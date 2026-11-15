import { NO_ERRORS_SCHEMA, NgModule } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { HelpRoutingModule } from './help-routing.module';
import { HelpComponent } from './help.component';

@NgModule({
  imports: [NativeScriptCommonModule, HelpRoutingModule],
  declarations: [HelpComponent],
  schemas: [NO_ERRORS_SCHEMA],
})
export class HelpModule {}
