import { Component, ElementRef, ViewChild, input, output } from '@angular/core';
import { GridLayout, Image, ImageSource, Screen, TouchGestureEventData } from '@nativescript/core';
import { RenderedSignature, Stroke, renderStrokes } from '../native/imaging';

/**
 * Finger-drawing signature pad. Touch points are collected in DIPs and rendered natively
 * (Android Canvas / iOS UIBezierPath) into a bitmap that is shown live.
 */
@Component({
  selector: 'app-signature-pad',
  standalone: false,
  templateUrl: './signature-pad.component.html',
})
export class SignaturePadComponent {
  readonly color = input('#111827');
  readonly lineWidth = input(3);
  readonly changed = output<boolean>();

  @ViewChild('pad', { static: true }) padRef: ElementRef<GridLayout>;
  @ViewChild('ink', { static: true }) inkRef: ElementRef<Image>;
  @ViewChild('saved', { static: true }) savedRef: ElementRef<Image>;

  private strokes: Stroke[] = [];
  private renderQueued = false;
  empty = true;
  /** An older saved signature that only exists as a picture: shown until the user starts drawing. */
  private pictureShown = false;

  /** Puts a saved drawing back on the pad, scaled to fit and centred if the pad size changed. */
  load(strokes: Stroke[], srcWidth: number, srcHeight: number) {
    this.whenSized((w, h) => {
      const k = Math.min(w / srcWidth, h / srcHeight);
      const ox = (w - srcWidth * k) / 2;
      const oy = (h - srcHeight * k) / 2;
      this.strokes = strokes.map((st) => st.map((p) => ({ x: ox + p.x * k, y: oy + p.y * k })));
      this.setEmpty(this.strokes.length === 0);
      this.queueRender();
    });
  }

  /** Shows a saved signature picture (no strokes available). It is replaced as soon as the user draws. */
  showPicture(image: ImageSource) {
    this.savedRef.nativeElement.imageSource = image;
    this.savedRef.nativeElement.visibility = 'visible';
    this.pictureShown = true;
    this.setEmpty(false);
  }

  /** What is on the pad, for saving alongside the PNG. */
  drawing(): { strokes: Stroke[]; width: number; height: number } {
    const size = this.padRef.nativeElement.getActualSize();
    return { strokes: this.strokes.map((st) => st.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }))), width: size.width, height: size.height };
  }

  /** True while only the old picture is shown (nothing new drawn). */
  get showingPicture() {
    return this.pictureShown;
  }

  onTouch(args: TouchGestureEventData) {
    const x = args.getX(),
      y = args.getY();
    switch (args.action) {
      case 'down':
        if (this.pictureShown) this.hidePicture();
        this.strokes.push([{ x, y }]);
        this.setEmpty(false);
        break;
      case 'move': {
        const s = this.strokes[this.strokes.length - 1];
        if (!s) return;
        const last = s[s.length - 1];
        if (Math.abs(last.x - x) + Math.abs(last.y - y) < 1.5) return; // ignore jitter
        s.push({ x, y });
        break;
      }
      default:
        break;
    }
    this.queueRender();
  }

  clear() {
    this.hidePicture();
    this.strokes = [];
    this.inkRef.nativeElement.imageSource = null;
    this.setEmpty(true);
  }

  undo() {
    if (this.pictureShown && !this.strokes.length) return; // nothing drawn yet: keep the saved picture
    this.strokes.pop();
    this.setEmpty(this.strokes.length === 0);
    this.queueRender();
  }

  /** Re-render with a new colour (called when the user switches ink colour). */
  redraw() {
    this.queueRender();
  }

  /** Exports the signature cropped to its ink, rendered at 3x for crisp output. */
  export(): RenderedSignature | null {
    return renderStrokes(this.strokes, {
      width: 0,
      height: 0,
      scale: 3,
      color: this.color(),
      lineWidth: this.lineWidth(),
      crop: true,
    });
  }

  private hidePicture() {
    if (!this.pictureShown) return;
    this.pictureShown = false;
    this.savedRef.nativeElement.imageSource = null;
    this.savedRef.nativeElement.visibility = 'collapse';
  }

  /** Runs fn once the pad has been laid out (its size is needed to place strokes). */
  private whenSized(fn: (w: number, h: number) => void, tries = 0) {
    const size = this.padRef.nativeElement.getActualSize();
    if (size.width && size.height) fn(size.width, size.height);
    else if (tries < 40) setTimeout(() => this.whenSized(fn, tries + 1), 50);
  }

  private setEmpty(empty: boolean) {
    if (this.empty !== empty) {
      this.empty = empty;
      this.changed.emit(!empty);
    }
  }

  private queueRender() {
    if (this.renderQueued) return;
    this.renderQueued = true;
    setTimeout(() => {
      this.renderQueued = false;
      const size = this.padRef.nativeElement.getActualSize();
      if (!size.width || !size.height) return;
      const r = renderStrokes(this.strokes, {
        width: size.width,
        height: size.height,
        scale: Screen.mainScreen.scale,
        color: this.color(),
        lineWidth: this.lineWidth(),
      });
      this.inkRef.nativeElement.imageSource = r ? r.image : null;
    }, 16);
  }
}
