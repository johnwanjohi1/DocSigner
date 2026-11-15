import { NO_ERRORS_SCHEMA, NgModule } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { SignatureRoutingModule } from './signature-routing.module';
import { SignatureComponent } from './signature.component';
import { SignaturePadComponent } from './signature-pad.component';

@NgModule({
  imports: [NativeScriptCommonModule, SignatureRoutingModule],
  declarations: [SignatureComponent, SignaturePadComponent],
  schemas: [NO_ERRORS_SCHEMA],
})
export class SignatureModule {}
