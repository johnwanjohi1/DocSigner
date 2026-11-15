import { AfterViewInit, Component, DestroyRef, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { RouterExtensions } from '@nativescript/angular';
import { Application, ApplicationSettings, CoreTypes, EventData, Screen, Utils, View, isAndroid } from '@nativescript/core';
import type { Drawer } from '@nativescript-community/ui-drawer';
import { filter } from 'rxjs/operators';
import { DocKind } from './native/files';
import { ActiveDialog, DialogService, shade, tint } from './services/dialog.service';
import { DocActionsService } from './services/doc-actions.service';
import { DrawerService } from './services/drawer.service';
import { ProService } from './services/pro.service';
import { INTRO_SEEN_KEY } from './intro/intro.component';
import { SignatureService } from './services/signature.service';
import { splashVisible } from './services/splash-state';

interface MenuItem {
  title: string;
  subtitle?: string;
  badge: string;
  color: string;
  route?: string;
  action?: () => void;
}

const EASE_OUT_BACK = CoreTypes.AnimationCurve.cubicBezier(0.34, 1.45, 0.64, 1);
const EASE_OUT = CoreTypes.AnimationCurve.cubicBezier(0.16, 1, 0.3, 1);

@Component({
  selector: 'ns-app',
  standalone: false,
  templateUrl: './app.component.html',
})
export class AppComponent implements AfterViewInit {
  private readonly router = inject(Router);
  private readonly routerExt = inject(RouterExtensions);
  private readonly drawerService = inject(DrawerService);
  private readonly actions = inject(DocActionsService);
  private readonly destroyRef = inject(DestroyRef);
  readonly signatures = inject(SignatureService);
  readonly pro = inject(ProService);
  readonly dialogs = inject(DialogService);
  readonly tint = tint;
  readonly shine = (c: string) => `linear-gradient(135deg, ${c}, ${shade(c)})`;
  /** Sheet bottom padding: clear Android's navigation bar (the app draws edge-to-edge). */
  readonly sheetBottom = signal(24);

  @ViewChild('drawer', { read: ElementRef }) drawerRef: ElementRef<Drawer>;

  readonly currentUrl = signal('/home');

  readonly navItems: MenuItem[] = [
    { title: 'Home', subtitle: 'Your signed files', badge: '⌂', color: '#4f46e5', route: '/home' },
    { title: 'My signature', subtitle: 'Draw or redraw', badge: '✎', color: '#7c3aed', route: '/signature' },
    { title: 'Help & how-to', subtitle: 'Guides, tips & support', badge: '?', color: '#0ea5e9', route: '/help' },
  ];

  readonly signItems: MenuItem[] = [
    { title: 'Scan a document', badge: 'SCAN', color: '#0ea5e9', action: () => this.actions.scan() },
    { title: 'Sign a PDF', badge: 'PDF', color: '#ef4444', action: () => this.actions.pickFile(['pdf'] as DocKind[]) },
    { title: 'Sign a Word document', badge: 'DOC', color: '#2563eb', action: () => this.actions.pickFile(['docx'] as DocKind[]) },
    { title: 'Sign a picture', badge: 'IMG', color: '#059669', action: () => this.actions.pickPhoto() },
    { title: 'Take a photo', badge: 'CAM', color: '#f59e0b', action: () => this.actions.takePhoto() },
  ];

  // ------------------------------------------------------------ splash
  readonly showSplash = signal(true);
  @ViewChild('splash', { read: ElementRef }) splashRef: ElementRef<View>;
  @ViewChild('cardPhoto', { read: ElementRef }) cardPhoto: ElementRef<View>;
  @ViewChild('cardWord', { read: ElementRef }) cardWord: ElementRef<View>;
  @ViewChild('cardPdf', { read: ElementRef }) cardPdf: ElementRef<View>;
  @ViewChild('pen', { read: ElementRef }) pen: ElementRef<View>;
  @ViewChild('title', { read: ElementRef }) titleRef: ElementRef<View>;
  @ViewChild('sigClip', { read: ElementRef }) sigClip: ElementRef<View>;
  @ViewChild('tagline', { read: ElementRef }) tagline: ElementRef<View>;
  @ViewChild('dots', { read: ElementRef }) dots: ElementRef<View>;
  private splashDone = false;

  // ------------------------------------------------------------ dialog
  private dlgBackdrop: View | null = null;
  private dlgCard: View | null = null;
  private dlgClosing = false;

  constructor() {
    let first = true;
    const sub = this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e: NavigationEnd) => {
      const url = e.urlAfterRedirects.split('?')[0];
      // First launch: once the initial route has settled (still under the splash), switch to the intro.
      if (first) {
        first = false;
        if (!ApplicationSettings.getBoolean(INTRO_SEEN_KEY, false) && url !== '/intro') {
          setTimeout(() => this.routerExt.navigate(['/intro'], { clearHistory: true, animated: false } as any), 0);
        }
      }
      this.currentUrl.set(url);
      // Swipe-to-open only on the home screen: elsewhere the user is drawing / dragging.
      this.drawerService.setGestureEnabled(url === '/home');
    });

    // Load store prices and re-validate Pro in the background.
    setTimeout(() => this.pro.init(), 1500);
    this.destroyRef.onDestroy(() => sub.unsubscribe());

    if (isAndroid) {
      // Always portrait (also declared in the manifest): re-applied whenever the activity resumes.
      const lockPortrait = (activity: any) => {
        try {
          activity?.setRequestedOrientation((global as any).android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        } catch (e) {
          console.error('orientation lock: ' + e);
        }
      };
      lockPortrait(Application.android.foregroundActivity || Application.android.startActivity);
      const onResume = (args: any) => lockPortrait(args.activity);
      Application.android.on(Application.android.activityResumedEvent, onResume);
      this.destroyRef.onDestroy(() => Application.android.off(Application.android.activityResumedEvent, onResume));

      const onBack = (args: any) => {
        if (this.showSplash()) {
          args.cancel = true;
        } else if (this.dialogs.current()) {
          args.cancel = true;
          this.closeDialog(null);
        } else if (this.drawerService.isOpen()) {
          args.cancel = true;
          this.drawerService.close();
        } else if (!this.routerExt.canGoBack()) {
          // Back on the first screen: send DocSigner to the background instead of destroying its screen.
          // Re-creating the Android activity in a live process left a blank window (NativeScript Angular
          // disposes the app on exit and doesn't rebuild it); keeping the activity means returning just resumes.
          args.cancel = true;
          (args.activity || Application.android.foregroundActivity)?.moveTaskToBack(true);
        }
      };
      Application.android.on(Application.android.activityBackPressedEvent, onBack);
      this.destroyRef.onDestroy(() => Application.android.off(Application.android.activityBackPressedEvent, onBack));
    }
  }

  ngAfterViewInit() {
    this.drawerService.register(this.drawerRef.nativeElement);
    this.readNavInset();
    setTimeout(() => this.playSplash(), 50);
  }

  /** Bottom padding for sheets so their buttons clear Android's navigation bar (the app draws edge-to-edge). */
  private readNavInset() {
    if (!isAndroid) return;
    let px = 0;
    try {
      const act = Application.android.foregroundActivity || Application.android.startActivity;
      const decor = act?.getWindow()?.getDecorView();
      const ins = decor && (global as any).androidx.core.view.ViewCompat.getRootWindowInsets(decor);
      if (ins) px = ins.getInsets((global as any).androidx.core.view.WindowInsetsCompat.Type.navigationBars()).bottom;
      if (!px) {
        // insets not attached yet: fall back to the system's navigation bar height
        const res = (act || Utils.android.getApplicationContext()).getResources();
        const id = res.getIdentifier('navigation_bar_height', 'dimen', 'android');
        if (id > 0) px = res.getDimensionPixelSize(id);
      }
    } catch (e) {
      console.log('nav inset: ' + e);
    }
    this.sheetBottom.set(24 + Math.round(px / Screen.mainScreen.scale));
  }

  // ------------------------------------------------------------ menu
  async onItem(item: MenuItem) {
    await this.drawerService.close();
    if (item.action) {
      item.action();
      return;
    }
    if (item.route === this.currentUrl()) return;
    if (item.route === '/home') {
      this.routerExt.navigate(['/home'], { clearHistory: true, animated: false } as any);
    } else {
      this.routerExt.navigate([item.route]);
    }
  }

  async openPro() {
    await this.drawerService.close();
    if (this.currentUrl() !== '/pro') this.routerExt.navigate(['/pro']);
  }

  async replayIntro() {
    await this.drawerService.close();
    this.routerExt.navigate(['/intro'], { clearHistory: true } as any);
  }

  /** Development builds only: recreate the Android activity (what Android does after some system changes). */
  devRecreate() {
    if (!__DEV__ || !isAndroid) return;
    this.drawerService.close();
    setTimeout(() => (Application.android.foregroundActivity as any)?.recreate(), 300);
  }

  async about() {
    await this.drawerService.close();
    this.dialogs.alert({
      title: 'DocSigner',
      message:
        'Sign PDFs, Word documents and pictures with your own hand-drawn signature.\n\nEverything stays on this device. Share signed files from the home screen.',
      tone: 'info',
      okText: 'Nice',
    });
  }

  // ------------------------------------------------------------ splash animation
  private async playSplash() {
    const v = (r: ElementRef<View>) => r?.nativeElement;
    const cards = [v(this.cardPhoto), v(this.cardWord), v(this.cardPdf)];
    if (cards.some((c) => !c)) return this.hideSplash();
    try {
      // initial state
      const fan = [
        { x: -88, r: -14 },
        { x: 88, r: 12 },
        { x: 0, r: -2 },
      ];
      cards.forEach((c, i) => {
        c.opacity = 0;
        c.translateY = 260;
        c.translateX = fan[i].x * 0.4;
        c.rotate = 0;
        c.scaleX = c.scaleY = 0.7;
      });
      for (const el of [v(this.titleRef), v(this.tagline), v(this.dots)]) {
        el.opacity = 0;
        el.translateY = 24;
      }
      const pen = v(this.pen);
      pen.opacity = 0;
      pen.translateX = -60;
      pen.translateY = 40;
      v(this.sigClip).width = 0;

      // cards fly in and fan out
      await Promise.all(
        cards.map((c, i) =>
          c.animate({
            opacity: 1,
            translate: { x: fan[i].x, y: 0 },
            rotate: fan[i].r,
            scale: { x: 1, y: 1 },
            duration: 650,
            delay: i * 110,
            curve: EASE_OUT_BACK,
          }),
        ),
      );
      // pen glides across while the signature is written
      await Promise.all([
        pen.animate({ opacity: 1, translate: { x: 0, y: 0 }, duration: 300, curve: EASE_OUT }),
        v(this.titleRef).animate({ opacity: 1, translate: { x: 0, y: 0 }, duration: 450, curve: EASE_OUT }),
      ]);
      await Promise.all([
        pen.animate({ translate: { x: 150, y: -6 }, duration: 700, curve: CoreTypes.AnimationCurve.easeInOut }),
        v(this.sigClip).animate({ width: 240, duration: 700, curve: CoreTypes.AnimationCurve.easeInOut }),
        v(this.tagline).animate({ opacity: 1, translate: { x: 0, y: 0 }, duration: 500, delay: 250, curve: EASE_OUT }),
        v(this.dots).animate({ opacity: 1, translate: { x: 0, y: 0 }, duration: 500, delay: 400, curve: EASE_OUT }),
      ]);
      await new Promise((r) => setTimeout(r, 650));
    } catch (e) {
      /* animation interrupted – just continue */
    }
    this.hideSplash();
  }

  skipSplash() {
    this.hideSplash();
  }

  private async hideSplash() {
    if (this.splashDone) return;
    this.splashDone = true;
    const s = this.splashRef?.nativeElement;
    if (s) {
      try {
        await s.animate({ opacity: 0, scale: { x: 1.08, y: 1.08 }, duration: 380, curve: EASE_OUT });
      } catch {
        /* ignore */
      }
    }
    this.showSplash.set(false);
    splashVisible.set(false);
  }

  // ------------------------------------------------------------ dialog animation
  onBackdropLoaded(args: EventData) {
    this.readNavInset();
    const b = args.object as View;
    this.dlgBackdrop = b;
    this.dlgClosing = false;
    b.opacity = 0;
    b.animate({ opacity: 1, duration: 180 });
  }

  onCardLoaded(args: EventData) {
    const c = args.object as View;
    this.dlgCard = c;
    c.translateY = 420;
    c.animate({ translate: { x: 0, y: 0 }, duration: 300, curve: EASE_OUT });
  }

  onBackdropTap(_d: ActiveDialog) {
    this.closeDialog(null);
  }

  /** Swallows taps on the card so they don't reach the backdrop. */
  noop() {}

  async closeDialog(value: string | null) {
    if (this.dlgClosing) return;
    this.dlgClosing = true;
    try {
      await Promise.all([
        this.dlgCard?.animate({ translate: { x: 0, y: 420 }, duration: 200, curve: CoreTypes.AnimationCurve.easeIn }),
        this.dlgBackdrop?.animate({ opacity: 0, duration: 180 }),
      ]);
    } catch {
      /* ignore */
    }
    this.dlgCard = this.dlgBackdrop = null;
    this.dialogs.settle(value);
  }
}
