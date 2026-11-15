import { Injectable, signal } from '@angular/core';
import { ApplicationSettings } from '@nativescript/core';

export type FilesLayout = 'grid' | 'list';

/** Small persisted UI preferences. */
@Injectable({ providedIn: 'root' })
export class UiPrefsService {
  readonly filesLayout = signal<FilesLayout>((ApplicationSettings.getString('filesLayout') as FilesLayout) || 'grid');

  setFilesLayout(layout: FilesLayout) {
    this.filesLayout.set(layout);
    ApplicationSettings.setString('filesLayout', layout);
  }
}
