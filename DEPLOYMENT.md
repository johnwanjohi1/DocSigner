# Deploying DocSigner to Google Play

This guide covers everything needed to publish DocSigner, from a signed release build to the Pro in-app purchases.
Steps marked **(once)** only happen for the first release.

| Item                          | Value                                                                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package name (application ID) | `com.docsigner.signpdf.esignature` (set in `nativescript.config.ts`; **permanent after the first upload**)                                                                                    |
| Version                       | `versionCode` / `versionName` in `App_Resources/Android/app.gradle`                                                                                                                               |
| Target SDK                    | 36 (meets Google Play's current target-API requirement)                                                                                                                                                 |
| Pro products                  | `docsigner_pro_monthly`, `docsigner_pro_yearly` (subscriptions), `docsigner_pro_lifetime` (one-time)                                                                                              |
| Store graphics                | `store/play-icon-512.png`, `store/feature-graphic-1024x500.png` (regenerate with `python tools/make_store_assets.py`)                                                                             |
| Store listing text (SEO)      | [PLAYSTORE.md](PLAYSTORE.md): step-by-step Play Console checklist with all listing text (name, descriptions, release notes, products, Data safety, rating), checked by `python tools/check_listing.py` |
| Phone screenshots             | `store/screenshots/*-1080x1920.png` (rebuild with `python tools/make_store_assets.py` from `store/raw/`)                                                                                          |
| Privacy policy page           | `store/privacy-policy.html`: host it and paste the URL into Play Console                                                                                                                              |

---

## 1. Accounts (once)

1. Create a **Google Play Console** developer account (one-time US$25 fee): [https://play.google.com/console](https://play.google.com/console).
   - New personal accounts must run a **closed test with at least 12 testers for 14 days** before production access is granted. Plan for this.
2. In Play Console › *Settings › Payments profile*, set up a **merchant/payments profile**. You can't sell Pro without one.

## 2. Create your upload keystore (once)

Run this **once** and keep the file and passwords somewhere safe (a password manager plus an off-device backup).
If you lose them you can ask Google to reset the upload key, but it's slow.

```bash
keytool -genkeypair -v -keystore docsigner-upload.jks -alias docsigner -keyalg RSA -keysize 2048 -validity 10000
```

- Store `docsigner-upload.jks` **outside** the project folder (it's not in git, and shouldn't be).
- Google Play App Signing (on by default) keeps the real app-signing key. You sign uploads with this upload key.

## 3. Before every release

1. Bump the version in `App_Resources/Android/app.gradle`:
   ```gradle
   versionCode 2        // +1 on every upload, never reused
   versionName "1.0.1"  // what users see
   ```
2. Test the app on a phone (see §8).

## 4. Build the release bundle (.aab)

Run this in your own terminal from the project folder:

```bash
ns build android --release --aab --key-store-path C:\keys\docsigner-upload.jks --key-store-password YOUR_STORE_PASSWORD --key-store-alias docsigner --key-store-alias-password YOUR_KEY_PASSWORD
```

The bundle is written to `platforms/android/app/build/outputs/bundle/release/app-release.aab`.

Release builds are production builds, so the **"DEV ONLY · Toggle Pro" button on the paywall disappears automatically**
(it only shows when `__DEV__` is true).

## 5. Create the app in Play Console (once)

*All apps › Create app*:

- **App name:** `DocSigner: PDF Signer & Scan` (see [PLAYSTORE.md](PLAYSTORE.md)). Up to 30 characters; the title is the biggest search factor.
- Default language, **App** (not game), **Free** (Pro is an in-app purchase).

### Store listing (*Grow › Store presence › Main store listing*)

Copy every text field from **[PLAYSTORE.md](PLAYSTORE.md)**: short description, full description, release notes,
category, in-app product names and the optional Swahili translation. They're SEO-tuned and checked against the limits.

- **App icon:** `store/play-icon-512.png`
- **Feature graphic:** `store/feature-graphic-1024x500.png`
- **Phone screenshots:** upload `store/screenshots/*-1080x1920.png` in file-name order.
  To add or replace one, save a raw capture (`adb exec-out screencap -p > store/raw/01-home.png`) with a name
  listed in `tools/make_store_assets.py`, then rerun that script.

### App content (*Policy › App content*)

- **Privacy policy URL:** required (the app uses the camera and photos). Host a page, e.g. on GitHub Pages or
  Google Sites, with the template in §10.
- **Ads:** No ads.
- **App access:** All functionality is available without login.
- **Content rating:** complete the questionnaire (utility app, no objectionable content; expect *Everyone / 3+*).
- **Target audience:** 18+ (or 13+). Avoid "children" unless you mean it, because it triggers extra rules.
- **Data safety:** see §9.
- **Photo and video permissions:** the app uses Android's **Photo Picker** and requests **no**
  `READ_MEDIA_IMAGES` permission, so no declaration is needed.

## 6. First upload to Internal testing (once, then per test build)

1. *Test and release › Testing › Internal testing › Create new release* and upload `app-release.aab`.
2. Add yourself and testers (email list), save and roll out.
3. Testers install the app via the opt-in link.

> Google Play only lets you create in-app products **after** a build that includes the Billing library
> has been uploaded, so this upload must come before §7.

## 7. Create the Pro products (once)

*Monetize › Products*:

**Subscriptions** (*Subscriptions › Create subscription*):

| Product ID                | Base plan              | Suggested                                                                    |
| ------------------------- | ---------------------- | ---------------------------------------------------------------------------- |
| `docsigner_pro_monthly` | auto-renewing, 1 month | e.g. KES 299 / US$2.99                                                       |
| `docsigner_pro_yearly`  | auto-renewing, 1 year  | e.g. KES 1,999 / US$19.99, plus an optional **7-day free-trial offer** |

The app picks an offer with a free trial automatically if one exists, and shows "Start 7-day free trial".

**One-time product** (*In-app products › Create product*):

| Product ID                 | Type     | Suggested                 |
| -------------------------- | -------- | ------------------------- |
| `docsigner_pro_lifetime` | one-time | e.g. KES 4,999 / US$39.99 |

**Activate** every product. The IDs must match exactly; they're set in `src/app/services/pro.service.ts`.

### Test purchases

- *Settings › License testing*: add tester Gmail accounts. Their purchases use test cards and are never charged.
- Install from the internal-testing link, open **Go Pro**, buy, and check that "Welcome to DocSigner Pro!" appears.
- Test **Restore purchases** after reinstalling.
- Subscriptions renew quickly for testers (a monthly plan renews every few minutes), which is handy for testing expiry.

## 8. What to test before each production release

- [ ] First launch: splash → intro (4 pages, swipe and Next, Skip) → home
- [ ] Draw a signature: colours, thickness slider, undo/clear, save
- [ ] Scan a document (ML Kit scanner) → sign → Save to… / Share
- [ ] Sign a PDF (drag, resize, multi-page, sign every page, date caption)
- [ ] Sign a Word document: drag onto the page, then open the result in Word / Google Docs to check the position
- [ ] Sign a picture (gallery photo picker) and a camera photo
- [ ] Preview signed files (PDF pages, Word, photo zoom), grid and list views, delete
- [ ] Free plan: the 4th signing in a month shows the upgrade sheet; the 4th Word document is locked; the watermark appears
- [ ] Pro (test purchase): no watermark, unlimited, Word unlocked; Restore purchases
- [ ] Back arrows, drawer, portrait lock (rotate the phone)

## 9. Data safety form answers

- **Does the app collect or share user data?** No. Documents, photos and the signature are processed and
  stored **on the device only**. Nothing is uploaded to our servers (there are none).
- Purchases are processed by Google Play. Google's billing doesn't count as collection by you.
- **Data encrypted in transit:** not applicable (no transfer).
- **Users can request deletion:** data lives only on the device; uninstalling or deleting files removes it.

If you later add analytics, crash reporting or cloud sync, update this form first.

## 10. Privacy policy template

> **DocSigner Privacy Policy**. Last updated: [date]
>
> DocSigner lets you sign documents and pictures on your device. We do not collect, store or share any
> personal data. Documents, photos, scans and your signature are processed locally and saved only on your
> device. The camera and photo access are used only when you choose to scan or sign a picture.
> In-app purchases are handled by Google Play under Google's privacy policy. We do not receive your payment
> details. Contact: [your email].

## 11. Release to production

1. Once testing passes (and the 12-tester / 14-day closed test, for new personal accounts),
   go to *Production › Create new release*, upload the `.aab`, and add release notes.
2. Use a **staged rollout** (e.g. 20%), check *Android vitals* for crashes, then go to 100%.
3. Review usually takes a few hours to a few days.

## 12. Updating the app later

Bump `versionCode` / `versionName` → `ns build android --release --aab …` → upload to a testing track → promote to production.

---

## Known limitations / recommendations

- **iOS:** in-app purchases (StoreKit) are not implemented yet, so iOS users stay on Free. The App Store also
  needs an Apple Developer account (US$99/yr) and a Mac to build.
- **Purchase verification** happens on the device against Google Play. For stronger protection against
  tampering, add server-side verification with the Google Play Developer API later.
- The Pro flag is re-checked against Google Play on every launch, so refunds and expired subscriptions turn Pro off.
