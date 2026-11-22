# Version-specific release material

Version directories hold notes, bills of materials, preparation records, or publication evidence. Follow the matching entity in [spec/versions](../../spec/versions/) when one exists and the [release workflow](../governance/release-workflow.md) to interpret the contents. A retained preparation directory without a version entity does not establish a release identity.

- A **draft version** is release preparation. Its notes and preparation data remain maintained, and its presence does not establish that any package is installable.
- An **active version** has admitted release evidence. Retain its original publication identity, hashes, notes, failures, and limitations. A newer workspace build cannot replace that historical evidence.
- The root [VERSION](../../VERSION) selects the workspace train. Default public installation advice follows the latest active stable release and its published artifacts. An explicitly selected prerelease follows its own active version entity and evidence.

The [root release entry](../../RELEASE_CHECKLIST.md) routes current release work to its plan and acceptance sources. The [versioning policy](../governance/versioning-policy.md) explains version meaning; the [documentation policy](../governance/documentation-policy.md) explains maintained versus historical prose.

Use the release workflow's generators for BOMs, snapshots, and metadata. Update current preparation notes in both locales when their meaning changes. Preserve admitted historical material and record corrections with provenance through the release process rather than regenerating old receipts from today's checkout.
