import { Injectable } from '@angular/core';
import type { Drawer } from '@nativescript-community/ui-drawer';

/** Lets any page open/close the app-wide side drawer that lives in AppComponent. */
@Injectable({ providedIn: 'root' })
export class DrawerService {
  private drawer: Drawer | null = null;

  register(drawer: Drawer) {
    this.drawer = drawer;
  }

  open() {
    this.drawer?.open('left');
  }

  close() {
    return this.drawer?.close('left');
  }

  isOpen(): boolean {
    return !!this.drawer?.isOpened('left');
  }

  toggle() {
    this.drawer?.toggle('left');
  }

  /** Swipe-to-open is turned off on screens where the user draws or drags (it would steal the gesture). */
  setGestureEnabled(enabled: boolean) {
    if (this.drawer) this.drawer.gestureEnabled = enabled;
  }
}
