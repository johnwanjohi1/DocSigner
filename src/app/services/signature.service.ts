import { Injectable, signal } from '@angular/core';
import { File, ImageSource, knownFolders, path as fsPath } from '@nativescript/core';
import type { Stroke } from '../native/imaging';

/** The editable drawing behind the saved PNG, so "My signature" can reopen it. */
export interface SignatureDrawing {
  strokes: Stroke[];
  /** pad size (DIPs) the strokes were drawn on */
  width: number;
  height: number;
  color: string;
  thickness: number;
}

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

  save(image: ImageSource, aspect: number, drawing?: SignatureDrawing): void {
    if (!image.saveToFile(this.pngPath, 'png')) throw new Error('Could not save signature');
    File.fromPath(this.metaPath).writeTextSync(JSON.stringify({ aspect, updated: Date.now(), drawing: drawing || null }));
    this.signature.set({ path: this.pngPath, image, aspect });
  }

  /** The strokes of the saved signature, or null (no signature, or one saved before strokes were kept). */
  drawing(): SignatureDrawing | null {
    if (!File.exists(this.metaPath)) return null;
    try {
      const d = JSON.parse(File.fromPath(this.metaPath).readTextSync()).drawing as SignatureDrawing | null;
      return d && Array.isArray(d.strokes) && d.strokes.length && d.width > 0 && d.height > 0 ? d : null;
    } catch {
      return null;
    }
  }

  clear(): void {
    [this.pngPath, this.metaPath].forEach((p) => File.exists(p) && File.fromPath(p).removeSync());
    this.signature.set(null);
  }
}
