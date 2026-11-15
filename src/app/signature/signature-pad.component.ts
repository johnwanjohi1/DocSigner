import { Component, ElementRef, ViewChild, input, output } from '@angular/core';
import { GridLayout, Image, Screen, TouchGestureEventData } from '@nativescript/core';
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

  private strokes: Stroke[] = [];
  private renderQueued = false;
  empty = true;

  onTouch(args: TouchGestureEventData) {
    const x = args.getX(),
      y = args.getY();
    switch (args.action) {
      case 'down':
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
    this.strokes = [];
    this.inkRef.nativeElement.imageSource = null;
    this.setEmpty(true);
  }

  undo() {
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
