import pathlib,subprocess,json,os,time
r=pathlib.Path('/var/tmp/proto-ui-s7-delivery-456f');o=pathlib.Path('/var/tmp/proto-ui-s7-transfer-456f/main-b939-integration')
def g(a):return subprocess.run(['git']+a,cwd=r,capture_output=True,text=True)
assert g(['rev-parse','HEAD']).stdout.strip()=='b939afe35d30a1a436766d80beea7093a46e4fb2';assert not g(['diff','--name-only','--diff-filter=U']).stdout
with (o/'install.log').open('w') as f:q=subprocess.run(['corepack','pnpm@10.32.1','install','--offline','--frozen-lockfile'],cwd=r,stdout=f,stderr=subprocess.STDOUT)
assert q.returncode==0
reviewed=g(['write-tree']).stdout.strip();start=time.monotonic();q=g(['-c','user.name=Codex','-c','user.email=codex@openai.com','commit','-s','-m','Merge Sprint 7 studies with accepted Sprint 2 main'])
(o/'merge-commit.log').write_text(q.stdout+q.stderr);assert q.returncode==0,q.stdout+q.stderr
head=g(['rev-parse','HEAD']).stdout.strip();d={'head':head,'tree':g(['rev-parse','HEAD^{tree}']).stdout.strip(),'parents':g(['show','-s','--format=%P','HEAD']).stdout.strip().split(),'exitCode':q.returncode,'elapsedMs':round((time.monotonic()-start)*1000),'reviewedTree':reviewed,'hookChangedPaths':g(['diff','--name-only',reviewed,head]).stdout.splitlines(),'status':g(['status','--porcelain']).stdout}
(o/'merge-terminal.json').write_text(json.dumps(d,indent=2)+'\n');print(json.dumps(d));assert not d['status'] and not d['hookChangedPaths']
cfg={'root':str(r),'head':head,'out':str(o/'first-checkers'),'tmp':'/var/tmp/pui456f-s7d','nodeOptions':'--max-old-space-size=1536','cpuAffinity':[0,1,2,3],'jobs':[{'name':'source-coverage','command':['node','scripts/coverage-matrices/check-coverage-matrices.mjs'],'timeout':300},{'name':'prototype-coverage','command':['node','scripts/coverage-matrices/prototype-coverage.mjs'],'timeout':300}]};c=o/'first-checkers.config.json';c.write_text(json.dumps(cfg,indent=2)+'\n')
q=subprocess.run(['python3','/var/tmp/proto-ui-native-evidence-456f/bounded-runner.py',str(c)]);print('checkers-driver-exit',q.returncode)
