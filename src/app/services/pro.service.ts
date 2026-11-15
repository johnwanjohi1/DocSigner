import { Injectable, computed, inject, signal } from '@angular/core';
import { RouterExtensions } from '@nativescript/angular';
import { ApplicationSettings } from '@nativescript/core';
import { OwnedPurchase, StoreProduct, billing } from '../native/billing';
import { DocKind } from '../native/files';
import { DialogService } from './dialog.service';

export const PRODUCT_IDS = {
  monthly: 'docsigner_pro_monthly',
  yearly: 'docsigner_pro_yearly',
  lifetime: 'docsigner_pro_lifetime',
};
export type PlanKey = keyof typeof PRODUCT_IDS;

/** Free plan: this many signed documents per calendar month. */
export const FREE_MONTHLY_LIMIT = 3;

/** Free plan: this many Word (.docx) documents in total, then Word is locked until Pro. */
export const FREE_DOCX_LIMIT = 3;

export interface PlanFeature {
  title: string;
  free: string | boolean;
  pro: string | boolean;
}

export const PLAN_FEATURES: PlanFeature[] = [
  { title: 'Sign PDFs & pictures', free: true, pro: true },
  { title: 'Signed documents', free: `${FREE_MONTHLY_LIMIT} / month`, pro: 'Unlimited' },
  { title: 'Sign Word (.docx) files', free: `${FREE_DOCX_LIMIT} docs`, pro: 'Unlimited' },
  { title: 'No "Signed with DocSigner" mark', free: false, pro: true },
  { title: 'Preview & share', free: true, pro: true },
];

/**
 * Free vs Pro. The Pro flag is cached locally and re-checked against Google Play on every launch,
 * so refunds / expired subscriptions turn Pro off again.
 */
@Injectable({ providedIn: 'root' })
export class ProService {
  private readonly dialogs = inject(DialogService);
  private readonly router = inject(RouterExtensions);

  readonly isPro = signal(ApplicationSettings.getBoolean('pro.active', false));
  readonly proPlan = signal<string>(ApplicationSettings.getString('pro.plan', ''));
  readonly products = signal<StoreProduct[]>([]);
  readonly storeError = signal('');
  readonly busy = signal(false);
  readonly storeAvailable = billing.available;

  private readonly usage = signal(this.readUsage());
  readonly usedThisMonth = computed(() => this.usage());
  readonly freeLeft = computed(() => Math.max(0, FREE_MONTHLY_LIMIT - this.usage()));
  private readonly docxUsage = signal(ApplicationSettings.getNumber('usage.docx.total', 0));
  readonly docxLeft = computed(() => Math.max(0, FREE_DOCX_LIMIT - this.docxUsage()));

  constructor() {
    billing.setPurchaseListener((owned, err) => {
      this.busy.set(false);
      if (err) {
        if (!err.cancelled) this.dialogs.alert({ title: 'Purchase failed', message: err.message || `Error ${err.code}`, tone: 'danger' });
        return;
      }
      if (this.apply(owned)) {
        this.dialogs.alert({
          title: 'Welcome to DocSigner Pro!',
          message: 'Unlimited signing, Word documents and no watermark are now unlocked.',
          tone: 'pro',
          okText: 'Start signing',
        });
      }
    });
  }

  /** Called at start-up: loads store prices and re-validates ownership. */
  async init() {
    if (!billing.available) return;
    try {
      this.products.set(await billing.queryProducts([PRODUCT_IDS.monthly, PRODUCT_IDS.yearly], [PRODUCT_IDS.lifetime]));
      this.apply(await billing.owned(), true);
      this.storeError.set('');
    } catch (e) {
      this.storeError.set(String((e as any)?.message || e));
    }
  }

  product(plan: PlanKey): StoreProduct | undefined {
    return this.products().find((p) => p.id === PRODUCT_IDS[plan]);
  }

