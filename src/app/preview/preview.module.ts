import { NO_ERRORS_SCHEMA, NgModule } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { PreviewRoutingModule } from './preview-routing.module';
import { PreviewComponent } from './preview.component';

@NgModule({
  imports: [NativeScriptCommonModule, PreviewRoutingModule],
  declarations: [PreviewComponent],
  schemas: [NO_ERRORS_SCHEMA],
})
export class PreviewModule {}
