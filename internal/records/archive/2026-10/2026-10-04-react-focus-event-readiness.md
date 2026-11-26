# React native Focus ingress readiness

Bounded regression candidate discovered by the PR #775 contrast audit. This record is not a new protocol, lifecycle admission or native acceptance result.

## Evidence

The exact `bf0fcf27` native audit (Actions `37226828131`) preserves two failed React Select End observations. `document.activeElement` is the real Paper item, but the same runtime Focus Center reports `focused: false` and `hasFocused: false` for it. The active listbox scope and its ordered Paper/Ink members are correct. Therefore the existing `requireFocusedMember` guard cannot admit End navigation. WC, Vue and Vue2 complete the same original keyboard and added pointer journeys; all four Dropdown runtimes pass. No failed case is omitted.

Separate real React 18.3.1 and 19.2.6 happy-dom compounds did not reproduce that native state divergence. They do not substitute for the preserved browser run.

## Initial d4e0eadf candidate: authority and repair

Draft `C-AS-FOCUSABLE-0001-G` requires a host to withhold a target that is not focus-ready and preserve a pending request rather than claim application. `focusSelf` deliberately relies on observed host focus events for its facts. React's earlier effects-ready boundary can expose the connected target while host-event ingress is still gated. The controlled capability regression is red on main `d05d1a00`: it returns the target in that state instead of null.

The adapter's private Focus target getter additionally requires its existing view-ready state and enabled event gate. Accessibility and style projection keep the earlier effects-ready boundary. The existing ready notification then replays pending native focus after ingress is available. No new public option, Host Capability, synthetic focus event, forced blur/refocus, timeout, portable state or semantics is added.

## Initial candidate validation and remaining work

The temporal capability negative turned green; it also checks ordinary ready, effects-not-ready and disconnected targets, and proves accessibility still projects its role/name while Focus waits. Twenty-eight focused React Focus/Select/catalog/retained-lifecycle tests and narrow TypeScript pass. The earlier invalid test-label snapshot was corrected to the actual typed A11y text-alternative API before this candidate was committed.

Native validation must combine this independent production candidate with the unchanged exact-head #775 audit; only that subsequent actual run can establish whether it closes the observed Select divergence. Independent review and full CI remain required. No main merge, release or production deployment is implied.

## Acquisition-only follow-up after independent review

The combined #775 head `319aa61a` completed native run `37228079085`: 192/192 target predicates, 16/16 cases, no failures. Light/dark React Select End reached Ink. This validates the observed Select repair, not every adjacent lifecycle operation.

Independent review then reproduced a new regression: an `onUpdated` blur saw a null shared target while the React event gate was disabled, clearing semantic facts without blurring the actual focused element. Both real React/happy-dom and fake React failed on d4; an exact main `modules.ts` source reversal passed. A second control showed that moving only the guard to acquisition would silently drop an entry request from `onUpdated`, because the existing entry path ignored a host `false` result.

The refined implementation keeps the existing effects-ready root getter for native blur, projection and eligibility. Only `FOCUS_REQUEST_FOCUS_CAP` requires the private `isFocusAcquisitionReady` predicate (view-ready plus enabled ingress). Focusable requests already retain a host rejection. The internal pending slot now distinguishes rejected entry intent, re-resolves the current descendant/fallback on readiness, and never stores the old DOM target or synthesizes region facts. Entry disable cancels only entry intent; blur and terminal disposal cancel pending work; retained detach preserves it. A newer entry request replaces an already retained intent during a missing-view interval. A first request with no host or no permitted descendant retains the previous no-wait behavior.

Regression evidence includes real React mounted/updated entry and updated blur, acquisition-only capability/A11y separation, and twelve module boundary tests for replacement, retained epochs, cancellation, latest options, dual target/entry ownership and the no-target negative. The isolated prior-source control fails five assertions while six controls pass. The repaired focused contract/roving/React suite and narrow TypeScript are run before commit. The final native audit must run again on the new combined source; the earlier 192/192 artifact is not presented as its screenshot or acceptance. No public API, capability, FocusCenter policy, ingress bypass or lifecycle promotion is introduced.
