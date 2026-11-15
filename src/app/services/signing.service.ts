import { Injectable, signal } from '@angular/core';
import { File, Folder, path as fsPath } from '@nativescript/core';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import JSZip from 'jszip';
import type { DocKind, PickedFile } from '../native/files';
import { extOf, readBytes, signedFolder, uniqueName, writeBytes } from '../native/files';
import { Placement, compositeImage, drawWatermark, loadPhoto } from '../native/imaging';
import { SavedSignature } from './signature.service';

export interface SignedFile {
  path: string;
  name: string;
  kind: DocKind;
  modified: Date;
}

export interface PdfSignOptions {
  pageIndex: number;
  allPages: boolean;
  placement: Placement;
  /** Optional caption printed under the signature, e.g. "Signed 10 Nov 2026". */
  caption?: string;
  /** Free plan: small "Signed with DocSigner" mark. */
  watermark?: boolean;
}

export interface DocxSignOptions {
  /** Signature width in centimetres. */
  widthCm: number;
  /** Replace the {{signature}} placeholder if present, otherwise append at the end. */
  usePlaceholder: boolean;
  caption?: string;
  /**
   * Place the signature exactly where the user dropped it: a floating image anchored to the paragraph
   * with top-level index `pi`, offset from the page's left edge and from the top of that paragraph (points).
   */
  anchor?: { pi: number; xPt: number; yPt: number; widthPt: number };
  /** Free plan: small "Signed with DocSigner" mark. */
  watermark?: boolean;
}

export const DOCX_PLACEHOLDER = '{{signature}}';
const EMU_PER_CM = 360000;

@Injectable({ providedIn: 'root' })
export class SigningService {
  /** The file currently being signed (set by the home screen, read by the sign screen). */
  readonly current = signal<PickedFile | null>(null);
  readonly signedFiles = signal<SignedFile[]>([]);

  refreshSignedFiles(): void {
    const folder = signedFolder();
    const files = folder
      .getEntitiesSync()
      .filter((e) => e instanceof File)
      .map((f: File) => {
        const ext = extOf(f.name);
        const kind: DocKind = ext === 'pdf' ? 'pdf' : ext === 'docx' ? 'docx' : 'image';
        return { path: f.path, name: f.name, kind, modified: f.lastModified };
      })
      .sort((a, b) => b.modified.getTime() - a.modified.getTime());
    this.signedFiles.set(files);
  }

  deleteSigned(path: string): void {
    if (File.exists(path)) File.fromPath(path).removeSync();
    this.refreshSignedFiles();
  }

  private outputPath(original: string, ext?: string): string {
    const dot = original.lastIndexOf('.');
    const stem = (dot > 0 ? original.substring(0, dot) : original).replace(/^\d{10,}_/, '');
    const extension = ext || (dot > 0 ? original.substring(dot + 1) : '');
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    // Local time, e.g. 20261110_154354
    const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const name = `${stem}_signed_${date}.${extension}`.replace(/[^\w.\- ]+/g, '_');
    return fsPath.join(signedFolder().path, name);
  }

  // ------------------------------------------------------------ PDF

  async signPdf(file: PickedFile, sig: SavedSignature, opts: PdfSignOptions): Promise<string> {
    const pdf = await PDFDocument.load(readBytes(file.path), { ignoreEncryption: true });
    const png = await pdf.embedPng(readBytes(sig.path));
    const font = opts.caption || opts.watermark ? await pdf.embedFont(StandardFonts.Helvetica) : null;
    const pages = pdf.getPages();
    const targets = opts.allPages ? pages : [pages[Math.min(opts.pageIndex, pages.length - 1)]];

    for (const page of targets) {
      const box = page.getCropBox();
      const rot = ((page.getRotation().angle % 360) + 360) % 360;
      const W = box.width,
        H = box.height;
      // Displayed page size (what the user saw in the preview).
      const Dw = rot % 180 ? H : W;
      const Dh = rot % 180 ? W : H;
      // Map a displayed point (top-left origin) to PDF user space (bottom-left origin).
      const toPdf = (dx: number, dy: number) => {
        switch (rot) {
          case 90:
            return { x: box.x + dy, y: box.y + dx };
          case 180:
            return { x: box.x + W - dx, y: box.y + dy };
          case 270:
            return { x: box.x + W - dy, y: box.y + H - dx };
          default:
            return { x: box.x + dx, y: box.y + H - dy };
        }
      };
      const p = opts.placement;
      const w = p.w * Dw,
        h = p.h * Dh;
      const anchor = toPdf(p.x * Dw, (p.y + p.h) * Dh); // bottom-left corner of the signature
      page.drawImage(png, { x: anchor.x, y: anchor.y, width: w, height: h, rotate: degrees(rot) });

      if (font && opts.caption) {
        const size = Math.max(6, Math.min(11, h * 0.18));
        const textAnchor = toPdf(p.x * Dw, (p.y + p.h) * Dh + size * 1.3);
        page.drawText(opts.caption, {
          x: textAnchor.x,
          y: textAnchor.y,
          size,
          font,
          color: rgb(0.25, 0.25, 0.25),
          rotate: degrees(rot),
        });
      }

      if (font && opts.watermark) {
        // Free plan: small grey mark in the page's bottom-right corner
        const size = 7;
        const tw = font.widthOfTextAtSize('Signed with DocSigner', size);
        const at = toPdf(Dw - tw - 10, Dh - 8);
        page.drawText('Signed with DocSigner', { x: at.x, y: at.y, size, font, color: rgb(0.55, 0.55, 0.6), rotate: degrees(rot) });
      }
    }

    const out = this.outputPath(file.name, 'pdf');
    writeBytes(out, await pdf.save());
    return out;
  }

