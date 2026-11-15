import { ChangeDetectionStrategy, Component, ElementRef, OnInit, QueryList, ViewChildren, computed, inject, signal } from '@angular/core';
import { RouterExtensions } from '@nativescript/angular';
import { ImageSource, PanGestureEventData, Screen, TapGestureEventData, View } from '@nativescript/core';
import { shareFile } from '../native/files';
import { loadPhoto, renderPdfPage, sizeOf } from '../native/imaging';
import { DialogService } from '../services/dialog.service';
import { DocBlock, DocRun, DocxDocument, PreviewService } from '../services/preview.service';
import { DocActionsService } from '../services/doc-actions.service';
import { ProService } from '../services/pro.service';
import { SignatureService } from '../services/signature.service';
import { DOCX_PLACEHOLDER, SigningService } from '../services/signing.service';

/**
 * Lets the user position and size their signature on a PDF page or photo
 * (drag to move, tap to jump, slider to resize), or choose options for a Word document.
 */
@Component({
  selector: 'app-sign',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sign.component.html',
})
export class SignComponent implements OnInit {
  private readonly signing = inject(SigningService);
  private readonly signatures = inject(SignatureService);
  private readonly router = inject(RouterExtensions);

  /** ActionBar back arrow: navigate back through the Angular router. */
  goBack() {
    if (this.router.canGoBack()) this.router.back();
    else this.router.navigate(['/home'], { clearHistory: true } as any);
  }

  private readonly dialogs = inject(DialogService);
  private readonly actions = inject(DocActionsService);
  readonly pro = inject(ProService);
  private readonly previews = inject(PreviewService);

  readonly file = this.signing.current;
  readonly sig = this.signatures.signature;
  readonly busy = signal(false);

  // ---- preview (pdf / image)
  readonly preview = signal<ImageSource | null>(null);
  readonly pageIndex = signal(0);
  readonly pageCount = signal(1);
  readonly pageDots = computed(() => Array.from({ length: this.pageCount() }, (_, i) => i));
  private readonly pageAspect = signal(1.414); // height / width of the displayed page
  readonly allPages = signal(false);
  readonly addCaption = signal(true);

  /** Signature placement, normalised to the page (0..1). */
  readonly posX = signal(0.55);
  readonly posY = signal(0.8);
  readonly sizePct = signal(30); // signature width as % of page width

  readonly maxW = Screen.mainScreen.widthDIPs - 32;
  readonly maxH = Screen.mainScreen.heightDIPs * 0.52;
  readonly viewW = computed(() => Math.min(this.maxW, this.maxH / this.pageAspect()));
  readonly viewH = computed(() => this.viewW() * this.pageAspect());
  readonly sigW = computed(() => (this.viewW() * this.sizePct()) / 100);
  readonly sigH = computed(() => this.sigW() / (this.sig()?.aspect || 3));
  readonly sigLeft = computed(() => this.posX() * this.viewW());
  readonly sigTop = computed(() => this.posY() * this.viewH());

  // ---- docx
  readonly docxWidthCm = signal(5);
  readonly hasPlaceholder = signal(false);
  readonly usePlaceholder = signal(true);
  readonly placeholder = DOCX_PLACEHOLDER;
  /** Word document laid out at page scale. */
  readonly docx = signal<DocxDocument | null>(null);
  readonly measuring = signal(false);
  /** Block indices on each page (filled after the measuring pass). */
  private readonly docxPages = signal<number[][]>([[]]);
  /** Top of each block within its page's content area (DIPs). */
  private blockTops: number[] = [];
  @ViewChildren('mb', { read: ElementRef }) measureBlocks: QueryList<ElementRef<View>>;
  /** DIPs per point at the current page view size. */
  readonly k = computed(() => (this.docx() ? this.viewW() / this.docx()!.layout.width : 1));
  readonly contentW = computed(() => {
    const d = this.docx();
    return d ? (d.layout.width - d.layout.marginLeft - d.layout.marginRight) * this.k() : 0;
  });
  readonly pageBlockIds = computed(() => this.docxPages()[this.pageIndex()] || []);
  readonly placeholderMode = computed(() => this.hasPlaceholder() && this.usePlaceholder());

