import { ChangeDetectionStrategy, Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RouterExtensions } from '@nativescript/angular';
import { CoreTypes, File, Image, ImageSource, PanGestureEventData, PinchGestureEventData, Screen } from '@nativescript/core';
import { DocKind, kindOf, shareFile } from '../native/files';
import { loadPhoto } from '../native/imaging';
import { DialogService } from '../services/dialog.service';
import { DocActionsService } from '../services/doc-actions.service';
import { DocBlock, DocRun, PreviewService, displayName, kindColor, kindLabel } from '../services/preview.service';
import { SigningService } from '../services/signing.service';

/** Full-screen preview of a PDF, photo or Word document. */
@Component({
  selector: 'app-preview',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './preview.component.html',
})
export class PreviewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(RouterExtensions);

  /** ActionBar back arrow: navigate back through the Angular router. */
  goBack() {
    if (this.router.canGoBack()) this.router.back();
    else this.router.navigate(['/home'], { clearHistory: true } as any);
  }

  private readonly previews = inject(PreviewService);
  private readonly signing = inject(SigningService);
  private readonly dialogs = inject(DialogService);
  private readonly actions = inject(DocActionsService);

  readonly path = signal('');
  readonly name = signal('');
  readonly kind = signal<DocKind | null>(null);
  /** true when previewing a signed file (shows Delete). */
  readonly isSigned = signal(false);
  readonly loading = signal(true);
  readonly title = computed(() => displayName(this.name()));
  readonly badge = computed(() => (this.kind() ? kindLabel(this.kind()!) : ''));
  readonly badgeColor = computed(() => (this.kind() ? kindColor(this.kind()!) : '#4f46e5'));

  // pdf
  readonly pages = signal<number[]>([]);
  private readonly pageWidthPx = Math.round((Screen.mainScreen.widthDIPs - 24) * Math.min(Screen.mainScreen.scale, 2.5));

  // image
  readonly photo = signal<ImageSource | null>(null);
  @ViewChild('photoView') photoView: ElementRef<Image>;
  private zoom = { scale: 1, x: 0, y: 0, startScale: 1, startX: 0, startY: 0 };

  // docx
  readonly blocks = signal<DocBlock[]>([]);
  readonly pageW = Screen.mainScreen.widthDIPs - 32;

  async ngOnInit() {
    const q = this.route.snapshot.queryParamMap;
    const path = q.get('path') || '';
    this.path.set(path);
    this.name.set(q.get('name') || path.substring(path.lastIndexOf('/') + 1));
    this.isSigned.set(q.get('signed') === '1');
    this.kind.set(kindOf(this.name()) || kindOf(path));
    try {
      if (!File.exists(path)) throw new Error('This file no longer exists.');
      switch (this.kind()) {
        case 'pdf': {
          const n = this.previews.pdfPageCount(path);
          this.pages.set(Array.from({ length: n }, (_, i) => i));
          break;
        }
        case 'image':
          this.photo.set(loadPhoto(path));
          break;
        case 'docx':
          this.blocks.set(await this.previews.docxBlocks(path));
          break;
        default:
          throw new Error('This file type cannot be previewed.');
      }
    } catch (e) {
      await this.dialogs.error(e, 'Cannot preview');
      this.router.back();
    } finally {
      this.loading.set(false);
    }
  }

  // ------------------------------------------------------------ pdf
  page(i: number): ImageSource {
    return this.previews.pdfPage(this.path(), i, this.pageWidthPx);
  }

  // ------------------------------------------------------------ photo zoom
  onPinch(args: PinchGestureEventData) {
    if (args.state === 1) this.zoom.startScale = this.zoom.scale;
    this.zoom.scale = Math.max(1, Math.min(5, this.zoom.startScale * args.scale));
    this.applyZoom();
  }

  onPan(args: PanGestureEventData) {
    if (this.zoom.scale <= 1) return;
    if (args.state === 1) {
      this.zoom.startX = this.zoom.x;
      this.zoom.startY = this.zoom.y;
    }
    this.zoom.x = this.zoom.startX + args.deltaX;
    this.zoom.y = this.zoom.startY + args.deltaY;
    this.applyZoom();
  }

  onDoubleTap() {
    const zoomed = this.zoom.scale > 1;
    this.zoom = { ...this.zoom, scale: zoomed ? 1 : 2.5, x: 0, y: 0 };
    this.photoView?.nativeElement.animate({
      scale: { x: this.zoom.scale, y: this.zoom.scale },
      translate: { x: 0, y: 0 },
      duration: 220,
      curve: CoreTypes.AnimationCurve.easeOut,
    });
  }

  private applyZoom() {
    const v = this.photoView?.nativeElement;
    if (!v) return;
    if (this.zoom.scale === 1) this.zoom.x = this.zoom.y = 0;
    v.scaleX = v.scaleY = this.zoom.scale;
    v.translateX = this.zoom.x;
    v.translateY = this.zoom.y;
  }

  // ------------------------------------------------------------ docx helpers
  fontSize(block: DocBlock & { type: 'p' }, run: DocRun): number {
    const base = block.heading === 1 ? 22 : block.heading === 2 ? 18 : block.heading === 3 ? 16 : run.size || 11;
    return Math.max(9, Math.min(28, base * 1.15));
  }

  imgWidth(block: DocBlock & { type: 'img' }): number {
    return Math.min(this.pageW - 32, block.width);
  }

  columns(row: string[]): string {
    return row.map(() => '*').join(',');
  }

  // ------------------------------------------------------------ actions
  share() {
    try {
      shareFile(this.path());
    } catch (e) {
      this.dialogs.error(e);
    }
  }

  saveTo() {
    this.actions.saveTo(this.path(), this.name());
  }

  async remove() {
    const ok = await this.dialogs.confirm({
      title: 'Delete this file?',
      message: `"${this.title()}" will be removed from this device.`,
      tone: 'delete',
      okText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    this.previews.forget(this.path());
    this.signing.deleteSigned(this.path());
    this.router.back();
  }
}
