from pathlib import Path
import subprocess,json,os,time,hashlib,datetime
root=Path('/var/tmp/proto-ui-s7-delivery-456f')
out=Path('/var/tmp/proto-ui-s7-transfer-456f/main-b939-integration/finf-fixture-repair')
env=os.environ.copy();env['PATH']='/tank/shared/projects/proto-ui-agent/seven-sprints-20261123-chvf1ono/tools/node-v24.22.3-linux-x64/bin:'+env['PATH'];env['TMPDIR']='/var/tmp/pui456f-s7d'
git=lambda *a:subprocess.check_output(['git',*a],cwd=root,text=True,env=env).strip()
before=git('rev-parse','HEAD');assert before=='42a01a0a68e668db75bfe6cdcf495bc9b446ca84';assert not git('status','--short')
patch=Path('/var/tmp/proto-ui-native-evidence-456f/current-repair-inputs/finf-exact-source-fixture.patch')
assert hashlib.sha256(patch.read_bytes()).hexdigest()=='64963a1294a64e1714ce18ef8d7eb34a0314aadff46ba6418a06eff9cdbe8475'
target='scripts/coverage-matrices/test/check-coverage-matrices.test.mjs'
subprocess.run(['git','apply','--check',str(patch)],cwd=root,check=True)
subprocess.run(['git','apply',str(patch)],cwd=root,check=True)
assert git('diff','--name-only')==target
assert hashlib.sha256((root/target).read_bytes()).hexdigest()=='f360834e99da2c6d78ea3803ceaf070b4a8d5ffaec4594d6a61d44bac3191101'
(out/'applied.patch').write_bytes(subprocess.check_output(['git','diff','--',target],cwd=root))
subprocess.run(['git','add','--',target],cwd=root,check=True)
indexBefore=git('write-tree');t=time.monotonic()
with (out/'commit.log').open('wb') as log:
 cp=subprocess.run(['git','commit','-s','-m','test(coverage): bind Finf fixture to admitted material sources'],cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT)
row={'before':before,'exitCode':cp.returncode,'elapsedMs':round((time.monotonic()-t)*1000),'head':git('rev-parse','HEAD'),'tree':git('rev-parse','HEAD^{tree}'),'indexBefore':indexBefore,'indexAfter':git('write-tree'),'statusAfter':git('status','--short'),'sourceSha256':hashlib.sha256((root/target).read_bytes()).hexdigest()}
(out/'commit-terminal.json').write_text(json.dumps(row,indent=2)+'\n');print(json.dumps(row),flush=True)
assert cp.returncode==0 and row['indexBefore']==row['indexAfter'] and not row['statusAfter']
cfg={'root':str(root),'head':row['head'],'out':str(out/'gates'),'tmp':'/var/tmp/pui456f-s7d','nodeOptions':'--max-old-space-size=1536','cpuAffinity':[0,1,2,3],'stopOnFailure':True,'jobs':[{'name':'finf-optical-closure-original-four','command':['node','--test','--test-name-pattern=^Finf continuous optical closure: ','scripts/coverage-matrices/test/check-coverage-matrices.test.mjs'],'timeout':900},{'name':'coverage-matrices-full','command':['corepack','pnpm@10.32.1','exec','node','--test','scripts/coverage-matrices/test/*.test.mjs'],'timeout':3600}]}
# Use the exact previously executed repository full-gate command, preserving glob handling.
old=json.loads(Path('/var/tmp/proto-ui-s7-transfer-456f/main-b939-integration/candidate-refresh/coverage-matrices.config.json').read_text())
assert len(old['jobs'])==1
cfg['jobs'][1]['command']=old['jobs'][0]['command']
p=out/'gates.config.json';p.write_text(json.dumps(cfg,indent=2)+'\n')
with (out/'gates.driver.log').open('wb') as log:
 proc=subprocess.Popen(['python3','/var/tmp/proto-ui-native-evidence-456f/bounded-runner.py',str(p)],stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
(out/'launched.json').write_text(json.dumps({'pid':proc.pid,'config':str(p),'head':row['head']})+'\n');print(json.dumps({'launched':proc.pid,'jobs':cfg['jobs']}),flush=True)
