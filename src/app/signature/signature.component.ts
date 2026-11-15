import { AfterViewInit, ChangeDetectionStrategy, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RouterExtensions } from '@nativescript/angular';
import { Screen } from '@nativescript/core';
import { DialogService } from '../services/dialog.service';
import { SignatureService } from '../services/signature.service';
import { SignaturePadComponent } from './signature-pad.component';

@Component({
  selector: 'app-signature',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './signature.component.html',
})
export class SignatureComponent implements AfterViewInit {
  private readonly signatures = inject(SignatureService);
  private readonly router = inject(RouterExtensions);

  /** ActionBar back arrow: navigate back through the Angular router. */
  goBack() {
    if (this.router.canGoBack()) this.router.back();
    else this.router.navigate(['/home'], { clearHistory: true } as any);
  }

  private readonly route = inject(ActivatedRoute);
  private readonly dialogs = inject(DialogService);

  @ViewChild('pad', { static: true }) pad: SignaturePadComponent;

  /** Ink palette: classic pen inks first, then brighter colours. */
  readonly colors = [
    // classic pen inks
    { name: 'Black', value: '#111827' },
    { name: 'Charcoal', value: '#374151' },
    { name: 'Navy', value: '#1e3a8a' },
    { name: 'Blue', value: '#2563eb' },
    { name: 'Sky', value: '#0284c7' },
    { name: 'Royal', value: '#4f46e5' },
    { name: 'Indigo', value: '#3730a3' },
    { name: 'Purple', value: '#7c3aed' },
    { name: 'Violet', value: '#6d28d9' },
    { name: 'Magenta', value: '#c026d3' },
    // warm
    { name: 'Pink', value: '#db2777' },
    { name: 'Red', value: '#b91c1c' },
    { name: 'Maroon', value: '#7f1d1d' },
    { name: 'Orange', value: '#ea580c' },
    { name: 'Gold', value: '#b45309' },
    { name: 'Brown', value: '#78350f' },
    // greens
    { name: 'Olive', value: '#4d7c0f' },
    { name: 'Green', value: '#15803d' },
    { name: 'Forest', value: '#14532d' },
    { name: 'Teal', value: '#0f766e' },
  ];
  readonly color = signal(this.colors[0].value);
  readonly colorName = computed(() => this.colors.find((c) => c.value === this.color())?.name || '');
  readonly thickness = signal(3);
  readonly hasInk = signal(false);
  /** True when the screen opened with the user's saved signature already on the pad. */
  readonly editingSaved = signal(false);
  /** Swatch cell size so 10 fit per row inside the tool card (screen - margins - padding). */
  readonly swatchCell = Math.floor((Screen.mainScreen.widthDIPs - 32 - 32) / 10);
  readonly minThickness = 1;
  readonly maxThickness = 9;

  setColor(c: string) {
    this.color.set(c);
    setTimeout(() => this.pad.redraw());
  }

  /** The native slider reports its min value while it is being set up; ignore events until then. */
  private sliderReady = false;

  ngAfterViewInit() {
    this.loadSaved();
    setTimeout(() => (this.sliderReady = true), 300);
  }

  /** If a signature is already saved, put it back on the pad (with its ink colour and thickness) to edit. */
  private loadSaved() {
    const saved = this.signatures.signature();
    if (!saved) return;
    const drawing = this.signatures.drawing();
    if (drawing) {
      if (this.colors.some((c) => c.value === drawing.color)) this.color.set(drawing.color);
      if (drawing.thickness >= this.minThickness && drawing.thickness <= this.maxThickness) this.thickness.set(drawing.thickness);
      this.pad.load(drawing.strokes, drawing.width, drawing.height);
    } else {
      this.pad.showPicture(saved.image);
    }
    this.editingSaved.set(true);
  }

  /** Slider drag: live-updates the stroke width (0.5 DIP steps). */
  onThickness(value: number) {
    if (!this.sliderReady) return;
    const v = Math.round(value * 2) / 2;
    if (v === this.thickness()) return;
    this.thickness.set(v);
    setTimeout(() => this.pad.redraw());
  }

  save() {
    // Old picture-only signature, nothing new drawn: keep it as it is.
    if (this.pad.showingPicture) return this.continue();
    const result = this.pad.export();
    if (!result) return;
    try {
      this.signatures.save(result.image, result.aspect, { ...this.pad.drawing(), color: this.color(), thickness: this.thickness() });
    } catch (e) {
      this.dialogs.error(e, 'Could not save signature');
      return;
    }
    this.continue();
  }

  private continue() {
    const next = this.route.snapshot.queryParamMap.get('next');
    if (next) {
      this.router.navigate([next], { clearHistory: false, replaceUrl: true } as any);
    } else {
      this.router.back();
    }
  }
}