  private panStart = { x: 0, y: 0 };

  async ngOnInit() {
    const f = this.file();
    if (!f) return;
    try {
      if (f.kind === 'pdf') {
        this.loadPage(0);
      } else if (f.kind === 'image') {
        const img = loadPhoto(f.path);
        const { width, height } = sizeOf(img);
        this.pageAspect.set(height / width);
        this.preview.set(img);
      } else {
        const doc = await this.previews.docxDocument(f.path);
        this.pageAspect.set(doc.layout.height / doc.layout.width);
        this.hasPlaceholder.set(await this.signing.docxHasPlaceholder(f));
        this.usePlaceholder.set(false); // default: sign on the page like a PDF
        this.measuring.set(true);
        this.docx.set(doc);
        setTimeout(() => this.paginate(), 250);
      }
      this.clampPosition();
    } catch (e) {
      this.fail(e);
    }
  }

  private loadPage(index: number) {
    const f = this.file()!;
    const page = renderPdfPage(f.path, index, Math.round(this.maxW * Screen.mainScreen.scale));
    this.pageCount.set(page.pageCount);
    this.pageIndex.set(index);
    this.pageAspect.set(page.height / page.width);
    this.preview.set(page.image);
  }

  prevPage() {
    if (this.pageIndex() <= 0) return;
    if (this.docx()) this.pageIndex.update((i) => i - 1);
    else this.loadPage(this.pageIndex() - 1);
  }

  nextPage() {
    if (this.pageIndex() >= this.pageCount() - 1) return;
    if (this.docx()) this.pageIndex.update((i) => i + 1);
    else this.loadPage(this.pageIndex() + 1);
  }

  /** Splits the measured Word blocks into pages (content height = page minus top/bottom margins). */
  private paginate(attempt = 0) {
    const d = this.docx();
    if (!d) return;
    const views = this.measureBlocks?.toArray() || [];
    const heights = views.map((v) => v.nativeElement.getActualSize().height);
    if ((views.length < d.blocks.length || heights.some((h) => !h)) && attempt < 10) {
      setTimeout(() => this.paginate(attempt + 1), 150);
      return;
    }
    const contentH = (d.layout.height - d.layout.marginTop - d.layout.marginBottom) * this.k();
    const pages: number[][] = [[]];
    const tops: number[] = [];
    let y = 0;
    d.blocks.forEach((b, i) => {
      const h = heights[i] || 0;
      const page = pages[pages.length - 1];
      if (page.length && (b.pb || y + h > contentH)) {
        pages.push([]);
        y = 0;
      }
      tops[i] = y;
      pages[pages.length - 1].push(i);
      y += h;
    });
    this.blockTops = tops;
    this.docxPages.set(pages);
    this.pageCount.set(pages.length);
    this.pageIndex.set(Math.min(this.pageIndex(), pages.length - 1));
    this.measuring.set(false);
  }

  /** Where the dropped signature lands in the Word file: anchor paragraph + offsets in points. */
  private docxAnchor(): { pi: number; xPt: number; yPt: number; widthPt: number } | undefined {
    const d = this.docx();
    if (!d) return undefined;
    const k = this.k();
    const ids = this.pageBlockIds().filter((i) => d.blocks[i].pi != null);
    if (!ids.length) return undefined;
    const yIn = this.sigTop() - d.layout.marginTop * k;
    let target = ids[0];
    for (const i of ids) if (this.blockTops[i] <= yIn) target = i;
    // measure from the top of the paragraph's first block on this page
    const first = ids.find((i) => d.blocks[i].pi === d.blocks[target].pi) ?? target;
    return {
      pi: d.blocks[target].pi!,
      xPt: this.sigLeft() / k,
      yPt: (yIn - this.blockTops[first]) / k,
      widthPt: this.sigW() / k,
    };
  }

  runSize(b: DocBlock & { type: 'p' }, r: DocRun): number {
    const pt = b.heading === 1 ? 20 : b.heading === 2 ? 16 : b.heading === 3 ? 13 : r.size || 11;
    return pt * this.k();
  }

