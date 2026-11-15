import { platformNativeScript, registerElement, runNativeScriptAngularApp } from '@nativescript/angular';
import { GestureRootView } from '@nativescript-community/gesturehandler';
import { install as installDrawer } from '@nativescript-community/ui-drawer';
import { Application, GridLayout, isAndroid } from '@nativescript/core';
import { AppModule } from './app/app.module';

// DocSigner has one (light) design. Ignore the phone's dark mode everywhere:
// - NativeScript stops switching the root between ns-light / ns-dark,
// - AppCompat always uses its light (day) resources for native widgets,
// - the themes set forceDarkAllowed=false so Android/ColorOS/MIUI "force dark" doesn't invert colours,
// - iOS: UIUserInterfaceStyle=Light in Info.plist.
Application.setAutoSystemAppearanceChanged(false);
if (isAndroid) {
  try {
    const delegate = (global as any).androidx.appcompat.app.AppCompatDelegate;
    delegate.setDefaultNightMode(delegate.MODE_NIGHT_NO);
  } catch (e) {
    console.log('Could not force light mode: ' + e);
  }
}
// The root gets its ns-light/ns-dark class once when it is created; make sure it is always ns-light.
Application.on(Application.displayedEvent, () => {
  const root = Application.getRootView();
  if (root && root.cssClasses.has('ns-dark')) {
    root.cssClasses.delete('ns-dark');
    root.cssClasses.add('ns-light');
  }
});

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
