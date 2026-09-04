import { loadSpecWorkspaceFromDirectory } from '@proto.ui/spec-engine/node';
import { describe, expect, it } from 'vitest';
import path from 'node:path';

const SPEC_DIR = path.join(process.cwd(), 'spec');

/** The pinned historical compatibility baseline the catalog claims. */
const PINNED_BASELINE = 'f31ed81983653919dd4fe77aee4b4859f610f1dc';
/** The later revision the baseline was compared against. */
const COMPARED_REVISION = '63c1308d112b6b1205d86244a156cca1abef5087';
/** The later official recipe adopted as visual-source evidence. */
const ADOPTED_RECIPE = '1773ecfeeb4a04366978d353e69b5c7ded78dcb2';
/** The maintainer ruling that fixed the box radius. */
const RADIUS_RULING = 'issues/379#issuecomment-5376886742';

/**
 * Every intentional deviation, by a phrase that names it in each locale. The
 * inventory is a named set rather than a total, so classifying another one
 * cannot leave a stale count behind — which is what this list guards.
 */
const INTENTIONAL_DEVIATIONS: Array<{ en: string; 'zh-CN': string }> = [
  { en: '`asChild` is omitted', 'zh-CN': '`asChild` 依' },
  {
    en: '`aria-invalid:*` presentations are not implemented',
    'zh-CN': '`aria-invalid:*` 呈现不实现',
  },
  { en: 'Upstream `peer` is not published', 'zh-CN': 'upstream 的 `peer` 不发布' },
  {
    en: 'Upstream `text-current` is not implemented',
    'zh-CN': 'upstream 的 `text-current` 不实现',
  },
  {
    en: 'The indeterminate presentation is added by this projection',
    'zh-CN': 'indeterminate 呈现是本投射新增的',
  },
  {
    en: 'ownership difference is recorded as an intentional deviation',
    'zh-CN': '所有者差异记为有意偏离',
  },
];

/** Every revision the comparison depends on must appear as a cited source. */
function sourcePaths(entity: { sources?: Array<{ path: string }> } | undefined): string {
  return (entity?.sources ?? []).map((source) => source.path).join('\n');
}

