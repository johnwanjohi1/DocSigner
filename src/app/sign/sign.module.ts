import { NO_ERRORS_SCHEMA, NgModule } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { SignRoutingModule } from './sign-routing.module';
import { SignComponent } from './sign.component';

@NgModule({
  imports: [NativeScriptCommonModule, SignRoutingModule],
  declarations: [SignComponent],
  schemas: [NO_ERRORS_SCHEMA],
})
export class SignModule {}
