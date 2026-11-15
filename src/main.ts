import { platformNativeScript, registerElement, runNativeScriptAngularApp } from '@nativescript/angular';
import { GestureRootView } from '@nativescript-community/gesturehandler';
import { install as installDrawer } from '@nativescript-community/ui-drawer';
import { GridLayout } from '@nativescript/core';
import { AppModule } from './app/app.module';

// Registers the gesture handler the side drawer needs for swipe-to-open.
installDrawer();
// The drawer's gestures must live under a GestureRootView (or a Page); it wraps the drawer in app.component.html.
registerElement('GestureRootView', () => GestureRootView);

runNativeScriptAngularApp({
  appModuleBootstrap: () => platformNativeScript().bootstrapModule(AppModule),
  // Shown while Angular (re)bootstraps asynchronously, e.g. when Android recreates the screen after the app was
  // in the background. Without it NativeScript has no root view at that moment and the window stays blank.
  launchView: () => {
    const view = new GridLayout();
    view.backgroundColor = '#4f46e5';
    return view as any;
  },
});
