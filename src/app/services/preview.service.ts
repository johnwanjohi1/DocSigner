import { Injectable } from '@angular/core';
import { File, ImageSource, knownFolders, path as fsPath } from '@nativescript/core';
import JSZip from 'jszip';
import { DocKind, kindOf, readBytes, writeBytes } from '../native/files';
import { loadThumbnail, renderPdfPage } from '../native/imaging';

export interface DocRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  size?: number; // points
  color?: string;
}

interface BlockBase {
  /** Index of the top-level body element (paragraph / table) this block came from. */
  pi?: number;
  /** Starts on a new page (explicit page break). */
  pb?: boolean;
}

export type DocBlock =
  | (BlockBase & { type: 'p'; runs: DocRun[]; align: 'left' | 'center' | 'right'; heading: number; bullet: boolean })
  | (BlockBase & { type: 'img'; src: string; width: number; align: 'left' | 'center' | 'right' })
  | (BlockBase & { type: 'table'; rows: string[][] });

/** Page geometry from the document's (last) section, in points. */
export interface DocxPageLayout {
  width: number;
  height: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
}

export interface DocxDocument {
  blocks: DocBlock[];
  layout: DocxPageLayout;
}

/** Illustration shown for Word files (no native renderer for .docx). */
export const DOCX_THUMB = '~/assets/splash/doc-word.png';

/**
 * Thumbnails and previews for PDFs, photos and Word documents.
 * - PDFs: pages rasterised natively, small LRU cache.
 * - Photos: down-sampled bitmaps.
 * - Word (.docx): parsed into simple blocks (headings, formatted text, tables, embedded images).
 */
@Injectable({ providedIn: 'root' })
export class PreviewService {
  private thumbs = new Map<string, ImageSource | string | null>();
  private pageCache = new Map<string, ImageSource>();
  private pageCountCache = new Map<string, number>();

  // ------------------------------------------------------------ thumbnails

  thumbnail(path: string, modified?: Date): ImageSource | string | null {
    const key = `${path}|${modified?.getTime() ?? ''}`;
    if (this.thumbs.has(key)) return this.thumbs.get(key)!;
    let thumb: ImageSource | string | null = null;
    try {
      const kind = kindOf(path);
      if (kind === 'pdf') thumb = renderPdfPage(path, 0, 420).image;
      else if (kind === 'image') thumb = loadThumbnail(path, 480);
      else thumb = DOCX_THUMB;
    } catch (e) {
      console.warn('thumbnail failed', path, e);
    }
    this.thumbs.set(key, thumb);
    return thumb;
  }

  forget(path: string) {
    for (const k of [...this.thumbs.keys()]) if (k.startsWith(path + '|')) this.thumbs.delete(k);
    for (const k of [...this.pageCache.keys()]) if (k.startsWith(path + '#')) this.pageCache.delete(k);
    this.pageCountCache.delete(path);
  }

  // ------------------------------------------------------------ PDF pages

  pdfPageCount(path: string): number {
    if (!this.pageCountCache.has(path)) this.pageCountCache.set(path, renderPdfPage(path, 0, 64).pageCount);
    return this.pageCountCache.get(path)!;
  }

  /** Rendered page, cached (keeps the 6 most recent pages in memory). */
  pdfPage(path: string, index: number, widthPx: number): ImageSource {
    const key = `${path}#${index}@${widthPx}`;
    const hit = this.pageCache.get(key);
    if (hit) {
      this.pageCache.delete(key);
      this.pageCache.set(key, hit);
      return hit;
    }
    const img = renderPdfPage(path, index, widthPx).image;
    this.pageCache.set(key, img);
    while (this.pageCache.size > 6) this.pageCache.delete(this.pageCache.keys().next().value);
    return img;
  }

  // ------------------------------------------------------------ Word

  async docxBlocks(path: string): Promise<DocBlock[]> {
    return (await this.docxDocument(path)).blocks;
  }

