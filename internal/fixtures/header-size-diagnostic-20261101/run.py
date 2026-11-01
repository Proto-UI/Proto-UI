#!/usr/bin/env python3
"""Unexecuted, fixed native8 carrier. Host controller never imports repository code.
Network-enabled acquisition and loopback-only source execution are distinct bwrap invocations.
Every result is untrusted until no-follow admission. No fallback sandbox route exists.
"""
import argparse, datetime, hashlib, json, os, pathlib, re, resource, shutil, signal, stat, subprocess, sys
P = pathlib.Path(__file__).resolve().parent
S = json.loads((P / 'scope.json').read_text())
LOCK = S['lockSha256']; OVERLAY = S['overlayPatchSha256']; TEST = S['testFile']
ENV = {'PATH': '/usr/bin:/bin', 'HOME': '/tmp', 'GIT_CONFIG_NOSYSTEM': '1',
       'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_NO_LAZY_FETCH': '1'}
EXTERNAL = None
NOW = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()
SHA = lambda x: hashlib.sha256(x).hexdigest()

def fail(message): raise RuntimeError(message)
def write(p, obj):
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open('x', encoding='utf-8') as f: f.write(json.dumps(obj, indent=2) + '\n')

def safe_read(root, relative, cap=128*1024*1024):
    """Open each directory with O_NOFOLLOW; do not resolve attacker-created symlinks."""
    parts = pathlib.PurePosixPath(relative).parts
    if not parts or relative.startswith('/') or any(x in ('..', '.', '') for x in parts): fail('unsafe relative path')
    fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for part in parts[:-1]:
            nxt = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd); fd = nxt
        f = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW, dir_fd=fd)
        try:
            info = os.fstat(f)
            if not stat.S_ISREG(info.st_mode) or info.st_size > cap: fail('unsafe/oversize output: ' + relative)
            chunks = []; total = 0
            while True:
                b = os.read(f, min(1024*1024, cap + 1 - total))
                if not b: break
                chunks.append(b); total += len(b)
                if total > cap: fail('output grew above cap')
            return b''.join(chunks)
        finally: os.close(f)
    finally: os.close(fd)

def command(args, cwd=None):
    return subprocess.check_output(args, cwd=cwd, env=ENV, stderr=subprocess.STDOUT).decode().strip()

def source_files(repo, expected):
    if command(['git', 'rev-parse', 'HEAD'], repo) != expected['commit']: fail('real HEAD mismatch')
    if command(['git', 'rev-parse', 'HEAD^{tree}'], repo) != expected['tree']: fail('tree mismatch')
    config = command(['git', 'config', '--local', '--list'], repo)
    if re.search(r'(?im)^(credential\.|http\..*extraheader)', config): fail('checkout credential configuration present')
    raw = subprocess.check_output(['git', 'ls-tree', '-rz', '--full-tree', 'HEAD'], cwd=repo, env=ENV)
    files = {}
    for record in raw.split(b'\0'):
        if not record: continue
        meta, name = record.split(b'\t', 1); mode, kind, blob = meta.decode().split(); name = name.decode()
        if kind != 'blob' or mode not in ['100644', '100755']: fail('unexpected tracked object: ' + name)
        data = safe_read(repo, name)
        actual = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        if actual != blob: fail('checkout blob drift: ' + name)
        files[name] = SHA(data)
    if files.get('pnpm-lock.yaml') != LOCK: fail('lock drift')
    if list(repo.glob('.pnpmfile*')) or list(repo.glob('pnpmfile*')): fail('pnpmfile not in approved install scope')
    return files

def source_guard(repo, manifest):
    changes = []
    for name, digest in manifest.items():
        try: actual = SHA(safe_read(repo, name))
        except (OSError, RuntimeError): actual = None
        if actual != digest: changes.append(name)
    if changes: fail('source changed/unsafe: ' + repr(changes))
    allowed = {'apps/www/src/styles/proto-ui-tokens.generated.css',
               'apps/www/src/styles/shadcn-theme.css',
               'apps/www/src/styles/proto-ui-shadow-style.generated.js',
               'apps/www/src/styles/proto-ui-shadow-style.generated.d.ts',
               'apps/www/src/generated/cli-init.generated.json',
               'apps/www/src/generated/cli-init.generated.json.tmp'}
    for current, dirs, files in os.walk(repo, followlinks=False):
        for name in list(dirs):
            p = pathlib.Path(current)/name; rel = p.relative_to(repo).as_posix()
            if name in ['.git', 'node_modules'] or rel == 'apps/www/.astro':
                if p.is_symlink(): fail('unexpected top-level generated/dependency directory link: ' + rel)
                dirs.remove(name)
            elif p.is_symlink(): fail('unexpected source directory link: ' + rel)
        for name in files:
            rel = (pathlib.Path(current)/name).relative_to(repo).as_posix()
            if rel not in manifest and rel not in allowed: fail('unexpected generated source path: ' + rel)
            if rel not in manifest: safe_read(repo,rel)


