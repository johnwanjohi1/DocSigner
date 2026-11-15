import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterExtensions } from '@nativescript/angular';
import { Utils } from '@nativescript/core';
import { shade, tint } from '../services/dialog.service';
import { HELP, HelpItem, HelpSection, SUPPORT_EMAIL } from './help-content';

type Section = HelpSection & { soft: string };

/** Help & how-to: every feature explained; searchable, sections and answers expand in place (as in Invoice Maker). */
@Component({
  selector: 'app-help',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './help.component.html',
})
export class HelpComponent {
  private readonly router = inject(RouterExtensions);

  readonly sections: Section[] = HELP.map((s) => ({ ...s, soft: tint(s.color) }));
  readonly supportEmail = SUPPORT_EMAIL;
  readonly query = signal('');
  readonly open = signal(new Set<string>()); // expanded sections
  readonly openItems = signal(new Set<string>()); // expanded answers ("section/index")

  readonly searching = computed(() => !!this.query().trim());

  /** Questions whose section title, question or answer contains every word typed. */
  readonly results = computed(() => {
    const words = this.query().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const out: { section: Section; item: HelpItem; key: string }[] = [];
    this.sections.forEach((s) =>
      s.items.forEach((item, i) => {
        const hay = (s.title + ' ' + s.summary + ' ' + item.q + ' ' + item.a).toLowerCase();
        if (words.every((w) => hay.includes(w))) out.push({ section: s, item, key: s.id + '/' + i });
      }),
    );
    return out;
  });

  grad(c: string) {
    return `linear-gradient(135deg, ${c}, ${shade(c)})`;
  }

  goBack() {
    if (this.router.canGoBack()) this.router.back();
    else this.router.navigate(['/home'], { clearHistory: true } as any);
  }

  onQuery(v: string) {
    this.query.set(v || '');
  }

  isOpen(id: string) {
    return this.open().has(id);
  }

  isItemOpen(key: string) {
    return this.openItems().has(key);
  }

  toggleSection(id: string) {
    const s = new Set(this.open());
    s.has(id) ? s.delete(id) : s.add(id);
    this.open.set(s);
  }

  toggleItem(key: string) {
    // A tap on the email link inside an open answer must not also collapse it. The row's tap can arrive before or
    // after the link's, so decide a moment later.
    setTimeout(() => {
      if (Date.now() - this.mailTapAt < 400) return;
      const s = new Set(this.openItems());
      s.has(key) ? s.delete(key) : s.add(key);
      this.openItems.set(s);
    }, 40);
  }

  replayIntro() {
    this.router.navigate(['/intro'], { clearHistory: true } as any);
  }

  private mailTapAt = 0;

  /** The tappable support address inside the "Contact support" answer. */
  emailSupport() {
    this.mailTapAt = Date.now();
    Utils.openUrl(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('DocSigner support')}`);
  }

  /** Opens an email to support, and expands Troubleshooting → Contact support. */
  contactSupport() {
    const trouble = HELP.find((s) => s.id === 'trouble')!;
    this.open.set(new Set([...this.open(), 'trouble']));
    this.openItems.set(new Set([...this.openItems(), 'trouble/' + (trouble.items.length - 1)]));
    this.emailSupport();
  }
}
