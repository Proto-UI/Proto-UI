// @vitest-environment node
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  TINT_STAGE_POLICY,
  TINT_STAGE_RAMPS,
  TINT_STAGE_KINDS,
  tintStageShader,
  mapTintStage,
  continuousTintVeto,
  assertMonotonicRamp,
  decodeTintStage,
  observedTintStageMean,
  assertSameStageFrame,
  tintTextureCosts,
  verifyTintStageSafety,
  type FrameBinding,
  type VetoSample,
  applyTintStageDither,
  failedTintStageResult,
  summarizeTintStageNativeStatus,
  createTintStageHistoricalSubstitution,
  assertTintStageHistoricalKernelReceipt,
  type TintStageKernelReceipt,
} from './liquid-tint-stage-diagnostic';
import { vertex } from '../../../../../../packages/adapters/base/src/material/liquidgl-kernel.generated';
import {
  TINT_PROFILE4_FIXTURE,
  tintProfile4Fragment,
  tintProfile4ContactFragment,
} from './liquid-tint-profile4-fixture';
import {
  styleTintProfile,
  styleTintContactProfile,
  styleTintFragment,
  styleTintContactFragment,
} from '../../../../../../packages/adapters/base/src/material/style-tint-profile';
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const root = process.cwd(),
  directory = path.join(root, 'apps/www/src/content/docs/zh-cn/liquid-tint-stage-inputs');
const binding: FrameBinding = {
  id: 'frame-1',
  sourceRevision: 4,
  sourceSha256: 'source-a',
  preparedSha256: 'prepared-a',
  frameSha256: 'frame-a',
  uniformSha256: 'uniform-a',
  maskSha256: 'mask-a',
  profile: 'pui-regular-style-tint-contact-4',
};
const samples = (tones: number[], mean: number, bound: number, light: boolean): VetoSample[] =>
  tones.map((tone) => {
    const result = mapTintStage(tone, mean, bound, light);
    return {
      tone,
      oldTarget: result.baseline,
      newTarget: result.candidate,
      low: result.low,
      high: result.high,
      opaque: true,
    };
  });