  // ------------------------------------------------------------ Images

  async signImage(file: PickedFile, sig: SavedSignature, placement: Placement, watermark = false): Promise<string> {
    const base = loadPhoto(file.path);
    let result = compositeImage(base, sig.image, placement);
    if (watermark) result = drawWatermark(result, 'Signed with DocSigner');
    const isPng = extOf(file.name) === 'png';
    const out = this.outputPath(file.name, isPng ? 'png' : 'jpg');
    const ok = await result.saveToFileAsync(out, isPng ? 'png' : 'jpg', 92);
    if (!ok) throw new Error('Could not save signed image');
    return out;
  }

  // ------------------------------------------------------------ Word (.docx)

  async docxHasPlaceholder(file: PickedFile): Promise<boolean> {
    const zip = await JSZip.loadAsync(readBytes(file.path));
    const xml = await zip.file('word/document.xml')?.async('string');
    return !!xml && paragraphText(xml).some((t) => t.includes(DOCX_PLACEHOLDER));
  }

  async signDocx(file: PickedFile, sig: SavedSignature, opts: DocxSignOptions): Promise<string> {
    const zip = await JSZip.loadAsync(readBytes(file.path));
    const docFile = zip.file('word/document.xml');
    if (!docFile) throw new Error('This is not a valid Word (.docx) document');
    let doc = await docFile.async('string');

    // 1. Add the image to the package.
    const stamp = Date.now();
    const mediaName = `signature_${stamp}.png`;
    zip.file(`word/media/${mediaName}`, readBytes(sig.path));

    // 2. Relationship from document.xml to the image.
    const relId = `rIdSig${stamp}`;
    const relsPath = 'word/_rels/document.xml.rels';
    let rels =
      (await zip.file(relsPath)?.async('string')) ||
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    rels = rels.replace(
      '</Relationships>',
      `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/></Relationships>`,
    );
    zip.file(relsPath, rels);

    // 3. Make sure PNG is a registered content type.
    let types = await zip.file('[Content_Types].xml')!.async('string');
    if (!/Extension="png"/i.test(types)) {
      types = types.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>');
      zip.file('[Content_Types].xml', types);
    }

    // 4. Insert the drawing.
    const cx = Math.round(opts.widthCm * EMU_PER_CM);
    const cy = Math.round(cx / sig.aspect);
    const drawingRun = drawingXml(relId, cx, cy, stamp % 100000);
    const captionRun = opts.caption
      ? `<w:r><w:br/></w:r><w:r><w:rPr><w:sz w:val="18"/><w:color w:val="555555"/></w:rPr><w:t xml:space="preserve">${escapeXml(opts.caption)}</w:t></w:r>`
      : '';
    const watermarkRun = opts.watermark
      ? `<w:r><w:br/></w:r><w:r><w:rPr><w:i/><w:sz w:val="14"/><w:color w:val="8A8F99"/></w:rPr><w:t xml:space="preserve">Signed with DocSigner</w:t></w:r>`
      : '';

    let replaced = false;
    if (opts.anchor) {
      const a = opts.anchor;
      const cxA = Math.round(a.widthPt * 12700);
      const cyA = Math.round(cxA / sig.aspect);
      const anchorRun = anchoredDrawingXml(relId, cxA, cyA, Math.round(a.xPt * 12700), Math.round(a.yPt * 12700), stamp % 100000);
      const bodyStart = doc.indexOf('<w:body');
      const top = /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p\b[^>]*\/>|<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
      top.lastIndex = bodyStart;
      let i = -1;
      let m: RegExpExecArray | null;
      while ((m = top.exec(doc))) {
        i++;
        if (i !== a.pi) continue;
        const el = m[0];
        let next: string;
        if (el.startsWith('<w:tbl')) {
          // anchor into the first paragraph of the table's first cell
          next = el.replace(/(<w:tc\b[\s\S]*?<w:p\b[^>]*>(?:\s*<w:pPr>[\s\S]*?<\/w:pPr>)?)/, `$1${anchorRun}`);
        } else if (el.endsWith('/>')) {
          next = el.replace(/\/>$/, `>${anchorRun}</w:p>`);
        } else {
          next = el.replace(/^(<w:p\b[^>]*>(?:\s*<w:pPr>[\s\S]*?<\/w:pPr>)?)/, `$1${anchorRun}`);
        }
        doc = doc.substring(0, m.index) + next + doc.substring(m.index + el.length);
        replaced = true;
        break;
      }
      if (replaced && watermarkRun) {
        const at = doc.lastIndexOf('<w:sectPr') > doc.lastIndexOf('</w:p>') ? doc.lastIndexOf('<w:sectPr') : doc.lastIndexOf('</w:body>');
        doc = doc.substring(0, at) + `<w:p>${watermarkRun.replace('<w:r><w:br/></w:r>', '')}</w:p>` + doc.substring(at);
      }
    }
    if (!replaced && opts.usePlaceholder) {
      doc = doc.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (para) => {
        if (replaced) return para;
        const text = runTexts(para).join('');
        const at = text.indexOf(DOCX_PLACEHOLDER);
        if (at < 0) return para;
        replaced = true;
        const open = para.match(/^<w:p\b[^>]*>/)![0];
        const pPr = para.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] || '';
        const rPr = para.match(/<w:r\b[^>]*>\s*(<w:rPr>[\s\S]*?<\/w:rPr>)/)?.[1] || '';
        const before = text.substring(0, at);
        const after = text.substring(at + DOCX_PLACEHOLDER.length);
        const textRun = (t: string) =>
          t ? `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(t)}</w:t></w:r>` : '';
        return `${open}${pPr}${textRun(before)}${drawingRun}${captionRun}${watermarkRun}${textRun(after)}</w:p>`;
      });
    }
    if (!replaced) {
      const para = `<w:p>${drawingRun}${captionRun}${watermarkRun}</w:p>`;
      const bodyEnd = doc.lastIndexOf('</w:body>');
      const sect = doc.lastIndexOf('<w:sectPr');
      const lastPara = doc.lastIndexOf('</w:p>');
      // The body-level <w:sectPr> must stay the last child of <w:body>.
      const insertAt = sect > lastPara && sect < bodyEnd ? sect : bodyEnd;
      doc = doc.substring(0, insertAt) + para + doc.substring(insertAt);
    }
    zip.file('word/document.xml', doc);

    const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    const out = this.outputPath(file.name, 'docx');
    writeBytes(out, bytes);
    return out;
  }
}

