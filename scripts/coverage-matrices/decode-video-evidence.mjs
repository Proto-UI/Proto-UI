// Real decode, not container-signature acceptance. Resource limits are validator
// constraints, not behavioral proof. See README.md for the supported toolchain.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export const VIDEO_EVIDENCE_LIMITS = Object.freeze({
  bytes: 32 * 1024 * 1024,
  pixels: 4 * 1024 * 1024,
  frames: 1200,
  seconds: 60,
  timeoutMs: 15000,
});
function readBounded(file, LIMITS) {
  const fd = fs.openSync(file, 'r');
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > LIMITS.bytes) throw new Error('input bound');
    const data = Buffer.alloc(stat.size + 1);
    let size = 0;
    while (size < data.length) {
      const count = fs.readSync(fd, data, size, data.length - size, null);
      if (!count) break;
      size += count;
    }
    if (size > stat.size) throw new Error('input changed');
    return data.subarray(0, size);
  } finally {
    fs.closeSync(fd);
  }
}
function run(tool, args, data, LIMITS) {
  const result = spawnSync(
    '/usr/bin/python3',
    [
      '-I',
      fileURLToPath(new URL('./with-sealed-video-input.py', import.meta.url)),
      `/usr/bin/${tool}`,
      ...args,
    ],
    {
      input: data,
      encoding: 'utf8',
      timeout: LIMITS.timeoutMs,
      maxBuffer: 256 * 1024,
      env: { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C' },
      windowsHide: true,
    }
  );
  if (result.error || result.status !== 0 || result.stderr.trim())
    throw new Error(
      `${tool} failed: ${(result.error?.code ?? result.stderr ?? result.status).toString().slice(0, 300)}`
    );
  return result.stdout;
}
export function decodeVideoEvidence(file, overrides = {}) {
  if (process.platform !== 'linux')
    throw new Error('video decoder unverified: supported Linux toolchain is unavailable');
  const LIMITS = { ...VIDEO_EVIDENCE_LIMITS, ...overrides };
  const data = readBounded(file, LIMITS);
  const format = /\.(mp4|mov)$/i.test(file)
    ? 'mov'
    : /\.(mkv|webm)$/i.test(file)
      ? 'matroska'
      : null;
  if (!format) throw new Error('unsupported container');
  // Sealed seekable memfd preserves MOV/MP4 layouts while fd-only input forbids nested file/network reads.
  const input = [
    '-protocol_whitelist',
    'fd',
    '-threads',
    '1',
    '-max_pixels',
    String(LIMITS.pixels),
    '-f',
    format,
    '-i',
    'fd:',
  ];
  const info = JSON.parse(
    run(
      'ffprobe',
      [
        '-v',
        'error',
        ...input,
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=codec_type,width,height:format=duration',
        '-of',
        'json',
      ],
      data,
      LIMITS
    )
  );
  const video = info.streams?.[0];
  const seconds = Number(info.format?.duration);
  if (
    !video ||
    video.codec_type !== 'video' ||
    !Number.isSafeInteger(video.width) ||
    !Number.isSafeInteger(video.height) ||
    video.width <= 0 ||
    video.height <= 0 ||
    video.width * video.height > LIMITS.pixels ||
    !Number.isFinite(seconds) ||
    seconds <= 0 ||
    seconds > LIMITS.seconds
  )
    throw new Error('video metadata bounds');
  const output = run(
    'ffmpeg',
    [
      '-nostdin',
      '-v',
      'error',
      '-xerror',
      '-err_detect',
      'explode',
      ...input,
      '-map',
      '0:v:0',
      '-an',
      '-sn',
      '-dn',
      '-frames:v',
      String(LIMITS.frames + 1),
      '-c:v',
      'rawvideo',
      '-threads',
      '1',
      '-pix_fmt',
      'rgba',
      '-f',
      'framehash',
      '-hash',
      'sha256',
      'pipe:1',
    ],
    data,
    LIMITS
  );
  const rows = output
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => line.split(',').map((v) => v.trim()));
  if (rows.length < 2 || rows.length > LIMITS.frames) throw new Error('decoded frame-count bound');
  const timeBase = output.match(/^#tb 0: ([1-9][0-9]*)\/([1-9][0-9]*)$/m);
  if (!timeBase) throw new Error('missing decoded time base');
  const tick = Number(timeBase[1]) / Number(timeBase[2]);
  let first = Infinity;
  let last = -Infinity;
  const hashes = new Set();
  for (const row of rows) {
    if (
      row.length !== 6 ||
      row[0] !== '0' ||
      Number(row[4]) !== video.width * video.height * 4 ||
      !/^[a-f0-9]{64}$/.test(row[5])
    )
      throw new Error('invalid decoded frame receipt');
    const pts = Number(row[2]),
      duration = Number(row[3]);
    if (!Number.isSafeInteger(pts) || !Number.isSafeInteger(duration) || duration < 0)
      throw new Error('invalid decoded frame timing');
    first = Math.min(first, pts);
    last = Math.max(last, pts + duration);
    hashes.add(row[5]);
  }
  if (!Number.isFinite(tick) || tick <= 0 || (last - first) * tick > LIMITS.seconds)
    throw new Error('decoded duration bound');
  if (hashes.size < 2) throw new Error('no decoded visual transition');
  return {
    width: video.width,
    height: video.height,
    seconds,
    frames: rows.length,
    distinctPixels: hashes.size,
  };
}
