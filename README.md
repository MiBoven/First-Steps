# First Steps

*Behind the Scenes of the Internet*

A tiny, privacy-friendly toolbox for getting a website ready to ship — starting with a favicon generator — plus a plain-language glossary of internet basics. Everything runs entirely in your browser, nothing is ever uploaded to a server.

**Live at:** [first-steps.michels.world](https://first-steps.michels.world)

## Features

### Favicons
- Upload, drag & drop, or **paste from the clipboard** (Ctrl+V / Cmd+V) a single image — any browser-supported raster format (PNG, WEBP, JPG, GIF, ...) or **SVG**. Since every output size is redrawn straight from the original source, an SVG source gets crisp, natively-rendered icons at every size instead of one upscaled/downscaled raster
- A **Photos / Files** toggle sits above the upload area — visible only on touch devices, matching the Bilder/Dateien toggle in JPG75 (in English here). On desktop it's hidden, since the native file dialog already offers an "All files" option regardless of the accept filter. "Photos" opens the OS photo picker (fast, but on mobile it typically won't list SVGs — they aren't photos); "Files" opens the general file browser, which shows every file type. Drag & drop and clipboard paste aren't affected by this toggle — both already accept SVGs regardless of device
- The uploaded image always fills the available crop area — scaled up for a small source (like a compact logo SVG) or down for a large one — rather than showing at its own intrinsic size with empty space around it
- Recommended minimum crop size is **512×512px** for raster sources; if your selection is smaller, the larger icons are upscaled and a warning is shown next to the download buttons. This warning is skipped for SVG sources, since a vector re-renders crisp at every size regardless of the crop selection's on-screen pixel size
- A square crop selection sits on top of the full image — drag it to move, drag any corner handle to resize. The selection always stays square and can never be dragged or resized outside the image
- **Center** snaps the selection back to the middle at its current size; **Maximize** grows it to the largest square that fits the image
- Corner handles have a generous 40×40px touch target for fingers, while the visible grip stays fully inside the selection — it can never render (or be dragged) outside the image, even at the very edge
- Choose which files to generate — your last selection is remembered (`localStorage`) for next time:

  | File | What it's for |
  |---|---|
  | `favicon.ico` | Multi-size icon (16/32/48px embedded) — the classic browser tab icon |
  | `favicon-16x16.png` | Small PNG fallback for browser tabs |
  | `favicon-32x32.png` | Larger PNG fallback, used by some browsers/OSes |
  | `apple-touch-icon.png` | 180×180 — iOS "Add to Home Screen" icon |
  | `android-chrome-192x192.png` | Android home screen / PWA icon |
  | `android-chrome-512x512.png` | Larger Android/PWA icon, also used for splash screens |
  | `site.webmanifest` | Small JSON file describing the site as an installable app (name, icons, colors, display mode, optionally a share target); automatically pulls in both Android icons above |

- The default selection (matching the four favicon files most sites need) is `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, and `apple-touch-icon.png`
- Download files individually, all at once, or bundled as a ZIP. The ZIP filename defaults to `favicons--<source filename>` and is shown, editable, right below the download buttons — tap it to rename before downloading
- `favicon.ico` is built client-side as a real multi-size icon: three PNG-encoded images (16/32/48px) are packed directly into the `.ico` container — no conversion service involved
- The ZIP is built with a small vendor-free ZIP writer (uncompressed "store" method) — no external library needed for a handful of small icon files
- `site.webmanifest` ships with placeholder `name`/`short_name`/`description` values ("My App") — edit those for the site you're actually using it on. An optional **Share target** checkbox adds a `share_target` entry, so the installed site can receive shared image files; the site itself still needs a service worker that handles the `POST` (see below)

### Web Card House (beta)
Freely assemble a header, main, and footer section out of five block types — Logo, Nav, Text, Image, Button — each with its own editable fields (image paths, link labels/URLs, heading level, text content, button labels). Per section you can:
- Add any number of blocks in any order via the block palette
- Reorder blocks with ↑/↓, or remove them
- For Nav blocks, add/remove individual links within the block

A live preview (rendered in a sandboxed `<iframe>`) updates as you type, and below it sit two read-only code panels — **HTML** and **CSS** — each with a **Copy** button. The generated CSS is deliberately colorless (only layout, spacing, and structure) so the snippet can be dropped into any existing site without fighting its color scheme; the one exception is the button style, which borders itself in `currentColor` so it's still visible against whatever text color the target page already uses.

There's no download here — Web Card House is copy-paste only, since the output is meant to be pasted into an existing project rather than shipped as standalone files.

### Navigation & menu
- The logo sits next to the page title; clicking either takes you back to the home screen
- The menu (☰, top right) holds a **Dark mode** toggle, **Settings**, and **About** (a short info modal with the app description and version)

### Settings: internet glossary
A searchable glossary of internet basics in short, plain English, grouped into categories: *Addresses & names* (URL, domain, DNS, TLDs …), *Reading the address bar* (`?`, `&`, `#`, ports …), *How a page reaches you* (HTTP/HTTPS, status codes, hosting, Git …), *Building a website* (HTML, CSS, JS, DOM, PWA, service worker …), *Remembering things* (cache, cookies, localStorage) and *Staying safe* (phishing, VPN, 2FA). The search field filters by term and description.

### Share target ("Open with…")
Once the app is installed, you can share an image file to it from the OS share sheet. The service worker receives the `POST /share-target/`, stores the file in the Cache API (`first-steps-share`) and redirects to `/?shared=1`. The app then shows a chooser — *Open this file with…* — with the file's preview and one tile per tool. Today only **Favicons** can take files (Web Card House is shown as unable to); more tools can be added to the chooser later. Choosing Favicons loads the image straight into the crop tool.

### Link preview
Open Graph and Twitter Card meta tags are set in `index.html`'s `<head>`, so sharing the link (chat apps, social media, etc.) shows a preview card with the logo, title, subtitle, and a short description — without the version number, which only appears in the in-app About modal.

### Offline support
Once you've visited the site once (and especially once you've "installed" it via the browser's add-to-home-screen prompt, enabled by `site.webmanifest`), a service worker lets it keep working without a network connection. It uses a stale-while-revalidate strategy: every request is answered from the cache instantly if available, while a background fetch quietly refreshes that cache entry for next time — so you always get an immediate response, and you're never more than one online visit out of date.

## How it works

The crop tool displays the full image and overlays a square selection box positioned in on-screen pixels. When you hit "Generate favicons", the on-screen crop rectangle is converted back into the original image's pixel coordinates (using the ratio between displayed size and natural size), then drawn onto a `<canvas>` at each required output size via `drawImage()` — which is what handles both downscaling and, if needed, upscaling.

Each PNG is produced with `canvas.toDataURL('image/png')`. For `favicon.ico`, the raw bytes of the 16/32/48px PNGs are packed into a standard `ICONDIR`/`ICONDIRENTRY` structure (the modern PNG-in-ICO format supported since Windows Vista) — no server round-trip needed. The ZIP file is assembled by hand (local file headers, a central directory, and the end-of-central-directory record, all using the uncompressed "store" method), keeping the app dependency-free.

## Files

- `index.html` — markup for the home screen, the share chooser, the favicon tool, Web Card House, and the About/Settings modals
- `style.css` — all styling
- `app.js` — theme/menu/modals, the glossary, the share chooser, the crop tool, icon/manifest generation, the ZIP writer, and Web Card House
- `service-worker.js` — stale-while-revalidate caching for offline support, plus the share-target `POST` handler
- `og-image.png` — opaque image used for link previews (WhatsApp renders transparency as white)
- `favicon.ico` — kept at the repo root; some browsers and crawlers still request `/favicon.ico` directly regardless of `<link>` tags, so this one stays outside the `icons/` folder
- `icons/` — the rest of First Steps' own favicon set (`favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`, `android-chrome-192x192.png`, `android-chrome-512x512.png`, `site.webmanifest`); all referenced with absolute paths, so the folder can be renamed if needed
- `logo.png` — kept at the repo root next to the other source files, since it's an in-app branding asset rather than a generated favicon
- Push everything to the repo root, preserving the `icons/` folder structure

## Favicon

First Steps' own favicon set — is included:

- `favicon.ico` at the repo root
- `icons/favicon-16x16.png`, `icons/favicon-32x32.png`, `icons/apple-touch-icon.png`, `icons/android-chrome-192x192.png`, `icons/android-chrome-512x512.png`, `icons/site.webmanifest` (all linked from `index.html`'s `<head>`)
- `logo.png` at the repo root (shown next to the page title)

If any file were ever missing, browsers just silently skip it — nothing breaks, you'd just see a generic icon.

## Browser support

Works in all modern browsers (Chrome, Safari, Firefox, Edge). The share target needs an installed app on a platform that supports the Web Share Target API (Chrome/Edge on Android and desktop). Uses the Pointer Events API for the crop tool's drag/resize handles (mouse, touch, and pen all work) and `canvas.toBlob()` for image export, both widely supported.
