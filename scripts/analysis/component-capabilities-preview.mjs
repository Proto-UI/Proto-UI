/**
 * Build a self-contained, visible consumer for manual native-browser evidence.
 *   node scripts/analysis/component-capabilities-preview.mjs
 * PUI_PREVIEW_OUTPUT is an HTML path or output directory (default: .tmp).
 * Uses the real four-Adapter fixture and generated production CSS. The page
 * only calls the fixture's public consumer mount/update/read APIs. It does not
 * inject input, geometry, scroll offsets or component state.
 * Assets are gzip-embedded to keep data: navigation practical; the page needs
 * a browser with DecompressionStream. Generated artifacts are disposable.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build, transform } from 'esbuild';

const root = fileURLToPath(new URL('../..', import.meta.url));
const requested = path.resolve(
  root,
  process.env.PUI_PREVIEW_OUTPUT ?? '.tmp/component-capabilities-preview'
);
const output = requested.endsWith('.html') ? requested : path.join(requested, 'index.html');
await mkdir(path.dirname(output), { recursive: true });
const hash = (value) => createHash('sha256').update(value).digest('hex');
const bundle = await build({
  absWorkingDir: root,
  entryPoints: ['scripts/analysis/fixtures/component-capabilities-browser.ts'],
  bundle: true,
  minify: true,
  write: false,
  metafile: true,
  format: 'iife',
  globalName: 'PuiCapabilities',
  platform: 'browser',
  tsconfig: 'tsconfig.json',
  target: 'es2022',
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' },
});
const javascript = bundle.outputFiles[0].text;
const [theme, tokens] = await Promise.all([
  readFile(path.join(root, 'apps/www/src/styles/shadcn-theme.css'), 'utf8'),
  readFile(path.join(root, 'apps/www/src/styles/proto-ui-tokens.generated.css'), 'utf8'),
]);
const css = (
  await transform(
    `
@layer reset, theme, proto-ui, consumer;
@layer reset { *,::before,::after { box-sizing:border-box; } body { margin:0; font:14px/1.5 system-ui,sans-serif; color:#172033; background:#f5f7fb; } }
@layer theme { ${theme} }
${tokens}
@layer consumer {
  #evidence { padding:20px; max-width:1200px; }
  h1 { margin:0 0 6px; font-size:24px; line-height:1.25; }
  #scope { margin:0 0 12px; color:#4b5563; }
  #controls { display:flex; flex-wrap:wrap; align-items:end; gap:8px 12px; margin-bottom:12px; }
  #controls label { display:grid; gap:3px; font-size:12px; }
  #controls .check { display:flex; align-items:center; min-height:34px; font-size:14px; }
  #controls select,#controls button { min-height:34px; font:inherit; padding:5px 9px; border:1px solid #aeb9c9; border-radius:5px; background:white; color:#172033; }
  #controls button { cursor:pointer; font-size:13px; }
  #controls button:disabled { opacity:.55; cursor:wait; }
  #mount { font-weight:700!important; background:#173d70!important; color:white!important; }
  #status { display:block; margin:6px 0 12px; font-weight:600; }
  #fixture { width:760px; max-width:100%; min-height:360px; padding:20px; background:white; border:1px solid #dce2eb; border-radius:12px; }
  #readouts { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:12px; margin-top:16px; }
  #readouts h2 { margin:0 0 5px; font-size:14px; }
  #readouts pre,#errors { margin:0; padding:10px; background:#eef2f7; border:1px solid #dce2eb; border-radius:6px; white-space:pre-wrap; overflow:auto; font:11px/1.4 ui-monospace,monospace; }
  #state,#timeline { height:230px; }
  #errors { max-height:150px; color:#9c2031; background:#fff5f5; }
  #source { display:block; margin-top:12px; color:#59677b; font-size:11px; overflow-wrap:anywhere; }
  @media(max-width:720px) { #readouts { grid-template-columns:1fr; } }
}
`,
    { loader: 'css', minify: true, target: 'es2022' }
  )
).code;
const inputsDigest = createHash('sha256');
const inputs = Object.keys(bundle.metafile.inputs).sort();
for (const file of inputs) {
  inputsDigest.update(file + '\0');
  inputsDigest.update(await readFile(path.resolve(root, file)));
}
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const metadata = {
  kind: 'component-capabilities-visible-preview',
  builtAt: new Date().toISOString(),
  head: git('rev-parse', 'HEAD'),
  branch: git('branch', '--show-current'),
  sourceInputsSha256: inputsDigest.digest('hex'),
  sourceInputCount: inputs.length,
  javascriptSha256: hash(javascript),
  cssSha256: hash(css),
  themeSha256: hash(theme),
  generatedTokensSha256: hash(tokens),
  builderSha256: hash(await readFile(fileURLToPath(import.meta.url))),
  javascriptBytes: Buffer.byteLength(javascript),
  cssBytes: Buffer.byteLength(css),
  node: process.version,
  scope:
    'Four real Web Adapters; five families; five component kinds. Native interaction is supplied by the reviewing browser. This build alone is not a browser acceptance result.',
};

/** Runs inside the page after the fixture and production styles load. */
async function bootstrap(metadata) {
  const api = window.PuiCapabilities;
  const element = (id) => document.getElementById(id);
  const stateElement = element('state'),
    timelineElement = element('timeline');
  const timeline = [];
  let ids = [],
    mounted = null,
    status = 'initializing',
    busy = false;
  let lastState = '',
    lastTimeline = '',
    lastContactFacts = '';
  let narrow = false,
    sequence = 0;
  const contacts = new Set();
  let lastContact = null;
  const rootKeys = [
    'value',
    'getValue',
    'empty',
    'draft',
    'formatInvalid',
    'disabled',
    'readOnly',
    'dragging',
    'getValues',
    'getRange',
    'mode',
    'selectedCount',
    'rangeComplete',
    'month',
    'open',
    'index',
    'slideCount',
    'visibleSlides',
    'maxIndex',
    'sizes',
  ];
  const partKeys = [
    'value',
    'getValue',
    'empty',
    'disabled',
    'readOnly',
    'focused',
    'focusVisible',
    'dragging',
    'scrolling',
    'scrollPosition',
    'current',
    'hidden',
    'selected',
    'rangeStart',
    'rangeEnd',
    'rangeMiddle',
    'rangePending',
    'date',
    'outside',
    'today',
    'size',
    'orientation',
    'displayValue',
  ];
  const read = (id, keys) => {
    const result = {};
    for (const key of keys) {
      try {
        const value = api.read(id, key);
        if (value !== undefined) result[key] = value;
      } catch (error) {
        result.readError = String(error);
        break;
      }
    }
    return result;
  };
  const facts = () => {
    if (status !== 'ready') return { root: null, parts: {} };
    return {
      root: read('root', rootKeys),
      parts: Object.fromEntries(
        ids
          .filter((id) => id !== 'root')
          .map((id) => [id, read(id, id === 'inner' ? rootKeys : partKeys)])
      ),
    };
  };
  const append = (event, current = facts()) => {
    const { root, parts } = current;
    const relevant = Object.fromEntries(
      Object.entries(parts).filter(
        ([id]) =>
          id === event.part ||
          id === 'viewport' ||
          id === 'inner' ||
          id.startsWith('panel') ||
          id.startsWith('handle') ||
          id.startsWith('slide')
      )
    );
    timeline.push({
      sequence: ++sequence,
      at: Math.round(performance.now() * 10) / 10,
      ...event,
      root,
      parts: relevant,
      latestevents: api.events().slice(-3),
    });
    if (timeline.length > 100) timeline.splice(0, timeline.length - 100);
  };
  const render = () => {
    const current = facts();
    const next = JSON.stringify(
      {
        status,
        mounted,
        fixtureWidth: narrow ? 320 : 760,
        ...current,
        latestevents: api.events().slice(-100),
        errors: window.__previewErrors.length,
      },
      null,
      2
    );
    if (next !== lastState) {
      stateElement.textContent = next;
      lastState = next;
    }
    const contactFacts = JSON.stringify(current);
    if (contacts.size && contactFacts !== lastContactFacts && status === 'ready')
      append({ type: 'public-facts-during-contact', ...lastContact }, current);
    lastContactFacts = contactFacts;
    const nextTimeline = JSON.stringify(timeline, null, 2);
    if (nextTimeline !== lastTimeline) {
      timelineElement.textContent = nextTimeline;
      lastTimeline = nextTimeline;
    }
  };
  const report = (error) => window.__previewReport('operation', error);
  const controlValues = () => ({
    runtime: element('runtime').value,
    family: element('family').value,
    kind: element('kind').value,
    mode: element('mode').value,
    controlled: element('controlled').checked,
    direction: element('direction').value,
    orientation: element('orientation').value,
  });
  const optionsFor = (selection) => {
    const options = { direction: selection.direction, orientation: selection.orientation };
    if (selection.kind === 'number-field')
      Object.assign(options, { locale: 'de-DE' }, selection.controlled ? { value: 20.5 } : {});
    else if (selection.kind === 'carousel' && selection.controlled) options.index = 0;
    else if (selection.kind === 'resizable' && selection.controlled) options.sizes = [25, 35, 40];
    else if (selection.kind === 'calendar' || selection.kind === 'date-picker') {
      options.mode = selection.mode;
      if (selection.controlled)
        Object.assign(
          options,
          selection.mode === 'multiple'
            ? { values: [] }
            : selection.mode === 'range'
              ? { range: { from: '2026-10-10' } }
              : { value: '2026-10-10' }
        );
    }
    return options;
  };
  const operation = async (work) => {
    if (busy) return;
    busy = true;
    element('mount').disabled = element('apply').disabled = true;
    try {
      await work();
    } catch (error) {
      status = 'error';
      report(error);
    } finally {
      busy = false;
      element('mount').disabled = element('apply').disabled = false;
      element('status').textContent = status;
      render();
    }
  };
  const mount = () =>
    operation(async () => {
      status = 'loading';
      element('status').textContent = status;
      contacts.clear();
      timeline.length = 0;
      sequence = 0;
      mounted = controlValues();
      render();
      const result = await api.mount(
        mounted.runtime,
        mounted.family,
        mounted.kind,
        optionsFor(mounted)
      );
      ids = result.ids;
      status = 'ready';
      element('scope').textContent =
        `${mounted.family} / ${mounted.runtime} / ${mounted.kind} · ${mounted.controlled ? 'controlled owner rejects proposals' : 'uncontrolled owner'} · ${mounted.direction} / ${mounted.orientation}`;
      append({ type: 'mounted' });
    });
  element('mount').addEventListener('click', mount);
  element('apply').addEventListener('click', () =>
    operation(async () => {
      if (status !== 'ready' || !mounted) return;
      const selected = controlValues();
      const patch = { direction: selected.direction, orientation: selected.orientation };
      if (mounted.kind === 'calendar' || mounted.kind === 'date-picker') patch.mode = selected.mode;
      await api.update('root', patch);
      mounted = { ...mounted, ...patch };
      append({ type: 'consumer-prop-update', patch });
    })
  );
  element('narrow').addEventListener('click', () => {
    narrow = !narrow;
    element('fixture').style.width = `${narrow ? 320 : 760}px`;
    element('narrow').textContent = narrow ? 'Widen to 760px' : 'Narrow to 320px';
    requestAnimationFrame(() => {
      append({ type: 'consumer-width', width: narrow ? 320 : 760 });
      render();
    });
  });
  element('clear-timeline').addEventListener('click', () => {
    timeline.length = 0;
    sequence = 0;
    render();
  });
  const partOf = (event) => {
    for (const node of event.composedPath()) {
      const className =
        node.classList &&
        [...node.classList].find((name) => name.startsWith('cap-') && ids.includes(name.slice(4)));
      if (className) return className.slice(4);
    }
    return null;
  };
  for (const type of [
    'pointerdown',
    'pointermove',
    'pointerup',
    'pointercancel',
    'lostpointercapture',
    'scroll',
  ])
    document.addEventListener(
      type,
      (event) => {
        if (status !== 'ready') return;
        const part = partOf(event);
        if (!part && !contacts.has(event.pointerId)) return;
        const observation = {
          type,
          part,
          trusted: event.isTrusted,
          inputAt: Math.round(performance.now() * 10) / 10,
        };
        if ('pointerId' in event)
          Object.assign(observation, {
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            clientX: event.clientX,
            clientY: event.clientY,
            buttons: event.buttons,
          });
        if (type === 'pointerdown') contacts.add(event.pointerId);
        if (type.startsWith('pointer'))
          lastContact = {
            part,
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            trusted: event.isTrusted,
          };
        // Record after the native event reaches its component owner. No event is
        // synthesized here and no observation is written back into the component.
        requestAnimationFrame(() => {
          if (status === 'ready') {
            append({ ...observation, observed: 'next-animation-frame' });
            render();
          }
        });
        if (type === 'pointerup' || type === 'pointercancel' || type === 'lostpointercapture')
          contacts.delete(event.pointerId);
      },
      { capture: true, passive: true }
    );
  element('source').textContent =
    `Bundle SHA-256 ${metadata.javascriptSha256} · CSS SHA-256 ${metadata.cssSha256} · Source inputs SHA-256 ${metadata.sourceInputsSha256}`;
  const tick = () => {
    try {
      render();
    } catch (error) {
      report(error);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  await mount();
}

const compressed = gzipSync(JSON.stringify({ javascript, css, metadata }), { level: 9 }).toString(
  'base64'
);
const options = (items, selected) =>
  items
    .map(
      (value) =>
        `<option value="${value}"${value === selected ? ' selected' : ''}>${value}</option>`
    )
    .join('');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Proto UI component capability acceptance</title></head><body>
<main id="evidence"><h1>Proto UI · component capabilities</h1><p id="scope">Real components, production CSS, visible native input.</p>
<div id="controls">
<label>Runtime<select id="runtime">${options(['wc', 'react', 'vue', 'vue2'], 'wc')}</select></label>
<label>Family<select id="family">${options(['base', 'shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'], 'base')}</select></label>
<label>Component<select id="kind">${options(['resizable', 'carousel', 'number-field', 'calendar', 'date-picker'], 'resizable')}</select></label>
<label>Selection mode<select id="mode">${options(['range', 'multiple', 'single'], 'range')}</select></label>
<label class="check"><input type="checkbox" id="controlled">Controlled</label>
<label>Direction<select id="direction">${options(['ltr', 'rtl'], 'ltr')}</select></label>
<label>Orientation<select id="orientation">${options(['horizontal', 'vertical'], 'horizontal')}</select></label>
<button id="mount" type="button">Load component</button><button id="apply" type="button">Apply axis / mode</button><button id="narrow" type="button">Narrow to 320px</button><button id="clear-timeline" type="button">Clear timeline</button>
</div><output id="status">initializing</output><div id="fixture"></div>
<div id="readouts"><section><h2>Public state and latest events</h2><pre id="state">{"status":"initializing"}</pre></section><section><h2>Native interaction timeline · last 100</h2><pre id="timeline">[]</pre></section></div>
<h2 style="font-size:14px;margin-bottom:5px">Errors</h2><pre id="errors">[]</pre><small id="source"></small></main>
<script>
window.__previewErrors=[];
window.__previewReport=function(kind,error){var item={kind:kind,message:error&&error.stack?error.stack:String(error)};var previous=window.__previewErrors.at(-1);if(!previous||previous.kind!==item.kind||previous.message!==item.message)window.__previewErrors.push(item);if(window.__previewErrors.length>100)window.__previewErrors.shift();var box=document.getElementById('errors'),next=JSON.stringify(window.__previewErrors,null,2);if(box&&box.textContent!==next)box.textContent=next;};
window.addEventListener('error',function(event){window.__previewReport('error',event.error||event.message);});
window.addEventListener('unhandledrejection',function(event){window.__previewReport('unhandledrejection',event.reason);});
(async function(){try{if(!globalThis.DecompressionStream)throw new Error('This standalone preview requires DecompressionStream support.');var bytes=Uint8Array.from(atob('${compressed}'),function(c){return c.charCodeAt(0);});var source=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();var assets=JSON.parse(source);var style=document.createElement('style');style.textContent=assets.css;document.head.append(style);var script=document.createElement('script');script.textContent=assets.javascript;document.head.append(script);await (${bootstrap.toString()})(assets.metadata);}catch(error){window.__previewReport('bootstrap',error);document.getElementById('status').textContent='error';document.getElementById('state').textContent=JSON.stringify({status:'error',message:String(error)},null,2);}})();
</script></body></html>`;
const manifest = {
  ...metadata,
  htmlSha256: hash(html),
  htmlBytes: Buffer.byteLength(html),
  output,
};
await Promise.all([
  writeFile(output, html),
  writeFile(output.replace(/\.html$/, '.manifest.json'), JSON.stringify(manifest, null, 2) + '\n'),
  writeFile(
    output.replace(/\.html$/, '.data-url.txt'),
    `data:text/html;base64,${Buffer.from(html).toString('base64')}`
  ),
]);
console.log(JSON.stringify(manifest, null, 2));
