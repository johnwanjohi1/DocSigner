# DocSigner on Google Play: complete checklist and listing content

This file has everything for publishing DocSigner on Google Play, in the order you'll do it.
The **Copy** blocks are ready to paste into Play Console. They're written for search (Play Store SEO) and fit
Google's character limits. After you edit any of them, run `python tools/check_listing.py` to check the limits again.

| | |
|---|---|
| Package name | `com.docsigner.signpdf.esignature` (permanent after the first upload) |
| Version | `versionCode 1`, `versionName "1.0.0"` in `App_Resources/Android/app.gradle` |
| Release file | `platforms/android/app/build/outputs/bundle/release/app-release.aab` |
| Graphics | `store/play-icon-512.png`, `store/feature-graphic-1024x500.png`, `store/screenshots/` |
| Privacy policy | `store/privacy-policy.html` (needs to be online, see step 3) |
| Build and signing details | [DEPLOYMENT.md](DEPLOYMENT.md) |

---

## Part A: Before you open Play Console

### Step 1. Developer account (once)
- [ ] Sign up at <https://play.google.com/console> (US$25 one-time fee) and complete **identity verification**.
- [ ] *Settings › Payments profile*: create a **merchant / payments profile**. Pro purchases can't be sold without one.
- [ ] Note: new **personal** accounts must run a **closed test with at least 12 testers who stay opted in for 14 days**
      before Google allows a production release. Start recruiting testers now (friends, family, colleagues with Android phones).

### Step 2. Build the signed release (.aab)
- [ ] Create your upload keystore once and back it up (command in [DEPLOYMENT.md §2](DEPLOYMENT.md)).
- [ ] Build:
  ```bash
  ns build android --release --aab --key-store-path C:\keys\docsigner-upload.jks --key-store-password YOUR_STORE_PASSWORD --key-store-alias docsigner --key-store-alias-password YOUR_KEY_PASSWORD
  ```
- [ ] Release builds hide the "DEV ONLY · Toggle Pro" button automatically.

### Step 3. Put the privacy policy online
Google requires a public URL (the app uses the camera).
- [ ] Easiest: **GitHub Pages**. Create a public repo (e.g. `docsigner-privacy`), upload `store/privacy-policy.html`
      renamed to `index.html`, then *Settings › Pages › Deploy from branch: main*. Your URL will look like
      `https://YOUR-USERNAME.github.io/docsigner-privacy/`.
- Alternative: Google Sites. Paste the policy text into a new page and publish it.
- [ ] Open the URL in a browser to confirm it loads. You'll also use this page as the app's website.

---

## Part B: Create the app

