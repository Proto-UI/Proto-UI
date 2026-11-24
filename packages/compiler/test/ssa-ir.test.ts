import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_BITS,
  PROTO_IR_VERSION,
  SsaBuilder,
  decodeCapabilityMask,
  encodeCapabilityMask,
  optimizeSsaFunction,
  printSsaFunction,
  verifySsaFunction,
  type SsaFunction,
} from '../src/ir';

describe('Proto SSA IR', () => {
  it('encodes and decodes 64-bit capability bitmasks without loss', () => {
    const caps = ['props', 'state', 'focus', 'accessible', 'overlay'] as const;
    const mask = encodeCapabilityMask(caps);
    expect(mask).toBe(
      CAPABILITY_BITS.props |
        CAPABILITY_BITS.state |
        CAPABILITY_BITS.focus |
        CAPABILITY_BITS.accessible |
        CAPABILITY_BITS.overlay
    );
    expect(decodeCapabilityMask(mask).sort()).toEqual([...caps].sort());
  });

  it('folds constants, simplifies boolean identities, prunes dead blocks and dead instructions', () => {
    const b = new SsaBuilder('opt_test', [{ id: '%x', type: 'i1' }], 'i32', {
      exported: true,
      pure: true,
    });
    const deadVal = b.binop('add', 'i32', b.constI32(10), b.constI32(32)); // dead
    void deadVal;
    const alwaysTrue = b.cmp('eq', 'i32', b.constI32(5), b.constI32(5));
    const simplified = b.binop('and', 'i1', alwaysTrue, '%x'); // true && %x -> %x
    const thenBlk = b.createBlock('then_blk');
    const deadBlk = b.createBlock('dead_blk');

    b.condbr(alwaysTrue, thenBlk.label, deadBlk.label);

    b.positionAt(thenBlk);
    const out = b.select('i32', simplified, b.constI32(100), b.constI32(200));
    b.ret(out);

    b.positionAt(deadBlk);
    b.ret(b.constI32(-1));

    const fn = b.build();
    expect(verifySsaFunction(fn)).toEqual([]);

    const { fn: opt, stats } = optimizeSsaFunction(fn);
    expect(verifySsaFunction(opt)).toEqual([]);
    expect(stats.foldedConstants).toBeGreaterThan(0);
    expect(stats.eliminatedBlocks).toBe(1);
    expect(stats.eliminatedInstructions).toBeGreaterThan(0);
    expect(opt.blocks.map((blk) => blk.label)).toEqual(['entry', 'then_blk']);
    expect(printSsaFunction(opt)).toContain('select.i32 %x');
  });

  it('rejects malformed SSA invariants cleanly', () => {
    const bad: SsaFunction = {
      name: 'bad_fn',
      params: [{ id: '%p', type: 'i32' }],
      returnType: 'i1',
      blocks: [
        {
          label: 'entry',
          instructions: [
            // Type mismatch: `not` requires i1, given i32 %p
            { op: 'not', result: '%r', operand: '%p' },
            // Undefined operand %ghost
            { op: 'binop', result: '%r', operator: 'and', type: 'i1', lhs: '%r', rhs: '%ghost' },
          ],
          terminator: { op: 'br', target: 'nonexistent' },
        },
      ],
    };
    const issues = verifySsaFunction(bad);
    expect(issues.length).toBeGreaterThanOrEqual(4);
    expect(issues.map((d) => d.message).join('\n')).toMatch(/Duplicate SSA definition/);
    expect(issues.map((d) => d.message).join('\n')).toMatch(/Type mismatch/);
    expect(issues.map((d) => d.message).join('\n')).toMatch(/Undefined SSA value %ghost/);
    expect(issues.map((d) => d.message).join('\n')).toMatch(/unknown block nonexistent/);
    expect(PROTO_IR_VERSION).toBe(2);
  });
});