  async buy(plan: PlanKey) {
    const p = this.product(plan);
    if (!p) {
      await this.dialogs.alert({
        title: 'Store not ready',
        message: this.storeError() || 'Prices are still loading from Google Play. Check your connection and try again.',
        tone: 'warning',
      });
      this.init();
      return;
    }
    this.busy.set(true);
    try {
      await billing.purchase(p);
    } catch (e) {
      this.busy.set(false);
      this.dialogs.error(e, 'Purchase failed');
    }
  }

  async restore() {
    this.busy.set(true);
    try {
      const had = this.isPro();
      this.apply(await billing.owned(), true);
      await this.dialogs.alert(
        this.isPro()
          ? { title: had ? 'Pro is active' : 'Purchases restored', message: 'Thanks for supporting DocSigner!', tone: 'pro' }
          : { title: 'No purchases found', message: 'This Google account has no DocSigner Pro purchase.', tone: 'info' },
      );
    } catch (e) {
      this.dialogs.error(e, 'Could not restore');
    } finally {
      this.busy.set(false);
    }
  }

  /** Development builds only: flip Pro on/off to test both plans without a Play Store purchase. */
  devToggle() {
    if (!__DEV__) return;
    this.setPro(!this.isPro(), this.isPro() ? '' : 'dev');
  }

  // ------------------------------------------------------------ gates

  /** True when the user may sign this kind of file now; otherwise shows the upgrade sheet. */
  async canSign(kind: DocKind): Promise<boolean> {
    if (this.isPro()) return true;
    if (kind === 'docx' && this.docxLeft() <= 0) {
      return this.upsell(
        `You've used your ${FREE_DOCX_LIMIT} free Word signings`,
        'Word signing is now locked on the Free plan. Go Pro for unlimited Word documents, unlimited signing and no watermark.',
      );
    }
    if (this.freeLeft() <= 0) {
      return this.upsell(
        `You've used your ${FREE_MONTHLY_LIMIT} free signings`,
        'Your free signings reset next month. Go Pro for unlimited signing with no watermark.',
      );
    }
    return true;
  }

  /** Watermark free-plan output. */
  get watermark(): boolean {
    return !this.isPro();
  }

  recordSign(kind?: DocKind) {
    if (this.isPro()) return;
    const n = this.readUsage() + 1;
    ApplicationSettings.setNumber(this.usageKey(), n);
    this.usage.set(n);
    if (kind === 'docx') {
      const d = this.docxUsage() + 1;
      ApplicationSettings.setNumber('usage.docx.total', d);
      this.docxUsage.set(d);
    }
  }

  openPaywall() {
    this.router.navigate(['/pro']);
  }

  private async upsell(title: string, message: string): Promise<boolean> {
    const go = await this.dialogs.confirm({ title, message, tone: 'pro', okText: 'See Pro plans', cancelText: 'Not now' });
    if (go) this.openPaywall();
    return false;
  }

  // ------------------------------------------------------------ internals

  /** Updates the Pro flag from owned purchases. Returns true when Pro became active. */
  private apply(owned: OwnedPurchase[], authoritative = false): boolean {
    const ids = Object.values(PRODUCT_IDS);
    const hit = owned.find((p) => p.productIds.some((id) => ids.includes(id)));
    const was = this.isPro();
    if (hit) {
      const plan = (Object.keys(PRODUCT_IDS) as PlanKey[]).find((k) => hit.productIds.includes(PRODUCT_IDS[k])) || '';
      this.setPro(true, plan);
    } else if (authoritative && this.proPlan() !== 'dev') {
      this.setPro(false, '');
    }
    return !was && this.isPro();
  }

  private setPro(on: boolean, plan: string) {
    ApplicationSettings.setBoolean('pro.active', on);
    ApplicationSettings.setString('pro.plan', plan);
    this.isPro.set(on);
    this.proPlan.set(plan);
  }

  private usageKey() {
    const d = new Date();
    return `usage.${d.getFullYear()}-${d.getMonth() + 1}`;
  }

  private readUsage() {
    return ApplicationSettings.getNumber(this.usageKey(), 0);
  }
}
