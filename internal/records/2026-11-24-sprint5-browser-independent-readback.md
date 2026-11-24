# Sprint 5 browser acceptance: independent source and evidence readback

This record preserves the independent technical review of the browser correction in PR #1738. It is separate from the new native/SSR followup, a GitHub approving review, and acceptance of every browser delivery row.

## Source-bound result

The actual formal run [45282014115](https://github.com/Proto-UI/Proto-UI/actions/runs/45282014115) executed implementation source `25ca6fcaecd917457f6f3d694b3e12bfb522e89a`. The subsequent `1afa22e88c087db244f0e28a835b2926fb8bce8e` commit changes records only. The independent reviewer compared the Git objects, the two changed product/test paths, and the raw artifact manifests. The followup branch preserves both commits through ordinary ancestry.

The finite native pseudo-element correction passed the original production browser journey **20/20**, including edit/reject/recover, cancel/reopen and actual Worker integrity. All four actual Workers closed. Four WASM requests and 206 loaded production asset hashes matched the sealed build; console and page errors were empty. The original 250 ms cleanup deadline, sandbox, input actions and assertions remain unchanged. This receipt contains no cleanup-duration distribution, and none is inferred from total case duration.

The run's eight bounded delivery rows cover English and Chinese Base Button across the four implemented Web targets. The independent review accepts those rows at the executed source. The other 492 pages, original 494-page/264-demo/722-prototype inventories, unsupported targets, security conditions outside the exercised journeys and unaccepted performance budgets remain distinct. No inventory row is silently promoted by this prose.

## Independent checks

| Subject | Actual independent finding |
| --- | --- |
| Product boundary | Exactly 17 observed native pseudo-element identities; conservative handling remains for real input state, mixed selectors, unknown or escaped names and opaque stylesheets |
| Original controls | The original 18-case file remains an unchanged byte prefix; the full 60-case selection changed from 26 pass / 34 fail to 60 pass |
| Additional boundary controls | 58 independent helper probes passed; these are source controls, not a second browser timing run |
| Input manifest | 10,687 inputs: 10,636 exact Git blobs and 51 frozen dependency files; zero drift |
| Source suite | 44 files, 778/778 at 25ca; no pending/todo cases |
| Other browser fixtures | WC generated owner 4/4 and two selected native direction controls 2/2; 190 unselected Shadow cases are not passes |
| Actual production graph | 2,606 chunks, 5,898 modules; the separate 2,150 controls are checker tests, not chunk counts |
| Raw custody | All 353 already published gzip members were verified for compressed/decompressed size and SHA-256; hosted ZIP digests, sizes and CRCs matched independently fetched metadata |

The independent package includes its original review, extracted-source probes, verifier, GitHub metadata and custody manifest. It references the existing 208 failure/diagnostic/candidate streams and 145 final acceptance streams rather than duplicating them.

The earlier 2df formal browser success, ea600 formal **17/20 failure**, and b880 development diagnostic **17/19 failure** retain their actual source, environment and instrumentation. The b880 passive profile does not become production acceptance. The alternative event-dedup experiment was archived without integration; it is not part of the accepted correction.

## Durable review packages

Both original packages and their manifests are under `internal/records/evidence/2026-11-24-sprint5-browser-independent-review/`.

| Package | Bytes | SHA-256 |
| --- | --: | --- |
| `hosted-45282014115-independent-acceptance.tar.gz` | 19,100 | `225769811e6dd3515ae2a857d9ed3e55eb41a3785dfffb9ead104975ef8426fa` |
| `hosted-45259712127-independent-acceptance.tar.gz` | 1,672,484 | `32ca7e676dda651baf6f0e866f64c85ecb0df7d4d65d1d4f6042e5359e94ba7e` |

The older package preserves its native Input/ControlLabel failures alongside browser success. Neither technical review manufactures an approving GitHub review, public SSR admission, full non-Web acceptance or a release decision. Later compiler/native/owner changes require their own affected-source acceptance.
