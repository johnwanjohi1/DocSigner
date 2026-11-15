/** In-app help. Keep in step with the app: every answer describes what DocSigner actually does. */
import { FREE_DOCX_LIMIT, FREE_MONTHLY_LIMIT } from '../services/pro.service';

export interface HelpItem {
  q: string;
  a: string;
  pro?: boolean;
}
export interface HelpSection {
  id: string;
  icon: string;
  color: string;
  title: string;
  summary: string;
  items: HelpItem[];
}

export const SUPPORT_EMAIL = 'johnwanjohi@gmail.com';

export const HELP: HelpSection[] = [
  {
    id: 'start',
    icon: '🚀',
    color: '#4f46e5',
    title: 'Getting started',
    summary: 'Draw your signature once, then sign anything',
    items: [
      {
        q: 'How does DocSigner work?',
        a: 'Draw your signature once. Then open a PDF, a Word document or a picture (or scan paper with the camera), drag your signature to the right spot and tap Apply signature & save. DocSigner keeps a signed copy and you can save it anywhere or share it. Everything happens on your phone: no account, and your documents are never uploaded.',
      },
      {
        q: 'First steps',
        a: '1. On the home screen tap Create (or Redraw) and draw your signature, then Save signature.\n2. Tap Scan a document, Sign a PDF, Sign a Word doc, Sign a picture or Take a photo.\n3. Place the signature and tap Apply signature & save.\n4. Choose Save to…, Share / Open or Done.',
      },
      {
        q: 'Where is everything?',
        a: 'Tap ☰ at the top left (or swipe in from the left edge on the home screen) to open the menu: Home, My signature, the signing options, DocSigner Pro, Intro, About and Help. Your signed files are listed at the bottom of the home screen.',
      },
      {
        q: 'Free plan limits',
        a: `The free plan lets you sign ${FREE_MONTHLY_LIMIT} documents or pictures each month and try ${FREE_DOCX_LIMIT} Word documents in total. Free copies carry a small "Signed with DocSigner" watermark. The banner on the home screen shows how many signings you have left; tap Go Pro to remove the limits.`,
      },
      {
        q: 'See the introduction again',
        a: 'Open the menu and tap ↺ Intro, or tap Replay the intro at the top of this Help screen.',
      },
    ],
  },
  {
    id: 'signature',
    icon: '✍️',
    color: '#7c3aed',
    title: 'Your signature',
    summary: 'Draw, colour and change your signature',
    items: [
      {
        q: 'Draw your signature',
        a: 'Tap Create (or Redraw) on the home screen, or My signature in the menu. Sign in the white box with your finger. Undo removes the last stroke and Clear starts again. Tap Save signature when you are happy with it.',
      },
      {
        q: 'Ink colour and thickness',
        a: 'Below the drawing box, tap any of the 20 ink colours (black, navy, blue, red, green and more). Drag the Thickness slider to make the line thinner or bolder; the preview line under it shows the result. You can change the colour after drawing and the whole signature updates.',
      },
      {
        q: 'Change your signature',
        a: 'Tap Redraw on the home screen and draw a new one. Documents you have already signed keep the signature they were signed with.',
      },
      {
        q: 'Where is my signature kept?',
        a: 'Only on this phone, inside DocSigner. It is used for the documents you sign and is never uploaded.',
      },
    ],
  },
  {
    id: 'pdf',
    icon: '📄',
    color: '#ef4444',
    title: 'Signing PDFs',
    summary: 'Place, resize and sign one or every page',
    items: [
      {
        q: 'Sign a PDF',
        a: 'Tap Sign a PDF and choose the file (from the phone, Downloads, Google Drive and so on). Drag the signature into place or tap where it should go, set its size with the Size slider, and tap Apply signature & save.',
      },
      {
        q: 'Documents with several pages',
        a: 'Use the ‹ and › buttons under the page to move between pages; the dots show where you are. The signature goes on the page you are viewing. Turn on Sign every page (same spot) to sign all pages at once, for example for initials.',
      },
      {
        q: 'Add the date',
        a: 'Turn on Add date under signature to print today’s date under your signature on the PDF.',
      },
      {
        q: 'Is my original PDF changed?',
        a: 'No. DocSigner saves a new signed copy and leaves the original file as it was.',
      },
    ],
  },
  {
    id: 'word',
    icon: '📝',
    color: '#2563eb',
    title: 'Word documents',
    summary: 'Sign .docx files on the page, like a PDF',
    items: [
      {
        q: 'Sign a Word document',
        a: 'Tap Sign a Word doc and choose a .docx file. DocSigner shows the document as pages, the same size as in Word. Move between pages with ‹ and ›, drag the signature where it belongs (or tap the spot), set its size and tap Apply signature & save. The signature is placed exactly there when the document is opened in Word or Google Docs.',
      },
      {
        q: 'Use a {{signature}} spot',
        a: 'If the document contains the text {{signature}}, a switch Use the {{signature}} spot appears. Turn it on and your signature replaces that text, at the width you choose, with an optional date underneath.',
      },
      {
        q: 'Word documents on the free plan',
        a: `You can sign ${FREE_DOCX_LIMIT} Word documents for free. After that, Word signing is locked until you go Pro. The Sign a Word doc tile on the home screen shows how many you have left.`,
        pro: true,
      },
      {
        q: 'Older .doc files',
        a: 'Only .docx files can be signed. Open an older .doc file in Word or Google Docs and save it as .docx first.',
      },
      {
        q: 'The preview looks slightly different from Word',
        a: 'The preview is a close approximation of the page so you can place your signature; fonts and line breaks may differ a little. The signature is anchored to the paragraph under it, so it stays next to the right text in the real document.',
      },
    ],
  },
  {
    id: 'scan',
    icon: '📷',
    color: '#0ea5e9',
    title: 'Scanning paper',
    summary: 'Turn paper documents into a PDF to sign',
    items: [
      {
        q: 'Scan a document',
        a: 'Tap Scan a document. Point the camera at the page: the scanner finds the edges, straightens and crops it. Add more pages if you need them, then tap Done. DocSigner turns the pages into a PDF and opens it for signing.',
      },
      {
        q: 'Tips for a good scan',
        a: 'Use good light, put the page on a dark, flat surface and keep the whole page in view. You can retake or crop a page before finishing.',
      },
      {
        q: 'The scanner doesn’t start',
        a: 'The scanner is provided by Google Play services and may need a moment to download the first time. If it can’t run on your phone, DocSigner opens the normal camera instead.',
      },
    ],
  },
  {
    id: 'pictures',
    icon: '🖼️',
    color: '#059669',
    title: 'Pictures & photos',
    summary: 'Sign photos from your gallery or camera',
    items: [
      {
        q: 'Sign a picture',
        a: 'Tap Sign a picture and choose a photo, or Take a photo to use the camera. Drag and resize the signature on the picture and tap Apply signature & save.',
      },
      {
        q: 'Which photos can DocSigner see?',
        a: 'Only the one you pick. DocSigner uses Android’s photo picker, so it never gets access to your whole gallery.',
      },
    ],
  },
  {
    id: 'files',
    icon: '📤',
    color: '#d97706',
    title: 'Saving & sharing',
    summary: 'Save to a folder, share, preview and delete',
    items: [
      {
        q: 'Choose where to save a signed document',
        a: 'After signing, tap Save to… and pick any folder: Downloads, a folder on the phone or SD card, or Google Drive. You can also do this later: open the file from Signed files and choose Save to… from the ⋮ menu.',
      },
      {
        q: 'Share a signed document',
        a: 'Tap Share / Open after signing, or the ↗ button on a file in Signed files, then choose WhatsApp, Gmail, Drive or any app.',
      },
      {
        q: 'Signed files list',
        a: 'Signed copies appear under Signed files on the home screen. Switch between Grid (with thumbnails) and List. Tap a file to preview it: flip through PDF pages, read Word documents, and pinch to zoom on photos.',
      },
      {
        q: 'Delete a signed file',
        a: 'Tap ✕ on the file, or Delete in the preview’s ⋮ menu, and confirm. Copies you saved elsewhere with Save to… are not affected.',
      },
    ],
  },
  {
    id: 'pro',
    icon: '👑',
    color: '#d97706',
    title: 'DocSigner Pro',
    summary: 'Unlimited signing, Word and no watermark',
    items: [
      {
        q: 'What does Pro include?',
        a: 'Unlimited signing every month, unlimited Word documents, and no "Signed with DocSigner" watermark on your files.',
        pro: true,
      },
      {
        q: 'Plans',
        a: 'Choose Monthly or Yearly (both renew automatically; the yearly plan may include a free trial), or Lifetime: one payment, Pro forever. Open Go Pro on the home screen or DocSigner Pro in the menu.',
        pro: true,
      },
      {
        q: 'Restore my purchase',
        a: 'On a new phone or after reinstalling, open the Pro screen and tap Restore purchases. Use the same Google account you bought Pro with.',
      },
      {
        q: 'Remove the watermark',
        a: 'Files signed on the free plan carry a small "Signed with DocSigner" watermark. With Pro, new files are saved without it.',
        pro: true,
      },
      {
        q: 'Cancel a subscription',
        a: 'Open the Pro screen and tap Manage subscription, or in the Play Store go to your profile → Payments & subscriptions → Subscriptions. Pro stays active until the end of the period you paid for.',
      },
    ],
  },
  {
    id: 'privacy',
    icon: '🔒',
    color: '#0f766e',
    title: 'Privacy',
    summary: 'Your documents never leave your phone',
    items: [
      {
        q: 'Are my documents uploaded?',
        a: 'No. Documents, scans, photos and your signature are processed and stored only on your phone. Nothing is sent to us. Files leave the phone only when you save them somewhere or share them.',
      },
      {
        q: 'Permissions',
        a: 'The camera is used only when you scan or take a photo. Pictures are chosen with Android’s photo picker, so DocSigner doesn’t need access to your gallery.',
      },
    ],
  },
  {
    id: 'trouble',
    icon: '🛠',
    color: '#e5484d',
    title: 'Troubleshooting',
    summary: 'When something doesn’t work as expected',
    items: [
      {
        q: 'I can’t find my file in the picker',
        a: 'Tap ☰ in the picker to browse other places (Downloads, Drive, the SD card) or use 🔍 to search by name. Sign a PDF only shows PDFs and Sign a Word doc only shows .docx files.',
      },
      {
        q: 'It says I have used my free signings',
        a: `The free plan includes ${FREE_MONTHLY_LIMIT} signings each calendar month; they reset on the 1st. Go Pro for unlimited signing.`,
      },
      {
        q: 'I bought Pro but it isn’t active',
        a: 'Check your internet connection, open the Pro screen and tap Restore purchases with the Google account you used to buy it.',
      },
      {
        q: 'The signature is too big or small',
        a: 'Use the Size slider on the signing screen before saving. For Word documents using the {{signature}} spot, use the Width slider.',
      },
      {
        q: 'Contact support',
        a: `Email ${SUPPORT_EMAIL} with a short description and, if you can, a screenshot.`,
      },
    ],
  },
];
