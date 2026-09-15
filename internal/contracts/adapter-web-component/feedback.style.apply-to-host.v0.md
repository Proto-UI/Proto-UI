# adapter-web-component / feedback.style.apply-to-host — Apply-to-Host Contract (v0)

> Historical host-style projection, not a rule for every current presentation mode. In explicit Shadow split, visible Root paint targets the inner surface while governed placement and non-paint contributions target the boundary. Current authority is [C-HOST-SURFACE-PROJECTION-0001](../../../spec/contracts/C-HOST-SURFACE-PROJECTION-0001.yaml), [D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001](../../../spec/decisions/D-FEEDBACK-STYLE-ROLE-RESOLUTION-0001.yaml) and [D-WEB-COMPONENT-SHADOW-PROFILE-0001](../../../spec/decisions/D-WEB-COMPONENT-SHADOW-PROFILE-0001.yaml). In particular, unsupported split recipes fail closed under those draft criteria; the legacy graceful-degradation wording below does not authorize silent fallback.

## 1. Purpose

This contract defines how a Web Component adapter consumes exported style intent from feedback and **applies it to the host element**.

In v0, the adapter primarily realizes style intent by mapping tokens to **class-based output**, assisted by Tailwind as a runtime style system.

This contract does NOT define how style intent is generated or merged. It only defines the responsibilities and invariants of the adapter when applying style intent to the host.

---

## 2. Inputs

### 2.1 Style Intent Input

The adapter consumes style intent via `feedback.style.export`, conceptually represented as:

```ts
{
  tokens: string[]
}
```

- `tokens` are semantic style intent tokens
- Tokens originate from `def.feedback.style.use`
- Tokens have already been semantically merged

---

### 2.2 Host Element

The adapter applies styles to the **component host element**.

- The host element is the root interaction surface
- The adapter MUST NOT assume exclusive ownership of the host’s classes
- Pre-existing classes on the host MUST be preserved

---

## 3. Realization Strategy (v0)

### 3.1 Primary Strategy: Class Mapping

In v0, the adapter SHOULD realize style intent by mapping exported tokens to **class names applied on the host element**.

- Each token is treated as a class-like identifier
- Tokens are added to the host’s `classList`
- Token-to-class mapping is identity-based by default

This strategy aligns with Tailwind’s runtime model and enables downstream customization via standard CSS.

---

### 3.2 Optional Optimization: CSS Variables

The adapter MAY choose to introduce CSS variables as an optimization strategy.

Examples include (non-exhaustive):

- reducing class churn
- enabling theme-level overrides
- improving runtime update performance

Such optimizations MUST preserve the semantic meaning of tokens and MUST NOT change observable behavior.

The presence or absence of CSS variables is an implementation detail and MUST NOT be relied upon by component authors.

---

## 4. Application Semantics

### 4.1 Initial Application

The adapter MUST apply all exported tokens to the host element when the component is mounted.

- Tokens MUST be applied as a coherent set
- Partial application is not allowed

---

### 4.2 Update Semantics

Although v0 style intent is static, the adapter MUST follow these rules to remain compatible with future extensions:

- Re-applying style intent MUST NOT reorder tokens semantically
- Later updates MUST NOT reintroduce tokens that were previously removed
- Style application MUST be idempotent

---

### 4.3 Cleanup

When the component is unmounted or disposed:

- The adapter MUST remove only the styles it applied
- Pre-existing host classes MUST NOT be removed or altered

Cleanup MUST be precise and scoped.

---

## 5. Scheduling and Timing

### 5.1 Scheduling Responsibility

The adapter is responsible for choosing _when_ style intent is applied.

Feedback does not dictate scheduling.

---

### 5.2 Timing Constraints (v0)

The adapter MUST satisfy the following constraints:

- **Order Preservation** Style application MUST NOT invert the relative order of user interactions.

- **Bounded Latency** Applied styles MUST become observable no later than:
  - the host’s next render/commit cycle, or
  - the next animation frame

Immediate application is allowed and considered compliant.

---

### 5.3 Host-driven Rendering

If the host environment controls render timing:

- The adapter MAY defer style application to align with host scheduling
- Such deferral MUST remain within the bounded latency defined above

---

## 6. Semantic Invariants

All adapter implementations MUST preserve the following invariants:

1. **Semantic Equivalence** The realized host styles MUST reflect the same semantic intent described by exported tokens.

2. **No Implicit Priority Injection** The adapter MUST NOT introduce additional priority or cascade rules beyond what is implied by semantic merge.

3. **Host Agnosticism** The adapter MUST NOT rely on undocumented host behavior or undefined class ordering semantics.

---

## 7. Error Handling

The adapter MUST NOT throw due to style application unless:

- the host element is unavailable
- internal invariants are violated

Style realization failures SHOULD degrade gracefully where possible.

---

## 8. Debug and Compliance Signaling (Optional)

The adapter MAY expose diagnostic information for debugging purposes, such as:

- realization strategy (`class-based`, `class+vars`)
- application timing (`immediate`, `next-frame`, `host-commit`)

Such signals are for diagnostics only and MUST NOT affect semantics.

---

## 9. Non-goals

This contract explicitly does NOT define:

- How Tailwind is configured or bundled
- How tokens are authored
- How dynamic conditions affect styles
- How multiple adapters coordinate styles
- How user-defined CSS overrides are authored

---

## 10. Related Contracts

This contract consumes:

- `feedback/style.export.v0`

And complements:

- `feedback/style.use.setup-only.v0`
- `feedback/style.merge.semantic.v0`
