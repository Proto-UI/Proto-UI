# DM Sans variable font

Unmodified `DMSans[opsz,wght].ttf` from google/fonts commit `5b35b7208dd4100571326fdf37f030b32a524232`, downloaded 2026-10-03.

- Source: https://github.com/google/fonts/blob/5b35b7208dd4100571326fdf37f030b32a524232/ofl/dmsans/DMSans%5Bopsz,wght%5D.ttf
- SHA-256: `8cd08d97e89c24d0aa92edd2f0f4c8ee6195eee9b7c9f154865a58b02f0c1c0d`
- Copyright 2014 The DM Sans Project Authors (https://github.com/googlefonts/dm-fonts)
- License: SIL Open Font License 1.1; full notice in `OFL.txt`
- Used by the documentation application through a self-hosted `@font-face`, normal style, variable weight 100–1000 and `font-display: swap`
- The PUI prototype package only owns the declared family/fallback tokens; it does not fetch or bundle these bytes

The full copyright/OFL is also shipped as `apps/www/public/fonts/dm-sans-OFL.txt` at `/fonts/dm-sans-OFL.txt`. An executable checksum/byte-equality test prevents source and public-license drift; browser evidence reads that public endpoint.

The UI Libraries gallery aliases these same bytes as `Library DM Sans` and inlines them into its render-blocking CSS with Vite's `?inline` asset query. `font-display: swap` keeps text visible; the gallery does not defer its family font to a separate network request. The global `DM Sans` face remains unchanged. This adds the complete 240,164-byte TTF (320,241-byte data URL, about 135 kB gzip) to the gallery stylesheet. No subset, font substitution or security-policy change is introduced. The source checksum and complete public OFL remain the same; real first-frame glyph selection is gated separately by Chromium CDP.