// ---------------------------------------------------------------- docx helpers

function runTexts(paraXml: string): string[] {
  const out: string[] = [];
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(paraXml))) out.push(unescapeXml(m[1]));
  return out;
}

function paragraphText(xml: string): string[] {
  return (xml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g) || []).map((p) => runTexts(p).join(''));
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Floating signature (wp:anchor) positioned from the page's left edge and the anchor paragraph's top. */
function anchoredDrawingXml(relId: string, cx: number, cy: number, x: number, y: number, id: number): string {
  return (
    `<w:r><w:drawing>` +
    `<wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="251659264" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">` +
    `<wp:simplePos x="0" y="0"/>` +
    `<wp:positionH relativeFrom="page"><wp:posOffset>${x}</wp:posOffset></wp:positionH>` +
    `<wp:positionV relativeFrom="paragraph"><wp:posOffset>${y}</wp:posOffset></wp:positionV>` +
    `<wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:wrapNone/>` +
    `<wp:docPr id="${id}" name="Signature ${id}" descr="Signature"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="0" name="signature.png"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${relId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`
  );
}

function drawingXml(relId: string, cx: number, cy: number, id: number): string {
  return (
    `<w:r><w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">` +
    `<wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:docPr id="${id}" name="Signature ${id}" descr="Signature"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="0" name="signature.png"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${relId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
  );
}
