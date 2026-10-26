# Folio Scanner

A phone scanner that runs in the browser and installs like an app. It turns photos of pages and open books into clean, searchable PDFs.

**Open it:** https://dancarter10.github.io/folio-scanner/

- HD scans: full-resolution photos from the phone camera, kept at full detail (about 300 dpi on an A4 page)
- Live camera with a page outline and auto-capture (it snaps again after you turn the page)
- Edge-to-edge cropping: finds each page's exact edges, including curved and bowed pages, and flattens them
- Book mode splits a two-page spread at the spine and flattens the curve of each page
- Lifts shadows, removes fingers at the page edges and cleans away bits of desk at folded or curled corners
- Looks: Auto, Grey, Black & white, Photo
- Text recognition on the phone (searchable PDFs, copy text)
- Mark-up: pen, highlighter, text, signature, white-out and black-out boxes
- Class and subject filing for file names
- Share PDFs to OneDrive, Google Drive, WhatsApp or email

Photos are processed on the device and stay there until you share them.

## Install on a phone

Open the link in Chrome on Android and tap **Install Folio on this phone**, or use Chrome's menu and choose **Install app**. On an iPhone, open it in Safari, tap **Share**, then **Add to Home Screen**.

## Credits

Text recognition uses [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) through [tesseract.js-core](https://github.com/naptha/tesseract.js-core) and its English language data, loaded from the jsDelivr CDN the first time it is used, all under the Apache License 2.0 (see `LICENSE-tesseract.txt`).
