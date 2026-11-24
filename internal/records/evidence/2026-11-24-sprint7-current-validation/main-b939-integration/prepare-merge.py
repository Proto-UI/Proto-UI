import pathlib,subprocess,json
r=pathlib.Path('/var/tmp/proto-ui-s7-delivery-456f');o=pathlib.Path('/var/tmp/proto-ui-s7-transfer-456f/main-b939-integration')
def g(a):return subprocess.run(['git']+a,cwd=r,capture_output=True,text=True)
assert g(['rev-parse','HEAD']).stdout.strip()=='422a02294325556d986fcc002ac60187f535af21';assert not g(['status','--porcelain']).stdout
q=g(['switch','-c','work/sprint7-main-b939-456f','b939afe35d30a1a436766d80beea7093a46e4fb2']);(o/'switch.log').write_text(q.stdout+q.stderr);assert q.returncode==0,q.stderr
q=g(['merge','--no-ff','--no-commit','422a02294325556d986fcc002ac60187f535af21']);(o/'merge-prepare.log').write_text(q.stdout+q.stderr);c=g(['diff','--name-only','--diff-filter=U']).stdout.strip().splitlines();(o/'conflicts.patch').write_text(g(['diff','--cc']).stdout)
(o/'merge-source-binding.json').write_text(json.dumps({'base':'b939afe35d30a1a436766d80beea7093a46e4fb2','incoming':'422a02294325556d986fcc002ac60187f535af21','mergeExitCode':q.returncode,'conflicts':c},indent=2)+'\n');print(json.dumps({'conflicts':c,'mergeExitCode':q.returncode}))
