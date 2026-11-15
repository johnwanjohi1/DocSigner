import { signal } from '@angular/core';

/** True while the animated splash covers the app. Screens with timers (the intro) wait until it is gone. */
export const splashVisible = signal(true);
