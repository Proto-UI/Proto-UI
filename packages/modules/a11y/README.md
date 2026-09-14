# @proto.ui/module-a11y

Proto UI module that records accessibility semantic object IR for host projection.

This package is intentionally not a Web ARIA wrapper. Adapters decide how to map the semantic object snapshot to their host accessibility surface.

Prototype authors obtain an `AccessibleHandle` through `asAccessible()` from `@proto.ui/hooks`. The module retains the instance-scoped semantic IR and setup guards; State owns dynamic facts and the host capability owns projection. In 0.3, `def.a11y` and `A11yDefAPI` are removed without aliases.
