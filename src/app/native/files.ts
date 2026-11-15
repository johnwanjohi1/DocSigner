/**
 * Cross-platform native helpers: raw byte I/O, system document picker and share sheet.
 * Everything here talks to Android / iOS APIs directly so we don't depend on extra plugins.
 */
import { Application, File, ImageSource, Utils, isAndroid, knownFolders, path as fsPath } from '@nativescript/core';
import * as camera from '@nativescript/camera';
import { PDFDocument } from 'pdf-lib';
import { flushAfter } from './native-async';

declare const android: any, java: any, androidx: any;
declare const NSData: any, NSURL: any, NSObject: any, UTType: any, UIDocumentPickerViewController: any,
  UIDocumentPickerDelegate: any, UIActivityViewController: any, UIModalPresentationStyle: any, interop: any,
  VNDocumentCameraViewController: any, VNDocumentCameraViewControllerDelegate: any, UIImageJPEGRepresentation: any;

export type DocKind = 'pdf' | 'docx' | 'image';

export interface PickedFile {
  path: string;
  name: string;
  kind: DocKind;
}

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  heic: 'image/heic',
};

export function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.substring(i + 1).toLowerCase() : '';
}

export function mimeOf(name: string): string {
  return MIME_BY_EXT[extOf(name)] || 'application/octet-stream';
}

export function kindOf(name: string): DocKind | null {
  const ext = extOf(name);
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif'].includes(ext)) return 'image';
  return null;
}

/** Folder holding working copies of files the user picked. */
export function workFolder() {
  return knownFolders.temp().getFolder('incoming');
}

/** Folder holding the signed output files. */
export function signedFolder() {
  return knownFolders.documents().getFolder('Signed');
}

export function uniqueName(base: string): string {
  return `${Date.now()}_${base.replace(/[^\w.\- ]+/g, '_')}`;
}

// ---------------------------------------------------------------- byte I/O

export function readBytes(path: string): Uint8Array {
  if (isAndroid) {
    const file = new java.io.File(path);
    const len = file.length();
    const bb = java.nio.ByteBuffer.allocateDirect(len);
    const ch = new java.io.FileInputStream(file).getChannel();
    try {
      while (bb.hasRemaining() && ch.read(bb) >= 0) {
        /* keep reading */
      }
    } finally {
      ch.close();
    }
    const view = new Uint8Array((ArrayBuffer as any).from(bb));
    return view.slice(0); // detach from the Java-owned buffer
  }
  const data = NSData.dataWithContentsOfFile(path);
  if (!data) throw new Error(`Cannot read ${path}`);
  return new Uint8Array(interop.bufferFromData(data)).slice(0);
}

export function writeBytes(path: string, bytes: Uint8Array): void {
  File.fromPath(path); // ensures parent folders exist
  if (isAndroid) {
    const bb = java.nio.ByteBuffer.allocateDirect(bytes.length);
    new Uint8Array((ArrayBuffer as any).from(bb)).set(bytes);
    bb.rewind();
    const ch = new java.io.FileOutputStream(new java.io.File(path)).getChannel();
    try {
      while (bb.hasRemaining()) ch.write(bb);
    } finally {
      ch.close();
    }
    return;
  }
  const data = NSData.dataWithBytesLength(bytes, bytes.length);
  if (!data.writeToFileAtomically(path, true)) throw new Error(`Cannot write ${path}`);
}

// ---------------------------------------------------------------- document picker

const PICK_REQUEST = 7341;
let iosPickerDelegate: any; // strong ref so iOS doesn't release it while the picker is up

/**
 * Opens the system file picker for PDFs, Word (.docx) files and images.
 * The chosen file is copied into the app's temp folder and that local path is returned.
 */
export function pickDocument(kinds: DocKind[] = ['pdf', 'docx', 'image']): Promise<PickedFile | null> {
  return flushAfter(isAndroid ? pickAndroid(kinds) : pickIOS(kinds));
}