### Step 4. Create app
*Home › Create app*:
- [ ] **App name:** `DocSigner: PDF Signer & Scan`
- [ ] **Default language:** English (United States) – en-US
- [ ] **App or game:** App
- [ ] **Free or paid:** Free (Pro is an in-app purchase. A free app can never be changed to paid later; that's fine here.)
- [ ] Tick the declarations (Developer Program Policies, US export laws) › **Create app**.

---

## Part C: App content (*Policy and programs › App content*)

Complete every item. The Dashboard shows which ones are still open.

| Section | What to choose |
|---|---|
| **Privacy policy** | Paste your URL from step 3 |
| **App access** | *All functionality is available without special access* |
| **Ads** | *No, my app does not contain ads* |
| **Content rating** | See below |
| **Target audience** | *18 and over* (you can add 13–17). **Don't** select under-13 age groups: that triggers the Families policy |
| **News app** | No |
| **Data safety** | See below |
| **Government app** | No |
| **Financial features** | *My app doesn't provide any financial features* |
| **Health** | *My app doesn't have any health features* |
| **Advertising ID** | *No*. DocSigner has no ads or analytics and doesn't use the advertising ID |
| **Photo and video permissions** | Not needed. The app uses Android's Photo Picker and doesn't request `READ_MEDIA_IMAGES` |

### Content rating questionnaire (IARC)
- Email: your contact email · Category: **All other app types** (utility / productivity).
- Violence, fear, sexuality, gambling, language, controlled substances: **No** to all.
- Can users interact or exchange content with each other *inside* the app? **No** (sharing goes through other apps).
- Does the app share the user's current location? **No**.
- Does the app allow purchases of digital goods? **Yes**.
- Expected result: **Everyone / PEGI 3 / 3+**.

### Data safety form
1. **Does your app collect or share any of the required user data types?** **No.**
   Documents, scans, photos and the signature are processed and stored only on the phone and never sent to you.
2. Google Play Billing handles purchases. Google's own processing doesn't count as collection by you.
3. Because nothing is collected, the encryption-in-transit and deletion-request questions don't apply.
4. Review the summary › **Save**.

> If you ever add analytics, crash reporting, ads or cloud sync, update this form **before** releasing that version.

---

## Part D: Store listing (*Grow users › Store presence › Main store listing*)

### How Play Store search works (why the text is written this way)
- Google Play has **no keyword field**. Ranking comes from the **title** (strongest), the **short description**,
  and the **full description**, plus installs, ratings and how often people who search a term install your app.
- Main search terms targeted: **sign PDF, PDF signer, e-signature / electronic signature, sign documents,
  document signer, signature app, fill and sign, scan to PDF / document scanner, sign Word / docx, contract**.
- Each term appears naturally 2–4 times. Repeating words more often (keyword stuffing) is against Play policy and can lower your ranking.
- Not allowed in the title, icon or graphics: words like "best", "#1", "free", "top", prices or promotions,
  and emojis in the title. The text below follows these rules.

### App name (max 30): copy
```
DocSigner: PDF Signer & Scan
```
Alternatives if you want to A/B test later (*Store listing experiments*): `DocSigner - Sign PDF & Word`, `DocSigner: Sign PDF, Docs`.

### Short description (max 80): copy
```
Sign PDF, Word & photos with your e-signature. Scan paper to PDF and share fast.
```

### Full description (max 4000): copy
```
DocSigner is the fast, simple way to sign PDF documents, Word files and photos on your phone. Draw your signature once, place it exactly where it belongs, and share the signed document in seconds — no printing, no scanning, no account.

✍️ SIGN PDF DOCUMENTS ANYWHERE
• Open any PDF: contracts, agreements, forms, invoices, leases, NDAs
• Drag your signature onto the page or tap where it should go, then resize it
• Move between pages and sign one page or every page at once
• Add the date under your signature automatically

📄 SIGN WORD DOCUMENTS (.DOCX) TOO
• See your Word document as real pages, just like on a computer
• Place your e-signature exactly where you want it
• Or use a {{signature}} placeholder and DocSigner fills it in

📷 SCAN PAPER TO PDF
• Built-in document scanner finds the edges, crops and straightens each page
• Scan multi-page documents into one PDF, then sign it straight away
• Perfect for forms you received on paper

🖼️ SIGN PHOTOS AND PICTURES
• Add your signature to photos from your gallery or camera
• Great for delivery notes, receipts and signed photos of documents

🎨 YOUR SIGNATURE, YOUR STYLE
• Draw a smooth, natural signature with your finger
• Choose from 20 ink colours, including black, blue and navy
• Adjust the pen thickness with a slider
• Your signature is saved on your phone, ready for every document

📤 SAVE ANYWHERE, SHARE INSTANTLY
• Save signed copies to Downloads, any folder, your SD card or Google Drive
• Share by WhatsApp, Gmail, email or any app
• Preview every signed page before you send it
• All your signed files in one list, with grid and list views

🔒 PRIVATE BY DESIGN
• Your documents and signature never leave your phone
• No sign-up, no account, no uploads to our servers
• Photos are chosen with Android’s photo picker, with no access to your whole gallery

👑 DOCSIGNER PRO
Try DocSigner free: sign 3 documents every month and 3 Word documents to try. Upgrade to Pro for:
• Unlimited signing, every month
• Unlimited Word documents
• No “Signed with DocSigner” watermark
Choose monthly, yearly or a one-time lifetime purchase. Cancel anytime in Google Play.

WHO USES DOCSIGNER?
Freelancers and small businesses signing contracts and quotes, landlords and tenants signing lease agreements, HR teams and new hires signing offer letters, students signing forms, and anyone who needs a quick electronic signature on the go.

DocSigner is an easy PDF signer, document signer and signature app in one. Sign documents, fill and sign forms, and scan to PDF whenever you need to.

Note: DocSigner adds your handwritten signature image to documents. It does not create certificate-based (PKI) digital signatures.
```

> Keep the last "Note" line. It's honest about what the app does, which avoids misleading-claims complaints and
> 1-star reviews from people who expected certificate signatures.

### Graphics
| Field | File | Notes |
|---|---|---|
| App icon | `store/play-icon-512.png` | 512×512 PNG |
| Feature graphic | `store/feature-graphic-1024x500.png` | Required. Shown at the top of the listing |
| Phone screenshots | `store/screenshots/01-hero` … `07-pro` (7 files, 1080×1920) | Upload in file-name order. **The first two matter most**: they show in search results |
| Video (optional) | YouTube URL | A 30-second screen recording of scanning and signing increases installs |
| Tablet screenshots | Optional | Only needed for the "designed for tablets" badge |

All store graphics are rebuilt with `python tools/make_store_assets.py`. To change a screen, save a new phone capture
into `store/raw/` (e.g. `adb exec-out screencap -p > store/raw/02-sign-pdf.png`) and rerun it. Headlines, colours,
stickers and order are in the `SHOTS` list at the top of that script.

### Contact details (*Store settings*)
- [ ] **Email:** your support email (the same one the Help screen uses)
- [ ] **Website:** your privacy-policy page URL (or your own site)
- [ ] Phone: optional, leave it blank

### Category and tags (*Store settings › App category*)
- [ ] **Category:** Business (Productivity is the alternative; most leading PDF-signing apps are in Business)
- [ ] **Tags** (up to 5): Document editor · PDF · Productivity · Office · Business

### Swahili translation (optional, more reach in Kenya, Tanzania and Uganda)
*Main store listing › Manage translations › Add your own translation text › Swahili – sw*.
Ask a native speaker to read it before you publish.

**App name (max 30): copy**
```
DocSigner: Saini PDF na Skena
```

**Short description (max 80): copy**
```
Weka sahihi kwenye PDF, Word na picha. Skena karatasi kuwa PDF, shiriki haraka.
```

**Full description: copy**
```
DocSigner ni njia rahisi na ya haraka ya kuweka sahihi kwenye nyaraka za PDF, faili za Word na picha ukitumia simu yako. Chora sahihi yako mara moja, iweke mahali sahihi, kisha shiriki nyaraka iliyosainiwa kwa sekunde chache — bila kuchapisha wala kufungua akaunti.

✍️ WEKA SAHIHI KWENYE PDF
• Fungua PDF yoyote: mikataba, makubaliano, fomu, ankara
• Buruta sahihi yako kwenye ukurasa, ibadilishe ukubwa
• Saini ukurasa mmoja au kurasa zote kwa mara moja
• Ongeza tarehe chini ya sahihi yako

📄 SAINI NYARAKA ZA WORD (.DOCX)
• Ona nyaraka yako ya Word kama kurasa halisi
• Weka sahihi mahali unapotaka hasa

📷 SKENA KARATASI KUWA PDF
• Skana iliyojengwa ndani hutambua kingo na kunyoosha kila ukurasa
• Skena kurasa nyingi kuwa PDF moja, kisha saini mara moja

🎨 SAHIHI YAKO, MTINDO WAKO
• Rangi 20 za wino na unene unaoweza kurekebishwa

📤 HIFADHI POPOTE, SHIRIKI PAPO HAPO
• Hifadhi kwenye Downloads, folda yoyote au Google Drive
• Shiriki kupitia WhatsApp, Gmail au programu yoyote

🔒 FARAGHA KWANZA
• Nyaraka zako na sahihi yako hazitoki kwenye simu yako
• Hakuna usajili wala akaunti

👑 DOCSIGNER PRO
Jaribu bure: nyaraka 3 kila mwezi na nyaraka 3 za Word. Pro inakupa sahihi bila kikomo, Word bila kikomo na bila alama ya "Signed with DocSigner". Chagua kila mwezi, kila mwaka au malipo ya mara moja.
```

---

## Part E: Testing tracks

### Step 5. Internal testing (do this first)
1. [ ] *Test and release › Testing › Internal testing › Create new release*.
2. [ ] Accept **Play App Signing** (recommended) and upload `app-release.aab`.
3. [ ] Release name: `1.0.0`. Release notes: paste the block below.
4. [ ] *Testers* tab: create an email list with your own Gmail address › Save › **Start rollout**.
5. [ ] Open the opt-in link on your phone and install. Uninstall the debug build first, because a different signature blocks the update.

> You can only create the Pro products (Part F) **after** a build with the Billing library has been uploaded,
> so this upload must come first.

### Release notes, version 1.0.0 (max 500): copy
```
Welcome to DocSigner 1.0!
• Sign PDF documents, Word files and photos with your handwritten signature
• Scan paper documents to PDF with the built-in scanner
• 20 ink colours and adjustable pen thickness
• Save to any folder or Google Drive, or share instantly
• Preview signed documents before sending
• Help & how-to guide for every feature
```

### Step 6. Closed testing (required for new personal accounts)
1. [ ] *Testing › Closed testing › Create track* (or use "Alpha"), upload the same `.aab` (or promote it from Internal).
2. [ ] Add **at least 12 testers** (a Google Group is easiest) and share the opt-in link.
3. [ ] Keep them opted in for **14 days in a row**. Ask them to actually use the app. Google checks engagement and
       asks about it when you apply.
4. [ ] After 14 days: *Dashboard › Apply for production* and answer the questions about your test.

---

## Part F: In-app products (*Monetize with Play › Products*)

The IDs must match `src/app/services/pro.service.ts` exactly. **Activate** each product after creating it.

### Subscriptions (*Subscriptions › Create subscription*)
| Product ID | Name | Base plan |
|---|---|---|
| `docsigner_pro_monthly` | DocSigner Pro (Monthly) | Auto-renewing, 1 month, e.g. KES 299 / US$2.99 |
| `docsigner_pro_yearly` | DocSigner Pro (Yearly) | Auto-renewing, 1 year, e.g. KES 1,999 / US$19.99 |

For each subscription:
- **Description: copy** (max 200)
  - Monthly: `Unlimited signing, unlimited Word documents and no watermark. Billed monthly, cancel anytime.`
  - Yearly: `Unlimited signing, unlimited Word documents and no watermark. Billed yearly at the best price.`
- **Benefits** (*Subscription › Edit subscription details › Benefits*): up to 4 lines, 40 characters each.
  Google Play shows them on the purchase screen and in the user's subscription settings, so they say what Pro adds.

  **Monthly, Benefits (English): copy**
  ```
  Unlimited PDF & photo signing
  Unlimited Word (.docx) signing
  No "Signed with DocSigner" mark
  Cancel anytime in Google Play
  ```

  **Yearly, Benefits (English): copy**
  ```
  Unlimited signing all year long
  Unlimited Word (.docx) signing
  No watermark on signed documents
  Best value: pay once a year
  ```

  If you added the Swahili listing, add these under *Manage translations* for each subscription:

  **Monthly, Benefits (Swahili): copy**
  ```
  Saini PDF na picha bila kikomo
  Saini nyaraka za Word bila kikomo
  Bila alama ya "Signed with DocSigner"
  Ghairi wakati wowote kwenye Google Play
  ```

  **Yearly, Benefits (Swahili): copy**
  ```
  Saini bila kikomo mwaka mzima
  Saini nyaraka za Word bila kikomo
  Bila alama ya maji kwenye nyaraka
  Thamani bora: lipa mara moja kwa mwaka
  ```
- Optional but recommended on the yearly plan: add an **offer › Free trial, 7 days, new customers only**.
  The app detects it and shows "Start 7-day free trial".
- Use *Set prices › Update exchange rates* so every country gets a local price.

### One-time product (*In-app products › Create product*)
One-time products have only a name and a description (no benefits list), so the description carries the benefits.
| Product ID | Name | Description (max 200): copy | Price |
|---|---|---|---|
| `docsigner_pro_lifetime` | DocSigner Pro (Lifetime) | Pay once and keep Pro forever: unlimited signing, unlimited Word documents and no watermark. | e.g. KES 4,999 / US$39.99 |

### Test the purchases
- [ ] *Settings › License testing*: add your tester Gmail accounts (they're never charged).
- [ ] On the internal-testing install: buy each plan → "Welcome to DocSigner Pro!" appears, the watermark disappears and Word is unlocked.
- [ ] Uninstall, reinstall, then use **Restore purchases**.

---

## Part G: Go live

### Step 7. Production release
1. [ ] *Production › Countries/regions*: add all countries, or start with Kenya plus the countries you want.
2. [ ] *Production › Create new release*: promote the tested build (or upload the `.aab`) and paste the release notes.
3. [ ] Use a **staged rollout** (start at 20%), then watch *Android vitals* for crashes for 1–2 days before going to 100%.
4. [ ] Review usually takes from a few hours to about 7 days for a new app.

### Final checks before you submit
- [ ] All *App content* items are green on the Dashboard
- [ ] Privacy-policy URL opens in a browser
- [ ] All three products are **Active**, with prices
- [ ] App tested on the phone: scan, sign PDF / Word / photo, Save to, Share, free limits, purchase, restore
- [ ] Phone dark mode on: the app still looks the same (it always uses its light design)

---

## Part H: After launch (keeps the ranking growing)

- **Ratings matter most for search.** Reply to every review within a day or two, especially low ratings.
- Check *Statistics › Acquisition › Search terms* monthly. If a term brings visitors but few installs, change the
  first screenshot or the short description to address it. If a useful term is missing, work it naturally into the full description.
- Use **Store listing experiments** to test the title alternatives and the first screenshot, one change at a time.
- Ship an update every 4–8 weeks with real release notes. Regular updates help both ranking and trust.
- Add more **translations** (e.g. French, Portuguese, Spanish) later for each market you target. Translate the short description first.
- Every update: bump `versionCode` (+1) and `versionName` in `app.gradle`, build, upload to Internal testing, test, then promote to Production.
