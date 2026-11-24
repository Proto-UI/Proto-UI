import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const referencePath='scripts/coverage-matrices/test/fixtures/website-markup-provenance-current.json';
const previousBytes=readFileSync(referencePath);
const profile=JSON.parse(previousBytes);
if(profile.revision!=='bd2d1cf66f72532c0aa529349a40893d00f513bc'||profile.sourceAdmission!=='unverified')throw new Error('Expected the reviewed website visual reference.');
const expectedChangedPaths=[
'apps/www/src/content/docs/zh-cn/ui-libraries/base/transition.mdx',
'apps/www/src/content/docs/zh-cn/ui-libraries/shadcn/button.mdx',
'pnpm-lock.yaml',
'apps/www/src/content/docs/zh-cn/ui-libraries/shadcn/dialog.mdx',
];
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const changed=[];
for(const source of profile.sources){const digest=sha256(readFileSync(source.path));if(digest!==source.sha256)changed.push({path:source.path,previous:source.sha256,current:digest});source.sha256=digest;}
if(JSON.stringify(changed.map(x=>x.path))!==JSON.stringify(expectedChangedPaths))throw new Error(`Unreviewed source change: ${JSON.stringify(changed)}`);
const archivePath='scripts/coverage-matrices/test/fixtures/website-markup-provenance-bd2d1cf.json';
if(existsSync(archivePath))throw new Error('Refuse to overwrite historical reference.');
writeFileSync(archivePath,previousBytes);
profile.revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
profile.scope += ' The release documentation renewal preserves that visual reference as website-markup-provenance-bd2d1cf.json and reviews the three sampled documentation rewrites, the restored Button/Dialog version and lifecycle boundaries, and the module-anatomy workspace dependency link. The 33 direct source identities and unverified admission remain unchanged; runtime, served/transitive and release acceptance require separate evidence.';
writeFileSync(referencePath,JSON.stringify(profile,null,2)+'\n');
const report={previousRevision:'bd2d1cf66f72532c0aa529349a40893d00f513bc',revision:profile.revision,sourceAdmission:profile.sourceAdmission,sourceCount:profile.sources.length,archivePath,archiveSha256:sha256(previousBytes),changed};
writeFileSync('/tmp/pui-40da-web-evidence/provenance/source-renewal.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
