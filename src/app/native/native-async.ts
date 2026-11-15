/**
 * Promises settled from a native (Java / Objective-C) callback: re-settle them on a timer so the awaiting code runs
 * straight away inside a macrotask (the runtime doesn't always flush microtasks after a native callback).
 * Same helper as Invoice Maker. Used for the file picker, document scanner, Save-to and Google Play Billing.
 */
export const flushAfter = <T>(p: Promise<T>): Promise<T> =>
  new Promise<T>((res, rej) => p.then((v) => setTimeout(() => res(v), 0), (e) => setTimeout(() => rej(e), 0)));