function pickAndroid(kinds: DocKind[]): Promise<PickedFile | null> {
  return new Promise((resolve, reject) => {
    const Intent = android.content.Intent;
    const mimes: string[] = [];
    if (kinds.includes('pdf')) mimes.push(MIME_BY_EXT.pdf);
    if (kinds.includes('docx')) mimes.push(MIME_BY_EXT.docx);
    if (kinds.includes('image')) mimes.push('image/*');

    const intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);
    intent.setType(mimes.length === 1 ? mimes[0] : '*/*');
    if (mimes.length > 1) {
      const arr = Array.create(java.lang.String, mimes.length);
      mimes.forEach((m, i) => (arr[i] = m));
      intent.putExtra(Intent.EXTRA_MIME_TYPES, arr);
    }

    const onResult = (args: any) => {
      if (args.requestCode !== PICK_REQUEST) return;
      Application.android.off(Application.android.activityResultEvent, onResult);
      if (args.resultCode !== android.app.Activity.RESULT_OK || !args.intent || !args.intent.getData()) {
        resolve(null);
        return;
      }
      try {
        resolve(copyContentUri(args.intent.getData()));
      } catch (e) {
        reject(e);
      }
    };
    Application.android.on(Application.android.activityResultEvent, onResult);
    Application.android.foregroundActivity.startActivityForResult(intent, PICK_REQUEST);
  });
}

function copyContentUri(uri: any): PickedFile {
  const ctx = Utils.android.getApplicationContext();
  const resolver = ctx.getContentResolver();

  let name = 'document';
  const cursor = resolver.query(uri, null, null, null, null);
  if (cursor) {
    try {
      const idx = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME);
      if (idx >= 0 && cursor.moveToFirst()) name = cursor.getString(idx) || name;
    } finally {
      cursor.close();
    }
  }
  if (!extOf(name)) {
    const mime = resolver.getType(uri) || '';
    const ext = Object.keys(MIME_BY_EXT).find((k) => MIME_BY_EXT[k] === mime);
    if (ext) name += '.' + ext;
  }
  const kind = kindOf(name);
  if (!kind) throw new Error(`Unsupported file type: ${name}`);

  const dest = fsPath.join(workFolder().path, uniqueName(name));
  const input = resolver.openInputStream(uri);
  const output = new java.io.FileOutputStream(dest);
  try {
    const buf = Array.create('byte', 64 * 1024);
    let n: number;
    while ((n = input.read(buf)) > 0) output.write(buf, 0, n);
  } finally {
    input.close();
    output.close();
  }
  return { path: dest, name, kind };
}

function pickIOS(kinds: DocKind[]): Promise<PickedFile | null> {
  return new Promise((resolve, reject) => {
    const ids: string[] = [];
    if (kinds.includes('pdf')) ids.push('com.adobe.pdf');
    if (kinds.includes('docx')) ids.push('org.openxmlformats.wordprocessingml.document');
    if (kinds.includes('image')) ids.push('public.image');
    const types = ids.map((id) => UTType.typeWithIdentifier(id)).filter((t) => !!t);

    const Delegate = (NSObject as any).extend(
      {
        documentPickerDidPickDocumentsAtURLs(_c: any, urls: any) {
          iosPickerDelegate = null;
          try {
            const url = urls.objectAtIndex(0);
            const name: string = url.lastPathComponent;
            const kind = kindOf(name);
            if (!kind) throw new Error(`Unsupported file type: ${name}`);
            const dest = fsPath.join(workFolder().path, uniqueName(name));
            const data = NSData.dataWithContentsOfURL(url);
            data.writeToFileAtomically(dest, true);
            resolve({ path: dest, name, kind });
          } catch (e) {
            reject(e);
          }
        },
        documentPickerWasCancelled() {
          iosPickerDelegate = null;
          resolve(null);
        },
      },
      { protocols: [UIDocumentPickerDelegate] },
    );

    const picker = UIDocumentPickerViewController.alloc().initForOpeningContentTypesAsCopy(types, true);
    iosPickerDelegate = Delegate.new();
    picker.delegate = iosPickerDelegate;
    topViewController().presentViewControllerAnimatedCompletion(picker, true, null);
  });
}

