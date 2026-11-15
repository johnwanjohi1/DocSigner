import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterExtensions } from '@nativescript/angular';
import { Utils, isAndroid } from '@nativescript/core';
import { StoreProduct } from '../native/billing';
import { PLAN_FEATURES, PlanKey, ProService } from '../services/pro.service';

interface PlanCard {
  key: PlanKey;
  title: string;
  badge?: string;
  price: string;
  sub: string;
}

@Component({
  selector: 'app-paywall',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './paywall.component.html',
})
export class PaywallComponent implements OnInit {
  readonly pro = inject(ProService);
  private readonly router = inject(RouterExtensions);

  /** ActionBar back arrow: navigate back through the Angular router. */
  goBack() {
    if (this.router.canGoBack()) this.router.back();
    else this.router.navigate(['/home'], { clearHistory: true } as any);
  }


  readonly features = PLAN_FEATURES;
  readonly selected = signal<PlanKey>('yearly');
  readonly dev = __DEV__;

  readonly plans = computed<PlanCard[]>(() => {
    this.pro.products(); // re-evaluate when prices load
    const y = this.pro.product('yearly');
    const m = this.pro.product('monthly');
    const l = this.pro.product('lifetime');
    return [
      {
        key: 'yearly',
        title: 'Yearly',
        badge: 'BEST VALUE',
        price: y ? `${y.price} / year` : '— / year',
        sub: y ? [trialText(y), perMonth(y)].filter(Boolean).join(' · ') : 'Billed yearly',
      },
      { key: 'monthly', title: 'Monthly', price: m ? `${m.price} / month` : '— / month', sub: m ? trialText(m) || 'Cancel anytime' : 'Cancel anytime' },
      { key: 'lifetime', title: 'Lifetime', badge: 'PAY ONCE', price: l ? l.price : '—', sub: 'One payment, Pro forever' },
    ];
  });

  readonly cta = computed(() => {
    const p = this.pro.product(this.selected());
    if (p?.freeTrial) return `Start ${periodText(p.freeTrial)} free trial`;
    return this.selected() === 'lifetime' ? 'Unlock Pro forever' : 'Continue';
  });

  ngOnInit() {
    if (!this.pro.products().length) this.pro.init();
  }

  close() {
    this.router.back();
  }

  buy() {
    this.pro.buy(this.selected());
  }

  manage() {
    const pkg = isAndroid ? Utils.android.getApplicationContext().getPackageName() : '';
    Utils.openUrl(`https://play.google.com/store/account/subscriptions?package=${pkg}`);
  }

  isBool(v: unknown): v is boolean {
    return typeof v === 'boolean';
  }

  planName(): string {
    const p = this.pro.proPlan();
    return p === 'lifetime' ? 'Lifetime' : p === 'yearly' ? 'Yearly plan' : p === 'monthly' ? 'Monthly plan' : p === 'dev' ? 'Developer test' : 'Pro';
  }
}

function periodText(iso: string): string {
  const m = /^P(\d+)([DWMY])$/.exec(iso || '');
  if (!m) return '';
  const n = +m[1];
  const unit = { D: 'day', W: 'week', M: 'month', Y: 'year' }[m[2] as 'D'];
  return `${n}-${unit}`;
}

function trialText(p: StoreProduct): string {
  return p.freeTrial ? `${periodText(p.freeTrial)} free trial` : '';
}

function perMonth(p: StoreProduct): string {
  if (!p.priceMicros) return '';
  const monthly = p.priceMicros / 1e6 / 12;
  return `≈ ${p.currency} ${monthly.toFixed(2)} / month`;
}
