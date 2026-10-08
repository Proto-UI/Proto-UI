import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { boundedSettings, settingsEligibility } from './bounded-settings.mjs';
import {
  SETTINGS_CHECKS,
  SETTINGS_CRITERIA,
  classifySettingsFailure,
} from './tabs-settings-oracle.mjs';

const require = createRequire(new URL('../../../package.json', import.meta.url));
const { parse: parseYaml } = require('yaml');
const enabled = process.env.PROTO_BENCHMARK_BROWSER_TESTS === '1';
const root = process.env.PROTO_BENCHMARK_EVIDENCE_ROOT || os.tmpdir();
await mkdir(root, { recursive: true });
const chromiumPath = process.env.PROTO_BENCHMARK_CHROMIUM;
const task = new URL('../../../benchmarks/interaction/tasks/tabs-settings/', import.meta.url);
const CONTROL_VERSION = 'tabs-settings.synthetic-controls.v2';

// Hand-authored synthetic implementation; never imported by the evaluator or
// supplied to participants. Deterministic names/IDs and versioned mutations.
function control({ variant = 'generic', mutation = null } = {}) {
  const labels = ['Overview', 'Unavailable', 'Details', 'History'];
  const tag = variant === 'native' ? 'button' : 'span';
  const tabs = labels
    .map(
      (name, i) =>
        `<${tag} ${tag === 'button' ? 'type="button"' : ''} role="tab" id="synthetic-${variant}-item-${i}" aria-controls="synthetic-${variant}-view-${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" ${i === 1 ? (variant === 'native' ? 'disabled' : 'aria-disabled="true"') : ''}>${name}</${tag}>`
    )
    .join('\n');
  const panels = labels
    .map(
      (name, i) =>
        `<div role="tabpanel" id="synthetic-${variant}-view-${i}" aria-labelledby="synthetic-${variant}-item-${i}" ${i ? 'hidden' : ''}><h2>${name}</h2><p>Reference section ${name}.</p></div>`
    )
    .join('\n');
  let html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Synthetic local control</title>
<style>body{font:18px system-ui;margin:30px} [role="tablist"]{display:flex;gap:14px;margin:20px 0}[role="tablist"][aria-orientation="vertical"]{flex-direction:column}[role="tab"]{padding:12px;border:1px solid #333;cursor:pointer}[aria-selected="true"]{background:#173755;color:white}[aria-disabled="true"]{opacity:.5}[role="tabpanel"]{border:1px solid;padding:20px} :focus{outline:3px solid #c60}label{margin-right:20px}</style></head><body>
<h1>Reference sections</h1>
<section aria-label="Reference fixture">
<label>Orientation <select><option>Horizontal</option><option>Vertical</option></select></label>
<label><input type="checkbox" ${mutation === 'default-loop' ? 'checked' : ''}>Wrap navigation</label>
<div role="tablist" aria-label="Reference sections" aria-orientation="horizontal">${tabs}</div>
${panels}</section>
<button type="button">Remove reference</button><button type="button">After</button>
<script>(()=>{
const mutation=${JSON.stringify(mutation)};
const fixture=document.querySelector('section');
const list=document.querySelector('[role="tablist"]');
const tabs=Array.from(list.children);
const panels=Array.from(document.querySelectorAll('[role="tabpanel"]'));
const settings=fixture.querySelector('select');
const wrap=fixture.querySelector('input');
const buttons=Array.from(document.querySelectorAll('body > button'));
let selected=0, disposed=false;
const eligible=()=>mutation==='skip-disabled' ? tabs : tabs.filter((n,i)=>i!==1);
function rove(n){tabs.forEach(t=>t.tabIndex=t===n?0:-1);n.focus();}
function select(n){
 const index=tabs.indexOf(n);
 if(index===1 && mutation!=='disabled-activation')return;
 selected=index;
 tabs.forEach((t,i)=>{t.setAttribute('aria-selected',String(i===selected));panels[i].hidden=i!==selected;});
 rove(n);
 if(mutation==='relationships')panels[0].setAttribute('aria-labelledby',tabs[2].id);
 if(mutation==='detach-panel')panels.filter((n,i)=>i!==selected).forEach(n=>n.remove());
 if(mutation==='repeat-duplicates')list.append(tabs[index].cloneNode(true));
}
function keys(e){
 const n=e.target.closest('[role="tab"]');if(!n)return;
 if(mutation==='disabled-vertical-navigation' && tabs.indexOf(n)===1 && settings.value==='Vertical' && e.key==='ArrowDown'){rove(tabs[2]);return;}
 if(tabs.indexOf(n)===1 && mutation!=='disabled-activation' && mutation!=='disabled-pointer-focus-bypass'){if(e.key===' ')e.preventDefault();return;}
 const items=eligible();const i=items.indexOf(n);
 const vertical=mutation==='orientation-keys' ? false : settings.value==='Vertical';
 let delta=e.key===(vertical?'ArrowDown':'ArrowRight')?1:e.key===(vertical?'ArrowUp':'ArrowLeft')?-1:0;
 let next=null;
 if(delta){const looping=mutation==='always-wrap'||mutation==='default-loop'?true:mutation==='never-wrap'?false:wrap.checked;
 const j=looping?(i+delta+items.length)%items.length:Math.max(0,Math.min(items.length-1,i+delta));next=items[j];}
 if(e.key==='Home'&&mutation!=='home-end')next=items[0];
 if(e.key==='End'&&mutation!=='home-end')next=items[items.length-1];
 if(next){e.preventDefault();rove(next);if(mutation==='manual')select(next);}
 if(e.key==='Enter'&&mutation!=='enter'){e.preventDefault();select(n);}
 if(e.key===' '&&mutation!=='space'){if(mutation!=='space-default')e.preventDefault();select(n);}
}
function clicked(e){const n=e.target.closest('[role="tab"]');if(n)select(n);}
function change(){
 if(disposed)return;
 if(mutation!=='orientation-aria')list.setAttribute('aria-orientation',settings.value.toLowerCase());
 if(mutation==='orientation-reset')select(tabs[0]);
}
list.addEventListener('keydown',keys);list.addEventListener('click',clicked);
settings.addEventListener('change',change);
if(mutation==='wrap-selection-reset')wrap.addEventListener('change',()=>select(tabs[0]));
if(mutation==='disabled-pointer-focus-bypass')tabs[1].addEventListener('mousedown',e=>e.preventDefault());
buttons[0].addEventListener('click',()=>{
 if(mutation==='cleanup')return;
 disposed=true;list.removeEventListener('keydown',keys);list.removeEventListener('click',clicked);settings.removeEventListener('change',change);fixture.remove();
 if(mutation==='cleanup-trap')buttons[0].addEventListener('keydown',e=>{if(e.key==='Tab')e.preventDefault();});
 if(${JSON.stringify(variant === 'restored-focus')})buttons[1].focus();
});
if(mutation==='host-error')queueMicrotask(()=>{throw new Error('Synthetic nonfatal host error');});
})();</script></body></html>`;
  if (variant === 'labelled-rolefallback') {
    html = html.replace(
      'const tabs=Array.from(list.children);',
      `
const epoch=Number(window.name||'0')+1;window.name=String(epoch);
const ids=Array.from(fixture.querySelectorAll('[id]'));
for(const node of ids){node.id+='-epoch-'+epoch;}
for(const node of fixture.querySelectorAll('[aria-controls],[aria-labelledby]')){
 for(const attr of ['aria-controls','aria-labelledby']){const old=node.getAttribute(attr);if(old&&old.startsWith('synthetic-${variant}-'))node.setAttribute(attr,old+'-epoch-'+epoch);}
}
const tabs=Array.from(list.children);`
    );
    html = html.replace(
      '<h1>Reference sections</h1>',
      '<h1 id="synthetic-list-name">Reference sections</h1>'
    );
    html = html.replace('aria-label="Reference sections"', 'aria-labelledby="synthetic-list-name"');
    for (let i = 0; i < labels.length; i++) {
      html = html.replace(
        `>${labels[i]}</span>`,
        ` aria-labelledby="synthetic-label-${i}">Open section ${i}</span>`
      );
      html = html.replace(
        '</h1>',
        `</h1><span hidden id="synthetic-label-${i}">${labels[i]}</span>`
      );
    }
    html = html
      .replaceAll('role="tab"', 'role="unknown-role tab"')
      .replaceAll('role="tabpanel"', 'role="unknown-role tabpanel"')
      .replaceAll('role="tablist"', 'role="unknown-role tablist"');
    html = html
      .replaceAll('[role="tab"]', '[role~="tab"]')
      .replaceAll('[role="tabpanel"]', '[role~="tabpanel"]')
      .replaceAll('[role="tablist"]', '[role~="tablist"]');
  }
  return html;
}

async function evaluate(name, html, wallMs = 45000) {
  assert.ok(chromiumPath, 'Explicit PROTO_BENCHMARK_CHROMIUM required');
  const run = await mkdtemp(path.join(root, `settings-v2-${name}-`));
  const htmlPath = path.join(run, 'input.html');
  const evidenceDir = path.join(run, 'evidence');
  await writeFile(htmlPath, html);
  await writeFile(
    path.join(run, 'control.json'),
    JSON.stringify(
      {
        controlVersion: CONTROL_VERSION,
        name,
        synthetic: true,
        inputSha256: createHash('sha256').update(html).digest('hex'),
      },
      null,
      2
    )
  );
  const receipt = await boundedSettings({ htmlPath, evidenceDir, chromiumPath, wallMs });
  assert.equal(receipt.cleanup.length, 2, 'Both worker and registered Chromium groups checked');
  assert.ok(receipt.browserPid, 'Browser registered before executing HTML');
  assert.ok(
    receipt.cleanup.every((c) => c.status === 'no-live-group-members'),
    JSON.stringify(receipt.cleanup)
  );
  console.log(JSON.stringify({ name, evidenceDir, outcome: receipt.outcome }));
  if (receipt.outcome !== 'completed') return { receipt, evidenceDir };
  const result = JSON.parse(await readFile(path.join(evidenceDir, 'result.json')));
  assert.equal(result.execution, 'completed', JSON.stringify(result.errors));
  assert.equal(result.evidence.status, 'complete', JSON.stringify(result.errors));
  assert.deepEqual(
    result.checks.map((c) => c.id),
    SETTINGS_CHECKS
  );
  assert.equal(result.inputSha256, receipt.inputSha256);
  assert.equal(result.inputSha256, createHash('sha256').update(html).digest('hex'));
  assert.ok(result.artifacts.includes('trace.zip'));
  return { receipt, result, evidenceDir };
}
const failures = (r) => r.checks.filter((c) => c.status === 'fail').map((c) => c.id);
const options = { skip: !enabled, timeout: 60000 };

test('fixed inventory, deterministic controls, and oracle independence', async () => {
  assert.equal(SETTINGS_CHECKS.length, 15);
  assert.equal(new Set(SETTINGS_CHECKS).size, 15);
  assert.ok(Object.isFrozen(SETTINGS_CRITERIA) && SETTINGS_CRITERIA.every(Object.isFrozen));
  assert.equal(control(), control());
  assert.notEqual(control({ variant: 'generic' }), control({ variant: 'native' }));
  const source = await readFile(new URL('./tabs-settings-oracle.mjs', import.meta.url), 'utf8');
  assert.ok(
    !/starter\.html|section-overview|view-overview|reference-fixture|synthetic-|tabs-controls|packages\/(prototypes|runtime|adapters)/.test(
      source
    )
  );
  assert.ok(!/import .*tabs-oracle/.test(source), 'Do not blindly apply wrap-only baseline');
});

test('Markdown and structured projection extract identical semantic information', async () => {
  const ordinary = await readFile(new URL('ordinary.md', task), 'utf8');
  const proto = await readFile(new URL('proto.md', task), 'utf8');
  const ledger = JSON.parse(await readFile(new URL('claims.json', task), 'utf8'));
  const yaml = parseYaml(proto.match(/```yaml\n([\s\S]*?)\n```/)[1]);
  const [limitations, qualifiers] = ordinary.split('\n\n').slice(1, 3);
  const ordinaryClaims = [...ordinary.matchAll(/### (C\d+)\n\n([^\n]+)/g)].map((m) => ({
    id: m[1],
    text: m[2],
  }));
  assert.deepEqual({ limitations, qualifiers, criteria: ordinaryClaims }, yaml);
  assert.deepEqual(
    yaml.criteria,
    ledger.claims.map(({ id, text }) => ({ id, text }))
  );
  assert.equal(yaml.limitations, ledger.limitations);
  assert.equal(yaml.qualifiers, ledger.qualifiers);
  assert.ok(
    !/Proto|P-BASE|spec\/|packages\/|project|context|domain owner|context provider/.test(ordinary)
  );
  assert.ok(!/P-BASE|spec\/|packages\//.test(proto));
  for (const c of ledger.claims) {
    assert.equal(c.lifecycle, 'draft');
    assert.equal(c.claimTextSha256, createHash('sha256').update(c.text).digest('hex'));
    for (const source of c.sources) {
      const parsed = parseYaml(
        await readFile(new URL(`../../../${source.path}`, import.meta.url), 'utf8')
      );
      assert.equal(parsed.id, source.entityId);
      assert.equal(parsed.status, 'draft');
      assert.ok(
        parsed.criteria.some((k) => k.id === source.criterionId),
        source.criterionId
      );
    }
  }
});

test('infrastructure blocking and evidence eligibility cannot become semantic pass', () => {
  assert.equal(
    classifySettingsFailure(
      new Error('locator.click: Target page, context or browser has been closed')
    ),
    'blocked'
  );
  assert.equal(classifySettingsFailure(new Error('Page crashed')), 'blocked');
  assert.equal(classifySettingsFailure(new Error('Protocol error: Session closed')), 'blocked');
  assert.equal(
    classifySettingsFailure(new Error('Timeout waiting for missing Orientation')),
    'fail'
  );
  assert.equal(
    classifySettingsFailure(new Error('unknown'), { browserConnected: false }),
    'blocked'
  );
  const receipt = {
    outcome: 'completed',
    deadlineExceeded: false,
    browserPid: 123,
    cleanup: [
      { status: 'no-live-group-members', live: [] },
      { status: 'no-live-group-members', live: [] },
    ],
  };
  const result = {
    execution: 'completed',
    evidence: { status: 'complete' },
    hostErrors: { status: 'pass' },
    checks: SETTINGS_CHECKS.map((id) => ({
      id,
      status: 'pass',
      evidence: ['a.png', 'a.dom.json', 'a.ax.json'],
    })),
  };
  assert.equal(settingsEligibility(result, receipt).scoringEligible, true);
  assert.equal(settingsEligibility(result, receipt).taskAccepted, true);
  const scoredFailure = {
    ...result,
    checks: result.checks.map((c, i) => ({ ...c, status: i === 0 ? 'fail' : 'pass' })),
  };
  assert.equal(settingsEligibility(scoredFailure, receipt).scoringEligible, true);
  assert.equal(settingsEligibility(scoredFailure, receipt).taskAccepted, false);
  assert.equal(settingsEligibility(scoredFailure, receipt).allCorePassed, false);
  for (const altered of [
    { ...result, evidence: { status: 'blocked' } },
    { ...result, hostErrors: { status: 'fail' } },
    { ...result, execution: 'blocked' },
    { ...result, checks: result.checks.map((c) => ({ ...c, id: 'duplicate' })) },
  ])
    assert.equal(settingsEligibility(altered, receipt).scoringEligible, false);
  assert.equal(settingsEligibility(result, { ...receipt, cleanup: [] }).scoringEligible, false);
});

for (const variant of ['generic', 'native', 'restored-focus', 'labelled-rolefallback'])
  test(`synthetic positive: ${variant}`, options, async () => {
    const { result, receipt, evidenceDir } = await evaluate(
      `positive-${variant}`,
      control({ variant })
    );
    assert.equal(receipt.outcome, 'completed');
    assert.deepEqual(failures(result), []);
    assert.equal(receipt.eligibility.scoringEligible, true);
    assert.equal(receipt.eligibility.taskAccepted, true);
    assert.equal(receipt.eligibility.allCorePassed, true);
    assert.equal(result.hostErrors.status, 'pass');
    assert.equal(result.summary.core.pass, 15);
    const log = JSON.parse(await readFile(path.join(evidenceDir, 'browser-log.json'), 'utf8'));
    assert.deepEqual(
      log.disabledKeyboard.map((r) => r.orientation),
      ['Horizontal', 'Vertical']
    );
    for (const row of log.disabledKeyboard) {
      assert.equal(row.focusMethod, 'explicit Playwright locator.focus host probe');
      assert.equal(row.acceptsFocus, variant !== 'native');
      assert.equal(row.keys.length, row.acceptsFocus ? 8 : 0);
    }
  });

const negatives = [
  ['wrap-selection-reset', 'horizontal-wrap', 'enter-activation'],
  ['disabled-vertical-navigation', 'disabled-suppression', 'horizontal-clamp'],
  ['disabled-pointer-focus-bypass', 'disabled-suppression', 'horizontal-clamp'],
  ['default-loop', 'settings-defaults', 'enter-activation'],
  ['always-wrap', 'horizontal-clamp', 'enter-activation'],
  ['never-wrap', 'horizontal-wrap', 'horizontal-clamp'],
  ['orientation-keys', 'orientation-live', 'horizontal-clamp'],
  ['orientation-aria', 'orientation-live', 'horizontal-clamp'],
  ['orientation-reset', 'orientation-live', 'horizontal-clamp'],
  ['skip-disabled', 'horizontal-clamp', 'settings-defaults'],
  ['home-end', 'home-end', 'settings-defaults'],
  ['manual', 'manual-focus', 'settings-defaults'],
  ['enter', 'enter-activation', 'horizontal-clamp'],
  ['space', 'space-activation', 'enter-activation'],
  ['space-default', 'space-activation', 'enter-activation'],
  ['disabled-activation', 'disabled-suppression', 'horizontal-clamp'],
  ['relationships', 'retained-relationships', 'horizontal-clamp'],
  ['detach-panel', 'retained-relationships', 'settings-defaults'],
  ['repeat-duplicates', 'pointer-repeat', 'horizontal-clamp'],
  ['cleanup', 'cleanup-after', 'horizontal-clamp'],
  ['cleanup-trap', 'cleanup-after', 'horizontal-clamp'],
];
for (const [mutation, target, unaffected] of negatives)
  test(`synthetic mutation: ${mutation} rejects ${target}`, options, async () => {
    const { result, receipt } = await evaluate(mutation, control({ mutation }));
    assert.equal(receipt.outcome, 'completed');
    assert.equal(receipt.eligibility.scoringEligible, true);
    assert.equal(receipt.eligibility.taskAccepted, false);
    assert.equal(receipt.eligibility.allCorePassed, false);
    assert.ok(failures(result).includes(target), JSON.stringify(failures(result)));
    assert.equal(
      result.checks.find((c) => c.id === unaffected).status,
      'pass',
      JSON.stringify(failures(result))
    );
    assert.equal(result.hostErrors.status, 'pass');
  });

test('starter retained as expected failure, not the positive solution', options, async () => {
  const { result, receipt } = await evaluate(
    'starter',
    await readFile(new URL('starter.html', task), 'utf8')
  );
  assert.equal(receipt.eligibility.scoringEligible, true);
  assert.equal(receipt.eligibility.taskAccepted, false);
  assert.ok(failures(result).includes('settings-defaults'));
  assert.ok(failures(result).includes('horizontal-clamp'));
  assert.equal(result.checks.find((c) => c.id === 'initial-structure').status, 'pass');
  assert.equal(result.checks.find((c) => c.id === 'enter-activation').status, 'pass');
  assert.equal(result.checks.find((c) => c.id === 'cleanup-after').status, 'pass');
});

test('host errors are retained separately from core semantics', options, async () => {
  const { result, receipt } = await evaluate('host-error', control({ mutation: 'host-error' }));
  assert.deepEqual(failures(result), []);
  assert.equal(result.hostErrors.status, 'fail');
  assert.ok(result.hostErrors.pageErrors.includes('Synthetic nonfatal host error'));
  assert.equal(receipt.eligibility.scoringEligible, false);
  assert.equal(receipt.eligibility.taskAccepted, false);
});

test(
  'arbitrary infinite HTML has an outer deadline and partial evidence',
  { skip: !enabled, timeout: 20000 },
  async () => {
    const start = Date.now();
    const { receipt, evidenceDir } = await evaluate(
      'hang',
      '<!doctype html><html><head><title>Infinite synthetic control</title></head><body><script>while(true){}</script></body></html>',
      5000
    );
    assert.equal(receipt.eligibility.scoringEligible, false);
    assert.equal(receipt.eligibility.taskAccepted, false);
    assert.equal(receipt.outcome, 'aborted');
    assert.equal(receipt.deadlineExceeded, true);
    assert.ok(Date.now() - start < 15000);
    assert.equal(receipt.signal, 'SIGKILL');
    assert.equal(
      JSON.parse(await readFile(path.join(evidenceDir, 'progress.json'))).stage,
      'before-submission'
    );
    await assert.rejects(readFile(path.join(evidenceDir, 'result.json')), /ENOENT/);
  }
);
