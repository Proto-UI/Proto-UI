# Prominent tint synthetic cancellation checkpoint ordering

## Scope and preserved failure

This test-only correction starts at commit `6882c82945c1dbe935482055086b6cc88c22ea97`, tree `ea0c768a3ca17e365a82e2bc4661e313063ff501`. The retained React and Vue2 preference artifacts show two requests with pressed/held contact at `cancel-held`, then three requests with unpressed/rest contact at `injected-cancel`. Those original failures remain failures.

The original fixture injected DOM `pointercancel`, released the still-held native mouse on the control, and only then captured and checked cancellation. Synthetic DOM cancellation does not terminate the native mouse-button session. The later on-target release can produce a separate click. This diagnosis concerns test event ordering; it does not establish a production cancellation defect or real browser/OS cancellation coverage.

## Bounded correction

The browser test now executes a shared test-only sequence:

1. Inject the same synthetic `pointercancel`.
2. Capture `injected-cancel` immediately and retain both the unpressed assertion and the strict unchanged request-count assertion.
3. Move the native mouse to the fixture's outside point `(0, 0)` and release it.
4. Separately assert that the request count is still unchanged after the outside release.

The immediate assertion completes before native cleanup. The second boundary is an assertion-only check, not a new image capture. All 48 planned cases (32 journeys and 16 preference cases), 1,608 capture identifiers, 120-second case deadlines, optical/contrast thresholds and existing product behavior remain unchanged. The summary explicitly describes synthetic DOM cancellation and does not claim browser/OS-generated cancellation evidence.

## Discriminating evidence

The shared executable sequence is used directly by the browser suite and deterministic tests. Extracting the original ordering yields two failing regressions: requests become three instead of two, and native release precedes the immediate checkpoint. The corrected sequence passes. The artificial input model is explicitly unit evidence, with an on-target-release control that retains the extra click rather than suppressing it.

Separate negative controls show that an unexpected action from cancellation fails before cleanup, and an unexpected action from outside release fails at the second boundary. Mutation runs independently fail when removing the immediate assertion, outside move or post-release assertion. The existing real event-router unit guard now covers both `pointercancel` and `lostpointercapture`, preserving a later click's activation. No production router, Base, material or source policy is edited.

The final eight focused suites pass 119 tests. Workflow-input checks pass 67 tests; focused strict TypeScript and formatting pass. The unchanged fixture tests verify all 48 cases and 1,608 captures, including 402 captures per runtime shard.

## Remaining evidence

Exact-candidate native CI, any later preference-stage failures, optical/contrast failures and independent actual-size visual review remain open. Real browser/OS-generated pointer cancellation is still an explicit end-to-end coverage gap. This fixture correction does not turn prior failures into passes, change acceptance thresholds, or prove the remaining native journeys.
