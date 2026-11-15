import { NO_ERRORS_SCHEMA, NgModule } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { PaywallRoutingModule } from './paywall-routing.module';
import { PaywallComponent } from './paywall.component';

@NgModule({
  imports: [NativeScriptCommonModule, PaywallRoutingModule],
  declarations: [PaywallComponent],
  schemas: [NO_ERRORS_SCHEMA],
})
export class PaywallModule {}
