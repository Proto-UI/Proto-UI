#!/usr/bin/env bash
# Homepage-composition-only exact official Ubuntu font preparation.
# Official package checksum:
# https://packages.ubuntu.com/noble/all/fonts-noto-cjk/download
# Invoke inside the existing 5-minute font/dependency preparation step.
# This helper does not install JS dependencies or grant a fresh overall budget.
# Restore/cache ONLY FONT_CACHE_DIR/fonts-noto-cjk_20230817+repack1-3_all.deb.
set -euo pipefail

readonly PACKAGE='fonts-noto-cjk'
readonly VERSION='1:20230817+repack1-3'
readonly FILENAME='fonts-noto-cjk_20230817+repack1-3_all.deb'
readonly SHA256='7d64b985f6fe128c99eae5610d5c047338e572bdcfb2bb09736be01b824a7f6c'
readonly SIZE='61229778'
readonly RELATIVE_URL="pool/main/f/fonts-noto-cjk/$FILENAME"
readonly CACHE_DIR="${FONT_CACHE_DIR:-${RUNNER_TEMP:?RUNNER_TEMP is required}/homepage-font-cache}"
readonly EVIDENCE_DIR="${FONT_EVIDENCE_DIR:-$RUNNER_TEMP/homepage-evidence}"
readonly DEB="$CACHE_DIR/$FILENAME"

mkdir -p "$EVIDENCE_DIR"
exec > >(tee -a "$EVIDENCE_DIR/font-preparation.log") 2>&1
echo 'Font helper runs inside the unchanged 300s font/dependency preparation step.'
[[ ! -L "$CACHE_DIR" ]] || { echo 'Refusing symlink cache directory'; exit 1; }
mkdir -p "$CACHE_DIR"
partial=''
cleanup() { if [[ -n "$partial" && -f "$partial" ]]; then rm -f -- "$partial"; fi; }
trap cleanup EXIT

fail() { echo "BLOCKED: $*" >&2; exit 1; }
bounded() {
  local cap="$1"
  shift
  timeout --signal=TERM --kill-after=5s "${cap}s" "$@"
}
verify_deb() {
  local file="$1"
  [[ -f "$file" && ! -L "$file" ]] || return 1
  [[ "$(stat -c %s -- "$file")" == "$SIZE" ]] || return 1
  printf '%s  %s\n' "$SHA256" "$file" | bounded 10 sha256sum --check --strict - || return 1
  [[ "$(bounded 10 dpkg-deb --field "$file" Package)" == "$PACKAGE" ]] || return 1
  [[ "$(bounded 10 dpkg-deb --field "$file" Version)" == "$VERSION" ]] || return 1
  [[ "$(bounded 10 dpkg-deb --field "$file" Architecture)" == 'all' ]] || return 1
}

# Inspect a cached file exactly as rigorously as a fresh download. A poisoned or
# truncated cache fails closed, before dpkg, font tools, dependencies, or tests.
# Do not automatically overwrite an immutable remote cache entry with bad data.
if [[ -e "$DEB" || -L "$DEB" ]]; then
  verify_deb "$DEB" || fail 'Cached Ubuntu font package failed immutable identity verification'
  origin='verified-cache'
else
  # Do not change APT sources or select a third-party mirror. These two origins
  # are the official runner-image mirror list, with the healthy fallback first.
  # Only use an origin actually present in THIS runner's original mirror list.
  [[ -r /etc/apt/apt-mirrors.txt ]] || fail 'Runner official mirror list is missing'
  for base in 'https://archive.ubuntu.com/ubuntu/' 'http://azure.archive.ubuntu.com/ubuntu/'; do
    if ! awk -v base="$base" '$1 == base { found = 1 } END { exit !found }' /etc/apt/apt-mirrors.txt; then
      echo "Not configured in runner mirror list, skipped: $base"
      continue
    fi
    partial="$(mktemp "$CACHE_DIR/.font-download.XXXXXX")"
    echo "Downloading exact Ubuntu package from $base (connect <=10s, transfer <=60s)."
    # No -L: redirecting to another origin is not silently authorized. No curl
    # retry loop: each of the two original origins receives one bounded attempt.
    # SHA256 protects package bytes even on the runner's original HTTP origin.
    if bounded 65 curl --fail --silent --show-error \
      --connect-timeout 10 --max-time 60 --speed-time 15 --speed-limit 65536 \
      --output "$partial" "$base$RELATIVE_URL"; then
      # A successful HTTP result with incorrect bytes is an integrity error,
      # not a reason to silently continue to another mirror.
      verify_deb "$partial" || fail 'Downloaded Ubuntu package failed immutable identity verification'
      mv -- "$partial" "$DEB"
      partial=''
      origin="$base"
      break
    fi
    echo "Bounded download failed: $base; no partial bytes will be installed or cached."
    rm -f -- "$partial"
    partial=''
  done
  [[ -f "$DEB" ]] || fail 'Both configured official download attempts failed within the existing budget'
