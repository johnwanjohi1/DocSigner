import { NO_ERRORS_SCHEMA, NgModule } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { IntroRoutingModule } from './intro-routing.module';
import { IntroComponent } from './intro.component';

@NgModule({
  imports: [NativeScriptCommonModule, IntroRoutingModule],
  declarations: [IntroComponent],
  schemas: [NO_ERRORS_SCHEMA],
})
export class IntroModule {}
