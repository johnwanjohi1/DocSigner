# DocSigner: Google Play Store listing kit

Copy each block into the matching Play Console field. Character limits are checked by
`python tools/check_listing.py`.

---

## 1. App name (max 30)

**Recommended:**

```
DocSigner: PDF Signer & Scan
```

Alternatives, all 30 characters or fewer:

- `DocSigner - Sign PDF & Word`
- `DocSigner: Sign PDF, Docs`

> SEO: the title carries the most search weight on Google Play. "PDF signer", "sign PDF" and "scan"
> are among the highest-volume terms in this category. Keep the brand first so it stays memorable.

## 2. Short description (max 80)

```
Sign PDF, Word & photos with your e-signature. Scan paper to PDF and share fast.
```

> Shown under the title and indexed for search. It covers: sign PDF · Word · e-signature · scan · PDF.

## 3. Full description (max 4000)

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

> SEO notes: Google Play has no keyword field, so ranking comes from the title, the short description and natural
> repetition in this text. The main terms appear 2–4 times each without stuffing: *sign PDF*, *PDF signer*,
> *e-signature / electronic signature*, *sign documents*, *Word / .docx*, *scan to PDF / document scanner*,
> *signature app*, *fill and sign*, *contracts / forms*. Keep them if you edit the text.

## 4. What's new / release notes (max 500), version 1.0.0

```
Welcome to DocSigner 1.0!
• Sign PDF documents, Word files and photos with your handwritten signature
• Scan paper documents to PDF with the built-in scanner
• 20 ink colours and adjustable pen thickness
• Save to any folder or Google Drive, or share instantly
• Preview signed documents before sending
• Help & how-to guide for every feature
```

## 5. Graphics

| Play Console field                   | File                                                              |
| ------------------------------------ | ----------------------------------------------------------------- |
| App icon (512×512, 32-bit PNG)      | `store/play-icon-512.png`                                       |
| Feature graphic (1024×500)          | `store/feature-graphic-1024x500.png`                            |
| Phone screenshots (2–8, 1080×1920) | `store/screenshots/*-1080x1920.png` (upload in file-name order) |

Screenshots are regenerated from `store/raw/` with `python tools/make_store_screenshots.py`; captions live in that
script. Icons and the feature graphic come from `python tools/generate_assets.py`.

## 6. Categorisation & contact

- **App category:** Business. An alternative is Productivity, but most leading PDF-signing apps sit in Business.
- **Tags** (pick up to 5 in *Store settings*): Document editor, PDF, Productivity, Business, Office.
- **Email:** `johnwanjohi@gmail.com`
- **Website:** optional. Use the page where you host the privacy policy.
- **Privacy policy URL:** host `store/privacy-policy.html`, for example on GitHub Pages or Google Sites, and paste its link.

## 7. In-app products (Monetize › Products)

**Subscriptions.** Each has a base plan; the benefit lines are 40 characters max each, up to 4.

| Product ID                | Name                    | Description (max 200)                                                                          |
| ------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------- |
| `docsigner_pro_monthly` | DocSigner Pro (Monthly) | Unlimited signing, unlimited Word documents and no watermark. Billed monthly, cancel anytime.  |
| `docsigner_pro_yearly`  | DocSigner Pro (Yearly)  | Unlimited signing, unlimited Word documents and no watermark. Billed yearly at the best price. |

Benefits for both subscriptions:

```
Unlimited signing every month
Unlimited Word (.docx) documents
No DocSigner watermark
Cancel anytime in Google Play
```

**One-time product:**

| Product ID                 | Name                     | Description (max 200)                                                                        |
| -------------------------- | ------------------------ | -------------------------------------------------------------------------------------------- |
| `docsigner_pro_lifetime` | DocSigner Pro (Lifetime) | Pay once and keep Pro forever: unlimited signing, unlimited Word documents and no watermark. |

Suggested prices: Monthly KES 299 / US$2.99 · Yearly KES 1,999 / US$19.99 (optional 7-day free trial offer) ·
Lifetime KES 4,999 / US$39.99.

## 8. Data safety form (Policy › App content › Data safety)

- **Does your app collect or share any of the required user data types?** No.
- Documents, scans, photos and the signature are processed and stored **only on the device**. Nothing is
  transmitted to the developer.
- Purchases are handled by Google Play Billing (Google's processing isn't collection by you).
- **Is all user data encrypted in transit?** Not applicable (no data is transmitted).
- **Do you provide a way to request data deletion?** Not applicable: data stays on the device and is deleted when the app is uninstalled.

## 9. Content rating questionnaire (IARC)

- Category: **Utility, productivity, communication or other**.
- Violence, sexuality, language, controlled substances, gambling: **No** to all.
- Users can interact or share content with each other inside the app: **No** (sharing goes through other apps).
- Shares the user's location: **No**. Digital purchases: **Yes** (in-app purchases).
- Expected rating: **Everyone / PEGI 3**.

## 10. Other declarations

- **Ads:** No, the app contains no ads.
- **App access:** All functionality is available without special access or login.
- **Target audience:** 18 and over (or 13+). Don't select children's age groups.
- **Photo & video permissions:** none requested. The app uses the Android Photo Picker.
- **Financial features:** none.
- **Government app / health / news:** No.

---

## Optional: Swahili (sw) listing, for better reach in Kenya and East Africa

Add it in *Main store listing › Manage translations › Add your own translation (Swahili)*.
Have a native speaker review it before publishing.

**Jina (max 30):**

```
DocSigner: Saini PDF na Skena
```

**Maelezo mafupi (max 80):**

```
Weka sahihi kwenye PDF, Word na picha. Skena karatasi kuwa PDF, shiriki haraka.
```

**Maelezo kamili:**

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