fi

# fontconfig is already supplied by the hosted runner. Stop explicitly rather
# than silently installing unrelated packages or modifying global APT sources.
for tool in fc-cache fc-match fc-query dpkg-query node; do
  command -v "$tool" >/dev/null || fail "Required runner tool is absent: $tool"
done
bounded 45 sudo dpkg --install "$DEB"
[[ "$(bounded 10 dpkg-query -W -f='${Status}\n${Version}\n' "$PACKAGE")" == $'install ok installed\n'"$VERSION" ]] ||
  fail 'Installed Ubuntu font package status/version is not exact'
bounded 25 fc-cache -f

# fc-match alone always returns the nearest available font. Check the actual
# selected file AND exact face's charset so generic fallback cannot pass.
font_file="$(bounded 10 fc-match -f '%{file}' 'sans-serif:lang=zh-cn')"
font_family="$(bounded 10 fc-match -f '%{family}' 'sans-serif:lang=zh-cn')"
font_index="$(bounded 10 fc-match -f '%{index}' 'sans-serif:lang=zh-cn')"
[[ -f "$font_file" ]] || fail 'Chinese font match is not a readable font file'
[[ "$font_family" == *'Noto Sans CJK SC'* ]] || fail "Chinese fallback is not Noto Sans CJK SC: $font_family"
[[ "$font_index" =~ ^[0-9]+$ ]] || fail 'Chinese font face index is invalid'
bounded 10 dpkg-query -L "$PACKAGE" | grep -F -x -- "$font_file" >/dev/null ||
  fail 'Selected font file does not belong to the verified Ubuntu package'
bounded 10 fc-query --index "$font_index" --format '%{charset}\n' "$font_file" \
  > "$EVIDENCE_DIR/chinese-font-charset.txt"
bounded 10 node --input-type=module - "$EVIDENCE_DIR/chinese-font-charset.txt" <<'JS'
import assert from 'node:assert/strict';
import fs from 'node:fs';
const raw = fs.readFileSync(process.argv[2], 'utf8').trim();
assert.ok(raw, 'Selected face charset is empty');
const ranges = raw.split(/\s+/).map(token => {
  assert.match(token, /^[0-9a-f]+(?:-[0-9a-f]+)?$/i, 'Invalid font charset token');
  const [start, finish = start] = token.split('-').map(value => parseInt(value, 16));
  assert.ok(start <= finish && finish <= 0x10ffff, 'Invalid font charset range');
  return [start, finish];
});
const sample = '中文组件按钮设置搜索复制原型界面';
const missing = [...new Set(sample)].filter(character => {
  const point = character.codePointAt(0);
  return !ranges.some(([start, end]) => start <= point && point <= end);
});
assert.deepEqual(missing, [], 'Selected Noto face lacks required representative Chinese glyphs');
console.log(`Verified every representative Chinese glyph: ${sample}`);
JS

{
  printf 'package=%s\nversion=%s\nsha256=%s\nsize=%s\norigin=%s\n' "$PACKAGE" "$VERSION" "$SHA256" "$SIZE" "$origin"
  printf 'font_family=%s\nfont_file=%s\nfont_index=%s\n' "$font_family" "$font_file" "$font_index"
  bounded 10 dpkg-query -W -f='${Package} ${Version}\n' fonts-noto-cjk fontconfig
  printf 'font_verified_at=%s\n' "$(date -u +%FT%TZ)"
} > "$EVIDENCE_DIR/font-environment.txt"

echo 'Exact Ubuntu CJK package, installed status, selected face, and representative glyph coverage verified.'
