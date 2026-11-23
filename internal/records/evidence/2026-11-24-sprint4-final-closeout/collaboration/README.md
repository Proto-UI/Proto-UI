# Final collaboration and Ready readback

At **2026-11-23T22:14:32.738Z**, [PR #1754](https://github.com/Proto-UI/Proto-UI/pull/1754) was **Ready for review, open and unmerged**, at `c18bf8f8c35a4ec1f69791468a5952c4cb460f41`. The implementation head was not changed by this closeout. [The full readback](readback.json) binds canonical review input digest `e1ca3b3908967477f7986bb76f5daeec44c6a71081fb451583702eb1b4ca48e8`.

## Published operations

The governed repository CLI verified 17 operations in this final sequence: 13 commit progress comments, the PR title/body, #1143 and #1089 body updates, and the separately invoked Ready action. Each operation has its request, authorization reference, live collection, actual mutation receipt, fresh readback and completed handoff. The earlier seven Issue updates are also retained. All nine Issue bodies matched their prepared bytes at final readback and all nine Issues remain open. The original #1143/#1089 bodies were preserved byte for byte as suffixes.

This completes publication and review readiness for the bounded implementation. It does not close the original Sprint 4 conditions, replay the private IR10 candidate, manufacture an independent review, or merge the PR.

## Actual platform outcomes

- Four lightweight CI jobs succeeded; eighteen were skipped. DCO succeeded. The Vercel daily deployment quota failure remains recorded.
- Formal GitHub reviews and review threads were both zero at readback.
- Marking Ready triggered the repository's automatic Codex review. Two subsequent bot comments report that the review could not finish because the account reached its code-review usage limit. Its failed summary flags and the explanatory quota comment are both retained in the canonical input. There is no inspectable file/line finding payload in that input. This is neither code-defect evidence nor approval. See [the explicit disposition](automatic-review-disposition.json).
- The 61 public definitions in the earlier fixed-revision comparison have identical bytes at the final implementation head. [The continuity receipt](public-definition-byte-continuity.json) does not supply the unknown original private hashes or an owner acceptance.

## Preserved compatibility failure

The first final-collaboration attempt stopped before its first write because system `gh 2.46.0` did not support `api --paginate --slurp`. Its failed logs, absent receipt and `halted-unresolved` journal remain unchanged. Complete pagination established that neither the stable commit marker nor the request marker was written.

A task-local official `gh 2.105.0` was checked against the release API asset sizes/digests and checksums file. Its binary hash is `fa7cff06d4db9eee98e00b10ac93beebfe1822109ac04a6cbbf9d806c21d0073`. System installation, repository CLI/policy, credentials source, content and authority were unchanged. Only the receipt output directory changed, retaining identical local intent. Every new operation collected fresh live state and used the ordinary repository CLI. [The recovery record](compatibility-recovery.json) binds the old failure, zero-write reconciliation, effective binary and both payloads.

## Originals and verification

[originals.tar.gz](originals.tar.gz) contains **967 regular-file originals**, 866,835 compressed bytes, SHA-256 `978842142d52a27631754c664c282b699b47ff454b73d03b3aff172ad41a2377`. [manifest.json](manifest.json) gives every member's size and SHA-256; [transport.json](transport.json) binds the archive and manifest. It contains no installed CLI binary or downloaded release archive. The original two bot comments, all current progress comments, checks, Issues and complete readbacks remain readable in the archive.

Run from this directory:

```sh
python3 verify.py --repo ../../../../..
```

The reader verifies retained files and optional immutable Git blobs; it makes no GitHub write and runs no test or browser. This evidence commit extends the already-published `528ece4cb575a7277981f481ccc0f54dfac8ca70` evidence parent; the tested implementation head stays c18.
