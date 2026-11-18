# Proto UI 0.3.0-alpha.1

> Published on September 20, 2026 under the npm `next` channel. The 43 public packages named by the published `package-bom-0.3.0-alpha.1.json` release asset, the `v0.3.0-alpha.1` tag, the prerelease GitHub Release and the immutable spec snapshot share this exact release identity.

Proto UI 0.3.0-alpha.1 is a testable continuation of the 0.3 alpha train. It remains an alpha release: it is neither a release candidate nor a stable compatibility promise.

## Vue 2 CLI and Base Image

- Extends the official CLI Adapter registry and generated facade path to recognize `vue2`.
- Lets Vue 2 consumers add the Base Image prototype through the same generated component route as the other supported Web Adapter profiles.
- Aligns the public Base Image documentation and Demo Matrix with the admitted `A-VUE-2-0001` profile, including light, dark, desktop, and mobile browser evidence.

## Consumer evidence

- Adds an isolated Vue `2.6.14` tarball consumer to the release CLI smoke suite.
- Verifies CLI-generated Vue 2 Button and Base Image components mount and render in a browser-like runtime.

## Registry readiness

- Keeps npm's deprecated bootstrap `latest` residue outside the release channel when npm refuses to remove the tag from the sole bootstrap version.
- Permits that residue only after `next` names an existing non-bootstrap prerelease; it neither changes `latest` nor manufactures a replacement stable version.

## Release validation

The protected release workflow run <https://github.com/Proto-UI/Proto-UI/actions/runs/35504873221> concluded `success` for head `e7961001af1d313b1518be694f866b0e98337b0d`, which is also the commit that the `v0.3.0-alpha.1` lightweight tag resolves to. npm wrote the first package at `2026-09-20T10:24:41.722Z` and the last at `2026-09-20T10:31:33.390Z`; the prerelease GitHub Release was published at `2026-09-20T10:28:40Z`. All 43 packages of the published release BOM exist at `0.3.0-alpha.1` with a registry integrity value, and `next` resolves to `0.3.0-alpha.1` for every one of them. The immutable spec snapshot attached to that release has SHA-256 `e483b661a09bb333b12c99d9639c016cb5bb6829281b939012859864ea8754ee`, matching its published checksum file. npm did not publish a `gitHead` for these versions, so the commit binding comes from the release workflow head and the tag target rather than from registry metadata.

These publication facts were re-read from the npm registry and the GitHub release API on 2026-11-17 and 2026-11-18. They describe this published release only: they do not activate `V-PROTO-UI-0010`, and they make no claim about any later release train.
