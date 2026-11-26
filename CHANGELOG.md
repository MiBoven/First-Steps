# Changelog

### 0.1.0 — 2026-11-26 — First Steps: rename of Prepare 4 3W
- App renamed from **Prepare 4 3W** to **First Steps — Behind the Scenes of the Internet**, now live at `first-steps.michels.world`. The version counter was reset to 0.1.0; the earlier history (1.0.0–1.3.1 as Prepare 4 3W) is folded into this release
- New logo and icon set (real multi-size `favicon.ico`, PNG icons, `og-image.png` for link previews)
- New `site.webmanifest` with a `share_target`: the installed app can receive shared image files and asks which tool should open them (currently Favicons; Web Card House is listed as unable to take files)
- New **Settings** modal with a searchable glossary of internet basics (URL, DNS, HTTPS, HTML, CSS, JS, `?` / `#` in the address bar, TLDs, PWA …)
- Menu aligned with the other apps: Dark mode toggle, Settings, About
- Favicon tool's manifest generator gained an optional **Share target** checkbox
- Service worker extended with a share-target `POST` handler
- localStorage keys renamed from `prepare4w-…` to `firststeps-…` (theme and favicon choices fall back to defaults once)
