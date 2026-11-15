/**
 * Native image helpers: render signature strokes to a bitmap, composite a signature on top
 * of a photo, load photos with the correct orientation and rasterise PDF pages for preview.
 */
import { Color, ImageSource, isAndroid } from '@nativescript/core';

declare const android: any, java: any;
declare const UIGraphicsBeginImageContextWithOptions: any, UIGraphicsGetImageFromCurrentImageContext: any,
  UIGraphicsEndImageContext: any, UIBezierPath: any, CGSizeMake: any, CGPointMake: any, CGRectMake: any,
  UIImage: any, UIColor: any, UIRectFill: any, PDFDocument: any, NSURL: any, NSString: any, NSDictionary: any,
  UIFont: any, NSFontAttributeName: any, NSForegroundColorAttributeName: any, NSShadow: any, NSShadowAttributeName: any;

export interface Point {
  x: number;
  y: number;
}
export type Stroke = Point[];

export interface RenderOptions {
  /** Canvas size in DIPs (ignored when crop = true). */
  width: number;
  height: number;
  /** Pixels per DIP. */
  scale: number;
  color: string;
  /** Line width in DIPs. */
  lineWidth: number;
  /** Crop the output to the bounding box of the ink (used when exporting). */
  crop?: boolean;
}

export interface RenderedSignature {
  image: ImageSource;
  /** width / height */
  aspect: number;
}

/** Renders strokes (DIP coordinates) to a transparent bitmap with smoothed, rounded lines. */
export function renderStrokes(strokes: Stroke[], opts: RenderOptions): RenderedSignature | null {
  const pts = strokes.flat();
  let ox = 0,
    oy = 0,
    w = opts.width,
    h = opts.height;
  if (opts.crop) {
    if (!pts.length) return null;
    const pad = opts.lineWidth * 2;
    const xs = pts.map((p) => p.x),
      ys = pts.map((p) => p.y);
    ox = Math.min(...xs) - pad;
    oy = Math.min(...ys) - pad;
    w = Math.max(...xs) + pad - ox;
    h = Math.max(...ys) + pad - oy;
  }
  w = Math.max(1, w);
  h = Math.max(1, h);
  const s = opts.scale;
  const color = new Color(opts.color);

  if (isAndroid) {
    const G = android.graphics;
    const bmp = G.Bitmap.createBitmap(Math.ceil(w * s), Math.ceil(h * s), G.Bitmap.Config.ARGB_8888);
    const canvas = new G.Canvas(bmp);
    const paint = new G.Paint(G.Paint.ANTI_ALIAS_FLAG);
    paint.setColor(color.android);
    paint.setStyle(G.Paint.Style.STROKE);
    paint.setStrokeWidth(opts.lineWidth * s);
    paint.setStrokeCap(G.Paint.Cap.ROUND);
    paint.setStrokeJoin(G.Paint.Join.ROUND);
    for (const stroke of strokes) {
      if (!stroke.length) continue;
      const P = (p: Point) => [(p.x - ox) * s, (p.y - oy) * s];
      if (stroke.length === 1) {
        const [x, y] = P(stroke[0]);
        canvas.drawPoint(x, y, paint);
        continue;
      }
      const path = new G.Path();
      const [x0, y0] = P(stroke[0]);
      path.moveTo(x0, y0);
      for (let i = 1; i < stroke.length - 1; i++) {
        const [cx, cy] = P(stroke[i]);
        const [nx, ny] = P(stroke[i + 1]);
        path.quadTo(cx, cy, (cx + nx) / 2, (cy + ny) / 2);
      }
      const [lx, ly] = P(stroke[stroke.length - 1]);
      path.lineTo(lx, ly);
      canvas.drawPath(path, paint);
    }
    return { image: new ImageSource(bmp), aspect: w / h };
  }

  UIGraphicsBeginImageContextWithOptions(CGSizeMake(w, h), false, s);
  color.ios.setStroke();
  color.ios.setFill();
  for (const stroke of strokes) {
    if (!stroke.length) continue;
    const P = (p: Point) => CGPointMake(p.x - ox, p.y - oy);
    if (stroke.length === 1) {
      const r = opts.lineWidth / 2;
      UIBezierPath.bezierPathWithOvalInRect(CGRectMake(stroke[0].x - ox - r, stroke[0].y - oy - r, r * 2, r * 2)).fill();
      continue;
    }
    const path = UIBezierPath.bezierPath();
    path.lineWidth = opts.lineWidth;
    path.lineCapStyle = 1; // kCGLineCapRound
    path.lineJoinStyle = 1; // kCGLineJoinRound
    path.moveToPoint(P(stroke[0]));
    for (let i = 1; i < stroke.length - 1; i++) {
      const c = stroke[i],
        n = stroke[i + 1];
      path.addQuadCurveToPointControlPoint(P({ x: (c.x + n.x) / 2, y: (c.y + n.y) / 2 }), P(c));
    }
    path.addLineToPoint(P(stroke[stroke.length - 1]));
    path.stroke();
  }
  const img = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();
  return { image: new ImageSource(img), aspect: w / h };
}

