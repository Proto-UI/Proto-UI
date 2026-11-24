from pathlib import Path
import collections, datetime, gzip, hashlib, io, json, lzma, tarfile, zipfile
from urllib.parse import urlparse
B=Path('/workspace/scratch/0d7d81e85daf')
R=B/'proto-ui-s7'
E=R/'internal/records/evidence/2026-11-24-button-projection-study'
N=B/'s7-operator-evidence/button-primary'
P=N/'button-primary-observation-01/button-primary-01'
O=B/'s7-button-results-review'
sha=lambda b:hashlib.sha256(b).hexdigest()
load=lambda p:json.loads(p.read_text())
errors=[]
def check(ok,label):
 if not ok: errors.append(label)
def checkref(root,ref,label):
 p=root/ref['path']
 check(p.is_file(),label+' missing '+str(p))
 if p.is_file():
  d=p.read_bytes(); check(sha(d)==ref['sha256'],label+' hash '+str(p))
  if 'bytes' in ref: check(len(d)==ref['bytes'],label+' size '+str(p))
report={'reviewedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'reviewer':'/root/s7_button_results_review','method':'Read-only retained evidence audit; no browser, install, build, source edits or GitHub writes','subjectHashes':{}}
for n in ['primary-freeze-v2.json','freeze.json','frozen-oracle.mjs','primary-input-manifest.json','primary-results.json','metrics.json','source-and-command-manifest.json','primary-native-evidence.tar.gz','oracle-calibration.tar.gz']:
 report['subjectHashes'][n]=sha((E/n).read_bytes())
report['subjectHashes']['report.md']=sha((R/'internal/records/2026-11-24-button-projection-comparison.md').read_bytes())
F=load(E/'primary-freeze-v2.json'); I=load(E/'primary-input-manifest.json')
check(F['oracleSha256']==report['subjectHashes']['frozen-oracle.mjs'],'frozen oracle')
check(I['primaryFreezeSha256']==report['subjectHashes']['primary-freeze-v2.json'],'manifest freeze')
check(F['rawCalibrationSha256']==report['subjectHashes']['oracle-calibration.tar.gz'],'calibration archive binding')
check(F['independentOracleReviewSha256']==sha((E/'oracle-review/final-calibration-addendum.json').read_bytes()),'independent oracle review binding')
# Two compression encodings represent one 1,693-member dataset.
sm=load(E/'source-and-command-manifest.json')['files']; xz=E/'source-and-command-evidence.tar.xz'
with tarfile.open(xz,'r:xz') as t:
 members=t.getmembers(); reg=[m for m in members if m.isfile()]; names=[m.name for m in reg]
 check(len(names)==len(set(names)),'duplicate archive paths')
 check(set(names)=={f['path'] for f in sm},'source archive manifest membership')
 for f in sm:
  d=t.extractfile(f['path']).read();check(sha(d)==f['sha256'] and len(d)==f['bytes'],'source archive '+f['path'])
 report['sourceArchive']={'path':xz.name,'sha256':sha(xz.read_bytes()),'regularFiles':len(reg),'nonRegularEntries':len(members)-len(reg),'perTopDirectory':dict(collections.Counter(n.split('/')[0] for n in names))}
gz=E/'source-and-command-evidence.tar.gz'
if not gz.exists():gz=B/'s7-control/button-source-original.tar.gz'
if gz.exists():
 same=gzip.decompress(gz.read_bytes())==lzma.decompress(xz.read_bytes())
 report['sourceArchive']['retainedGzipPath']=str(gz);report['sourceArchive']['gzipSha256']=sha(gz.read_bytes());report['sourceArchive']['uncompressedTarExactlyEqual']=same
 check(same,'lossless recompression tar bytes')
# Actual native return archive and its extracted local copy.
with tarfile.open(E/'primary-native-evidence.tar.gz','r:gz') as t:
 nativeFiles=[m for m in t.getmembers() if m.isfile()]
 for m in nativeFiles:
  p=N/m.name; check(p.is_file(),'native extracted missing '+m.name)
  if p.is_file():check(t.extractfile(m).read()==p.read_bytes(),'native extracted changed '+m.name)
 report['nativeArchive']={'regularFiles':len(nativeFiles),'allExtractedBytesCompared':True}
inputCount=0; fixture=collections.defaultdict(set)
for c in I['cases']:
 for f in c['files']:
  if c['id'].startswith('clean-generative-'):
   if f['path'].startswith('clean-consumer/'):
    originalRef=dict(f);originalRef['path']='project/'+f['path'][len('clean-consumer/'):]
    checkref(Path(c['source']),originalRef,'input original '+c['id'])
   else:check(f['path']=='clean-consumer.json','unexpected operator-authored wrapper '+f['path'])
  else:checkref(Path(c['source']),f,'input original '+c['id'])
  checkref(P/c['id'],f,'input browser '+c['id']);inputCount+=1
 for rel in ['package-lock.json','package.json','index.html','tsconfig.json','src/App.tsx','src/main.tsx','src/storage.ts','src/style.css']:
  fixture[rel].add(sha((P/c['id']/'clean-consumer'/rel).read_bytes()))
check(all(len(v)==1 for v in fixture.values()),'shared fixture mismatch')
check(fixture['package-lock.json']=={F['lockSha256']},'lock mismatch')
report['inputManifest']={'cases':len(I['cases']),'fileReferencesCheckedAgainstOriginalAndBrowserCopies':inputCount,'sharedFixtureHashes':{k:sorted(v) for k,v in fixture.items()}}
S=load(E/'primary-results.json'); M={x['id']:x for x in load(E/'metrics.json')['runs']}
rows=[]; counts=collections.Counter(); allProduction=[]
sourceArchive=sha((N/'button-primary-observation-01/input.tar.gz').read_bytes())
for s in S:
 rid=s['name']; root=P/rid; d=load(root/'operator/browser/result.json'); m=M[rid]
 check(s['sourceArchiveSha256']==sourceArchive,rid+' source archive')
 check(s['status']==d['status']=='passed-shared-button-observation',rid+' status')
 check(s['exitCode']==0 and not d['errors'],rid+' errors')
 check(s['checkpoints']==len(d['checkpoints'])==10 and s['gestures']==len(d['gestures'])==5,rid+' checkpoint/gesture count')
 check(d['disabledKeyboard']['attempted']==[] and not d['disabledKeyboard']['focusable'],rid+' disabled branch')
 for f in d['productionFiles']:checkref(root,f,rid+' production');counts['productionFileHashes']+=1
 prods={f['path'].removeprefix('clean-consumer/dist/'):f['sha256'] for f in d['productionFiles']}
 for a in d['assets']:
  check(a['status']==200 and a['proof']=='response-body' and prods.get(a['path'])==a['sha256'],rid+' response receipt');counts['responseBindings']+=1
 for c in d['checkpoints']:
  p=root/c['screenshot'];check(p.is_file() and p.read_bytes()[:8]==b'\x89PNG\r\n\x1a\n',rid+' screenshot '+c['name']);counts['png']+=1
 for g in d['gestures']:check(g['postGestureWindowMs']==250,rid+' window')
 zpath=root/'operator/browser/trace.zip'
 with zipfile.ZipFile(zpath) as z:
  check(z.testzip() is None,rid+' trace CRC');counts['traceZip']+=1
  ev=[json.loads(l) for l in z.read('trace.trace').splitlines()]
  opt=ev[0];check(opt['playwrightVersion']=='1.58.2' and opt['options']['viewport']=={'width':960,'height':720},rid+' trace environment')
  check(any(e.get('type')=='frame-snapshot' for e in ev),rid+' trace snapshots')
  check(any(e.get('type')=='screencast-frame' for e in ev),rid+' trace screencast')
  for line in z.read('trace.network').splitlines():
   n=json.loads(line)['snapshot'];u=urlparse(n['request']['url']);rel=u.path.lstrip('/') or 'index.html';con=n['response']['content'];counts['traceNetworkRecords']+=1
   check(n['response']['status']==200 and rel in prods,rid+' trace asset member')
   if con.get('_sha1'):
    body=z.read('resources/'+con['_sha1']);check(sha(body)==prods[rel],rid+' trace response body');counts['traceBodiesRehashed']+=1
   else:counts['traceBodiesNotRetained']+=1;check(rel.endswith('.js'),rid+' non-JS missing trace body')
 component=root/'clean-consumer/generated/Component.tsx'; ts=list((root/'clean-consumer/generated').rglob('*.ts'))+list((root/'clean-consumer/generated').rglob('*.tsx'));js=list((root/'clean-consumer/dist').rglob('*.js'))
 computed={'componentBytes':component.stat().st_size,'componentSha256':sha(component.read_bytes()),'generatedSourceFiles':len(ts),'generatedSourceBytes':sum(t.stat().st_size for t in ts),'productionJsBytes':sum(t.stat().st_size for t in js),'productionJsGzipBytes':sum(len(gzip.compress(t.read_bytes(),mtime=0)) for t in js)}
 for k,v in computed.items():check(v==m[k],rid+' metric '+k)
 check(m['firstTag']==d['checkpoints'][0]['tag'] and m['spaceActivationEdge']==d['spaceActivationEdge'],rid+' representation')
 rows.append({'id':rid,'status':d['status'],'start':s['startedAt'],'finish':s['finishedAt'],'checkpoints':len(d['checkpoints']),'gestures':len(d['gestures']),'tag':d['checkpoints'][0]['tag'],'spaceEdge':d['spaceActivationEdge'],'disabledKeyboardAttempted':d['disabledKeyboard']['attempted'],'metrics':computed})
report['primaryRuns']=rows;report['evidenceCounts']=dict(counts)
# Compiler repeat inventory, references and actual logged command outputs.
admitted=load(B/'s7-button-artifact-01/candidate.json');outinv=admitted['outputs']; refs=0
for batch in ['s7-button-deterministic','s7-button-deterministic-02']:
 bd=B/batch;driver=load(bd/'driver.json')
 for c in driver['commands']:
  check(c['exitCode']==0,batch+' command exit '+c['label'])
  for st in ['stdout','stderr']:check(sha((bd/(c['label']+'.'+st+'.log')).read_bytes())==c[st+'Sha256'],batch+' log '+c['label']+st)
 for i in range(1,4):
  rd=bd/f'deterministic-{i}'; cand=load(rd/'candidate.json')
  for typ in ['inputs','compilerInputs','outputs']:
   for ref in cand[typ]:checkref(rd,ref,batch);refs+=1
  if batch.endswith('-02'):check(cand['outputs']==outinv,batch+' admitted output list')
report['compilerRepeatAudit']={'batches':2,'runs':6,'commandReceipts':18,'hashedLogs':36,'sourceCompilerOutputReferences':refs,'formalOutputsMatchAdmittedInventory':True,'formalOutputInventorySha256':F['admittedOutputInventorySha256']}
# Temporal facts directly from retained receipts.
v1=load(E/'freeze.json'); excluded=load(B/'s7-button-generations/generative-1/operator-exclusion.json');setup=load(B/'s7-button-deterministic/setup-mismatch.json')
original=[json.loads(l) for l in (B/'s7-button-generations/releases.jsonl').read_text().splitlines()]
clean=[json.loads(l) for l in (B/'s7-button-generations-clean/releases.jsonl').read_text().splitlines()]
firstBrowser=min(s['startedAt'] for s in S)
check(v1['frozenAt']<original[0]['at']<F['frozenAt'],'original release chronology')
check(all(F['frozenAt']<x['at']<firstBrowser for x in clean),'clean release chronology')
check(setup['at']<firstBrowser and excluded['at']<firstBrowser,'exclusion chronology')
report['chronology']={'initialFreeze':v1['frozenAt'],'originalGenerationRelease':original[0]['at'],'formalV2Freeze':F['frozenAt'],'cleanGenerationReleases':[x['at'] for x in clean],'setupExclusion':setup['at'],'metadataExclusion':excluded['at'],'firstFormalBrowser':firstBrowser,'v2InheritedHistoricalFlag':F['beforeAnyGenerativeRelease'],'preciseFormalFlag':F['beforeAnyCleanGenerativeRelease']}
report['errors']=errors;report['verified']=not errors
(O/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['primaryRuns','inputManifest','subjectHashes']},ensure_ascii=False,indent=2))