def dependency_manifest(repo):
    # Walk without following symlink directories. Workspace links may point to source,
    # but every resolution must remain inside this dedicated subject checkout.
    records = {}; caches = []; root = repo.resolve()
    for current, dirs, files in os.walk(repo, followlinks=False):
        here = pathlib.Path(current)
        if here == repo: dirs[:] = [d for d in dirs if d != '.git']
        inside = 'node_modules' in here.relative_to(repo).parts
        for name in list(dirs):
            p = here / name
            if inside and name in ['.vite', '.vite-temp']:
                if p.is_symlink(): fail('cache must not be a symlink')
                caches.append(p.relative_to(repo).as_posix()); dirs.remove(name); continue
            if p.is_symlink():
                if inside or name == 'node_modules':
                    if not p.resolve().is_relative_to(root): fail('dependency link escape: ' + str(p))
                    records[p.relative_to(repo).as_posix()] = {'link': os.readlink(p)}
                dirs.remove(name)
        if not inside: continue
        for name in files:
            p = here / name; rel = p.relative_to(repo).as_posix(); st = p.lstat()
            if stat.S_ISLNK(st.st_mode):
                if not p.resolve().is_relative_to(root): fail('dependency link escape: ' + rel)
                records[rel] = {'link': os.readlink(p)}
            elif stat.S_ISREG(st.st_mode): records[rel] = {'sha256': SHA(safe_read(repo, rel))}
            else: fail('special dependency file: ' + rel)
    if len(records) < 1000: fail('full locked dependency closure missing')
    return records, sorted(set(caches))

def runtime_cache_manifest(root):
    result = {}
    for current, dirs, files in os.walk(root, followlinks=False):
        for name in list(dirs):
            p = pathlib.Path(current)/name
            if p.is_symlink(): fail('unexpected Corepack cache directory link')
        for name in files:
            p = pathlib.Path(current)/name; rel = p.relative_to(root).as_posix()
            if p.is_symlink(): fail('unexpected Corepack cache file link')
            result[rel] = SHA(safe_read(root, rel))
    if not result: fail('empty Corepack cache')
    return result

def run_logged(args, external, label, timeout=900):
    # External FDs opened before spawn, and this directory is never child-mounted.
    started = NOW(); timed_out = False
    with (external / (label + '.stdout')).open('xb') as out, (external / (label + '.stderr')).open('xb') as err:
        proc = subprocess.Popen(args, stdin=subprocess.DEVNULL, stdout=out, stderr=err,
                                env=ENV, start_new_session=True,
                                preexec_fn=lambda: resource.setrlimit(resource.RLIMIT_FSIZE, (128*1024*1024,128*1024*1024)))
        try: code = proc.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            timed_out = True
            os.killpg(proc.pid, signal.SIGTERM)
            try: code = proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(proc.pid, signal.SIGKILL); code = proc.wait()
    result = {'start': started, 'end': NOW(), 'exitCode': code, 'timeout': timed_out}
    write(external / (label + '.receipt.json'), result)
    return result