function topViewController(): any {
  let vc: any = Utils.ios.getRootViewController();
  while (vc && vc.presentedViewController) vc = vc.presentedViewController;
  return vc;
}

// ---------------------------------------------------------------- share / open with

/** Opens the platform share sheet so the signed file can be sent, saved or opened in another app. */
export function shareFile(path: string, title = 'Share signed file'): void {
  const mime = mimeOf(path);
  if (isAndroid) {
    const ctx = Utils.android.getApplicationContext();
    const Intent = android.content.Intent;
    const uri = androidx.core.content.FileProvider.getUriForFile(
      ctx,
      ctx.getPackageName() + '.provider',
      new java.io.File(path),
    );
    const intent = new Intent(Intent.ACTION_SEND);
    intent.setType(mime);
    intent.putExtra(Intent.EXTRA_STREAM, uri);
    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    const chooser = Intent.createChooser(intent, title);
    Application.android.foregroundActivity.startActivity(chooser);
    return;
  }
  const url = NSURL.fileURLWithPath(path);
  const vc = UIActivityViewController.alloc().initWithActivityItemsApplicationActivities([url] as any, null);
  const top = topViewController();
  if (vc.popoverPresentationController) {
    vc.popoverPresentationController.sourceView = top.view;
    vc.popoverPresentationController.sourceRect = top.view.bounds;
  }
  top.presentViewControllerAnimatedCompletion(vc, true, null);
}

// ---------------------------------------------------------------- activity results (Android)

/** Starts an Intent (or IntentSender) for a result and resolves with the result intent, or null when cancelled. */
function startForResult(code: number, start: (activity: any) => void): Promise<any | null> {
  return new Promise((resolve, reject) => {
    const onResult = (args: any) => {
      if (args.requestCode !== code) return;
      Application.android.off(Application.android.activityResultEvent, onResult);
      resolve(args.resultCode === android.app.Activity.RESULT_OK ? args.intent : null);
    };
    Application.android.on(Application.android.activityResultEvent, onResult);
    try {
      start(Application.android.foregroundActivity);
    } catch (e) {
      Application.android.off(Application.android.activityResultEvent, onResult);
      reject(e);
    }
  });
}

function copyUriToFile(uri: any, dest: string) {
  const resolver = Utils.android.getApplicationContext().getContentResolver();
  const input = resolver.openInputStream(uri);
  const output = new java.io.FileOutputStream(dest);
  try {
    const buf = Array.create('byte', 64 * 1024);
    let n: number;
    while ((n = input.read(buf)) > 0) output.write(buf, 0, n);
  } finally {
    input.close();
    output.close();
  }
}

function scanName(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `Scan ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}.pdf`;
}

// ---------------------------------------------------------------- document scanner

const SCAN_REQUEST = 7342;
let iosScanDelegate: any;

/**
 * Scans paper documents with the camera into a PDF:
 * Android - Google ML Kit Document Scanner (edge detection, crop, filters, multi-page; no camera permission needed),
 * iOS - VisionKit document camera, pages assembled into a PDF.
 */
export function scanDocument(): Promise<PickedFile | null> {
  return isAndroid ? scanAndroid() : flushAfter(scanIOS());
}

/**
 * Google ML Kit document scanner, set up like Invoice Maker's ScannerService: JPEG pages (edge detection, crop,
 * perspective fix, several pages) that we assemble into a PDF. Runs inside Google Play services; if it can't run on
 * this phone we fall back to a plain camera photo.
 */
