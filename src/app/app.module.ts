import { NO_ERRORS_SCHEMA, NgModule, provideZonelessChangeDetection } from '@angular/core';
import { NativeScriptModule } from '@nativescript/angular';
import { DrawerModule } from '@nativescript-community/ui-drawer/angular';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

@NgModule({
  bootstrap: [AppComponent],
  imports: [NativeScriptModule, AppRoutingModule, DrawerModule],
  declarations: [AppComponent],
  providers: [provideZonelessChangeDetection()],
  schemas: [NO_ERRORS_SCHEMA],
})
export class AppModule {}