  /** Blocks plus page size / margins (twips -> points), for page-accurate rendering. */
  async docxDocument(path: string): Promise<DocxDocument> {
    const zip = await JSZip.loadAsync(readBytes(path));
    const doc = await zip.file('word/document.xml')?.async('string');
    if (!doc) throw new Error('This is not a valid Word (.docx) document');

    // relationship id -> media target
    const rels = (await zip.file('word/_rels/document.xml.rels')?.async('string')) || '';
    const relMap = new Map<string, string>();
    for (const m of rels.matchAll(/<Relationship\b[^>]*?Id="([^"]+)"[^>]*?Target="([^"]+)"[^>]*>/g)) relMap.set(m[1], m[2]);
    for (const m of rels.matchAll(/<Relationship\b[^>]*?Target="([^"]+)"[^>]*?Id="([^"]+)"[^>]*>/g)) relMap.set(m[2], m[1]);

    const outDir = knownFolders.temp().getFolder('preview').getFolder(String(Math.abs(hash(path)))).path;
    const extracted = new Map<string, string>();
    const mediaPath = async (relId: string): Promise<string | null> => {
      if (extracted.has(relId)) return extracted.get(relId)!;
      const target = relMap.get(relId);
      if (!target || /^https?:/i.test(target)) return null;
      const zipPath = target.startsWith('/') ? target.substring(1) : 'word/' + target.replace(/^\.\//, '');
      const f = zip.file(zipPath);
      if (!f || !/\.(png|jpe?g|gif|bmp|webp)$/i.test(zipPath)) return null;
      const dest = fsPath.join(outDir, zipPath.replace(/[\\/]/g, '_'));
      if (!File.exists(dest)) writeBytes(dest, await f.async('uint8array'));
      extracted.set(relId, dest);
      return dest;
    };

    const body = doc.substring(doc.indexOf('<w:body'), doc.lastIndexOf('</w:body>'));
    const blocks: DocBlock[] = [];
    const top = /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p\b[^>]*\/>|<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
    let pi = -1;
    for (const m of body.matchAll(top)) {
      const xml = m[0];
      pi++;
      const firstOfElement = blocks.length;
      const pageBreak = /<w:br w:type="page"\s*\/>|<w:pageBreakBefore(?: w:val="(?:1|true|on)")?\s*\/>/.test(xml);
      const tag = () => {
        for (let i = firstOfElement; i < blocks.length; i++) blocks[i].pi = pi;
        if (pageBreak && blocks[firstOfElement]) blocks[firstOfElement].pb = true;
      };
      if (xml.startsWith('<w:tbl')) {
        const rows = (xml.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || []).map((tr) =>
          (tr.match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || []).map((tc) => texts(tc).trim()),
        );
        if (rows.length) blocks.push({ type: 'table', rows });
        tag();
        continue;
      }
      const style = /<w:pStyle w:val="([^"]+)"/.exec(xml)?.[1] || '';
      const hm = /^(?:Heading|heading)\s?(\d)$/.exec(style);
      const heading = style === 'Title' ? 1 : hm ? Math.min(3, +hm[1]) : 0;
      const jc = /<w:jc w:val="([^"]+)"/.exec(xml)?.[1];
      const align = jc === 'center' ? 'center' : jc === 'right' || jc === 'end' ? 'right' : 'left';
      const bullet = /<w:numPr>/.test(xml);

      let runs: DocRun[] = [];
      const flush = () => {
        if (runs.some((r) => r.text.length)) blocks.push({ type: 'p', runs, align, heading, bullet });
        runs = [];
      };
      for (const r of xml.matchAll(/<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g)) {
        const rx = r[1];
        const embed = /r:embed="([^"]+)"/.exec(rx)?.[1];
        if (embed) {
          flush();
          const src = await mediaPath(embed);
          const cx = +(/<wp:extent cx="(\d+)"/.exec(rx)?.[1] || 0);
          if (src) blocks.push({ type: 'img', src, width: cx ? cx / 9525 : 200, align });
          continue;
        }
        const rPr = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(rx)?.[1] || '';
        const on = (tag: string) => new RegExp(`<w:${tag}(?: w:val="(?!0|false)[^"]*")?\\s*/>`).test(rPr);
        let text = '';
        for (const t of rx.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g)) {
          text += t[0] === '<w:tab/>' ? '    ' : t[0] === '<w:br/>' ? '\n' : unescapeXml(t[1]);
        }
        if (!text) continue;
        const sz = /<w:sz w:val="(\d+)"/.exec(rPr)?.[1];
        const color = /<w:color w:val="([0-9A-Fa-f]{6})"/.exec(rPr)?.[1];
        runs.push({
          text,
          bold: on('b'),
          italic: on('i'),
          underline: /<w:u w:val="(?!none)/.test(rPr),
          size: sz ? +sz / 2 : undefined,
          color: color ? '#' + color : undefined,
        });
      }
      flush();
      if (!xml.includes('<w:t') && !xml.includes('r:embed')) blocks.push({ type: 'p', runs: [{ text: ' ' }], align, heading: 0, bullet: false });
      tag();
    }

    // page size & margins from the last <w:sectPr> (twips; default US Letter with 1" margins)
    const sect = doc.substring(doc.lastIndexOf('<w:sectPr'));
    const tw = (re: RegExp, def: number) => {
      const v = re.exec(sect)?.[1];
      return (v ? +v : def) / 20;
    };
    const layout: DocxPageLayout = {
      width: tw(/<w:pgSz[^>]*w:w="(\d+)"/, 12240),
      height: tw(/<w:pgSz[^>]*w:h="(\d+)"/, 15840),
      marginTop: tw(/<w:pgMar[^>]*w:top="(-?\d+)"/, 1440),
      marginRight: tw(/<w:pgMar[^>]*w:right="(\d+)"/, 1440),
      marginBottom: tw(/<w:pgMar[^>]*w:bottom="(-?\d+)"/, 1440),
      marginLeft: tw(/<w:pgMar[^>]*w:left="(\d+)"/, 1440),
    };
    return { blocks, layout };
  }
}

function texts(xml: string): string {
  let out = '';
  for (const p of xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || []) {
    let line = '';
    for (const t of p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)) line += unescapeXml(t[1]);
    out += (out ? '\n' : '') + line;
  }
  return out;
}

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function kindLabel(kind: DocKind) {
  return kind === 'pdf' ? 'PDF' : kind === 'docx' ? 'DOC' : 'IMG';
}

export function kindColor(kind: DocKind) {
  return kind === 'pdf' ? '#ef4444' : kind === 'docx' ? '#2563eb' : '#059669';
}

/** "10 Nov 2026 · 15:43" */
export function friendlyDate(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Strips our "_signed_YYYYMMDD_HHMMSS" suffix for display. */
export function displayName(name: string): string {
  return name.replace(/_signed_\d{8}_?\d{6}(?=\.\w+$)/, '');
}