  imgW(b: DocBlock & { type: 'img' }): number {
    return Math.min(this.contentW(), b.width * 0.75 * this.k());
  }

  cols(row: string[]): string {
    return row.map(() => '*').join(',');
  }

  onPan(args: PanGestureEventData) {
    if (args.state === 1) {
      this.panStart = { x: this.posX(), y: this.posY() };
    }
    this.posX.set(this.panStart.x + args.deltaX / this.viewW());
    this.posY.set(this.panStart.y + args.deltaY / this.viewH());
    this.clampPosition();
  }

  /**
   * A tap on the signature itself also reaches the page underneath, but with coordinates relative to the
   * signature image, which would snap it to the top-left corner. Taps on the signature leave it where it is.
   */
  private sigTapAt = 0;

  onSigTap() {
    this.sigTapAt = Date.now();
  }

  onPageTap(args: TapGestureEventData) {
    const x = (args as any).getX?.();
    const y = (args as any).getY?.();
    if (x == null || y == null) return;
    setTimeout(() => {
      if (Date.now() - this.sigTapAt < 400) return;
      this.posX.set((x - this.sigW() / 2) / this.viewW());
      this.posY.set((y - this.sigH() / 2) / this.viewH());
      this.clampPosition();
    }, 40);
  }

  onSize(value: number) {
    this.sizePct.set(Math.round(value));
    this.clampPosition();
  }

  private clampPosition() {
    const wN = this.sigW() / this.viewW();
    const hN = this.sigH() / this.viewH();
    this.posX.set(Math.max(0, Math.min(1 - wN, this.posX())));
    this.posY.set(Math.max(0, Math.min(1 - hN, this.posY())));
  }

  onDocxWidth(value: number) {
    this.docxWidthCm.set(Math.round(value));
  }

  previewOriginal() {
    const f = this.file();
    if (f) this.router.navigate(['/preview'], { queryParams: { path: f.path, name: f.name } });
  }

  editSignature() {
    this.router.navigate(['/signature']);
  }

  private caption(): string | undefined {
    if (!this.addCaption()) return undefined;
    return 'Signed ' + new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  async save() {
    const f = this.file();
    const sig = this.sig();
    if (!f || !sig) return;
    this.busy.set(true);
    try {
      const placement = {
        x: this.posX(),
        y: this.posY(),
        w: this.sigW() / this.viewW(),
        h: this.sigH() / this.viewH(),
      };
      let out: string;
      if (f.kind === 'pdf') {
        out = await this.signing.signPdf(f, sig, {
          pageIndex: this.pageIndex(),
          allPages: this.allPages(),
          placement,
          caption: this.caption(),
          watermark: this.pro.watermark,
        });
      } else if (f.kind === 'image') {
        out = await this.signing.signImage(f, sig, placement, this.pro.watermark);
      } else {
        out = await this.signing.signDocx(f, sig, {
          widthCm: this.docxWidthCm(),
          usePlaceholder: this.placeholderMode(),
          anchor: this.placeholderMode() ? undefined : this.docxAnchor(),
          caption: this.placeholderMode() ? this.caption() : undefined,
          watermark: this.pro.watermark,
        });
      }
      this.pro.recordSign(f.kind);
      this.signing.refreshSignedFiles();
      this.busy.set(false);
      const fileName = out.substring(out.lastIndexOf('/') + 1);
      const freeNote = this.pro.isPro() ? '' : `\n${this.pro.freeLeft()} free signing(s) left this month.`;
      const choice = await this.dialogs.choose({
        title: 'Signed!',
        message: `Saved in DocSigner as\n${fileName}${freeNote}`,
        tone: 'success',
        actions: [
          { text: 'Save to…', value: 'save', icon: '📁' },
          { text: 'Share / Open', value: 'share', icon: '↗' },
          { text: 'Done', value: 'done' },
        ],
      });
      if (choice === 'save') await this.actions.saveTo(out, fileName);
      else if (choice === 'share') shareFile(out);
      this.router.back();
    } catch (e) {
      this.busy.set(false);
      this.fail(e);
    }
  }

  private fail(e: any) {
    this.dialogs.error(e);
  }
}
