# DocSigner

A NativeScript + Angular (NgModule) app for signing **PDFs**, **Word documents (.docx)**, **scanned paper** and **pictures**
with a hand-drawn signature. Package: `com.docsigner.signpdf.esignature`. Publishing steps: [DEPLOYMENT.md](DEPLOYMENT.md).

## Features

- **Signature pad**: draw with your finger; 20 ink colours; draggable thickness slider; undo/clear. Saved on the device.
- **Scan a document** with Google ML Kit Document Scanner (edge detection, crop, multi-page), turned into a PDF ready to sign.
  Falls back to the camera if the scanner is unavailable.
- **Sign PDFs**: page preview, drag/tap/resize the signature, pill pager for multi-page documents, sign every page, date caption.
- **Sign Word (.docx) like a PDF**: the document is laid out as real pages (its page size and margins); the signature is inserted
  as a floating image anchored to the paragraph where you drop it. The `{{signature}}` placeholder is also supported.
- **Sign pictures** from the Android Photo Picker (no media permission) or the camera.
- **After signing**: *Save to…* (any folder, Downloads, SD card, Drive), *Share / Open*, or *Done*.
- **Signed files**: grid/list views with thumbnails, full previews (PDF pages, Word layout, pinch-zoom photos), share, delete.
- **Free vs Pro** (Google Play Billing 8: monthly/yearly subscriptions plus lifetime):
  - Free: 3 signings/month, 3 Word documents in total, small "Signed with DocSigner" mark.
  - Pro: unlimited, Word unlocked, no mark. Dev builds show a "Toggle Pro" switch on the paywall.
- Animated illustrated splash, 4-page onboarding, side-drawer menu, bottom-sheet dialogs (Invoice Maker style),
  portrait-only.

## Run (development)

```bash
npm install
ns run android
```

Requirements: NativeScript CLI 9, Android SDK (API 36), JDK 17+. iOS needs Xcode and has no in-app purchases yet.

## Project layout

```
src/app/
  app.module.ts / app-routing.module.ts   root module, lazy feature routes
  home/ signature/ sign/ preview/ intro/ paywall/   feature modules (component + routing + module)
  native/files.ts      byte I/O, document picker, ML Kit scanner, Save to…, share
  native/imaging.ts    signature rendering, photo compositing, watermark, PDF page rendering
  native/billing.ts    Google Play Billing 8 wrapper
  services/            signing (PDF/DOCX/image), preview, Pro/limits, dialogs, drawer, prefs
tools/generate_assets.py   app icons, splash, illustrations, Play Store graphics
store/                     Play Store icon + feature graphic
```

## Notes

- Don't add an app-level `App_Resources/Android/native-api-usage.json` whitelist. It filtered out core classes and broke start-up;
  the full metadata already includes Play Billing and ML Kit.
- After changing the app ID, restart `ns run` (a running session keeps deploying to the old ID).
