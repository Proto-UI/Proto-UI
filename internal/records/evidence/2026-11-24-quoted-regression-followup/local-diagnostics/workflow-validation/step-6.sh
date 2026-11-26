set -uo pipefail
set +e
corepack pnpm@10.32.1 exec vitest run --no-file-parallelism \
  apps/www/src/content/docs/zh-cn/contents-wheel-evidence.browser.test.ts \
  --reporter=default --reporter=json \
  --outputFile="$CONTENTS_WHEEL_EVIDENCE_DIR/controls-vitest.json" \
  2>&1 | tee "$CONTENTS_WHEEL_EVIDENCE_DIR/controls.log"
results=("${PIPESTATUS[@]}")
printf '%s\n' "${results[0]}" > "$CONTENTS_WHEEL_EVIDENCE_DIR/controls-exit-code.txt"
if [ "${results[0]}" -ne 0 ]; then exit "${results[0]}"; fi
exit "${results[1]}"
