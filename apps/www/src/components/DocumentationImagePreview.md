# Documentation image preview

This site composition advances [#780](https://github.com/Proto-UI/Proto-UI/issues/780) within [#420](https://github.com/Proto-UI/Proto-UI/issues/420). It is monorepo-HEAD dogfood of draft PUI prototypes, not a lifecycle promotion or a generic SVG sanitizer.

## Ownership

- `DocumentationImagePreview.astro` installs one disposable service for a page. `PageFrame.astro` mounts it on all documentation routes.
- `documentation-image-controls.ts` is the bounded WC integration bridge. It registers real Shadcn/Brutalist Dialog, Button and Toggle facades and Base Scroll Area in native projection. It imports only their public package entry points plus the public WC adapter. It does not duplicate keyboard, focus, dismissal, selection or scroll semantics.
- The runtime service owns image selection, native image load/error data, fit/original-size presentation, authored caption text, object URLs and route cleanup. Each new media request gets a fresh image element and abortable listeners; old events cannot update the new request.
- Dialog Content/Mask own presence and motion clocks; the family owns its border/shadow/overlay/animation tokens. Reduced motion sends zero-duration Transition props and disables visual animation. The CSS file only sizes/layouts the media composition and identifies native scroll-viewport focus.
- The current `data-site-library-family` document signal selects actual family facades. Without that signal, Brutalist library routes choose Brutalist and other routes choose Shadcn. A family change closes/disposes the old protocol and remounts the new family. This does not claim state transfer or page-runtime switching.

## Automatic eligibility

All rendered `img` and top-level static SVG elements in `.sl-markdown-content` are considered, including Markdown output and MDX-native HTML. A `picture` remains intact and its selected `currentSrc` is reused. Authored `figure` and `figcaption` are not reconstructed. Only standalone Markdown image paragraphs receive the historical enhanced-image figure styling.

Images inside links, native controls, custom elements/demos, contenteditable regions, role/tabindex owners, image maps/native image controls, code or pre blocks are not enhanced. Empty `alt`, hidden/inert/editable/presentational media and `data-image-preview="off"` opt out. Known whitepaper `button[data-diagram-open]` wrappers are migrated only when they contain one image and no other interactive controls. Native click handlers in the authored attributes are not taken over. DOM listeners installed by other application code cannot generally be inferred; such owners must declare an interactive boundary or explicit opt-out.

Image source URL, alt and figure caption are preserved as data. Original CORS and referrer policy are copied before setting the preview src, preserving the image request policy. Candidate ownership is rechecked both on document mutations and immediately before activation; a later-authored link or hidden/interactive boundary removes the old trigger without dropping new descendants. There is intentionally no “open original” navigation, download, iframe, object or embed path. Existing external image URLs remain image-mode resources; the viewer neither fetches SVG source nor creates active SVG documents.

## Bounded inline-SVG profile

The runtime accepts a small inert presentation subset: `svg`, `g`, basic shapes, paths, text/tspan, title and desc, with explicit presentation/geometry attributes. It rejects unsupported elements and attributes without rewriting them. Script, handlers, animation, foreignObject, nested svg, class/style, defs/use/image, references (including local fragments), namespace expansion, processing instructions and URL/CSS escape forms are unsupported. The serialized SVG is loaded only through a revocable blob URL on an `img`.

This profile does not admit arbitrary SVG, prove the original inline document safe, rewrite content, or resolve [#563's public SVG active-document admission](https://github.com/Proto-UI/Proto-UI/pull/563#discussion_r4160559595). An unsupported source keeps its original display and gets no preview control. Changing the subset requires an independent safety review and negative fixtures; do not silently whitelist existing artwork.

## Evidence

- `documentation-image-source.test.ts`: admission, unsupported boundaries and candidate exclusions
- `rehype-enhanced-image.test.ts`: links, figures, pictures, captions and phrasing structure; the six baseline regressions were red before repair
- `documentation-image-preview.test.ts`: actual PUI activation, modal state, zoom, focus return, family replacement, stale load/error rejection and cleanup (DOM harness, not pixels)
- `documentation-image-preview.browser.test.ts`: real Chromium at 320/390/1280px, light/dark, both families, source fixtures, touch/keyboard, modal focus, native original-size scrolling, repeated dismissal, reduced motion and no-JavaScript content
- `.github/workflows/documentation-image-preview.yml`: read-only exact-head public fixture captures with revision/environment metadata and 14-day artifact retention

The browser fixture injects the documented family/theme signal to isolate those axes; it does not claim a user-operated family selector journey. Runtime suite registration prevents the browser test from being silently skipped in the repository plan. Final-head browser captures and independent review are required before visual acceptance. The unmerged #563 matrix must separately reconcile this integration path/surface; no admission allowlist is changed here.
