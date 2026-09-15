# Expose State Web Extension (v0)

> Catalog authority: `M-EXPOSE-STATE-WEB-0001`, `HC-EXPOSE-STATE-WEB-TARGETS-0001` and `T-EXPOSE-STATE-WEB-0001`. This document is a readable projection; lifecycle and open questions follow those entities.

> Status: Draft – v0
>
> Web extension maps expose-state to DOM `data-*` attributes and CSS variables. This is Web-only and does not change expose-state semantics.

---

## 0. Scope and Non-goals

- web mapping strategy
- name → attr/var rules
- lifecycle synchronization

Not included:

- write capability
- cross-platform guarantees

---

## 1. Default Mapping

### 1.1 Semantic name → DOM names

- `btn.disabled` → `data-btn-disabled` and `--pui-btn-disabled`
- rules: official aliases first; otherwise trim, separate camelCase, normalize punctuation/whitespace to collapsed hyphens, remove edge hyphens, lowercase

### 1.2 Type-driven mapping

- enum/string → attr
- bool → attr (true: empty string, false: remove)
- number.discrete → attr + css var
- number.range → css var

---

## 2. Overrides (optional)

Via `EXPOSE_STATE_WEB_MODE_CAP`:

- `allowContinuousAttr`
- `allowStringVar`

---

## 3. Lifecycle

- subscription-driven sync
- revoke subscriptions on host loss, unmounting, detach and terminal disposal; remount replays current values
- cleanup invalidates bindings and future writes; erasing/restoring prior DOM artifacts after target, mapping or mode changes remains unresolved

---

## 4. Minimum Tests

- bool/enum/string/number discrete/continuous mapping
- semantic name mapping rules
