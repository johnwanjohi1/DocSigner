/**
 * Minimal Google Play Billing Library 8 wrapper (Android). iOS (StoreKit) is not wired up yet: every call
 * there reports "store unavailable", so the app simply stays on the Free plan on iOS.
 *
 * Products must exist in Play Console with these ids (see README):
 *   subscriptions: docsigner_pro_monthly, docsigner_pro_yearly
 *   one-time:      docsigner_pro_lifetime
 */
import { Application, Utils, isAndroid } from '@nativescript/core';

declare const com: any, java: any;

export type ProductKind = 'subs' | 'inapp';

export interface StoreProduct {
  id: string;
  kind: ProductKind;
  title: string;
  /** Formatted recurring / one-time price, e.g. "KES 499.00". */
  price: string;
  priceMicros: number;
  currency: string;
  /** ISO-8601 billing period for subscriptions ("P1M", "P1Y"). */
  period?: string;
  /** ISO-8601 free-trial length when the chosen offer has one ("P7D"). */
  freeTrial?: string;
  /** @internal */
  native: any;
  /** @internal subscription offer token used to launch the purchase flow */
  offerToken?: string;
}

export interface OwnedPurchase {
  productIds: string[];
  token: string;
  acknowledged: boolean;
  autoRenewing: boolean;
}

type PurchaseCallback = (purchases: OwnedPurchase[], error?: { code: number; message: string; cancelled: boolean }) => void;

const OK = 0;
const USER_CANCELED = 1;

class AndroidBilling {
  private client: any;
  private ready: Promise<void> | null = null;
  private onPurchases: PurchaseCallback = () => {};

  get available() {
    return isAndroid;
  }

  setPurchaseListener(cb: PurchaseCallback) {
    this.onPurchases = cb;
  }

  connect(): Promise<void> {
    if (this.ready) return this.ready;
    const B = com.android.billingclient.api;
    this.ready = new Promise<void>((resolve, reject) => {
      const listener = new B.PurchasesUpdatedListener({
        onPurchasesUpdated: (result: any, purchases: any) => {
          const code = result.getResponseCode();
          if (code === OK && purchases) {
            const list = toArray(purchases).map(toOwned);
            list.filter((p) => !p.acknowledged).forEach((p) => this.acknowledge(p.token));
            this.onPurchases(list.filter(Boolean));
          } else {
            this.onPurchases([], { code, message: result.getDebugMessage() || '', cancelled: code === USER_CANCELED });
          }
        },
      });
      this.client = B.BillingClient.newBuilder(Utils.android.getApplicationContext())
        .setListener(listener)
        .enablePendingPurchases(B.PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
        .enableAutoServiceReconnection()
        .build();
      this.client.startConnection(
        new B.BillingClientStateListener({
          onBillingSetupFinished: (r: any) => {
            if (r.getResponseCode() === OK) resolve();
            else {
              this.ready = null;
              reject(new Error(`Google Play Billing is unavailable (${r.getResponseCode()}): ${r.getDebugMessage()}`));
            }
          },
          onBillingServiceDisconnected: () => {
            /* auto reconnection is enabled */
          },
        }),
      );
    });
    return this.ready;
  }

  async queryProducts(subs: string[], inapp: string[]): Promise<StoreProduct[]> {
    await this.connect();
    const [a, b] = await Promise.all([this.query(subs, 'subs'), this.query(inapp, 'inapp')]);
    return [...a, ...b];
  }

  private query(ids: string[], kind: ProductKind): Promise<StoreProduct[]> {
    if (!ids.length) return Promise.resolve([]);
    const B = com.android.billingclient.api;
    const type = kind === 'subs' ? B.BillingClient.ProductType.SUBS : B.BillingClient.ProductType.INAPP;
    const list = new java.util.ArrayList();
    ids.forEach((id) => list.add(B.QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(type).build()));
    const params = B.QueryProductDetailsParams.newBuilder().setProductList(list).build();
    return new Promise((resolve, reject) => {
      this.client.queryProductDetailsAsync(
        params,
        new B.ProductDetailsResponseListener({
          onProductDetailsResponse: (r: any, result: any) => {
            if (r.getResponseCode() !== OK) return reject(new Error(r.getDebugMessage() || 'Could not load products'));
            const details = result && result.getProductDetailsList ? result.getProductDetailsList() : result;
            resolve(toArray(details).map((d: any) => toProduct(d, kind)).filter(Boolean) as StoreProduct[]);
          },
        }),
      );
    });
  }

  async purchase(product: StoreProduct): Promise<void> {
    await this.connect();
    const B = com.android.billingclient.api;
    const pdp = B.BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product.native);
    if (product.offerToken) pdp.setOfferToken(product.offerToken);
    const list = new java.util.ArrayList();
    list.add(pdp.build());
    const flow = B.BillingFlowParams.newBuilder().setProductDetailsParamsList(list).build();
    const r = this.client.launchBillingFlow(Application.android.foregroundActivity, flow);
    if (r.getResponseCode() !== OK) throw new Error(r.getDebugMessage() || `Purchase could not start (${r.getResponseCode()})`);
  }

