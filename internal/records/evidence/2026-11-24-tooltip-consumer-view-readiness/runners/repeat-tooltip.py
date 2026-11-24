from pathlib import Path
import subprocess,os,json,time,datetime,signal
root=Path('/var/tmp/proto-ui-portal-evidence-456f')
out=Path('/var/tmp/proto-ui-native-evidence-456f/portal-current-union/tooltip-repeat-diagnostic')
out.mkdir(exist_ok=False)
expected='4f8c56486825afbb563c3aa159c7ad76a1d3d82a'
env=os.environ.copy();env['PATH']='/tank/shared/projects/proto-ui-agent/seven-sprints-20261123-chvf1ono/tools/node-v24.22.3-linux-x64/bin:'+env['PATH'];env['TMPDIR']='/var/tmp/pui456f-pu';env['NODE_OPTIONS']='--max-old-space-size=2048';env['NO_COLOR']='1';env['CHROME_PATH']='/tank/shared/projects/proto-ui-agent/seven-sprints-20261123-chvf1ono/tools/playwright-browsers/chromium-1208/chrome-linux64/chrome'
def git(*args):return subprocess.check_output(['git',*args],cwd=root,text=True).strip()
assert git('rev-parse','HEAD')==expected and git('status','--porcelain')==''
rows=[]
for number in range(1,6):
 name=f'attempt-{number:02d}';env['PROTO_UI_RUNTIME_EVIDENCE_DIR']=str(out/name)
 args=['corepack','pnpm@10.32.1','exec','vitest','run','apps/www/test/component-consumer-repairs.browser.test.ts','--testNamePattern','base.*react.*Tooltip Button has one Tab stop','--maxWorkers=1','--minWorkers=1','--reporter=default','--reporter=json','--outputFile.json='+str(out/(name+'.json'))]
 t=time.monotonic();start=datetime.datetime.now(datetime.timezone.utc).isoformat()
 with (out/(name+'.log')).open('wb') as log:
  p=subprocess.Popen(args,cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
  (out/'current-job.json').write_text(json.dumps({'attempt':number,'pid':p.pid,'startedAt':start})+'\n')
  try:code=p.wait(timeout=180);timedout=False
  except subprocess.TimeoutExpired:
   timedout=True;os.killpg(p.pid,signal.SIGTERM)
   try:code=p.wait(timeout=10)
   except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);code=p.wait()
 row={'head':expected,'attempt':number,'startedAt':start,'command':args,'exitCode':code,'timedOut':timedout,'outerTimeoutSeconds':180,'elapsedMs':round((time.monotonic()-t)*1000),'scope':'One unchanged original case, five separate processes to diagnose the observed union failure; 83 unselected cases are not passes. The failed complete 84-case attempt remains intact.','headAfter':git('rev-parse','HEAD'),'statusAfter':git('status','--porcelain')}
 rp=out/(name+'.json')
 if rp.exists():
  data=json.loads(rp.read_text());row['report']={k:data.get(k) for k in ['success','numTotalTests','numPassedTests','numFailedTests','numPendingTests']}
  row['failed']=[{'name':a['fullName'],'messages':a['failureMessages']} for s in data.get('testResults',[]) for a in s.get('assertionResults',[]) if a['status']=='failed']
 (out/(name+'.terminal.json')).write_text(json.dumps(row,indent=2)+'\n');rows.append(row);print(json.dumps(row),flush=True)
 assert row['headAfter']==expected and row['statusAfter']==''
(out/'terminal.json').write_text(json.dumps({'head':expected,'attempts':rows,'scope':'Bounded reproducibility diagnosis, not complete-suite acceptance.'},indent=2)+'\n')
