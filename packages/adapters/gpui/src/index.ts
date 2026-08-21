/**
 * Spike entry: exposes the fake bridge and the adapter surface contract notes.
 * Real module wiring lands only after the #466 port-strategy ruling; see
 * docs/superpowers/specs/2026-08-22-gpui-adapter-spike-design.md.
 */
export { FakeGpuiBridge } from './fake-bridge';
export type { GpuiElement, GpuiElementKind, GpuiInputMessage } from './fake-bridge';
