import { definePrototype, tw } from '@proto.ui/core';

/** One exact authored input for Runtime and every native source consumer. */
export default definePrototype({
  name: 'shader-presentation-owner',
  setup(def) {
    def.props.define({ visible: { type: 'boolean', default: true } });
    def.feedback.style.use(tw('block', 'p-4'));
    def.feedback.material.shader({
      version: 1,
      source: {
        kind: 'owned-pixels',
        width: 2,
        height: 2,
        pixels: [255, 0, 0, 255, 0, 128, 0, 128, 0, 0, 64, 64, 64, 128, 192, 255],
        colorSpace: 'linear-srgb',
        alpha: 'premultiplied',
        origin: 'top-left',
      },
      passes: [
        { id: 'copied', kernel: 'copy-rgba8-v1', input: '$source' },
        { id: 'tinted', kernel: 'tint-rgba8-v1', input: 'copied', tint: [0.5, 1, 0.25, 0.5] },
      ],
      output: 'tinted',
      fallback: [0.15, 0.2, 0.25, 1],
    });
    def.lifecycle.onCreated((run) => run.lifecycle.setPresent(run.props.get().visible));
    def.props.watch(['visible'], (run, next) => run.lifecycle.setPresent(next.visible));
    return (r) => r.el('button', ['ordinary child', r.slot()]);
  },
});
