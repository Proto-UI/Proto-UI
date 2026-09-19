/** D-ROLE S/T: native CSS endpoint semantics. This is not natural rollback evidence.
 * Uses the CLI source renderer; public delivery is covered by S4 admission/journey.
 */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

const compiled = await build({
  entryPoints: ['packages/cli/src/services/proto-style-css.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
});
const { renderProtoShadowSplitStyleArtifact } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`
);
const motion = ['animate-in', 'fade-in-0', 'zoom-in-95', 'duration-200'];
const geometry = ['-translate-x-1/2', '-translate-y-1/2', 'data-[active]:scale-[0.98]'];
const artifact = renderProtoShadowSplitStyleArtifact([...motion, ...geometry]);
const { chromium } = createRequire(new URL('../../apps/www/package.json', import.meta.url))(
  'playwright-core'
);
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PUI_CHROME_EXECUTABLE ??
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const result = await page.evaluate(
    ({ artifact, motion, geometry }) => {
      const create = (tokens) => {
        const host = document.createElement('x-endpoint');
        host.style.cssText = 'position:absolute;left:300px;top:200px;width:200px;height:80px';
        host.setAttribute('data-pui-split-root-style', tokens.join(' '));
        const root = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = artifact.cssText;
        const surface = document.createElement('div');
        surface.setAttribute('data-pui-split-surface', '');
        surface.setAttribute('data-pui-style', motion.join(' '));
        surface.append(document.createElement('slot'));
        root.append(style, surface);
        document.body.append(host);
        return { host, surface, style };
      };
      const centered = create([...motion, ...geometry]);
      const plain = create(motion);
      const nested = create(motion);
      centered.host.append(nested.host);
      const marker = document.createElement('span');
      marker.style.cssText = 'position:fixed;left:7px;top:9px;width:1px;height:1px';
      plain.host.append(marker);
      const read = ({ host, surface }) => {
        const rect = host.getBoundingClientRect();
        const transform = getComputedStyle(host).transform;
        return {
          transform,
          scale: transform === 'none' ? 1 : new DOMMatrixReadOnly(transform).a,
          center: [rect.x + rect.width / 2, rect.y + rect.height / 2],
          opacity: Number(getComputedStyle(surface).opacity),
          rest: getComputedStyle(host).getPropertyValue('--pui-split-rest-transform').trim(),
        };
      };
      const animations = [centered, plain, nested].flatMap(({ host, surface }) => [
        ...host.getAnimations(),
        ...surface.getAnimations(),
      ]);
      for (const a of animations) a.pause();
      const samples = [0, 40, 120, 200].map((time) => {
        for (const a of animations) a.currentTime = time;
        return { time, centered: read(centered), plain: read(plain), nested: read(nested) };
      });
      const fixed = marker.getBoundingClientRect().toJSON();
      // Compare actual Chrome interpolation with the previous implicit endpoint,
      // not an assumption that an underlying none computes to none while filled.
      plain.style.textContent = artifact.cssText.replace(
        '    to {\n      transform: var(--pui-split-rest-transform, none);\n    }\n',
        ''
      );
      for (const a of plain.host.getAnimations()) {
        a.pause();
        a.currentTime = 200;
      }
      const baselinePlain = read(plain);
      const baselineFixed = marker.getBoundingClientRect().toJSON();
      centered.host.setAttribute('data-active', '');
      const activated = read(centered);
      centered.host.removeAttribute('data-active');
      const revoked = read(centered);
      // Relocation must retain the explicit keyframe in stylesheet text.
      const wrapper = document.createElement('section');
      document.body.append(wrapper);
      wrapper.append(centered.host);
      const rules = [];
      const visit = (list) => {
        for (const r of list) {
          if (r.name === 'pui-split-geometry-enter') rules.push(r);
          else if (r.cssRules) visit(r.cssRules);
        }
      };
      visit(centered.style.sheet.cssRules);
      return {
        samples,
        fixed,
        baselinePlain,
        baselineFixed,
        activated,
        revoked,
        endpoint: rules[0]?.findRule('100%')?.style.transform,
      };
    },
    { artifact, motion, geometry }
  );
  assert.equal(result.endpoint, 'var(--pui-split-rest-transform, none)');
  for (const { centered } of result.samples) {
    assert.ok(Math.abs(centered.center[0] - 300) < 0.01);
    assert.ok(Math.abs(centered.center[1] - 200) < 0.01);
    assert.ok(Math.abs(centered.scale - (0.95 + 0.05 * centered.opacity)) < 0.001);
  }
  const end = result.samples.at(-1);
  assert.equal(end.centered.scale, 1);
  assert.equal(end.plain.transform, result.baselinePlain.transform);
  assert.equal(end.nested.transform, end.plain.transform);
  assert.equal(end.nested.rest, '');
  assert.deepEqual(result.fixed, result.baselineFixed);
  assert.equal(result.activated.scale, 0.98);
  assert.equal(result.revoked.scale, 1);
  console.log(JSON.stringify({ browser: browser.version(), result }));
} finally {
  await browser.close();
}
