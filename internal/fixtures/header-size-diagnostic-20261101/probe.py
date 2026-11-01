"""Trusted system-only namespace probe. No repository/package imports."""
import json, os, socket, pathlib, threading
interfaces = [name for _, name in socket.if_nameindex()]
assert interfaces == ['lo'], interfaces
routes = pathlib.Path('/proc/net/route').read_text().splitlines()[1:]
assert not routes, routes
assert os.getuid() != 0
status = pathlib.Path('/proc/self/status').read_text()
assert 'NoNewPrivs:\t1' in status
assert int(next(x.split()[1] for x in status.splitlines() if x.startswith('CapEff:')), 16) == 0
pids = sorted(x.name for x in pathlib.Path('/proc').iterdir() if x.name.isdigit())
assert len(pids) <= 4, pids
for p in ['/home/runner', '/run/docker.sock', '/var/run/docker.sock', '/external', '/github']:
    assert not pathlib.Path(p).exists(), p
for key in os.environ:
    assert not any(word in key for word in ['TOKEN', 'SECRET', 'PASSWORD', 'CREDENTIAL', 'ACTIONS_']), key
server = socket.socket(); server.bind(('127.0.0.1', 0)); server.listen(1)
port = server.getsockname()[1]
def echo():
    c, _ = server.accept()
    with c: c.sendall(c.recv(4))
t = threading.Thread(target=echo); t.start()
with socket.create_connection(('127.0.0.1', port), timeout=5) as c:
    c.sendall(b'ping'); assert c.recv(4) == b'ping'
t.join(5); assert not t.is_alive(); server.close()
print(json.dumps({'interfaces': interfaces, 'routes': routes, 'pids': pids,
                  'uid': os.getuid(), 'noNewPrivs': True, 'capEff': 0,
                  'privateLoopbackEcho': True, 'envKeys': sorted(os.environ),
                  'namespaceIds': {n: os.readlink('/proc/self/ns/' + n) for n in ['pid', 'net', 'mnt', 'ipc', 'user']}}))