async function scanAndroid(): Promise<PickedFile | null> {
  let pages: string[];
  try {
    pages = await scanPagesAndroid(30);
  } catch (e) {
    const msg = String((e as any)?.message || e);
    console.error('document scanner unavailable: ' + msg);
    if (/download|install|module|wait/i.test(msg)) {
      throw new Error('Google Play services is still setting up the document scanner on this phone. Please try again in a minute.');
    }
    await camera.requestCameraPermissions();
    let asset;
    try {
      asset = await camera.takePicture({ width: 2400, height: 2400, keepAspectRatio: true, saveToGallery: false });
    } catch (err) {
      if (/cancel/i.test(String((err as any)?.message || err))) return null;
      throw err;
    }
    const img = await ImageSource.fromAsset(asset);
    const tmp = fsPath.join(workFolder().path, uniqueName('camera.jpg'));
    img.saveToFile(tmp, 'jpg', 90);
    pages = [tmp];
  }
  if (!pages.length) return null;
  const name = scanName();
  const dest = fsPath.join(workFolder().path, uniqueName(name));
  writeBytes(dest, await jpegPagesToPdf(pages.map((p) => readBytes(p))));
  pages.forEach((p) => File.exists(p) && File.fromPath(p).removeSync());
  return { path: dest, name, kind: 'pdf' };
}

function scanPagesAndroid(maxPages: number): Promise<string[]> {
  const uris = flushAfter(
    new Promise<string[]>((resolve, reject) => {
      try {
        const act = Application.android.foregroundActivity || Application.android.startActivity;
        const D = (global as any).com.google.mlkit.vision.documentscanner;
        const O = D.GmsDocumentScannerOptions;
        const options = new O.Builder()
          .setGalleryImportAllowed(false)
          .setPageLimit(maxPages)
          .setResultFormats(O.RESULT_FORMAT_JPEG, Array.create('int', 0))
          .setScannerMode(O.SCANNER_MODE_FULL)
          .build();
        const onResult = (args: any) => {
          if (args.requestCode !== SCAN_REQUEST) return;
          Application.android.off(Application.android.activityResultEvent, onResult);
          if (args.resultCode !== android.app.Activity.RESULT_OK || !args.intent) return resolve([]);
          try {
            const result = D.GmsDocumentScanningResult.fromActivityResultIntent(args.intent);
            const list = result && result.getPages();
            const out: string[] = [];
            for (let i = 0; list && i < list.size(); i++) out.push(String(list.get(i).getImageUri()));
            resolve(out);
          } catch (e) {
            reject(e);
          }
        };
        const tasks = (global as any).com.google.android.gms.tasks;
        D.GmsDocumentScanning.getClient(options)
          .getStartScanIntent(act)
          .addOnSuccessListener(
            new tasks.OnSuccessListener({
              onSuccess: (sender: any) => {
                Application.android.on(Application.android.activityResultEvent, onResult);
                act.startIntentSenderForResult(sender, SCAN_REQUEST, null, 0, 0, 0);
              },
            }),
          )
          .addOnFailureListener(
            new tasks.OnFailureListener({ onFailure: (e: any) => reject(new Error(String((e && e.getMessage && e.getMessage()) || e))) }),
          );
      } catch (e) {
        reject(e);
      }
    }),
  );
  // copy each page out of the scanner's cache (in page order), then delete the scanner's own copy
  return uris.then((list) =>
    list.map((u, i) => {
      const uri = android.net.Uri.parse(u);
      const dest = fsPath.join(workFolder().path, uniqueName(`scan-p${i + 1}.jpg`));
      copyUriToFile(uri, dest);
      if (uri.getScheme() === 'file') new java.io.File(uri.getPath()).delete();
      return dest;
    }),
  );
}

