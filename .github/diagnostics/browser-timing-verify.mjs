import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const manifest = JSON.parse(readFileSync(new URL('./browser-timing-manifest.json', import.meta.url)));
const directory = path.resolve(process.argv[2]);
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const observations = [];
const errors = [];
const all = [];
const equal = (a,b,message) => assert.deepEqual([...a].sort(), [...b].sort(), message);
try {
  const folders = readdirSync(directory, {withFileTypes:true}).filter(e=>e.isDirectory());
  assert.equal(folders.length,13,'Require exactly 13 producer artifacts from this attempt');
  for (let index=0;index<13;index++) {
    const shard=`${index+1}/13`;
    const name=`browser-${index+1}-of-13`;
    const matches=folders.filter(folder=>folder.name===`runtime-ci-${process.env.GITHUB_RUN_ID}-${name}-attempt-${process.env.GITHUB_RUN_ATTEMPT}`);
    assert.equal(matches.length,1,`Missing or duplicate current-attempt ${shard}`);
    const root=path.join(directory,matches[0].name);
    const terminal=read(path.join(root,'terminal.json'));
    assert.equal(terminal.source,manifest.source);
    assert.equal(terminal.shard,shard);
    const selection=read(path.join(root,`selection-${name}.json`));
    assert.equal(selection.checkoutSha,manifest.source);
    equal(selection.suites,manifest.groups[index].files,'Selection mismatch or duplicates');
    const report=read(path.join(root,`vitest-${name}.json`));
    const names=report.testResults.map(result=>result.name.replaceAll('\\','/').split('/source/').at(-1));
    equal(names,manifest.groups[index].files,'Report membership mismatch or duplicates');
    all.push(...names);
    observations.push({shard,terminal,success:report.success,files:report.testResults});
    if(terminal.outcome!=='success'||report.success!==true||report.numFailedTests!==0||report.numFailedTestSuites!==0) errors.push(`${shard}: failed producer/report`);
    for(const file of report.testResults) {
      if(file.status!=='passed'||!file.assertionResults.length) errors.push(`${shard}: failed/empty suite ${file.name}`);
      for(const test of file.assertionResults) if(test.status!=='passed') errors.push(`${shard}: ${test.status} ${file.name} ${test.fullName}`);
    }
  }
  equal(all,manifest.groups.flatMap(group=>group.files),'All 99 identities must occur exactly once');
  assert.equal(all.length,99);
  if(process.env.TIMING_NEEDS) assert.equal(JSON.parse(process.env.TIMING_NEEDS).timing.result,'success');
} catch(error) { errors.push(error.stack); }
writeFileSync(path.join(directory,'verification.json'),JSON.stringify({source:manifest.source,manifest,observations,errors,success:errors.length===0},null,2)+'\n');
if(errors.length) { console.error(errors.join('\n')); process.exitCode=1; }
