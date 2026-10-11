# Finf Brutalist provenance and Card documentation correction

The maintainer requested removal of misleading originality wording on 2026-10-08. This is a documentation correction over frozen Finf source `404708b6c3205d5f53d3e486028797f14209b5b9`, not a new visual implementation, release, lifecycle admission or completed delivery item.

## Source and correction

- Public [PR #800](https://github.com/Proto-UI/Proto-UI/pull/800) explicitly adapts typography, geometry, palette and component depth from neobrutalism-components `3306a802724874a85f93079702b2795370a279d4`. Its merged commit `c7a7309a` is an ancestor of the frozen Finf source. The current draft `K-BRUTALIST-0001` already records that source-pinned adaptation and Proto UI's separate semantic ownership.
- The bilingual library introduction and current package-surface map still used “contributor-authored / 贡献者原创”; the package README additionally claimed “only general” references. Replace those claims with a maintained design-language projection, identify the pinned adapted recipes, and distinguish Proto UI's own semantic implementation and documented extensions. Do not label every implementation file an upstream derivative.
- Preserve `THIRD_PARTY_NOTICES.md` byte-for-byte, including Samuel Breznjak's copyright and the full MIT text. The separate DM Sans/OFL notice and historical release/engineering records remain unchanged.
- Card Header/Footer implementation and current draft criteria provide layout and spacing without section borders. The Chinese Card page still claimed theme-relative separators; both locales called the fixed black Root frame “ink”. Align the current descriptions, and correct only the Header/Footer entity summaries. Criteria, revisions, versions, status, implementation and visual behavior remain unchanged.

## Source-object binding

Local, not-published source commit A is `1a0f8d82732db619d29a39802ac8e8d6bddd8132`, tree `316158a846227a677882f778081920697c3ff4d8`. The canonical `refreshCandidateSource` and renderers refresh the candidate proof against that actual Git commit. This is not a GitHub readback or remote publication claim.

The previous candidate proof binds `d118c00b731c472be8d52baf076609435b289348`. Of its 4,195 paths, only these source hashes change:

- `spec/prototypes/P-BRUTALIST-CARD-FOOTER.yaml`: `9ead086fa83d3fc777cb1f16f23d678a70aa52aa8fd050478da04e47f0933a90` → `eb9673eeb256ce8e4a98ee6776f5e4acd2c70cf1d96eba174b17a859b90929f4`
- `spec/prototypes/P-BRUTALIST-CARD-HEADER.yaml`: `51fc13b02c592a75120372d582c0d7a04ebe555491b1f730d211c1dc6dd18d45` → `df0bfeb0d1eb3fc031c74ae08d3d464be1d8780835aba2cb84b341558a3ba9e8`

Executable assertions retain all candidate counts, prototype inventories, atomic mappings, GPUI rows, package consumption and the exact generated Finf checklist. Website/Harness consumer rows and their dispositions are unchanged. Finf remains 0/68 complete. Publication must reconcile any real remote commit remapping rather than asserting that this local commit is already published.

## Validation and retained failures

- New source-document controls: provenance baseline 1 pass / 5 expected failures; after correction 6/6 pass. Card baseline 6 pass / 2 expected failures; final combined 8/8 pass.
- Public documentation suite: 358 passed, 20 skipped, no failures. Skipped tests are not runtime/browser acceptance.
- `check:prototype-catalog`: passes, 256 declaration files / 321 static authoring entries / 254 cataloged P entities / zero known debt files / one dynamic factory.
- `check:types`: passes; Astro checked 630 files with zero errors, zero warnings and 10 hints.
- Lifecycle authoring against `404708b6`: two changed catalog inputs pass through the same script with `node --import tsx`. The initial pnpm/tsx entry failed while creating its sandbox IPC pipe (`EPERM`); no schema or lifecycle gate was relaxed.
- Agent operations checks and their complete suite pass: 1,631/1,631. Agent documentation renderability passes through `node --import tsx`; the disposable projection is absent as expected. Its pnpm/tsx entry separately encountered the same sandbox IPC `EPERM`.
- The final commit-A proof passes the canonical check and all 113 proof/coverage controls (rerun after binding A, no skipped tests). The final-A Website/Harness source wall passes both matrices. An overlapping earlier scanner process was killed (exit 137); that failed run is retained and is not a pass.
- Original proof correctly rejected the two changed catalog bytes. An intermediate real Git tree proof passed before the final commit-A binding; that intermediate diagnostic is not the final receipt.
- The first refresh diagnostic exceeded Node's default 1 MiB child-output buffer when reading the existing matrix. Rerunning with a 32 MiB read buffer succeeded without changing the canonical validator.
- First real pre-commit backup failed with `fatal: Needed a single revision`; HEAD stayed at `404708b6` and edits were intact. A direct diagnostic lint-staged run passed, then the unchanged commit command passed the real Prettier and dot commit-message hooks with `PUI_AGENT=1` and the author's Signed-off-by. No hook bypass or fabricated transport was used. The transient failure's root cause is not established.

No fresh browser screenshot, independent approval, trusted remote CI, push, merge or deployment is claimed. The next publication report must attach current-source documentation captures or explicitly retain that evidence debt.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.
