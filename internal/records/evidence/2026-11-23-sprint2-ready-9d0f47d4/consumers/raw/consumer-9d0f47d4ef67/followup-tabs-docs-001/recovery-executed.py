#!/usr/bin/env python3
"""Preserve the original FAIL; diagnose worker setup, then run the unchanged Tabs 13 and docs gates."""
from pathlib import Path
import datetime,hashlib,json,os,signal,shutil,subprocess,sys,time,traceback
root=Path('$CONTROL')
parent=root/'consumer-9d0f47d4ef67'
out=parent/'followup-tabs-docs-001'
source=Path('$PRODUCT_9D')
head='9d0f47d4ef67bbc3676e4db24c7906f8721e5b42'
tree='0c9d31e5bb05d3af79932ec3c62a61480197f9eb'
lock='96dbd55a65d85ba1fcf2f4268a42842c20844c409f41f1a0e457019c4cdd5672'
original=parent/'evidence-run-001/summary.json'
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
original_sha=sha(original)
original_report=json.loads(original.read_text())
assert original_report['status']=='FAIL' and original_report['expectedHead']==head
assert original_report['commands'][-1]['name']=='tabs-profile-switch-separate-13'
assert original_report['commands'][-1]['exitCode']==1
out.mkdir(exist_ok=False)
(out/'logs').mkdir()
(out/'receipts').mkdir()
shutil.copyfile(__file__,out/'recovery-executed.py')
env=dict(os.environ,CI='true',NODE_OPTIONS='',NODE_PATH='',TMPDIR=str(parent/'runtime'))
env['PATH']='$NODE24_BIN:$COREPACK_BIN:'+env.get('PATH','')
summary={'schema':'proto-ui.sprint2.tabs-docs-followup.v1','head':head,'tree':tree,'lockSha256':lock,
 'source':str(source),'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'pid':os.getpid(),'pgid':os.getpgrp(),'status':'RUNNING','commands':[],'sourceChecks':[],
 'originalReplayStatus':'FAIL','originalReplaySha256':original_sha,
 'recoveryScriptSha256':sha(out/'recovery-executed.py'),
 'scope':'Only the original two Tabs files (13 tests), docs style generation, and docs typecheck. No product/test assertion change; no repeat of passed compiler/CLI/apps/public builds.',
 'aggregateAcceptanceClaim':False}
def save():
 (out/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
def guard(where):
 actual_head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=source,text=True).strip()
 actual_tree=subprocess.check_output(['git','rev-parse','HEAD^{tree}'],cwd=source,text=True).strip()
 actual_status=subprocess.check_output(['git','status','--porcelain','--untracked-files=normal'],cwd=source,text=True).strip()
 actual_lock=sha(source/'pnpm-lock.yaml')
 assert actual_head==head and actual_tree==tree and not actual_status and actual_lock==lock
 assert sha(original)==original_sha,'The original failed replay must remain unchanged'
 summary['sourceChecks'].append({'where':where,'head':actual_head,'tree':actual_tree,'clean':True,'lockSha256':actual_lock})
 save()
def run(name,argv,expected=0,timeout=1200):
 guard(name+':before')
 output=out/'logs'/(name+'.stdout.log');error=out/'logs'/(name+'.stderr.log')
 record={'name':name,'argv':list(map(str,argv)),'cwd':str(source),'expectedExit':expected,'timeoutSeconds':timeout,
         'stdout':str(output.relative_to(out)),'stderr':str(error.relative_to(out))}
 print(json.dumps({'stage':name,'state':'START'}),flush=True)
 started=time.monotonic()
 with output.open('w') as stdout,error.open('w') as stderr:
  process=subprocess.Popen(list(map(str,argv)),cwd=source,env=env,stdin=subprocess.DEVNULL,stdout=stdout,stderr=stderr,start_new_session=True)
  record['pid']=process.pid
  try:
   record['exitCode']=process.wait(timeout=timeout);record['timedOut']=False
  except subprocess.TimeoutExpired as exc:
   record.update(exitCode=None,timedOut=True,error=str(exc),timeoutSignals=[])
   for sig,delay in [(signal.SIGTERM,1),(signal.SIGKILL,0)]:
    try:os.killpg(process.pid,sig);record['timeoutSignals'].append(sig.name)
    except ProcessLookupError:pass
    if delay:time.sleep(delay)
   record['terminatedReturnCode']=process.wait(timeout=10)
 record['wallSeconds']=round(time.monotonic()-started,3)
 record['stdoutSha256']=sha(output);record['stderrSha256']=sha(error)
 summary['commands'].append(record);save()
 print(json.dumps({'stage':name,'state':'END','exitCode':record['exitCode'],'wallSeconds':record['wallSeconds']}),flush=True)
 guard(name+':after')
 if expected is not None and record['exitCode']!=expected:raise RuntimeError(name+' failed; actual '+str(record['exitCode']))
 return record
save()
try:
 guard('start')
 prefix=['corepack','pnpm@10.32.1','exec','vitest','run',
         'apps/www/src/components/PrototypePreviewer/tabs-profile-switch.test.ts',
         'apps/www/src/components/PrototypePreviewer/tabs-profile-switch-code.test.ts','--maxWorkers=1']
 diag_file=out/'receipts/tabs-diagnostic.json'
 diag=run('tabs-worker-diagnostic',prefix+['--reporter=default','--reporter=json','--outputFile='+str(diag_file)],expected=None)
 diagnostic=(out/diag['stdout']).read_text()+(out/diag['stderr']).read_text()
 conflict=(('minThreads' in diagnostic and 'maxThreads' in diagnostic) or ('minWorkers' in diagnostic and 'maxWorkers' in diagnostic)) and 'conflict' in diagnostic
 if diag['exitCode']!=1 or not conflict:
  raise RuntimeError('The real diagnostic did not confirm the independently inspected worker min/max conflict; keep the actual output and escalate.')
 summary['diagnosis']={'kind':'Vitest/Tinypool worker initialization conflict','actualExit':1,
   'actualErrorConfirmed':True,'onlyExecutionFix':'Add --minWorkers=1 while preserving --maxWorkers=1 and both original files.',
   'originalProductAndTestsChanged':False}
 save()
 tabs_file=out/'receipts/tabs-13.json'
 run('tabs-original-13-with-bounded-workers',prefix+['--minWorkers=1','--reporter=default','--reporter=json','--outputFile='+str(tabs_file)])
 tabs=json.loads(tabs_file.read_text())
 assert tabs['numTotalTests']==13 and tabs['numPassedTests']==13 and tabs['numFailedTests']==0
 assert tabs['numTotalTestSuites']>0
 summary['tabs']={k:tabs[k] for k in ['numTotalTests','numPassedTests','numFailedTests','numTotalTestSuites','success']}
 save()
 run('docs-generate-proto-ui-style',['corepack','pnpm@10.32.1','--filter','apps-www','generate:proto-ui-style'])
 run('docs-types',['corepack','pnpm@10.32.1','check:types:docs'])
 guard('finish')
 summary.update(status='PASS',supplementScopeAccepted=True)
except BaseException as exc:
 summary.update(status='FAIL',supplementScopeAccepted=False,failure={'message':str(exc),'traceback':traceback.format_exc()})
finally:
 summary['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
 summary['originalReplayStillUnchanged']=sha(original)==original_sha
 save()
 print(json.dumps({'status':summary['status'],'summary':str(out/'summary.json')}),flush=True)
sys.exit(0 if summary['status']=='PASS' else 1)