/** Pixel / point size of an image source. */
export function sizeOf(src: ImageSource): { width: number; height: number } {
  if (isAndroid) return { width: src.android.getWidth(), height: src.android.getHeight() };
  return { width: src.ios.size.width, height: src.ios.size.height };
}

/** Loads a photo from disk, applying EXIF rotation on Android (iOS UIImage already honours it). */
export function loadPhoto(path: string): ImageSource {
  if (!isAndroid) return ImageSource.fromFileSync(path);
  const G = android.graphics;
  let bmp = G.BitmapFactory.decodeFile(path);
  if (!bmp) throw new Error('Could not decode image');
  try {
    const exif = new android.media.ExifInterface(path);
    const o = exif.getAttributeInt(android.media.ExifInterface.TAG_ORIENTATION, 1);
    const deg = o === 6 ? 90 : o === 3 ? 180 : o === 8 ? 270 : 0;
    if (deg) {
      const m = new G.Matrix();
      m.postRotate(deg);
      bmp = G.Bitmap.createBitmap(bmp, 0, 0, bmp.getWidth(), bmp.getHeight(), m, true);
    }
  } catch (e) {
    /* no EXIF – keep as is */
  }
  return new ImageSource(bmp);
}

/** Loads a down-sampled copy of a photo (longest side ≈ maxPx) – cheap enough for list thumbnails. */
export function loadThumbnail(path: string, maxPx: number): ImageSource | null {
  if (isAndroid) {
    const G = android.graphics;
    const opts = new G.BitmapFactory.Options();
    opts.inJustDecodeBounds = true;
    G.BitmapFactory.decodeFile(path, opts);
    const longest = Math.max(opts.outWidth, opts.outHeight);
    if (longest <= 0) return null;
    let sample = 1;
    while (longest / (sample * 2) >= maxPx) sample *= 2;
    const o2 = new G.BitmapFactory.Options();
    o2.inSampleSize = sample;
    let bmp = G.BitmapFactory.decodeFile(path, o2);
    if (!bmp) return null;
    try {
      const o = new android.media.ExifInterface(path).getAttributeInt(android.media.ExifInterface.TAG_ORIENTATION, 1);
      const deg = o === 6 ? 90 : o === 3 ? 180 : o === 8 ? 270 : 0;
      if (deg) {
        const m = new G.Matrix();
        m.postRotate(deg);
        bmp = G.Bitmap.createBitmap(bmp, 0, 0, bmp.getWidth(), bmp.getHeight(), m, true);
      }
    } catch (e) {
      /* ignore */
    }
    return new ImageSource(bmp);
  }
  const img = UIImage.imageWithContentsOfFile(path);
  if (!img) return null;
  const k = maxPx / Math.max(img.size.width, img.size.height);
  if (k >= 1) return new ImageSource(img);
  const w = img.size.width * k,
    h = img.size.height * k;
  UIGraphicsBeginImageContextWithOptions(CGSizeMake(w, h), false, 1);
  img.drawInRect(CGRectMake(0, 0, w, h));
  const out = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();
  return new ImageSource(out);
}

