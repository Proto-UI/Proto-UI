# @proto.ui/module-feedback

Proto UI module that provides feedback capability for adapters.

## Purpose

Provides feedback capability to adapters running Proto UI prototypes.

## Package Role

Adapter-facing module package used by the Proto UI runtime and adapter layer.

## Install

```bash
npm install @proto.ui/module-feedback@0.3.0-alpha.1
```

## Draft shared material intent

`def.feedback.material.declare(slot)` declares one setup-owned material slot. `def.feedback.material.use(candidate)` contributes a whole static candidate; `i.feedback.material.use(candidate)` does the same from an active Rule. Both setup methods return setup-only disposers. Static panels need no button state.

```ts
def.feedback.style.use(tw('bg-secondary text-secondary-foreground rounded-lg'));
def.feedback.material.declare({
  version: 2,
  shape: { kind: 'rounded-rect', geometry: 'style' },
  source: { kind: 'in-app-backdrop' },
  fallback: { fill: 'style', foreground: 'style' },
});
def.feedback.material.use({ intent: 'liquid-glass' });
```

Explicit `liquid-glass` requires a self optical renderer. `adaptive-blur` is a different intent for an eligible system material or in-app browser compositor. Backend model/profile versions remain host-private. Optional liquid-glass `variant` and finite `deformation: { kind: 'press', phase: 'rest' | 'pressed' }` consume existing state through mutually exclusive Rules; they add no input owner. Multiple candidates, even identical ones, are a conflict rather than last-write-wins. Zero candidates retain the slot and its fallback.

The fallback is derived from the governed final style IR and current theme; arbitrary computed CSS is not proof of ownership. Unknown/nonopaque fallback or conflicting paint cannot be cleared as if a valid fallback existed. Reduced motion constrains dynamic deformation to a supported static path; reduced transparency/forced colors/unsafe contrast require opaque fallback.

`VISUAL_FEEDBACK_SINK_CAP` receives complete style/material intent for a current view. It does not certify source resources or paint. Without an admitted sink, ordinary legal style stays in place and the privileged Feedback diagnostic is `material-host-unavailable`. This draft API does not claim that any Web or GPUI provider, all family projections, or full Prototype Compiler lowering is done.

共享材质为 draft：静态面板可直接表达显式液态玻璃，平台适应模糊是另一种意图。Rule 整值候选与最终 style 共同替换，不复制 Button 行为；多个候选保持冲突。减少动态效果优先约束为静态材质，不等于减少透明度。缺失宿主能力会保留普通合法 style 并诊断，不能将接口或纯测试通过当成真实绘制、原生材质或完整 Compiler 支持。

## Internal Structure

- `src/caps.ts`
- `src/create.ts`
- `src/index.ts`
- `src/types.ts`

## Related Internal Packages

- `@proto.ui/core`
- `@proto.ui/module-base`

## License

MIT
