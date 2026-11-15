import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { RouterExtensions } from '@nativescript/angular';
import { Application, ApplicationSettings, CoreTypes, Page, Screen, SwipeGestureEventData, View } from '@nativescript/core';
import { FREE_DOCX_LIMIT, FREE_MONTHLY_LIMIT } from '../services/pro.service';
import { splashVisible } from '../services/splash-state';

export const INTRO_SEEN_KEY = 'intro.seen.v1';

interface IntroPage {
  key: 'sign' | 'docs' | 'share' | 'pro';
  title: string;
  body: string;
}

const EASE = CoreTypes.AnimationCurve.cubicBezier(0.16, 1, 0.3, 1);
const POP = CoreTypes.AnimationCurve.cubicBezier(0.34, 1.45, 0.64, 1);
/** How long each page stays before the intro moves on by itself. */
const AUTO_ADVANCE_MS = 5000;
const TICK_MS = 50;
/** Width of the active dot (see .intro-dot-on in app.css); its white fill grows across it as a countdown. */
export const ACTIVE_DOT_WIDTH = 26;

/** First-launch onboarding: four swipeable pages that also advance on their own, dots, Skip / Next / Get started. */
@Component({
  selector: 'app-intro',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './intro.component.html',
})
export class IntroComponent implements AfterViewInit {
  private readonly router = inject(RouterExtensions);
  private readonly page = inject(Page);
  private readonly destroyRef = inject(DestroyRef);

  readonly W = Screen.mainScreen.widthDIPs;
  readonly freeLimit = FREE_MONTHLY_LIMIT;
  readonly docxLimit = FREE_DOCX_LIMIT;
  readonly pages: IntroPage[] = [
    {
      key: 'sign',
      title: 'Your signature,\neverywhere',
      body: 'Draw it once with your finger. Pick any ink colour and thickness — it’s saved securely on your phone.',
    },
    {
      key: 'docs',
      title: 'Sign PDFs\n& pictures',
      body: 'Open a contract, form or photo, then drag your signature exactly where it belongs. Sign one page or all of them.',
    },
    {
      key: 'share',
      title: 'Preview & share\nin seconds',
      body: 'Flip through the signed pages, then send them by WhatsApp, email or Drive straight from the app.',
    },
    {
      key: 'pro',
      title: 'Free to start,\nPro when you need it',
      body: '',
    },
  ];
  readonly index = signal(0);
  readonly current = computed(() => this.pages[this.index()]);
  private animating = false;

  /** 0..1: how far the current page is through its auto-advance time; drawn as the fill of the active dot. */
  readonly progress = signal(0);
  readonly dotFill = computed(() => ACTIVE_DOT_WIDTH * (this.index() < this.pages.length - 1 ? this.progress() : 1));
  private elapsed = 0;

  @ViewChild('stage', { read: ElementRef }) stage: ElementRef<View>;
  @ViewChild('art', { read: ElementRef }) art: ElementRef<View>;
  @ViewChild('copy', { read: ElementRef }) copy: ElementRef<View>;

  constructor() {
    this.page.actionBarHidden = true;
    // Auto-advance. The clock only runs while the page is really visible: not under the first-launch splash,
    // not while the app is in the background, not mid-transition. It stops on the last page, which needs a choice.
    const timer = setInterval(() => {
      if (splashVisible() || Application.inBackground || this.animating) return;
      if (this.index() >= this.pages.length - 1) return;
      this.elapsed += TICK_MS;
      this.progress.set(Math.min(1, this.elapsed / AUTO_ADVANCE_MS));
      if (this.elapsed >= AUTO_ADVANCE_MS) this.go(this.index() + 1);
    }, TICK_MS);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  ngAfterViewInit() {
    setTimeout(() => this.animateIn(), 50);
  }

  onSwipe(args: SwipeGestureEventData) {
    if (args.direction === 2) this.go(this.index() + 1); // left
    else if (args.direction === 1) this.go(this.index() - 1); // right
  }

  next() {
    if (this.index() < this.pages.length - 1) this.go(this.index() + 1);
    else this.finish(false);
  }

  async go(i: number) {
    if (i < 0 || i >= this.pages.length || i === this.index() || this.animating) return;
    this.animating = true;
    // Any page change (automatic, swipe, Next or a dot) gives the new page its full time.
    this.elapsed = 0;
    this.progress.set(0);
    const dir = i > this.index() ? 1 : -1;
    const stage = this.stage?.nativeElement;
    try {
      await stage?.animate({ translate: { x: -dir * this.W * 0.35, y: 0 }, opacity: 0, duration: 180, curve: CoreTypes.AnimationCurve.easeIn });
    } catch {
      /* ignore */
    }
    this.index.set(i);
    if (stage) {
      stage.translateX = dir * this.W * 0.35;
      stage.opacity = 0;
    }
    setTimeout(() => {
      stage?.animate({ translate: { x: 0, y: 0 }, opacity: 1, duration: 360, curve: EASE });
      this.animateIn();
      this.animating = false;
    }, 16);
  }

  finish(showPro: boolean) {
    ApplicationSettings.setBoolean(INTRO_SEEN_KEY, true);
    this.router.navigate(['/home'], { clearHistory: true, transition: { name: 'fade', duration: 250 } } as any).then(() => {
      if (showPro) setTimeout(() => this.router.navigate(['/pro']), 150);
    });
  }

  private animateIn() {
    const art = this.art?.nativeElement;
    const copy = this.copy?.nativeElement;
    // On first launch the intro is built under the splash: wait until the views are attached.
    if ((art && !art.isLoaded) || (copy && !copy.isLoaded) || !art || !copy) {
      setTimeout(() => this.animateIn(), 120);
      return;
    }
    const settle = (v: View) => {
      v.opacity = 1;
      v.scaleX = v.scaleY = 1;
      v.translateY = 0;
    };
    art.opacity = 0;
    art.scaleX = art.scaleY = 0.8;
    art.translateY = 30;
    art.animate({ opacity: 1, scale: { x: 1, y: 1 }, translate: { x: 0, y: 0 }, duration: 520, delay: 80, curve: POP }).catch(() => settle(art));
    copy.opacity = 0;
    copy.translateY = 24;
    copy.animate({ opacity: 1, translate: { x: 0, y: 0 }, duration: 420, delay: 180, curve: EASE }).catch(() => settle(copy));
    // safety net: never leave the page invisible if an animation is cancelled (e.g. by the splash fade)
    setTimeout(() => {
      if (art.opacity < 1) settle(art);
      if (copy.opacity < 1) settle(copy);
    }, 1200);
  }
}
