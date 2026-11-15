import { NgModule } from '@angular/core';
import { Routes } from '@angular/router';
import { NativeScriptRouterModule } from '@nativescript/angular';

/** Each screen is a lazily loaded feature module. */
const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', loadChildren: () => import('./home/home.module').then((m) => m.HomeModule) },
  { path: 'signature', loadChildren: () => import('./signature/signature.module').then((m) => m.SignatureModule) },
  { path: 'sign', loadChildren: () => import('./sign/sign.module').then((m) => m.SignModule) },
  { path: 'preview', loadChildren: () => import('./preview/preview.module').then((m) => m.PreviewModule) },
  { path: 'intro', loadChildren: () => import('./intro/intro.module').then((m) => m.IntroModule) },
  { path: 'pro', loadChildren: () => import('./paywall/paywall.module').then((m) => m.PaywallModule) },
  { path: 'help', loadChildren: () => import('./help/help.module').then((m) => m.HelpModule) },
];

@NgModule({
  imports: [NativeScriptRouterModule.forRoot(routes)],
  exports: [NativeScriptRouterModule],
})
export class AppRoutingModule {}
