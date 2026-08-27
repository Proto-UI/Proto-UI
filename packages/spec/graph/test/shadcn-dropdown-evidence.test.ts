import { loadSpecWorkspaceFromDirectory } from '@proto.ui/spec-engine/node';
import { describe, expect, it } from 'vitest';
import path from 'node:path';

const SPEC_DIR = path.join(process.cwd(), 'spec');

describe('shadcn Dropdown Item evidence text', () => {
  it('preserves the complete parsed destructive evidence boundary', async () => {
    const workspace = await loadSpecWorkspaceFromDirectory(SPEC_DIR);
    expect(workspace.issues).toEqual([]);

    const entity = workspace.entities.find(
      (candidate) => candidate.id === 'P-SHADCN-DROPDOWN-MENU-ITEM'
    );
    const criterion = entity?.criteria?.find(
      (candidate) => candidate.id === 'P-SHADCN-DROPDOWN-MENU-ITEM-DESTRUCTIVE-EVIDENCE-BOUNDARY'
    );

    const text = criterion?.text;
    if (!text || typeof text === 'string') {
      throw new Error('destructive evidence-boundary criterion must have bilingual text');
    }
    expect(text.en).toContain('surface remains render-undemonstrated');
    expect(text.en).toContain(
      'Button #454 is a related component observation, not measured evidence for Dropdown Item'
    );
    expect(text['zh-CN']).toContain('Button #454 仅是相邻组件观察');

    const testEntity = workspace.entities.find(
      (candidate) => candidate.id === 'T-SHADCN-DROPDOWN-MENU-ITEM-0001'
    );
    const note = testEntity?.implementations?.[0]?.notes?.[0];
    expect(note).toContain('Button #454 is only a related component observation');
    expect(note).toContain('not measured evidence for Dropdown Item');
  });
});
