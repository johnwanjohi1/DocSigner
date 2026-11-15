import { Injectable, signal } from '@angular/core';
import { File, ImageSource, knownFolders, path as fsPath } from '@nativescript/core';

export interface SavedSignature {
  path: string;
  image: ImageSource;
  /** width / height of the cropped signature */
  aspect: number;
}

/** Persists the user's signature as a transparent PNG in the app's documents folder. */
@Injectable({ providedIn: 'root' })
export class SignatureService {
  private readonly pngPath = fsPath.join(knownFolders.documents().path, 'signature.png');
  private readonly metaPath = fsPath.join(knownFolders.documents().path, 'signature.json');

  readonly signature = signal<SavedSignature | null>(this.load());

  private load(): SavedSignature | null {
    if (!File.exists(this.pngPath) || !File.exists(this.metaPath)) return null;
    try {
      const meta = JSON.parse(File.fromPath(this.metaPath).readTextSync());
      return { path: this.pngPath, image: ImageSource.fromFileSync(this.pngPath), aspect: meta.aspect };
    } catch {
      return null;
    }
  }

  save(image: ImageSource, aspect: number): void {
    if (!image.saveToFile(this.pngPath, 'png')) throw new Error('Could not save signature');
    File.fromPath(this.metaPath).writeTextSync(JSON.stringify({ aspect, updated: Date.now() }));
    this.signature.set({ path: this.pngPath, image, aspect });
  }

  clear(): void {
    [this.pngPath, this.metaPath].forEach((p) => File.exists(p) && File.fromPath(p).removeSync());
    this.signature.set(null);
  }
}
