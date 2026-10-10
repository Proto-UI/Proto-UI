# Finf package-resolver profile reconciliation

Status: exact configuration review, not consumer promotion.

The f91 general CI job 112776953785 in run 37616450544 rejected seven resolver-profile controls. The production gate correctly fails closed for any unreviewed full Astro configuration fingerprint; the test fixture had copied the evolving live configuration while pretending its non-audit derivative was still the historical #857 file.

The original configurations were recovered unchanged from Git:

- `27331cebfc30565fd70835c26a32c64f838c5ca6`: SHA-256 `d96e4e9086541e713e95f1fa8cda44a7af04795f37f4a91f9f3f93de75ea9f30`
- `facf4a3880f8e8121d1d4d2b10b47e0fe50ee779`: SHA-256 `b07dfc4350c16a8bee3b65717887cc5d592002f2cb492e134c60a3d18519a6de`

Both exact historical files are now retained as inert text fixtures and both profiles remain accepted. The current reviewed source adds only documentation sidebar entries and one earlier Finf manual-chunk exclusion for the lazy `packages/adapters/base/src/host/instance-associations.ts` helper. The package resolver implementation and audit plugin import remain unchanged; the audit helper stays pinned to `a1e7103b44b29063a9bc47d6e7d0881122b9184ff29c239275e00cba8315462a`.

Current exact audit and non-audit counterparts are `37e3dc63ada011e330c32ed2c97af28600a87cdef0d892c3ed9adb8b3b84e705` and `368441f22060c0a9adec23a98320e87fb68df4b64c1a3d8e7e3ff3877944f475`. Any further configuration edit still fails closed. Both audit profiles require the exact helper as evidence metadata. This does not approve arbitrary plugin bytes or relax package closure/path checks.

Verification: the 14 targeted source-resolver and audit-profile controls pass, including both historical profiles, the current counterpart, changed/missing/symlinked helper, altered resolver, unknown config and configuration symlink negatives. Full aggregate validation remains separate.

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06)
