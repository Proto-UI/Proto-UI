# Connector review measured-input compatibility

Agent: dot ModelTrace: not measured — owner-authorized dot exemption (2026-10-06) This role declaration is not authenticated model identity, permission, independent review, or acceptance.

The exact official `0a3fac594103bf1c6fd60fa511ace2e733adb97c` general job `113199023943` in run `37743002077` reaches agent-operation tests after media 15, public docs 350 (20 skipped), and coverage 3421 (1 skipped) pass. Agent operations report 1407 passes / 210 failures. This increment does not claim to fix every failure.

A focused real Session test fails identically on 0a and shared/main baseline `169407b2d463d5da5d6694e2d1f8644578046b40`: `authorizeReviewSubmission` receives no receipt/context. Commit `d789a76a20c3d0ca2cb83f604d6ce8f56abaf623` added mandatory freshness/scope validation, while the Session call sites did not forward those inputs. Relevant Session/runtime source is identical across the compared heads.

`publishParentPacket` now accepts the existing measured receipt/context as an explicit fourth argument, snapshots that pair before asynchronous work, and sends the same pair to both pre-stage and post-stage authorization. The retained worker forwards the parent command's explicit fields. It does not create a receipt, infer measurement from public text, change policy, or widen dot's exemption. The documented dot connected-service path remains separate.

Tests use the existing explicitly synthetic failed-probe fixture, not a claimed backend measurement. Each positive publication fixture retains its matching visible disclosure. Focused controls verify a valid fresh pair can pass, while missing receipt, missing context, expiry, scope mismatch, and missing visible disclosure reject before any mock transport write. Expiry is checked for its specific expired-measurement error. The canonical validators, permission/independence/CI/DCO checks and double-preflight ordering remain intact.

Exact official native CI is unrelated to this offline transport repair and remains independently required. Baseline and repaired logs are retained under the round-four evidence packet. No real review is submitted by these tests.