def sandbox(repo, out, runtime, network, extra_env, dependency_ro, config_dir=None):
    b = ['/usr/bin/bwrap', '--unshare-user', '--uid', str(os.getuid()), '--gid', str(os.getgid()),
         '--unshare-pid', '--unshare-ipc', '--unshare-uts', '--die-with-parent', '--new-session',
         '--cap-drop', 'ALL', '--ro-bind', '/usr', '/usr', '--symlink', 'usr/bin', '/bin',
         '--symlink', 'usr/sbin', '/sbin', '--symlink', 'usr/lib', '/lib', '--symlink', 'usr/lib64', '/lib64',
         '--ro-bind', str(runtime['node']), '/runtime/node', '--ro-bind', '/opt/google/chrome', '/opt/google/chrome',
         '--ro-bind', '/etc/ld.so.cache', '/etc/ld.so.cache', '--ro-bind', '/etc/fonts', '/etc/fonts',
         '--ro-bind', str(P), '/harness', '--bind', str(repo), '/work/repo',
         '--ro-bind', str(repo / '.git'), '/work/repo/.git', '--bind', str(out), '/out',
         '--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp', '--tmpfs', '/dev/shm',
         '--dir', '/home/test', '--dir', '/run', '--clearenv']
    if network:
        b += ['--ro-bind', '/etc/resolv.conf', '/etc/resolv.conf', '--ro-bind', '/etc/ssl/certs', '/etc/ssl/certs',
              '--bind', str(runtime['corepack']), '/cache/corepack', '--bind', str(runtime['store']), '/cache/pnpm']
    else:
        b += ['--unshare-net', '--ro-bind', str(runtime['corepack']), '/cache/corepack']
    if config_dir is not None:
        b += ['--bind', str(config_dir), '/control-config',
              '--ro-bind', str(P/'vitest.selection.ts'), '/control-config/vitest.selection.mts']
    for filename in ['hosts', 'nsswitch.conf', 'passwd', 'group']:
        source_name = 'nsswitch-acquisition.conf' if network and filename == 'nsswitch.conf' else filename
        b += ['--ro-bind', str(runtime['etc'] / source_name), '/etc/' + filename]
    if dependency_ro:
        # Individual workspace node_modules dirs plus root .pnpm store are immutable;
        # only dedicated Vite caches, prepared before mounting, remain writable.
        for modules in sorted(repo.glob('**/node_modules')):
            if modules.is_symlink() or 'node_modules' in modules.relative_to(repo).parts[:-1]: continue
            target = '/work/repo/' + modules.relative_to(repo).as_posix()
            b += ['--ro-bind', str(modules), target]
            for cache in ['.vite', '.vite-temp']:
                cp = modules / cache
                if cp.is_dir() and not cp.is_symlink(): b += ['--bind', str(cp), target + '/' + cache]
    values = {'PATH': '/runtime/node/bin:/usr/bin:/bin', 'HOME': '/home/test', 'TMPDIR': '/tmp', 'CI': '1',
              'COREPACK_HOME': '/cache/corepack', 'COREPACK_DEFAULT_TO_LATEST':'0',
              'COREPACK_ENABLE_AUTO_PIN':'0', 'COREPACK_ENABLE_DOWNLOAD_PROMPT':'0', 'COREPACK_ENABLE_NETWORK': '1' if network else '0',
              'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': '/dev/null', 'GIT_NO_LAZY_FETCH': '1',
              'ASTRO_TELEMETRY_DISABLED': '1', 'ASTRO_DISABLE_DEV_TOOLBAR': '1',
              'DEBUG':'pw:browser', 'CHROME_PATH': '/opt/google/chrome/chrome', 'NODE_OPTIONS': '--max-old-space-size=6144'}
    values.update(extra_env)
    for key, value in values.items(): b += ['--setenv', key, value]
    return b + ['--chdir', '/work/repo', '--', '/usr/bin/setpriv', '--no-new-privs', '--']

def admit_outputs(source, destination, total_cap=512*1024*1024):
    destination.mkdir(exist_ok=False); used = 0; manifest = {}
    for current, dirs, files in os.walk(source, followlinks=False):
        for name in dirs:
            if not stat.S_ISDIR((pathlib.Path(current)/name).lstat().st_mode): fail('output directory link/special')
        for name in files:
            rel = (pathlib.Path(current)/name).relative_to(source).as_posix()
            if pathlib.Path(rel).suffix not in ['.json', '.png', '.txt', '.log']: fail('unexpected output extension: ' + rel)
            data = safe_read(source, rel); used += len(data)
            if used > total_cap: fail('total output cap')
            target = destination / rel; target.parent.mkdir(parents=True, exist_ok=True)
            with target.open('xb') as f: f.write(data)
            manifest[rel] = {'bytes': len(data), 'sha256': SHA(data)}
    return manifest

