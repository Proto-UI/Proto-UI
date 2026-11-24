set -euo pipefail
corepack enable
corepack pnpm@10.32.1 install --frozen-lockfile 2>&1 | tee "$CONTENTS_WHEEL_EVIDENCE_DIR/install.log"
corepack pnpm@10.32.1 --version | tee "$CONTENTS_WHEEL_EVIDENCE_DIR/pnpm-version.txt"
CHROME=$(command -v google-chrome || command -v chromium || command -v chromium-browser)
echo "CHROME_PATH=$CHROME" >> "$GITHUB_ENV"
"$CHROME" --version | tee "$CONTENTS_WHEEL_EVIDENCE_DIR/browser-version.txt"
corepack pnpm@10.32.1 --filter apps-www exec astro preferences disable devToolbar 2>&1 | tee "$CONTENTS_WHEEL_EVIDENCE_DIR/toolbar-disable.log"
corepack pnpm@10.32.1 --filter apps-www exec astro preferences get devToolbar.enabled 2>&1 | tee "$CONTENTS_WHEEL_EVIDENCE_DIR/toolbar-preference.log"
