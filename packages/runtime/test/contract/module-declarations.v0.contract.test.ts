import { describe, expect, it } from 'vitest';
import { declareModule, moduleDeclaration, type PrototypeModuleDeclaration } from '@proto.ui/core';
import { defineModule } from '@proto.ui/module-base';
import { RuntimeModuleOrchestrator } from '../../src/orchestrator/module-orchestrator/runtime-module-orchestrator';

describe('runtime static module declarations', () => {
  it('passes the immutable declaration view into ModuleInit', () => {
    const token = moduleDeclaration<{ kind: string }>('@proto.ui/test/runtime-declaration');
    const declaration = declareModule(token, { kind: 'control' });
    let captured: readonly PrototypeModuleDeclaration[] | null = null;
    const ProbeModuleDef = defineModule({
      name: 'runtime-declaration-probe',
      resourceOwnership: 'instance',
      create({ init }) {
        captured = init.declarations;
        return {
          name: 'runtime-declaration-probe' as const,
          scope: 'instance' as const,
          facade: {},
          hooks: {},
        };
      },
    });
    new RuntimeModuleOrchestrator(
      {
        prototypeName: 'x-runtime-declarations',
        declarations: [declaration],
        getPhase: () => 'setup',
      },
      [ProbeModuleDef]
    );
    expect(captured).toEqual([declaration]);
    expect(Object.isFrozen(captured)).toBe(true);
  });
});
