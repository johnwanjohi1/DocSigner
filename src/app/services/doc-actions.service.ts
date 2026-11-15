import { Injectable, inject } from '@angular/core';
import { RouterExtensions } from '@nativescript/angular';
import { File, ImageAsset, ImageSource, path as fsPath } from '@nativescript/core';
import * as camera from '@nativescript/camera';
import * as imagepicker from '@nativescript/imagepicker';
import { DocKind, PickedFile, pickDocument, saveFileAs, scanDocument, uniqueName, workFolder } from '../native/files';
import { DialogService } from './dialog.service';
import { ProService } from './pro.service';
import { SignatureService } from './signature.service';
import { SigningService } from './signing.service';

/**
 * The "start signing something" actions, shared by the home screen and the side drawer menu.
 */
@Injectable({ providedIn: 'root' })
export class DocActionsService {
  private readonly router = inject(RouterExtensions);
  private readonly signing = inject(SigningService);
  private readonly signatures = inject(SignatureService);
  private readonly dialogs = inject(DialogService);
  private readonly pro = inject(ProService);

  async pickFile(kinds: DocKind[]) {
    try {
      // check Pro limits before the user spends time finding the file
      if (kinds.length === 1 && !(await this.pro.canSign(kinds[0]))) return;
      const picked = await pickDocument(kinds);
      if (picked && (await this.pro.canSign(picked.kind))) this.startSigning(picked);
    } catch (e) {
      this.fail(e);
    }
  }

  /** Scan paper pages with the camera into a PDF, then sign it. */
  async scan() {
    try {
      if (!(await this.pro.canSign('pdf'))) return;
      const scanned = await scanDocument();
      if (scanned) this.startSigning(scanned);
    } catch (e) {
      this.fail(e);
    }
  }

  /** Let the user pick where to keep a copy (folders, Downloads, SD card, Drive...). */
  async saveTo(path: string, name?: string) {
    try {
      if (await saveFileAs(path, name)) {
        await this.dialogs.alert({ title: 'Saved', message: 'A copy was saved to the location you chose.', tone: 'success' });
      }
    } catch (e) {
      this.fail(e);
    }
  }

  async pickPhoto() {
    try {
      if (!(await this.pro.canSign('image'))) return;
      // Android Photo Picker: no READ_MEDIA_IMAGES permission needed (Google Play photo/video permission policy)
      const picker = imagepicker.create({ mode: 'single', mediaType: 1 /* Image */, android: { use_photo_picker: true } });
      await picker.authorize();
      const selection = await picker.present();
      if (!selection?.length) return;
      const sel = selection[0];
      const name = sel.filename || sel.originalFilename || 'photo.jpg';
      const local = await this.copyAsset(sel.asset, sel.path, name);
      this.startSigning({ path: local, name, kind: 'image' });
    } catch (e) {
      this.fail(e);
    }
  }

  async takePhoto() {
    try {
      if (!(await this.pro.canSign('image'))) return;
      if (!camera.isAvailable()) throw new Error('No camera available on this device');
      await camera.requestCameraPermissions();
      const asset = await camera.takePicture({ saveToGallery: false, keepAspectRatio: true, width: 2400, height: 2400 });
      const name = `photo_${Date.now()}.jpg`;
      const local = await this.copyAsset(asset, null, name);
      this.startSigning({ path: local, name, kind: 'image' });
    } catch (e) {
      if (String(e).toLowerCase().includes('cancel')) return;
      this.fail(e);
    }
  }

  /** Copies a picked/captured image into our working folder. */
  private async copyAsset(asset: ImageAsset, sourcePath: string | null, name: string): Promise<string> {
    const isPng = name.toLowerCase().endsWith('.png');
    const dest = fsPath.join(workFolder().path, uniqueName(isPng ? name : name.replace(/\.\w+$/, '') + '.jpg'));
    if (sourcePath && File.exists(sourcePath) && /\.(jpe?g|png)$/i.test(sourcePath)) {
      // Keep the original bytes (EXIF orientation is applied when loading).
      File.fromPath(dest).writeSync(File.fromPath(sourcePath).readSync());
      return dest;
    }
    const img = await ImageSource.fromAsset(asset);
    if (!(await img.saveToFileAsync(dest, isPng ? 'png' : 'jpg', 95))) throw new Error('Could not read the image');
    return dest;
  }

  private startSigning(file: PickedFile) {
    this.signing.current.set(file);
    if (!this.signatures.signature()) {
      this.dialogs.alert({
        title: 'Create your signature',
        message: 'First draw the signature you want to use. You only need to do this once.',
        tone: 'info',
        okText: "Let's draw it",
      }).then(() => this.router.navigate(['/signature'], { queryParams: { next: '/sign' } }));
      return;
    }
    this.router.navigate(['/sign']);
  }

  fail(e: any) {
    return this.dialogs.error(e);
  }
}
