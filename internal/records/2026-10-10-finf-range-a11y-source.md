# Finf range accessibility projection source

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

## Implemented boundary

The shared Web A11y projector and generated native-DOM interaction helper now translate `valueMin`, `valueMax`, `valueNow` and `valueText` into their corresponding ARIA range attributes. Zero, negative and fractional numeric values remain valid. Numeric range facts require finite numbers; text requires an actual nonempty string. Missing or malformed facts withdraw the owned contribution. Rebinding and disposal retain the existing host-owned attribute restoration semantics.

This supplies the actual accessibility projection needed by the Progress, Meter, Slider and Number Field source slices. It does not set their values, clamp their domain, invent author intent, or certify a role-specific accessibility interaction.

## Validation and retained failure

- 9 focused shared-projector tests pass: numeric and text projection, malformed/nonfinite values, indeterminate removal, replacement target and host-baseline restoration.
- 11 generated Web Component source tests pass, including executing a generated range component, value updates and attribute withdrawal after detach.
- The initial generated range test selected the shadow child; the actual generated A11y target is the custom-element host. That test failed before correcting the observation target. No product fallback was added to satisfy it.
- A first workspace type invocation was blocked by two absent generated Shadow style inputs. The website's normal style generator supplies those inputs; this was an environment preparation gap, not a passing type result.

GPUI and Qt physical range projection, real assistive-technology/native input, all generated targets, full aggregate checks and independent review remain pending. No Finf checkbox or lifecycle state is promoted by this change.
