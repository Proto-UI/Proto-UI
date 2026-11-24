// Handwritten oracle controls; never count these as generated participant runs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = path.resolve(process.argv[2]);
if (fs.existsSync(root)) throw new Error('Use a new calibration directory');
const controls = [
  'legal-native',
  'legal-aria',
  'late-duplicate',
  'disabled-ignored',
  'reset-leak',
  'missing-role',
  'unlisted-asset',
  'space-double',
  'space-missing',
  'tab-unreachable',
  'disabled-keyboard-leak',
  'reenable-stuck',
];
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
for (const control of controls) {
  const dist = path.join(root, control, 'clean-consumer/dist');
  fs.mkdirSync(dist, { recursive: true });
  const native = ['legal-native', 'late-duplicate', 'reset-leak', 'unlisted-asset'].includes(
    control
  );
  const action = native
    ? '<button type="button" id="action">Save preference</button>'
    : `<div id="action" tabindex="${control === 'tab-unreachable' ? -1 : 0}"${control === 'missing-role' ? '' : ' role="button"'}>Save preference</div>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Independent oracle calibration</title><link rel="stylesheet" href="style.css"></head><body>${action}<label><input type="checkbox" id="disabled">Disable action</label><output aria-label="Activations">0</output><script src="app.js"></script>${control === 'unlisted-asset' ? '<script src="extra.js"></script>' : ''}</body></html>`;
  const js = `const control=${JSON.stringify(control)}; const native=${native};
const action=document.querySelector('#action'), toggle=document.querySelector('#disabled'), output=document.querySelector('output');
let disabledOnce=false;
let count=control==='reset-leak'?Number(localStorage.getItem('calibration-count')||0):0;
output.textContent=String(count);
function increment(){count++;output.textContent=String(count);if(control==='reset-leak')localStorage.setItem('calibration-count',String(count));}
function activate(){if((control==='reenable-stuck'&&disabledOnce)||(toggle.checked&&control!=='disabled-ignored'))return;increment();if(control==='late-duplicate')setTimeout(increment,80);}
action.addEventListener('click',activate);
if(!native)action.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();if(control==='space-missing'&&event.key===' ')return;if(control==='disabled-keyboard-leak'&&toggle.checked){increment();return;}activate();}});
if(control==='space-double')action.addEventListener('keyup',event=>{if(event.key===' '){event.preventDefault();activate();}});
toggle.addEventListener('change',()=>{if(toggle.checked)disabledOnce=true;if(native)action.disabled=toggle.checked;else action.setAttribute('aria-disabled',String(toggle.checked));});
if(!native)action.setAttribute('aria-disabled','false');
`;
  fs.writeFileSync(path.join(dist, 'index.html'), html);
  fs.writeFileSync(path.join(dist, 'app.js'), js);
  fs.writeFileSync(
    path.join(dist, 'style.css'),
    'body{font:16px sans-serif;padding:30px}#action{display:inline-block;padding:12px;margin:12px;background:#eee;color:#111}#action:focus-visible{outline:3px solid #005fcc}label,output{display:block;margin:16px}'
  );
  if (control === 'unlisted-asset')
    fs.writeFileSync(path.join(dist, 'extra.js'), 'window.extraCalibrationAsset=true;');
  const shippedFiles = ['index.html', 'app.js', 'style.css'].map((filename) => ({
    path: `clean-consumer/dist/${filename}`,
    sha256: hash(fs.readFileSync(path.join(dist, filename))),
  }));
  fs.writeFileSync(
    path.join(root, control, 'clean-consumer.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        kind: 'handwritten-independent-oracle-calibration',
        control,
        expected: control.startsWith('legal-') ? 'pass' : 'fail',
        shippedFiles,
      },
      null,
      2
    ) + '\n'
  );
}
console.log(
  JSON.stringify({ root, controls, sourceSha256: hash(fs.readFileSync(new URL(import.meta.url))) })
);
