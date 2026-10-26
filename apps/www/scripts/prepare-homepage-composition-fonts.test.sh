#!/usr/bin/env bash
# Local PATH mocks only. No network, package install, root writes, or new tools.
# This tests control flow and real charset parsing, NOT package authenticity or
# a browser's actual rendered font. Official CI remains required for those.
set -euo pipefail
proposal="${1:-$(dirname "$0")/prepare-homepage-composition-fonts.sh}"
root="$(mktemp -d /tmp/font-prep-mocks.XXXXXX)"
mkdir -p "$root/bin" "$root/cache"
printf 'mock font file, not executable\n' > "$root/mock-font.ttc"
truncate -s 61229778 "$root/cache/fonts-noto-cjk_20230817+repack1-3_all.deb"
cat > "$root/bin/dispatcher" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
case "${0##*/}" in
  sha256sum)
    [[ "$*" == '--check --strict -' ]]
    IFS= read -r supplied
    expected="7d64b985f6fe128c99eae5610d5c047338e572bdcfb2bb09736be01b824a7f6c  $FONT_CACHE_DIR/fonts-noto-cjk_20230817+repack1-3_all.deb"
    [[ "$supplied" == "$expected" ]]
    [[ "$MOCK_SCENARIO" != bad-sha ]]
    ;;
  dpkg-deb)
    [[ "$1" == --field ]]
    case "$3" in
      Package) echo fonts-noto-cjk ;;
      Version) if [[ "$MOCK_SCENARIO" == bad-version ]]; then echo 0:wrong; else echo 1:20230817+repack1-3; fi ;;
      Architecture) echo all ;;
      *) exit 91 ;;
    esac
    ;;
  sudo)
    [[ "$1 $2" == 'dpkg --install' && "$3" == "$FONT_CACHE_DIR/fonts-noto-cjk_20230817+repack1-3_all.deb" ]]
    echo 'mock-install-only' >> "$MOCK_ACTIONS"
    ;;
  fc-cache) [[ "$*" == -f ]] ;;
  fc-match)
    [[ "$1" == -f && "$3" == 'sans-serif:lang=zh-cn' ]]
    case "$2" in
      '%{file}') printf '%s' "$MOCK_FONT" ;;
      '%{family}') if [[ "$MOCK_SCENARIO" == wrong-family ]]; then printf 'DejaVu Sans'; else printf 'Noto Sans CJK SC'; fi ;;
      '%{index}') printf 2 ;;
      *) exit 92 ;;
    esac
    ;;
  dpkg-query)
    if [[ "$1" == -L ]]; then
      printf '%s\n' "$MOCK_FONT"
    elif [[ "$2" == '-f=${Status}\n${Version}\n' ]]; then
      printf 'install ok installed\n1:20230817+repack1-3\n'
    else
      printf 'fonts-noto-cjk 1:20230817+repack1-3\nfontconfig mock\n'
    fi
    ;;
  fc-query)
    [[ "$1 $2 $3" == '--index 2 --format' && "$5" == "$MOCK_FONT" ]]
    if [[ "$MOCK_SCENARIO" == missing-glyphs ]]; then echo '20-7e'; else echo '20-7e 4e00-9fff'; fi
    ;;
  curl) echo 'ERROR: cached mock unexpectedly attempted network' >&2; exit 93 ;;
  *) exit 94 ;;
esac
SH
chmod +x "$root/bin/dispatcher"
for command in sha256sum dpkg-deb sudo fc-cache fc-match dpkg-query fc-query curl; do
  ln -s dispatcher "$root/bin/$command"
done
export FONT_CACHE_DIR="$root/cache" MOCK_FONT="$root/mock-font.ttc" PATH="$root/bin:$PATH"

for scenario in success bad-sha bad-version wrong-family missing-glyphs; do
  mkdir -p "$root/$scenario"
  export RUNNER_TEMP="$root/$scenario" MOCK_SCENARIO="$scenario" MOCK_ACTIONS="$root/$scenario/actions.txt"
  set +e
  # Drain the helper's tee process before inspecting diagnostics. pipefail
  # preserves the helper exit status; this does not turn a rejection into success.
  bash "$proposal" 2>&1 | cat > "$root/$scenario/result.txt"
  status=$?
  set -e
  case "$scenario" in
    success)
      [[ "$status" == 0 ]]
      grep -F 'Verified every representative Chinese glyph:' "$root/$scenario/result.txt" >/dev/null
      grep -F 'version=1:20230817+repack1-3' "$root/$scenario/homepage-evidence/font-environment.txt" >/dev/null
      ;;
    bad-sha|bad-version)
      [[ "$status" != 0 && ! -e "$MOCK_ACTIONS" ]]
      grep -F 'Cached Ubuntu font package failed immutable identity verification' "$root/$scenario/result.txt" >/dev/null
      ;;
    wrong-family)
      [[ "$status" != 0 ]]
      grep -F 'Chinese fallback is not Noto Sans CJK SC' "$root/$scenario/result.txt" >/dev/null
      ;;
    missing-glyphs)
      [[ "$status" != 0 ]]
      grep -F 'Selected Noto face lacks required representative Chinese glyphs' "$root/$scenario/result.txt" >/dev/null
      ;;
  esac
  printf 'PASS: %s (exit %s)\n' "$scenario" "$status"
done
printf 'Mock evidence: %s\n' "$root"
