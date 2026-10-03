"""Run only the media decoder with bounded, sealed, seekable Linux input."""

import fcntl
import os
import resource
import sys

if sys.platform != 'linux' or len(sys.argv) < 2 or sys.argv[1] not in ('/usr/bin/ffmpeg', '/usr/bin/ffprobe'):
    raise SystemExit('unsupported bounded decoder toolchain')
resource.setrlimit(resource.RLIMIT_AS, (1024 * 1024 * 1024,) * 2)
resource.setrlimit(resource.RLIMIT_CPU, (20, 20))
# Input is already bounded by the Node caller; enforce the same limit here.
data = sys.stdin.buffer.read(32 * 1024 * 1024 + 1)
if len(data) > 32 * 1024 * 1024:
    raise SystemExit('input byte bound')
fd = os.memfd_create('coverage-video-evidence', os.MFD_ALLOW_SEALING | os.MFD_CLOEXEC)
view = memoryview(data)
while view:
    written = os.write(fd, view)
    if not written:
        raise SystemExit('short immutable-input write')
    view = view[written:]
# Linux UAPI: include/uapi/linux/fcntl.h, F_LINUX_SPECIFIC_BASE + 9;
# prevent write, growth, shrinking, and changes to the seal set.
fcntl.fcntl(fd, getattr(fcntl, 'F_ADD_SEALS', 1033), 0x0001 | 0x0002 | 0x0004 | 0x0008)
os.lseek(fd, 0, os.SEEK_SET)
# fd: defaults to stdin for input. Inherit the sealed seekable object as fd 0;
# no decoder-version-specific descriptor option or filename is needed.
if fd != 0:
    os.dup2(fd, 0, inheritable=True)
    os.close(fd)
else:
    os.set_inheritable(0, True)
args = sys.argv[1:]
os.execv(args[0], args)
