from pathlib import Path
import os,subprocess,json,time,datetime,hashlib,signal
root=Path('/var/tmp/proto-ui-portal-evidence-456f');out=Path('/var/tmp/proto-ui-native-evidence-456f/tooltip-current-main/candidate84');out.mkdir(exist_ok=False)
head='1cc4ad159da621d58e2b668d0d2ef0a22be6ed1b';testPath='apps/www/test/component-consumer-repairs.browser.test.ts';testHash='3cd0b01fa078f3b3a1fcef76b56eb5d2ca659f3a37046f65a8f882eb4867f909'
def git(*args):return subprocess.check_output(['git',*args],cwd=root,text=True).strip()
assert git('rev-parse','HEAD')==head and git('diff','--name-only')==testPath
assert hashlib.sha256((root/testPath).read_bytes()).hexdigest()==testHash
env=os.environ.copy();env['PATH']='/tank/shared/projects/proto-ui-agent/seven-sprints-20261123-chvf1ono/tools/node-v24.22.3-linux-x64/bin:'+env['PATH'];env['TMPDIR']='/var/tmp/pui456f-pu';env['NODE_OPTIONS']='--max-old-space-size=2048';env['NO_COLOR']='1';env['CHROME_PATH']='/tank/shared/projects/proto-ui-agent/seven-sprints-20261123-chvf1ono/tools/playwright-browsers/chromium-1208/chrome-linux64/chrome';env['PROTO_UI_RUNTIME_EVIDENCE_DIR']=str(out/'runtime-evidence')
args=['corepack','pnpm@10.32.1','exec','vitest','run',testPath,'--maxWorkers=1','--minWorkers=1','--reporter=default','--reporter=json','--outputFile.json='+str(out/'vitest.json')]
start=datetime.datetime.now(datetime.timezone.utc).isoformat();t=time.monotonic()
with (out/'native.log').open('wb') as log:
 p=subprocess.Popen(args,cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 (out/'running.json').write_text(json.dumps({'pid':p.pid,'startedAt':start,'head':head,'testSha256':testHash})+'\n')
 try:code=p.wait(timeout=300);timedout=False
 except subprocess.TimeoutExpired:
  timedout=True;os.killpg(p.pid,signal.SIGTERM)
  try:code=p.wait(timeout=10)
  except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);code=p.wait()
row={'baseHead':head,'testSha256':testHash,'command':args,'startedAt':start,'exitCode':code,'timedOut':timedout,'outerTimeoutSeconds':300,'elapsedMs':round((time.monotonic()-t)*1000),'headAfter':git('rev-parse','HEAD'),'testSha256After':hashlib.sha256((root/testPath).read_bytes()).hexdigest(),'statusAfter':git('status','--porcelain')}
rp=out/'vitest.json'
if rp.exists():
 d=json.loads(rp.read_text());row['report']={k:d.get(k) for k in ['success','numTotalTests','numPassedTests','numFailedTests','numPendingTests']};row['failed']=[{'name':a['fullName'],'messages':a['failureMessages']} for s in d.get('testResults',[]) for a in s.get('assertionResults',[]) if a['status']=='failed']
(out/'terminal.json').write_text(json.dumps(row,indent=2)+'\n');print(json.dumps(row),flush=True)
