set -uo pipefail
set +e
corepack pnpm@10.32.1 exec vitest run --no-file-parallelism \
  apps/www/src/content/docs/zh-cn/homepage-dogfood.browser.test.ts \
  --testNamePattern='^Homepage end-to-end dogfood boundary uses real family Popover Triggers through all four Docs runtimes with keyboard and exact-source visual evidence$' \
  --reporter=default --reporter=json \
  --outputFile="$CONTENTS_WHEEL_EVIDENCE_DIR/popover-vitest.json" \
  2>&1 | tee "$CONTENTS_WHEEL_EVIDENCE_DIR/popover.log"
results=("${PIPESTATUS[@]}")
printf '%s\n' "${results[0]}" > "$CONTENTS_WHEEL_EVIDENCE_DIR/popover-exit-code.txt"
if [ "${results[0]}" -ne 0 ]; then exit "${results[0]}"; fi
exit "${results[1]}"
