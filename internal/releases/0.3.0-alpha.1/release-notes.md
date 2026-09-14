# Proto UI 0.3.0-alpha.1

> Draft release notes. This release has not been published. npm, Git tag, GitHub prerelease, dist-tag, and immutable snapshot evidence remain pending.

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

## Publication status

This preparation does not publish packages, create `v0.3.0-alpha.1`, move npm `next`, or activate `V-PROTO-UI-0010`. Those actions require merge to `main`, a complete release rehearsal over the final reviewed package set, protected publication, and a separate evidence review.