describe('shadcn Checkbox baseline text', () => {
  it('keeps the pinned baseline and the later adopted recipe distinguishable', async () => {
    const workspace = await loadSpecWorkspaceFromDirectory(SPEC_DIR);
    expect(workspace.issues).toEqual([]);

    const entity = workspace.entities.find((candidate) => candidate.id === 'P-SHADCN-CHECKBOX');
    const criterion = entity?.criteria?.find(
      (candidate) => candidate.id === 'P-SHADCN-CHECKBOX-COMPATIBILITY-SUBSET'
    );

    const text = criterion?.text;
    if (!text || typeof text === 'string') {
      throw new Error('compatibility-subset criterion must have bilingual text');
    }
    expect(text.en).toContain(
      'the pinned historical compatibility baseline and evidence for later official recipes must remain distinct'
    );
    // Agreement with a later recipe is not baseline movement, and disagreement
    // is not automatically a gap. Both halves have to survive an edit.
    expect(text.en).toContain('must not be read as advancing the overall baseline');
    expect(text.en).toContain('must not be filed as a parity gap by default');
    expect(text['zh-CN']).toContain('固定历史兼容比较基线与后来的官方 recipe 证据必须分开记录');

    const context = entity?.openQuestions?.[0]?.context;
    if (!context || typeof context === 'string') {
      throw new Error('the compatibility open question must have bilingual context');
    }
    // The per-item conclusions are the whole point of the separation: which
    // parts of the later recipe this projection adopts, and which it does not.
    // The comparison depends on two revisions, so both must be bound by
    // executable evidence. A floating "current upstream" claim cannot be
    // reconstructed once that branch moves.
    expect(context.en).toContain(PINNED_BASELINE);
    expect(context.en).toContain(COMPARED_REVISION);
    expect(context.en).not.toContain('current upstream main');
    expect(context['zh-CN']).toContain(COMPARED_REVISION);
    expect(context.en).toContain('style-maia.css');
    expect(context.en).toContain('centers with `flex items-center justify-center`');
    expect(context.en).toContain('`rounded-[6px]` is not adopted');
    expect(context['zh-CN']).toContain('逐字节相同');
    expect(context['zh-CN']).toContain('`rounded-[6px]` 未被采用');

    // The centering mechanism has one settled classification. It must not read
    // as an adoption in one sentence and a remaining gap in the next.
    expect(context.en).toContain('intentional adoption of the later official recipe');
    expect(context.en).not.toMatch(/gaps include[^.]*centering mechanism/);
    expect(context['zh-CN']).toContain('有意采用较新官方 recipe');

    // Both revisions must be reachable from the entity's own source ledger,
    // not merely mentioned in prose.
    const rootSources = sourcePaths(entity as never);
    expect(rootSources).toContain(PINNED_BASELINE);
    expect(rootSources).toContain(COMPARED_REVISION);
    expect(rootSources).toContain(ADOPTED_RECIPE);

    const indicator = workspace.entities.find(
      (candidate) => candidate.id === 'P-SHADCN-CHECKBOX-INDICATOR'
    );
    const indicatorContext = indicator?.openQuestions?.[0]?.context;
    if (!indicatorContext || typeof indicatorContext === 'string') {
      throw new Error('the Indicator compatibility question must have bilingual context');
    }
    // Same settled classification on the owning entity, not merely a retraction.
    expect(indicatorContext.en).toContain(
      'intentional adoption of the later official recipe rather than a parity gap'
    );
    expect(indicatorContext['zh-CN']).toContain('有意采用较新官方 recipe');

    const indicatorSources = sourcePaths(indicator as never);
    expect(indicatorSources).toContain(PINNED_BASELINE);
    expect(indicatorSources).toContain(COMPARED_REVISION);
    // The Indicator's centering classification rests on the later recipe, so
    // that revision has to be reachable from this entity's own ledger, not only
    // from the Root's.
    expect(indicatorSources).toContain(ADOPTED_RECIPE);
    expect(indicatorContext.en).toContain(PINNED_BASELINE);

    // The mechanism is adopted but its owner is not; both halves must survive.
    expect(indicatorContext.en).toContain('The owner does differ');
    expect(indicatorContext['zh-CN']).toContain('所有者');
  });

  it('names every intentional deviation instead of counting them', async () => {
    const workspace = await loadSpecWorkspaceFromDirectory(SPEC_DIR);
    const entity = workspace.entities.find((candidate) => candidate.id === 'P-SHADCN-CHECKBOX');
    const context = entity?.openQuestions?.[0]?.context;
    if (!context || typeof context === 'string') {
      throw new Error('the compatibility open question must have bilingual context');
    }

    // A numeric total goes stale the moment another deviation is classified,
    // and leaves the authoritative inventory contradicting its own list.
    expect(context.en).not.toMatch(
      /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+intentional deviations\b/i
    );
    expect(context['zh-CN']).not.toMatch(/有意偏离有[一二三四五六七八九十百零\d]+项/);

    for (const deviation of INTENTIONAL_DEVIATIONS) {
      expect(context.en, `en inventory must name: ${deviation.en}`).toContain(deviation.en);
      expect(context['zh-CN'], `zh-CN inventory must name: ${deviation['zh-CN']}`).toContain(
        deviation['zh-CN']
      );
    }
  });

  it('binds the radius decision to a reconstructible ruling', async () => {
    const workspace = await loadSpecWorkspaceFromDirectory(SPEC_DIR);
    const entity = workspace.entities.find((candidate) => candidate.id === 'P-SHADCN-CHECKBOX');
    const context = entity?.openQuestions?.[0]?.context;
    if (!context || typeof context === 'string') {
      throw new Error('the compatibility open question must have bilingual context');
    }

    // Not adopting `rounded-[6px]` is a decision with an owner. Naming "the
    // issue ruling" without an identifier cannot be reconstructed by a reader.
    expect(context.en).toContain(RADIUS_RULING);
    expect(context['zh-CN']).toContain(RADIUS_RULING);
    expect(context.en).not.toContain('per the issue ruling');
    expect(context['zh-CN']).not.toContain('按 issue 裁决');
    expect(sourcePaths(entity as never)).toContain(RADIUS_RULING);
  });
});