function historicalKernelReceipt(): TintStageKernelReceipt {
  return {
    scope: TINT_STAGE_POLICY.executionScope,
    currentProductValidation: false,
    currentAdapter: {
      profile: styleTintContactProfile,
      requestedFragmentSha256: hash(styleTintContactFragment),
    },
    compiledKernel: {
      profile: TINT_PROFILE4_FIXTURE.contact.profile,
      fragmentSha256: TINT_PROFILE4_FIXTURE.contact.sha256,
      head: TINT_PROFILE4_FIXTURE.head,
      tree: TINT_PROFILE4_FIXTURE.tree,
    },
    vertexSha256: hash(vertex),
    vertexSources: 1,
    fragmentReplacements: 1,
    unusedAdapterUniforms: ['u_styleTintSourceTone'],
  };
}
function nativeSummaryFixture() {
  const frozenIds = Array.from({ length: 16 }, (_, i) => `frozen-tinted-${i}`);
  const ids = [...frozenIds, ...TINT_STAGE_RAMPS.map((ramp) => ramp.id)];
  const coverage: Record<string, { status: string; executed: boolean }> = Object.fromEntries(
    ids.map((id) => [id, { status: 'passed', executed: true }])
  );
  const results = new Map<
    string,
    {
      status: string;
      evidenceKind: string;
      kernelExecution?: TintStageKernelReceipt;
      ramp?: { id: string };
      veto?: ReturnType<typeof continuousTintVeto>;
    }
  >(
    ids.map((id) => [
      id,
      {
        status: 'collected-native-diagnostic',
        evidenceKind: 'native-diagnostic',
        kernelExecution: historicalKernelReceipt(),
      },
    ])
  );
  for (const ramp of TINT_STAGE_RAMPS) {
    const tones = Array.from(
      { length: 256 },
      (_, i) =>
        (ramp.low + ((ramp.high - ramp.low) * (ramp.direction === 1 ? i : 255 - i)) / 255) / 255
    );
    results.set(ramp.id, {
      ...results.get(ramp.id)!,
      ramp,
      veto: continuousTintVeto(
        samples(tones, 0.5, 0.42810766728058786, ramp.lightForeground),
        0.5,
        0.42810766728058786,
        ramp.lightForeground,
        ramp.direction
      ),
    });
  }
  return { frozenIds, coverage, results };
}
describe('test-only Tint4 stage diagnosis, never product acceptance', () => {
  it('reports an incomplete native diagnosis when all GPU cases were blocked before execution', () => {
    const { frozenIds, coverage, results } = nativeSummaryFixture();
    for (const id of Object.keys(coverage)) coverage[id] = { status: 'blocked', executed: false };
    results.clear();
    expect(summarizeTintStageNativeStatus(frozenIds, coverage, results)).toEqual({
      candidateStatus: 'incomplete-native-diagnostic',
      allExpectedGpuEvidenceComplete: false,
      allFullDomainEndpointVetoesConfirmed: false,
    });
    expect(TINT_STAGE_POLICY.candidateGeneralTransfer).toBe('rejected-analytically');
    expect(TINT_STAGE_POLICY.productAccepted).toBe(false);
  });
  it('does not claim a complete native rejection after one frozen case fails or is interrupted', () => {
    const { frozenIds, coverage, results } = nativeSummaryFixture();
    for (const status of ['failed', 'interrupted']) {
      coverage[frozenIds[0]].status = status;
      expect(summarizeTintStageNativeStatus(frozenIds, coverage, results)).toEqual({
        candidateStatus: 'incomplete-native-diagnostic',
        allExpectedGpuEvidenceComplete: false,
        allFullDomainEndpointVetoesConfirmed: true,
      });
    }
  });
  it('requires both confirmed endpoints for every full-domain direction and foreground polarity', () => {
    for (const ramp of TINT_STAGE_RAMPS.filter((ramp) => ramp.low === 0))
      for (const missing of ['low', 'high']) {
        const { frozenIds, coverage, results } = nativeSummaryFixture();
        const veto = results.get(ramp.id)!.veto!;
        veto.intervals = veto.intervals.filter((interval) => interval.side !== missing);
        expect(summarizeTintStageNativeStatus(frozenIds, coverage, results)).toEqual({
          candidateStatus: 'incomplete-native-diagnostic',
          allExpectedGpuEvidenceComplete: true,
          allFullDomainEndpointVetoesConfirmed: false,
        });
      }
  });
  it('does not substitute passed labels, archived references or missing receipts for native execution', () => {
    for (const defect of ['not-executed', 'archived', 'missing-receipt']) {
      const { frozenIds, coverage, results } = nativeSummaryFixture();
      if (defect === 'not-executed') coverage[frozenIds[0]].executed = false;
      else if (defect === 'archived')
        results.get(frozenIds[0])!.evidenceKind = 'archived-reference';
      else results.delete(frozenIds[0]);
      expect(summarizeTintStageNativeStatus(frozenIds, coverage, results).candidateStatus).toBe(
        'incomplete-native-diagnostic'
      );
    }
  });
  it('reports observed continuous-tone rejection only after all 28 native cases and full-ramp endpoints complete', () => {
    const { frozenIds, coverage, results } = nativeSummaryFixture();
    expect(summarizeTintStageNativeStatus(frozenIds, coverage, results)).toEqual({
      candidateStatus: 'diagnostic-rejected-on-continuous-tone',
      allExpectedGpuEvidenceComplete: true,
      allFullDomainEndpointVetoesConfirmed: true,
    });
    expect(TINT_STAGE_POLICY.candidateGeneralTransfer).toBe('rejected-analytically');
    expect(TINT_STAGE_POLICY.productAccepted).toBe(false);
  });
  it('binds frozen profile4 bytes independently of current profile6 and finite derivative anchors', () => {
    expect(styleTintProfile).toBe('pui-regular-style-tint-6');
    expect(styleTintContactProfile).toBe('pui-regular-style-tint-contact-6');
    expect(hash(styleTintFragment)).not.toBe(TINT_STAGE_POLICY.shaderSha256.static);
    expect(hash(styleTintContactFragment)).not.toBe(TINT_STAGE_POLICY.shaderSha256.contact);
    expect(hash(tintProfile4Fragment)).toBe(TINT_STAGE_POLICY.shaderSha256.static);
    expect(hash(tintProfile4ContactFragment)).toBe(TINT_STAGE_POLICY.shaderSha256.contact);
    expect(Buffer.byteLength(tintProfile4Fragment)).toBe(10692);
    expect(Buffer.byteLength(tintProfile4ContactFragment)).toBe(10945);
    expect(tintStageShader('baseline')).toBe(tintProfile4ContactFragment);
    expect(tintStageShader('baseline', false)).toBe(tintProfile4Fragment);
    for (const kind of TINT_STAGE_KINDS) {
      const source = tintStageShader(kind);
      expect(source.split('void main(){')).toHaveLength(2);
      if (kind !== 'baseline')
        expect(source.split('uniform float u_tintStageMean;')).toHaveLength(2);
    }
    expect(tintStageShader('tone')).toContain('tintStagePack(styleTintTone, 1.0, inShape)');
    expect(tintStageShader('postlight-r')).toContain('tintStagePack(final.r, 2.0, inShape)');
    expect(tintStageShader('target-clamp')).toContain('tintStageRaw < tintStageLow');
    expect(() => tintStageShader('author-code' as any)).toThrow('unknown-stage');
  });
  it('substitutes current source exactly once and accounts for its sole adapter-only uniform', () => {
    for (const contact of [false, true]) {
      const host = {
        profile: contact ? styleTintContactProfile : styleTintProfile,
        fragment: contact ? styleTintContactFragment : styleTintFragment,
        vertex,
      };
      const historical = contact ? tintProfile4ContactFragment : tintProfile4Fragment;
      const replacement = createTintStageHistoricalSubstitution(host, contact);
      expect(() => replacement.complete()).toThrow('substitution-count-drift');
      expect(replacement.source('vertex', vertex)).toBe(vertex);
      expect(() => replacement.complete()).toThrow('substitution-count-drift');
      expect(replacement.source('fragment', host.fragment)).toBe(historical);
      expect(replacement.complete()).toEqual({
        vertexSources: 1,
        fragmentReplacements: 1,
        unusedAdapterUniforms: ['u_styleTintSourceTone'],
      });
      expect(() => replacement.source('fragment', host.fragment)).toThrow('source-or-count-drift');
      expect(() => replacement.source('vertex', vertex)).toThrow('source-or-count-drift');
      expect(() =>
        createTintStageHistoricalSubstitution({ ...host, profile: 'profile5' }, contact)
      ).toThrow('current-host-profile-drift');
      expect(() =>
        createTintStageHistoricalSubstitution({ ...host, fragment: historical }, contact)
      ).toThrow('current-host-profile-drift');
      expect(() =>
        createTintStageHistoricalSubstitution(
          { ...host, fragment: host.fragment + '\nuniform float unapproved;' },
          contact
        )
      ).toThrow('historical-uniform-schema-drift');
      for (const replacement of [
        '',
        'uniform float u_styleTintSourceTone;',
        'uniform vec4 u_styleTintSourceTone;\nuniform vec4 u_styleTintSourceTone;',
      ])
        expect(() =>
          createTintStageHistoricalSubstitution(
            {
              ...host,
              fragment: host.fragment.replace('uniform vec4 u_styleTintSourceTone;', replacement),
            },
            contact
          )
        ).toThrow('historical-uniform-schema-drift');
      const stale = createTintStageHistoricalSubstitution(host, contact);
      expect(() => stale.source('fragment', host.fragment + '\n')).toThrow('source-or-count-drift');
      expect(() => stale.source('fragment', historical)).toThrow('source-or-count-drift');
      expect(() => stale.source('vertex', vertex + '\n')).toThrow('source-or-count-drift');
      expect(() => stale.source('unknown' as any, vertex)).toThrow('unexpected-shader-type');
      expect(() => stale.complete()).toThrow('substitution-count-drift');
    }
  });
  it('forbids relabeling historical replay as current profile6 evidence or dropping replacement receipts', () => {
    expect(() => assertTintStageHistoricalKernelReceipt(historicalKernelReceipt())).not.toThrow();
    const mutations: ((receipt: TintStageKernelReceipt) => void)[] = [
      (r) => {
        r.unusedAdapterUniforms = [];
      },
      (r) => {
        r.scope = 'current-production';
      },
      (r) => {
        r.currentProductValidation = true;
      },
      (r) => {
        r.currentAdapter.profile = TINT_PROFILE4_FIXTURE.contact.profile;
      },
      (r) => {
        r.currentAdapter.requestedFragmentSha256 = TINT_PROFILE4_FIXTURE.contact.sha256;
      },
      (r) => {
        r.compiledKernel.profile = styleTintContactProfile;
      },
      (r) => {
        r.compiledKernel.fragmentSha256 = hash(styleTintContactFragment);
      },
      (r) => {
        r.compiledKernel.head = 'current';
      },
      (r) => {
        r.compiledKernel.tree = 'current';
      },
      (r) => {
        r.vertexSha256 = '';
      },
      (r) => {
        r.vertexSources = 0;
      },
      (r) => {
        r.fragmentReplacements = 0;
      },
      (r) => {
        r.fragmentReplacements = 2;
      },
    ];
    for (const mutate of mutations) {
      const receipt = historicalKernelReceipt();
      mutate(receipt);
      expect(() => assertTintStageHistoricalKernelReceipt(receipt)).toThrow(
        'not-historical-profile4-evidence'
      );
      const { frozenIds, coverage, results } = nativeSummaryFixture();
      results.get(frozenIds[0])!.kernelExecution = receipt;
      expect(summarizeTintStageNativeStatus(frozenIds, coverage, results).candidateStatus).toBe(
        'incomplete-native-diagnostic'
      );
    }
    const { frozenIds, coverage, results } = nativeSummaryFixture();
    delete results.get(frozenIds[0])!.kernelExecution;
    expect(summarizeTintStageNativeStatus(frozenIds, coverage, results).candidateStatus).toBe(
      'incomplete-native-diagnostic'
    );
    const rampId = TINT_STAGE_RAMPS.find((ramp) => ramp.low === 0)!.id;
    results.get(rampId)!.kernelExecution!.currentProductValidation = true;
    expect(
      summarizeTintStageNativeStatus(frozenIds, coverage, results)
        .allFullDomainEndpointVetoesConfirmed
    ).toBe(false);
    expect(TINT_STAGE_POLICY.currentProductValidation).toBe(false);
  });
  it('disables RGBA8 dithering for every packed tap and preserves observed product state for final output', () => {
    const calls: string[] = [];
    const gl = {
      DITHER: 3024 as const,
      enable: (n: number) => calls.push(`enable:${n}`),
      disable: (n: number) => calls.push(`disable:${n}`),
    };
    for (const kind of TINT_STAGE_KINDS) {
      applyTintStageDither(gl, kind, true);
      expect(calls.at(-1)).toBe(
        `${kind === 'baseline' || kind === 'candidate' ? 'enable' : 'disable'}:3024`
      );
      applyTintStageDither(gl, kind, false);
      expect(calls.at(-1)).toBe('disable:3024');
    }
  });
  it('bounds exact RG16 storage quantization independently of inherited GLSL optical arithmetic', () => {
    for (let integer = 0; integer <= 65535; integer++) {
      const high = Math.floor(integer / 256),
        low = integer % 256;
      expect((high * 256 + low) / 65535).toBe(integer / 65535);
      if (integer < 65535) {
        const value = (integer + 0.49) / 65535;
        expect(Math.abs(Math.round(value * 65535) / 65535 - value)).toBeLessThanOrEqual(
          0.5 / 65535
        );
      }
    }
  });
  it('preserves bounded partial evidence without relabeling a failed baseline/target/safety stage as passed', () => {
    const partial = {
      id: 'frame',
      stagePngs: { baseline: 'data:image/png;base64,owned' },
      stageReceipts: { baseline: { sourceSha256: 'exact' } },
      productAccepted: true,
      currentProductValidation: true,
    };
    for (const error of [
      'tint-stage-baseline-mismatch',
      'tint-stage-target-arithmetic-mismatch',
      'tint-stage-rendered-contrast-unsafe',
    ]) {
      const result = failedTintStageResult(partial, new Error(error));
      expect(result.status).toBe('failed');
      expect(result.failure).toBe(error);
      expect(result.stagePngs).toEqual(partial.stagePngs);
      expect(result.stageReceipts).toEqual(partial.stageReceipts);
      expect(result.productAccepted).toBe(false);
      expect(result.currentProductValidation).toBe(false);
    }
  });
  it('predeclares both directions, three byte domains and both foreground polarities', () => {
    expect(TINT_STAGE_RAMPS).toHaveLength(12);
    expect(new Set(TINT_STAGE_RAMPS.map((r) => r.id)).size).toBe(12);
    expect(TINT_STAGE_POLICY.candidateGeneralTransfer).toBe('rejected-analytically');
    expect(TINT_STAGE_POLICY.productAccepted).toBe(false);
    expect(TINT_STAGE_POLICY.expectedCompleteDiagnosticStatus).toBe(
      'diagnostic-rejected-on-continuous-tone'
    );
  });
  it('rejects a real continuous clamp on all four safe-bound endpoints, including reversal', () => {
    for (const light of [true, false])
      for (const direction of [1, -1] as const) {
        const tones = Array.from({ length: 256 }, (_, i) => (direction === 1 ? i : 255 - i) / 255);
        const result = continuousTintVeto(
          samples(tones, 0.5, 0.42810766728058786, light),
          0.5,
          0.42810766728058786,
          light,
          direction
        );
        expect(result.verdict).toBe('rejected-continuous-tone');
        expect(new Set(result.intervals.map((i) => i.side))).toEqual(new Set(['low', 'high']));
      }
    const data = samples(
      Array.from({ length: 256 }, (_, i) => i / 255),
      0.5,
      0.42810766728058786,
      true
    );
    expect(data.filter((v) => v.low)).toHaveLength(73);
    expect(data.filter((v) => v.high)).toHaveLength(73);
  });
  it('does not turn ordinary 8bit RGB quantization into a clipping veto', () => {
    const data = samples([0.5001, 0.5002, 0.5003], 0.5, 0.42810766728058786, true);
    expect(data.map((v) => Math.round(v.newTarget * 255))).toEqual([55, 55, 55]);
    expect(continuousTintVeto(data, 0.5, 0.42810766728058786, true, 1).verdict).toBe(
      'no-confirmed-veto-in-this-ramp'
    );
  });
  it('flat input is uninformative and unrelated noise cannot qualify as a monotonic control', () => {
    expect(
      continuousTintVeto(samples([0.9, 0.9, 0.9], 0.5, 0.428, true), 0.5, 0.428, true, 1).verdict
    ).toBe('inconclusive-precision');
    expect(() => assertMonotonicRamp([0.5, 0.5, 0.5], 1)).toThrow('invalid-monotonic-control');
    expect(() => assertMonotonicRamp([0.2, 0.8, 0.3, 0.9], 1)).toThrow('invalid-monotonic-control');
  });
  it('packing uncertainty cannot resolve a two-sample endpoint plateau', () => {
    const data = samples([0.95, 0.95 + TINT_STAGE_POLICY.toneError / 2], 0.5, 0.428, true);
    expect(continuousTintVeto(data, 0.5, 0.428, true, 1).verdict).toBe('inconclusive-precision');
  });
  it('native flags and target readback are required alongside the analytic mapping', () => {
    const data = samples([0.8, 0.9, 1], 0.5, 0.428, true);
    expect(
      continuousTintVeto(
        data.map((s) => ({ ...s, high: false })),
        0.5,
        0.428,
        true,
        1
      ).intervals
    ).toHaveLength(0);
    expect(
      continuousTintVeto(
        data.map((s) => ({ ...s, newTarget: 0.2 })),
        0.5,
        0.428,
        true,
        1
      ).intervals
    ).toHaveLength(0);
  });
  it('uses a binary shader shape mask, never rounded output alpha == 255', () => {
    const decoded = decodeTintStage([128, 0, 0, 255, 64, 0, 255, 255], 1);
    expect(decoded.mask).toEqual([false, true]);
    expect(observedTintStageMean(decoded.values, decoded.mask).samples).toBe(1);
    expect(observedTintStageMean(decoded.values, decoded.mask).value).toBeCloseTo(16384 / 65535, 7);
    expect(() => decodeTintStage([0, 0, 254, 255], 1)).toThrow('nonbinary-shape-mask');
    expect(() => decodeTintStage([255, 255, 255, 0], 2)).toThrow('packed-overflow');
    expect(() => observedTintStageMean([0.5], [])).toThrow('empty-or-stale-mask');
    expect(() => observedTintStageMean([0.5], [false])).toThrow('empty-or-stale-mask');
  });
  it.each(Object.keys(binding) as (keyof FrameBinding)[])(
    'rejects stale frame binding field %s',
    (key) => {
      const stale = { ...binding, [key]: key === 'sourceRevision' ? 5 : 'stale' } as FrameBinding;
      expect(() => assertSameStageFrame(stale, binding)).toThrow(`stale-${key}`);
    }
  );
  it('accepts only the same complete binding and finite tone statistics', () => {
    expect(() => assertSameStageFrame({ ...binding }, binding)).not.toThrow();
    expect(() => mapTintStage(NaN, 0.5, 0.4, true)).toThrow('invalid-transfer-input');
    expect(() => observedTintStageMean([NaN], [true])).toThrow('invalid-tone');
  });
  it('records local full-shape plateau costs even when aggregate metrics could pass', () => {
    const data = samples([0.8, 0.9, 1, 0.4], 0.5, 0.428, true);
    const before = [20, 30, 40, 255, 21, 31, 41, 255, 22, 32, 42, 255, 18, 28, 38, 255];
    const after = [22, 32, 42, 255, 22, 32, 42, 255, 22, 32, 42, 255, 17, 27, 37, 255];
    const costs = tintTextureCosts(data, 4, 1, before, after, {
      mean: 0.5,
      bound: 0.428,
      light: true,
    });
    expect(costs.highClipPixels).toBe(3);
    expect(costs.largestPlateau).toBe(3);
    expect(costs.newFlatRgbEdges).toBe(2);
    expect(costs.resolvedClampedEdges).toBe(2);
    expect(() =>
      tintTextureCosts(data.slice(1), 4, 1, before, after, { mean: 0.5, bound: 0.428, light: true })
    ).toThrow('stale-texture-mask');
  });
  it('does not call a near-endpoint native flag a precision-resolved local clipping edge', () => {
    const data = samples([0.714001, 0.724], 0.5, 0.428, true);
    const costs = tintTextureCosts(
      data,
      2,
      1,
      [10, 10, 10, 255, 11, 11, 11, 255],
      [12, 12, 12, 255, 12, 12, 12, 255],
      { mean: 0.5, bound: 0.428, light: true }
    );
    expect(costs.rawClampedEdges).toBe(1);
    expect(costs.resolvedClampedEdges).toBe(0);
    expect(costs.uncertainOrUninformativeClampedEdges).toBe(1);
  });
  it('retains near-opaque composite, foreground interval and polarity readback checks', () => {
    expect(
      verifyTintStageSafety([0, 0, 0, 255, 0, 0, 0, 250], [0, 0.2, 0.5, 1], [1, 1, 1, 1])
        .minimumContrast
    ).toBeGreaterThan(4.5);
    expect(() =>
      verifyTintStageSafety([255, 255, 255, 255], [0, 0.2, 0.5, 1], [1, 1, 1, 1])
    ).toThrow('rendered-contrast-unsafe');
    expect(() => verifyTintStageSafety([0, 0, 0, 249], [0, 0.2, 0.5, 1], [1, 1, 1, 1])).toThrow(
      'empty-opaque-output'
    );
  });
  it('freezes all 16 original tinted inputs and each control own geometry/PNG binding', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
    expect(manifest.head).toBe(TINT_STAGE_POLICY.originalHead);
    expect(manifest.tree).toBe(TINT_STAGE_POLICY.originalTree);
    expect(manifest.provenance.runId).toBe(38799513893);
    expect(manifest.provenance.jobId).toBe(116644569728);
    expect(manifest.provenance.artifactId).toBe(12003538844);
    const referenced = new Set(
      manifest.frames.flatMap((frame: any) =>
        Object.values(frame.files).map((file: any) => file.file)
      )
    );
    expect([...referenced].sort()).toEqual(
      fs
        .readdirSync(directory)
        .filter((file) => file.endsWith('.png'))
        .sort()
    );
    expect(manifest.frames).toHaveLength(48);
    expect(manifest.frames.filter((f: any) => f.control === 'tinted')).toHaveLength(16);
    for (const frame of manifest.frames) {
      expect(frame.head).toBe(manifest.head);
      expect(frame.tree).toBe(manifest.tree);
      expect(frame.geometry.width).toBeGreaterThan(0);
      expect(frame.cells.length).toBeGreaterThan(0);
      if (frame.control === 'tinted')
        expect(frame.profile).toBe('pui-regular-style-tint-contact-4');
      for (const value of Object.values(frame.files) as any[]) {
        const bytes = fs.readFileSync(path.join(directory, value.file));
        expect(bytes.length).toBe(value.bytes);
        expect(hash(bytes)).toBe(value.sha256);
        expect(bytes.subarray(1, 4).toString()).toBe('PNG');
      }
    }
  });
  it('is imported only by its dedicated test route/tests, with no production package export', () => {
    const owners: string[] = [],
      fixtureOwners: string[] = [];
    const compilerConfig = ts.readConfigFile(
      path.join(root, 'tsconfig.json'),
      ts.sys.readFile
    ).config;
    const options = ts.parseJsonConfigFileContent(compilerConfig, ts.sys, root).options;
    const target = path.join(
      root,
      'apps/www/src/content/docs/zh-cn/liquid-tint-stage-diagnostic.ts'
    );
    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (['node_modules', 'dist', '.astro', '.git'].includes(entry.name)) continue;
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(file);
        else if (
          /\.(ts|tsx|js|mjs|astro|mdx)$/.test(file) &&
          !file.includes('liquid-tint-stage-inputs')
        ) {
          const text = fs.readFileSync(file, 'utf8');
          const imports = ts.preProcessFile(text, true, true).importedFiles;
          for (const { fileName } of imports) {
            const resolved = ts.resolveModuleName(fileName, file, options, ts.sys).resolvedModule
              ?.resolvedFileName;
            if (
              resolved ===
                path.join(
                  root,
                  'apps/www/src/content/docs/zh-cn/liquid-tint-profile4-fixture.ts'
                ) ||
              fileName.includes('liquid-tint-profile4-fixture')
            )
              fixtureOwners.push(path.relative(root, file));
            if (resolved === target || fileName.includes('liquid-tint-stage-diagnostic'))
              owners.push(path.relative(root, file));
          }
        } else if (entry.name === 'package.json' || entry.name.startsWith('tsconfig')) {
          expect(fs.readFileSync(file, 'utf8')).not.toContain('liquid-tint-stage-diagnostic');
          expect(fs.readFileSync(file, 'utf8')).not.toContain('liquid-tint-profile4-fixture');
        }
      }
    }
    walk(path.join(root, 'packages'));
    walk(path.join(root, 'apps/www/src'));
    expect([...new Set(owners)].sort()).toEqual([
      'apps/www/src/content/docs/zh-cn/demo-liquid-tint-stage-diagnostic.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/demo-liquid-visible-refraction-diagnostic.browser.test.ts',
      'apps/www/src/content/docs/zh-cn/liquid-tint-stage-diagnostic.test.ts',
      'apps/www/src/content/docs/zh-cn/liquid-visible-refraction-diagnostic.ts',
      'apps/www/src/pages/en/test/liquid-tint-stage-diagnostic.astro',
    ]);
    expect([...new Set(fixtureOwners)].sort()).toEqual([
      'apps/www/src/content/docs/zh-cn/liquid-tint-stage-diagnostic.test.ts',
      'apps/www/src/content/docs/zh-cn/liquid-tint-stage-diagnostic.ts',
    ]);
    const fixture = fs.readFileSync(
      path.join(root, 'apps/www/src/content/docs/zh-cn/liquid-tint-profile4-fixture.ts'),
      'utf8'
    );
    expect(ts.preProcessFile(fixture, true, true).importedFiles).toHaveLength(0);
    expect(fixture).toContain('Copyright (c) NaughtyDuk');
    expect(fixture).toContain('88f681ab7035fd55b04f63edff1841e32c4199e9');
    const production = fs.readFileSync(
      path.join(root, 'packages/adapters/base/src/material/program.ts'),
      'utf8'
    );
    expect(production).not.toContain('u_tintStageMean');
    expect(production).not.toContain('liquid-tint-stage-diagnostic');
    const page = fs.readFileSync(
      path.join(root, 'apps/www/src/pages/en/test/liquid-tint-stage-diagnostic.astro'),
      'utf8'
    );
    expect(page).toContain("from '../../../content/docs/zh-cn/liquid-tint-stage-diagnostic'");
  });
});
