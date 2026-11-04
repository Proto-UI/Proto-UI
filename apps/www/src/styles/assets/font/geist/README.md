# Geist variable font (normal)

Unmodified `Geist[wght].ttf` from google/fonts commit `718e1db4deb9e4d9d85a0ead1b9f5fde2761ccfd`.

- Source: https://github.com/google/fonts/blob/718e1db4deb9e4d9d85a0ead1b9f5fde2761ccfd/ofl/geist/Geist%5Bwght%5D.ttf
- Upstream source recorded by that repository: vercel/geist-font commit `a6d260e6cbc07eafdfad438f33601fe3c38b1e6f`, `fonts/Geist/variable/Geist[wght].ttf`.
- Font metadata version: **1.800**. This is not the latest package/release number.
- Git blob: `f63f0afc6390323715972b6645115485f37cc9f4`.
- Bytes: `169056`.
- SHA-256: `73894e0448cae90a92b6c2f8732b7bb9acb7b94c418bff559dad4a18e1de9659`.
- Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font).
- License: complete SIL Open Font License 1.1 in `OFL.txt` and identical public `/fonts/geist-OFL.txt`. The integration license does not replace the font license.

The consuming documentation app self-hosts these bytes with a normal 100–900 weight `@font-face` and `font-display: swap`. The filename is a packaging path; the font tables, family name and glyphs are unmodified. No generated subset or converted binary is distributed by this change. Prototype packages export only an opt-in family/fallback preset; they do not bundle or fetch font bytes.

The observed official website used a Latin WOFF2 reporting the same 1.800 font version. Matching version metadata is not proof that its subset bytes or all glyph outlines equal this complete TTF. The full source includes Latin, Latin extended, Cyrillic and Vietnamese; it does not provide Chinese glyphs. Existing platform CJK fallbacks remain explicit and their actual per-glyph selection is not established by a computed font-family list.

`swap` preserves visible fallback text, not zero layout shift. Cold-cache, delayed/failed font load, real four-host typography and Chinese fallback evidence remain separate native acceptance requirements. No CDN request, account, prototype-level loader, or global replacement of other design families is added.