/** Normalised placement (0..1 of the page/image width & height, origin top-left). */
export interface Placement {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Draws `sig` on top of `base` at the given normalised placement and returns a new image. */
export function compositeImage(base: ImageSource, sig: ImageSource, p: Placement): ImageSource {
  const { width, height } = sizeOf(base);
  const x = p.x * width,
    y = p.y * height,
    w = p.w * width,
    h = p.h * height;
  if (isAndroid) {
    const G = android.graphics;
    const out = base.android.copy(G.Bitmap.Config.ARGB_8888, true);
    const canvas = new G.Canvas(out);
    const paint = new G.Paint(G.Paint.ANTI_ALIAS_FLAG | G.Paint.FILTER_BITMAP_FLAG);
    canvas.drawBitmap(sig.android, null, new G.RectF(x, y, x + w, y + h), paint);
    return new ImageSource(out);
  }
  UIGraphicsBeginImageContextWithOptions(CGSizeMake(width, height), true, base.ios.scale);
  base.ios.drawInRect(CGRectMake(0, 0, width, height));
  sig.ios.drawInRect(CGRectMake(x, y, w, h));
  const img = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();
  return new ImageSource(img);
}

/** Draws a small, semi-transparent text mark in the bottom-right corner (Free plan). */
export function drawWatermark(src: ImageSource, text: string): ImageSource {
  const { width, height } = sizeOf(src);
  const size = Math.max(12, Math.round(Math.min(width, height) * 0.022));
  const margin = Math.round(size * 0.9);
  if (isAndroid) {
    const G = android.graphics;
    const out = src.android.isMutable() ? src.android : src.android.copy(G.Bitmap.Config.ARGB_8888, true);
    const canvas = new G.Canvas(out);
    const paint = new G.Paint(G.Paint.ANTI_ALIAS_FLAG);
    paint.setTextSize(size);
    paint.setColor(G.Color.argb(200, 255, 255, 255));
    paint.setShadowLayer(size * 0.25, 0, 0, G.Color.argb(160, 0, 0, 0));
    paint.setTypeface(G.Typeface.create(G.Typeface.DEFAULT, G.Typeface.BOLD));
    const tw = paint.measureText(text);
    canvas.drawText(text, width - tw - margin, height - margin, paint);
    return new ImageSource(out);
  }
  UIGraphicsBeginImageContextWithOptions(CGSizeMake(width, height), true, src.ios.scale);
  src.ios.drawInRect(CGRectMake(0, 0, width, height));
  const shadow = NSShadow.new();
  shadow.shadowBlurRadius = size * 0.25;
  shadow.shadowColor = UIColor.colorWithWhiteAlpha(0, 0.6);
  const attrs = NSDictionary.dictionaryWithObjectsForKeys(
    [UIFont.boldSystemFontOfSize(size), UIColor.colorWithWhiteAlpha(1, 0.8), shadow],
    [NSFontAttributeName, NSForegroundColorAttributeName, NSShadowAttributeName],
  );
  const str = NSString.stringWithString(text);
  const ts = str.sizeWithAttributes(attrs);
  str.drawAtPointWithAttributes({ x: width - ts.width - margin, y: height - ts.height - margin } as any, attrs);
  const img = UIGraphicsGetImageFromCurrentImageContext();
  UIGraphicsEndImageContext();
  return new ImageSource(img);
}

// ---------------------------------------------------------------- PDF preview

export interface PdfPageImage {
  image: ImageSource;
  /** Displayed page size (points, rotation applied). */
  width: number;
  height: number;
  pageCount: number;
}

/** Rasterises one page of a PDF for on-screen preview (Android PdfRenderer / iOS PDFKit). */
export function renderPdfPage(path: string, index: number, targetWidthPx: number): PdfPageImage {
  if (isAndroid) {
    const PFD = android.os.ParcelFileDescriptor;
    const PdfRenderer = android.graphics.pdf.PdfRenderer;
    const pfd = PFD.open(new java.io.File(path), PFD.MODE_READ_ONLY);
    const renderer = new PdfRenderer(pfd);
    try {
      const pageCount = renderer.getPageCount();
      const page = renderer.openPage(Math.min(index, pageCount - 1));
      const width = page.getWidth(),
        height = page.getHeight();
      const k = targetWidthPx / width;
      const G = android.graphics;
      const bmp = G.Bitmap.createBitmap(Math.round(width * k), Math.round(height * k), G.Bitmap.Config.ARGB_8888);
      bmp.eraseColor(G.Color.WHITE);
      page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
      page.close();
      return { image: new ImageSource(bmp), width, height, pageCount };
    } finally {
      renderer.close();
      pfd.close();
    }
  }
  const doc = PDFDocument.alloc().initWithURL(NSURL.fileURLWithPath(path));
  if (!doc) throw new Error('Could not open PDF');
  const pageCount = doc.pageCount;
  const page = doc.pageAtIndex(Math.min(index, pageCount - 1));
  const box = page.boundsForBox(1 /* kPDFDisplayBoxCropBox */);
  const rotated = page.rotation % 180 !== 0;
  const width = rotated ? box.size.height : box.size.width;
  const height = rotated ? box.size.width : box.size.height;
  const pts = targetWidthPx / 2; // thumbnail size is in points; @2x is plenty for preview
  const img = page.thumbnailOfSizeForBox(CGSizeMake(pts, (pts * height) / width), 1);
  return { image: new ImageSource(img), width, height, pageCount };
}
