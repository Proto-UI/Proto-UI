#!/usr/bin/env python3
from pathlib import Path
import datetime,hashlib,json,os,re,shutil,subprocess,sys,time,traceback
head=sys.argv[1]
assert re.fullmatch('[0-9a-f]{40}',head), 'Pass the explicit final full commit SHA'
parent=Path('$CONTROL')
control=parent/('consumer-'+head[:12])
control.mkdir(exist_ok=True)
source=Path('$PRODUCT_9D')
assert head=='9d0f47d4ef67bbc3676e4db24c7906f8721e5b42'
expected_tree='0c9d31e5bb05d3af79932ec3c62a61480197f9eb'
shenko=Path('$FROZEN_SHENKO')
verdant=parent/'consumer-16be/frozen-verdant'
runner=control/'run-final-consumers.py'
assert not runner.exists(), 'Refuse to replace an earlier executed runner; inspect that run first'
shutil.copyfile(parent/'consumer-next-9d0f47d4/run-final-consumers.py',runner)
shutil.copyfile(Path(__file__),control/'bootstrap-executed.py')
runtime=control/'runtime'
runtime.mkdir(exist_ok=True)
env=dict(os.environ,CI='true',NODE_OPTIONS='',NODE_PATH='',TMPDIR=str(runtime))
env['PATH']='$NODE24_BIN:$COREPACK_BIN:'+env.get('PATH','')
summary={'expectedHead':head,'source':str(source),'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status':'RUNNING','commands':[],'pid':os.getpid(),'persistentTemporaryRoot':str(runtime),
    'runnerSha256':hashlib.sha256(runner.read_bytes()).hexdigest(),
    'bootstrapSha256':hashlib.sha256((control/'bootstrap-executed.py').read_bytes()).hexdigest()}
def save():
    (control/'bootstrap-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
def run(name,argv,cwd=control,timeout=1200):
    out=control/(name+'.stdout.log')
    err=control/(name+'.stderr.log')
    record={'name':name,'argv':list(map(str,argv)),'cwd':str(cwd)}
    started=time.monotonic()
    with out.open('w') as stdout,err.open('w') as stderr:
        try:
            result=subprocess.run(list(map(str,argv)),cwd=cwd,env=env,stdin=subprocess.DEVNULL,stdout=stdout,stderr=stderr,timeout=timeout)
            record['exitCode']=result.returncode
        except Exception as error:
            record['exitCode']=None
            record['error']=str(error)
    record['seconds']=time.monotonic()-started
    record['stdoutSha256']=hashlib.sha256(out.read_bytes()).hexdigest()
    record['stderrSha256']=hashlib.sha256(err.read_bytes()).hexdigest()
    summary['commands'].append(record)
    save()
    if record['exitCode']!=0:raise RuntimeError(name+' failed; see '+str(err))
    return out.read_text().strip()
save()
try:
    assert run('source-head',['git','rev-parse','HEAD'],source)==head
    assert run('source-tree',['git','rev-parse','HEAD^{tree}'],source)==expected_tree
    summary['expectedTree']=expected_tree
    assert run('source-clean',['git','status','--porcelain','--untracked-files=normal'],source)==''
    assert run('node-version',['node','--version']).startswith('v24.')
    assert run('pnpm-version',['corepack','pnpm@10.32.1','--version'])=='10.32.1'
    lock_before=hashlib.sha256((source/'pnpm-lock.yaml').read_bytes()).hexdigest()
    run('source-frozen-install',['corepack','pnpm@10.32.1','install','--frozen-lockfile','--ignore-scripts','--fetch-retries=0','--fetch-timeout=30000'],source)
    assert hashlib.sha256((source/'pnpm-lock.yaml').read_bytes()).hexdigest()==lock_before
    summary['sourceFrozenInstallLockSha256']=lock_before
    assert run('source-clean-after-install',['git','status','--porcelain','--untracked-files=normal'],source)==''
    assert run('shenko-original-commit',['git','cat-file','-t','f3fa6f4d8bf22cfd2baf490d9c3a08bd39af4d42'],shenko)=='commit'
    assert run('verdant-original-commit',['git','cat-file','-t','91a775546ebd21a87d76d76568195a6513437719'],verdant)=='commit'
    summary['pipelineOutput']=str(control/'evidence-run-001')
    save()
    run('pipeline',['python3',runner,'--source',source,'--head',head,'--out',control/'evidence-run-001',
        '--shenko-repository',shenko,'--verdant-repository',verdant],timeout=5400)
    report=json.loads((control/'evidence-run-001/summary.json').read_text())
    assert report['status']=='PASS'
    summary['status']='PASS'
except BaseException as error:
    summary['status']='FAIL'
    summary['failure']={'message':str(error),'traceback':traceback.format_exc()}
finally:
    summary['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
    save()
    print(json.dumps({'status':summary['status'],'summary':str(control/'bootstrap-summary.json')}),flush=True)
sys.exit(0 if summary['status']=='PASS' else 1)