/** One PDF page per scanned JPEG, A4 width (595pt) with the page's own aspect ratio. */
async function jpegPagesToPdf(pages: Uint8Array[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (const bytes of pages) {
    const jpg = await pdf.embedJpg(bytes);
    const w = 595;
    const h = (jpg.height / jpg.width) * w;
    pdf.addPage([w, h]).drawImage(jpg, { x: 0, y: 0, width: w, height: h });
  }
  return pdf.save();
}

function scanIOS(): Promise<PickedFile | null> {
  return new Promise((resolve, reject) => {
    if (!VNDocumentCameraViewController.isSupported) return reject(new Error('Document scanning is not supported on this device.'));
    const Delegate = (NSObject as any).extend(
      {
        documentCameraViewControllerDidFinishWithScan(c: any, scan: any) {
          c.dismissViewControllerAnimatedCompletion(true, null);
          iosScanDelegate = null;
          (async () => {
            const pages: Uint8Array[] = [];
            for (let i = 0; i < scan.pageCount; i++) {
              pages.push(new Uint8Array(interop.bufferFromData(UIImageJPEGRepresentation(scan.imageOfPageAtIndex(i), 0.85))));
            }
            const name = scanName();
            const dest = fsPath.join(workFolder().path, uniqueName(name));
            writeBytes(dest, await jpegPagesToPdf(pages));
            resolve({ path: dest, name, kind: 'pdf' });
          })().catch(reject);
        },
        documentCameraViewControllerDidCancel(c: any) {
          c.dismissViewControllerAnimatedCompletion(true, null);
          iosScanDelegate = null;
          resolve(null);
        },
        documentCameraViewControllerDidFailWithError(c: any, err: any) {
          c.dismissViewControllerAnimatedCompletion(true, null);
          iosScanDelegate = null;
          reject(new Error((err && err.localizedDescription) || 'Scanning failed'));
        },
      },
      { protocols: [VNDocumentCameraViewControllerDelegate] },
    );
    const vc = VNDocumentCameraViewController.new();
    iosScanDelegate = Delegate.new();
    vc.delegate = iosScanDelegate;
    topViewController().presentViewControllerAnimatedCompletion(vc, true, null);
  });
}

// ---------------------------------------------------------------- save to a location the user chooses

const SAVE_REQUEST = 7343;
let iosExportDelegate: any;

/**
 * Lets the user choose where to save a copy of the file (Android: system "Save to" dialog - device folders,
 * Downloads, SD card, Google Drive...; iOS: Files export). Resolves true when a copy was saved.
 */
export function saveFileAs(path: string, suggestedName?: string): Promise<boolean> {
  const name = suggestedName || path.substring(path.lastIndexOf('/') + 1);
  if (isAndroid) {
    const Intent = android.content.Intent;
    const intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
    intent.addCategory(Intent.CATEGORY_OPENABLE);
    intent.setType(mimeOf(name));
    intent.putExtra(Intent.EXTRA_TITLE, name);
    return flushAfter(startForResult(SAVE_REQUEST, (act) => act.startActivityForResult(intent, SAVE_REQUEST))).then((data) => {
      if (!data || !data.getData()) return false;
      const resolver = Utils.android.getApplicationContext().getContentResolver();
      const output = resolver.openOutputStream(data.getData(), 'wt');
      const input = new java.io.FileInputStream(path);
      try {
        const buf = Array.create('byte', 64 * 1024);
        let n: number;
        while ((n = input.read(buf)) > 0) output.write(buf, 0, n);
      } finally {
        input.close();
        output.close();
      }
      return true;
    });
  }
  return new Promise((resolve) => {
    const Delegate = (NSObject as any).extend(
      {
        documentPickerDidPickDocumentsAtURLs() {
          iosExportDelegate = null;
          resolve(true);
        },
        documentPickerWasCancelled() {
          iosExportDelegate = null;
          resolve(false);
        },
      },
      { protocols: [UIDocumentPickerDelegate] },
    );
    const picker = UIDocumentPickerViewController.alloc().initForExportingURLsAsCopy([NSURL.fileURLWithPath(path)] as any, true);
    iosExportDelegate = Delegate.new();
    picker.delegate = iosExportDelegate;
    topViewController().presentViewControllerAnimatedCompletion(picker, true, null);
  });
}
