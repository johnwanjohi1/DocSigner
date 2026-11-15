import { Injectable, signal } from '@angular/core';
import { Dialogs } from '@nativescript/core';

export type DialogTone = 'info' | 'success' | 'danger' | 'warning' | 'question' | 'delete' | 'pro';

export interface DialogOptions {
  title: string;
  message?: string;
  tone?: DialogTone;
  /** Emoji shown in the badge (defaults from the tone / wording). */
  icon?: string;
  /** Accent colour of the badge and primary button. */
  color?: string;
  /** Primary button text (default "OK"). */
  okText?: string;
  /** Secondary button text; when set the sheet is a confirm. */
  cancelText?: string;
  /** Paints the primary button red (e.g. Delete). */
  destructive?: boolean;
  /** Stacked action buttons (choose()); the first one is the filled primary. */
  actions?: DialogAction[];
}

export interface DialogAction {
  text: string;
  value: string;
  icon?: string;
}

export interface ActiveDialog extends DialogOptions {
  id: number;
  icon: string;
  color: string;
  resolve: (value: string | null) => void;
}

const TONES: Record<DialogTone, { icon: string; color: string }> = {
  info: { icon: 'ℹ', color: '#4f46e5' },
  success: { icon: '✅', color: '#1f9d55' },
  danger: { icon: '⚠️', color: '#e5484d' },
  delete: { icon: '🗑️', color: '#e5484d' },
  warning: { icon: '📝', color: '#c77700' },
  question: { icon: '❔', color: '#4f46e5' },
  pro: { icon: '👑', color: '#d97706' },
};

/** Soft tint of a hex colour (badge rings, soft buttons). */
export const tint = (hex: string, a = 0.14) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/** Darker shade of a hex colour (gradient end). */
export const shade = (hex: string, f = 0.28) => {
  const n = parseInt(hex.replace('#', ''), 16);
  const c = (v: number) => Math.max(0, Math.round(v * (1 - f)));
  return `rgb(${c((n >> 16) & 255)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`;
};

/**
 * App-wide bottom-sheet dialogs (drawn by AppComponent above every screen), replacing the platform's classic
 * alert / confirm popups. Styled like the Invoice Maker sheets: tinted emoji badge, centred title & message,
 * soft + filled pill buttons. One at a time (queued); Android Back or a tap on the scrim cancels.
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly current = signal<ActiveDialog | null>(null);
  private queue: ActiveDialog[] = [];
  private seq = 0;

  constructor() {
    // Any Dialogs.alert / confirm elsewhere (plugins, quick debug code) also opens a sheet.
    const norm = (o: any) => (typeof o === 'string' ? { message: o } : o || {});
    (Dialogs as any).alert = (o: any) => {
      const x = norm(o);
      return this.alert({ title: x.title || x.message || '', message: x.title ? x.message : '', okText: x.okButtonText });
    };
    (Dialogs as any).confirm = (o: any) => {
      const x = norm(o);
      return this.confirm({
        title: x.title || x.message || '',
        message: x.title ? x.message : '',
        okText: x.okButtonText,
        cancelText: x.cancelButtonText || 'Cancel',
      });
    };
  }

  /** One-button sheet. Without a tone, the icon follows the wording: a problem, a success, or information. */
  alert(opts: DialogOptions): Promise<void> {
    const all = `${opts.title} ${opts.message || ''}`;
    const tone: DialogTone =
      opts.tone ||
      (/fail|couldn|can['’]t|cannot|error|denied|invalid|not supported|no longer/i.test(all)
        ? 'danger'
        : /saved|signed|done|restored|welcome|unlocked|complete/i.test(all)
          ? 'success'
          : 'info');
    return this.open({ ...opts, tone, cancelText: undefined, actions: undefined }).then(() => undefined);
  }

  /** Yes/no sheet: resolves true for the primary button. */
  confirm(opts: DialogOptions): Promise<boolean> {
    const tone = opts.tone || (opts.destructive ? 'delete' : 'question');
    return this.open({ cancelText: 'Cancel', ...opts, tone, actions: undefined }).then((v) => v === 'ok');
  }

  /** Sheet with stacked action buttons; resolves the chosen action's value, or null when dismissed. */
  choose(opts: DialogOptions & { actions: DialogAction[] }): Promise<string | null> {
    return this.open({ tone: 'info', ...opts, cancelText: undefined });
  }

  error(e: any, title = 'Something went wrong'): Promise<void> {
    console.error(e);
    return this.alert({ title, message: String(e?.message || e), tone: 'danger', okText: 'Got it' });
  }

  /** Called by the overlay once its exit animation finished. */
  settle(value: string | null) {
    const d = this.current();
    if (!d) return;
    this.current.set(null);
    d.resolve(value);
    const next = this.queue.shift();
    if (next) setTimeout(() => this.current.set(next), 60);
  }

  private open(opts: DialogOptions): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      const t = TONES[opts.tone || 'info'];
      const color = opts.color || (opts.destructive ? '#e5484d' : t.color);
      const d: ActiveDialog = { okText: 'OK', ...opts, icon: opts.icon || t.icon, color, id: ++this.seq, resolve };
      if (this.current()) this.queue.push(d);
      else this.current.set(d);
    });
  }
}