  /** Everything the user currently owns (active subscriptions + lifetime). */
  async owned(): Promise<OwnedPurchase[]> {
    await this.connect();
    const B = com.android.billingclient.api;
    const q = (type: string) =>
      new Promise<OwnedPurchase[]>((resolve, reject) => {
        this.client.queryPurchasesAsync(
          B.QueryPurchasesParams.newBuilder().setProductType(type).build(),
          new B.PurchasesResponseListener({
            onQueryPurchasesResponse: (r: any, list: any) => {
              if (r.getResponseCode() !== OK) return reject(new Error(r.getDebugMessage() || 'Could not restore purchases'));
              resolve(toArray(list).map(toOwned).filter(Boolean));
            },
          }),
        );
      });
    const all = [...(await q(B.BillingClient.ProductType.SUBS)), ...(await q(B.BillingClient.ProductType.INAPP))];
    all.filter((p) => !p.acknowledged).forEach((p) => this.acknowledge(p.token));
    return all;
  }

  private acknowledge(token: string) {
    const B = com.android.billingclient.api;
    this.client.acknowledgePurchase(
      B.AcknowledgePurchaseParams.newBuilder().setPurchaseToken(token).build(),
      new B.AcknowledgePurchaseResponseListener({ onAcknowledgePurchaseResponse: () => {} }),
    );
  }
}

class UnavailableBilling {
  get available() {
    return false;
  }
  setPurchaseListener() {}
  connect(): Promise<void> {
    return Promise.reject(new Error('In-app purchases are not available on this platform yet.'));
  }
  queryProducts(): Promise<StoreProduct[]> {
    return this.connect() as any;
  }
  purchase(): Promise<void> {
    return this.connect();
  }
  owned(): Promise<OwnedPurchase[]> {
    return this.connect() as any;
  }
}

export const billing = isAndroid ? new AndroidBilling() : new UnavailableBilling();

// ---------------------------------------------------------------- helpers

function toArray(list: any): any[] {
  if (!list) return [];
  const out = [];
  for (let i = 0; i < list.size(); i++) out.push(list.get(i));
  return out;
}

function toOwned(p: any): OwnedPurchase | null {
  const PURCHASED = com.android.billingclient.api.Purchase.PurchaseState.PURCHASED;
  if (p.getPurchaseState() !== PURCHASED) return null; // pending purchases don't unlock yet
  return {
    productIds: toArray(p.getProducts()).map(String),
    token: p.getPurchaseToken(),
    acknowledged: p.isAcknowledged(),
    autoRenewing: p.isAutoRenewing(),
  };
}

function toProduct(d: any, kind: ProductKind): StoreProduct | null {
  const base = { id: d.getProductId(), kind, title: d.getName() || d.getTitle(), native: d };
  if (kind === 'inapp') {
    let o = d.getOneTimePurchaseOfferDetails ? d.getOneTimePurchaseOfferDetails() : null;
    if (!o && d.getOneTimePurchaseOfferDetailsList) {
      const l = toArray(d.getOneTimePurchaseOfferDetailsList());
      o = l[0];
    }
    if (!o) return null;
    return { ...base, price: o.getFormattedPrice(), priceMicros: Number(o.getPriceAmountMicros()), currency: o.getPriceCurrencyCode() };
  }
  const offers = toArray(d.getSubscriptionOfferDetails());
  if (!offers.length) return null;
  // prefer an offer with a free trial, otherwise the base plan
  const phases = (o: any) => toArray(o.getPricingPhases().getPricingPhaseList());
  const offer = offers.find((o) => phases(o).some((ph: any) => Number(ph.getPriceAmountMicros()) === 0)) || offers[offers.length - 1];
  const ph = phases(offer);
  const recurring = ph[ph.length - 1];
  const trial = ph.find((x: any) => Number(x.getPriceAmountMicros()) === 0);
  return {
    ...base,
    price: recurring.getFormattedPrice(),
    priceMicros: Number(recurring.getPriceAmountMicros()),
    currency: recurring.getPriceCurrencyCode(),
    period: recurring.getBillingPeriod(),
    freeTrial: trial ? trial.getBillingPeriod() : undefined,
    offerToken: offer.getOfferToken(),
  };
}