def main():
    global EXTERNAL
    a = argparse.ArgumentParser(); a.add_argument('--workspace', required=True); a.add_argument('--output', required=True)
    a.add_argument('--node', required=True); a.add_argument('--carrier', required=True); args = a.parse_args()
    if not re.fullmatch('[0-9a-f]{40}', args.carrier): fail('invalid carrier SHA')
    if os.getuid() == 0: fail('hosted test must be non-root')
    ws = pathlib.Path(args.workspace).resolve(); output = pathlib.Path(args.output)
    output.mkdir(exist_ok=False); external = output/'admitted'; external.mkdir(); private = output/'private'; private.mkdir(); EXTERNAL = external
    # No wholesale environment dump: only these public image labels.
    write(external/'invocation.json', {'at': NOW(), 'carrier': args.carrier, 'overlay': OVERLAY,
          'runnerSha256': SHA(pathlib.Path(__file__).read_bytes()), 'scopeSha256': SHA((P/'scope.json').read_bytes()),
          'imageOS': os.environ.get('ImageOS'), 'imageVersion': os.environ.get('ImageVersion'), 'nativeExpected': 8})
    node = pathlib.Path(args.node).resolve().parent.parent
    node_actual = command([str(node/'bin/node'), '--version'])
    chrome_actual = command(['/opt/google/chrome/chrome', '--version'])
    # Keep the original merged observations and comparisons unchanged. Separate
    # stdout/stderr are a second fixed --version invocation, not falsely relabeled
    # as streams from the first invocation; neither runs browser journeys.
    version_details = {}
    for label, argv in [('node', [str(node/'bin/node'), '--version']),
                        ('chrome', ['/opt/google/chrome/chrome', '--version'])]:
        observed = subprocess.run(argv, env=ENV, stdin=subprocess.DEVNULL,
                                  stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                  timeout=10, check=False)
        version_details[label] = {'returnCode': observed.returncode,
              'stdout': observed.stdout.decode('utf-8', errors='replace')[:8192],
              'stderr': observed.stderr.decode('utf-8', errors='replace')[:8192],
              'truncated': len(observed.stdout)>8192 or len(observed.stderr)>8192}
    write(external/'version-preflight.json', {
          'originalMergedNode':node_actual, 'originalMergedChrome':chrome_actual,
          'expectedNode':'v'+S['nodeVersion'], 'expectedChrome':'Google Chrome '+S['chromeVersion'],
          'separateSecondInvocation':version_details,
          'nodeSha256':SHA((node/'bin/node').read_bytes()),
          'chromeSha256':SHA(pathlib.Path('/opt/google/chrome/chrome').read_bytes())})
    if node_actual != 'v' + S['nodeVersion']: fail('Node version drift')
    if chrome_actual != 'Google Chrome ' + S['chromeVersion']: fail('Chrome image version drift; no update fallback')
    for pkg in S['aptPackages']:
        if command(['dpkg-query', '-W', '-f=${Version}', pkg['name']]) != pkg['version']: fail('OS package version drift')
    if not pathlib.Path('/usr/bin/bwrap').is_file(): fail('bubblewrap missing')
    runtime = {'node': node, 'corepack': private/'corepack', 'store': private/'pnpm-store', 'etc': private/'etc'}
    for name in ['corepack', 'store', 'etc']: runtime[name].mkdir()
    for name, value in {'hosts':'127.0.0.1 localhost\n::1 localhost\n', 'nsswitch.conf':'hosts: files\npasswd: files\ngroup: files\n',
                        'nsswitch-acquisition.conf':'hosts: files dns\npasswd: files\ngroup: files\n',
                        'passwd':f'test:x:{os.getuid()}:{os.getgid()}:test:/home/test:/bin/sh\n',
                        'group':f'test:x:{os.getgid()}:\n'}.items(): (runtime['etc']/name).write_text(value)
    write(external/'system-fonts.json', {str(p.relative_to('/usr/share/fonts')):SHA(p.read_bytes())
          for p in pathlib.Path('/usr/share/fonts').rglob('*') if p.is_file() and not p.is_symlink()})
    summaries = []; prepared = {}; pinned_cache = None
    for role, subject in zip(['baseline', 'candidate'], S['subjects']):
        repo = ws/role; original = source_files(repo, subject)
        for f in S['overlayFiles']:
            data = safe_read(ws/'carrier', f['path'])
            if SHA(data) != f['afterSha256']: fail('overlay bytes drift')
            target = repo/f['path']; target.parent.mkdir(parents=True, exist_ok=True)
            if target.exists() and target.is_symlink(): fail('overlay target link')
            target.write_bytes(data); original[f['path']] = f['afterSha256']
        out = private/(role+'-install'); out.mkdir(); receipts = external/(role+'-install'); receipts.mkdir()
        acquisition = sandbox(repo, out, runtime, True, {}, False)
        version_command = acquisition + ['/runtime/node/bin/corepack', 'pnpm@10.32.1', '--version']
        version_before = run_logged(version_command, receipts, 'pnpm-before', 180)
        actual_before = safe_read(receipts, 'pnpm-before.stdout').decode().strip()
        if version_before['exitCode'] or version_before['timeout'] or actual_before != S['pnpmVersion']:
            fail('actual pnpm before install does not match fixed version')
        source_guard(repo, original)
        cache_before = runtime_cache_manifest(runtime['corepack'])
        if pinned_cache is not None and cache_before != pinned_cache: fail('Corepack cache changed between subjects')
        pinned_cache = cache_before
        install = acquisition + ['/runtime/node/bin/corepack', 'pnpm@10.32.1', 'install',
                    '--frozen-lockfile', '--ignore-scripts', '--ignore-pnpmfile', '--verify-store-integrity=true', '--store-dir=/cache/pnpm']
        result = run_logged(install, receipts, 'install', timeout=900)
        source_guard(repo, original)
        if result['exitCode'] or result['timeout']: fail('locked install failed; no postinstall/rebuild fallback')
        version_after = run_logged(version_command, receipts, 'pnpm-after', 60)
        actual_after = safe_read(receipts, 'pnpm-after.stdout').decode().strip()
        if version_after['exitCode'] or version_after['timeout'] or actual_after != S['pnpmVersion']:
            fail('actual pnpm after install does not match fixed version')
        source_guard(repo, original)
        if runtime_cache_manifest(runtime['corepack']) != pinned_cache: fail('Corepack cache drift during install')
        write(receipts/'corepack-cache.json', pinned_cache)
        for modules in sorted(repo.glob('**/node_modules')):
            if modules.is_symlink() or 'node_modules' in modules.relative_to(repo).parts[:-1]: continue
            for name in ['.vite', '.vite-temp']: (modules/name).mkdir(exist_ok=True)
        deps, _ = dependency_manifest(repo)
        write(receipts/'source-manifest.json', original); write(receipts/'dependency-manifest.json', deps)
        write(receipts/'versions.json', {'Node':node_actual,'pnpmBefore':actual_before,'pnpmAfter':actual_after,'Chrome':chrome_actual,
              'nodeBinarySha256':SHA((node/'bin/node').read_bytes()),'chromeBinarySha256':SHA(pathlib.Path('/opt/google/chrome/chrome').read_bytes()),
              'bwrapBinarySha256':SHA(pathlib.Path('/usr/bin/bwrap').read_bytes()), 'lockSha256':LOCK})
        prepared[role] = (repo, subject, original, deps)
    write(external/'corepack-cache.json', pinned_cache)
    # Sequential fresh source+dependency copies preserve one VM/runtime but no app cache between phases.
    for role, mode in [('baseline','control'), ('candidate','control'), ('baseline','trace'), ('candidate','trace')]:
        original_repo, subject, source, deps = prepared[role]
        label = role+'-'+mode; phase = private/label; phase.mkdir(); repo = phase/'repo'; out = phase/'out'; out.mkdir()
        shutil.copytree(original_repo, repo, symlinks=True)
        evidence = external/label; evidence.mkdir()
        config_dir = phase/'control-config'; config_dir.mkdir()
        (config_dir/'vitest.selection.mts').write_bytes((P/'vitest.selection.ts').read_bytes())
        source_guard(repo, source)
        current_deps, _ = dependency_manifest(repo)
        if current_deps != deps: fail('copied dependency manifest mismatch')
        env = {'PROTO_UI_HEADER_SIZE_DIAGNOSTIC':mode, 'PROTO_UI_HEADER_SELECT_APPEARANCE':'family',
               'PROTO_UI_HEADER_SELECT_SUBJECT_SHA':subject['commit'], 'CANDIDATE_SHA':args.carrier,
               'GITHUB_SHA':args.carrier, 'PROTO_UI_HEADER_SELECT_EVIDENCE_DIR':'/out'}
        base = sandbox(repo, out, runtime, False, env, True, config_dir)
        probe = run_logged(base+['/usr/bin/python3','/harness/probe.py'], evidence, 'sandbox-probe', 30)
        if probe['exitCode'] or probe['timeout']: fail('sandbox unsupported; no security fallback')
        raw_probe = safe_read(evidence, 'sandbox-probe.stdout'); facts = json.loads(raw_probe)
        host_ns = {n: os.readlink('/proc/self/ns/'+n) for n in ['pid','net','mnt','ipc','user']}
        if any(facts['namespaceIds'][n] == host_ns[n] for n in host_ns): fail('namespace not private')
        common = ['--config','/control-config/vitest.selection.mts', TEST, '-t', S['pattern']]
        collect = run_logged(base+['/runtime/node/bin/node','node_modules/vitest/vitest.mjs','list',*common,'--json=/out/collected.json'], evidence, 'collect', 90)
        if collect['exitCode'] or collect['timeout']: fail('collection blocked')
        selection = json.loads(safe_read(out,'collected.json'))
        expected_names = {f'Header public family presentation and labelled compact fields shadcn/wc/{theme}: candidate-acceptance; source-bound rest, hover, native focus, popup and compact reparenting' for theme in ['light','dark']}
        if not isinstance(selection,list) or len(selection)!=2: fail('collection must be exactly2')
        collected_names = {name.replace('fields shadcn/', 'fields > shadcn/', 1) for name in expected_names}
        if {x.get('name') for x in selection} != collected_names: fail('unexpected collected full names')
        if any(x.get('file') != '/work/repo/'+TEST for x in selection): fail('unexpected collected file')
        source_guard(repo, source)
        run = run_logged(base+['/runtime/node/bin/node','node_modules/vitest/vitest.mjs','run',*common,'--reporter=json','--outputFile=/out/vitest.json'], evidence, 'native', 600)
        source_guard(repo, source)
        after, _ = dependency_manifest(repo)
        if after != deps: fail('dependency drift')
        if runtime_cache_manifest(runtime['corepack']) != pinned_cache: fail('Corepack cache drift during native phase')
        artifact_manifest = admit_outputs(out, evidence/'page-artifacts')
        # Preserve failed/missing report as an execution failure, never substitute expected totals.
        actual = {'reportAvailable': False}
        if 'vitest.json' in artifact_manifest:
            report = json.loads(safe_read(evidence/'page-artifacts','vitest.json'))
            records = [item for f in report.get('testResults',[]) for item in f.get('assertionResults',[])]
            selected = [x for x in records if x.get('fullName') in expected_names]
            unexpected = [x for x in records if x.get('status') in ['passed','failed'] and x.get('fullName') not in expected_names]
            if unexpected: fail('out-of-scope executed tests')
            actual = {'reportAvailable': True, 'selectedRecords':len(selected),
                      'passed':sum(x.get('status')=='passed' for x in selected),
                      'failed':sum(x.get('status')=='failed' for x in selected),
                      'other':sum(x.get('status') not in ['passed','failed'] for x in selected),
                      'unselectedRecords':len(records)-len(selected),
                      'selectedFullNames':[x.get('fullName') for x in selected],
                      'uniqueExpectedNames':len({x.get('fullName') for x in selected})==2 and {x.get('fullName') for x in selected}==expected_names,
                      'executedFiles':[f.get('name') for f in report.get('testResults',[]) if any(x.get('status') in ['passed','failed'] for x in f.get('assertionResults',[]))]}
        receipt = {'role':role,'mode':mode,'subject':subject,'overlay':OVERLAY,'intentionalDirty':S['overlayFiles'],
                   'carrier':args.carrier,'exactCollected':selection,'native':run,'actual':actual,
                   'artifacts':artifact_manifest,'sourceChanges':[],'dependencyChanges':[],
                   'controlCaveat':'Trace is observation and may perturb timing; not a product repair.'}
        write(evidence/'phase.json',receipt); summaries.append(receipt)
        # Child process has terminated; all retained evidence admitted. Free only this owned temporary copy.
        shutil.rmtree(repo)
    write(external/'summary.json',{'at':NOW(),'phases':summaries,'expectedJourneys':8,'mergeReady':False})
    return 0 if len(summaries)==4 and all(
        x['native']['exitCode']==0 and not x['native']['timeout'] and
        x['actual'].get('selectedRecords')==2 and x['actual'].get('passed')==2 and
        x['actual'].get('failed')==0 and x['actual'].get('other')==0 and
        x['actual'].get('uniqueExpectedNames') is True and
        x['actual'].get('executedFiles')==['/work/repo/'+TEST]
        for x in summaries) else 1

if __name__ == '__main__':
    try: sys.exit(main())
    except Exception as error:
        # Trusted controller errors only; don't dump environment or arbitrary object representations.
        message = type(error).__name__+': '+str(error)[:4000]
        if EXTERNAL is not None:
            write(EXTERNAL/'blocked.json', {'at':NOW(),'status':'BLOCKED_OR_FAILED','reason':message,'noSecurityFallback':True})
        print('BLOCKED_OR_FAILED: '+message, file=sys.stderr)
        sys.exit(2)
