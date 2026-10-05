import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const READING_VIEWPORT = Object.freeze({ width: 1180, height: 757 });
export const READING_ROUTES = Object.freeze([
  { id: 'quick-start', route: '/zh-cn/start-here/quick-start/' },
  { id: 'radio-group', route: '/zh-cn/ui-libraries/shadcn/radio-group/' },
]);
export const READING_CASES = Object.freeze(
  READING_ROUTES.flatMap((route) =>
    ['light', 'dark'].map((colorScheme) =>
      Object.freeze({ ...route, colorScheme, id: `${route.id}-${colorScheme}` })
    )
  )
);

export function readSourceBinding(expectedHead, cwd = process.cwd()) {
  if (!/^[0-9a-f]{40}$/.test(expectedHead ?? ''))
    throw new Error('PROTO_UI_EXPECTED_HEAD must be a full lowercase candidate Git SHA.');
  const git = (args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const actualGitHead = git(['rev-parse', 'HEAD']);
  const worktreeStatus = git(['status', '--porcelain=v1', '--untracked-files=normal']);
  if (actualGitHead !== expectedHead)
    throw new Error(`Candidate SHA mismatch: expected ${expectedHead}, observed ${actualGitHead}`);
  if (worktreeStatus)
    throw new Error(
      `Candidate worktree must be clean, including untracked files:\n${worktreeStatus}`
    );
  return {
    kind: 'source-bound-candidate',
    actualGitHead,
    expectedHead,
    worktreeStatus,
    observedAtUTC: new Date().toISOString(),
  };
}

export function allowOwnRequest(url, baseUrl) {
  try {
    const target = new URL(url);
    const base = new URL(baseUrl);
    return (
      ['http:', 'https:', 'ws:', 'wss:'].includes(target.protocol) &&
      target.hostname === base.hostname &&
      target.port === base.port &&
      target.protocol.replace(/^ws/, 'http') === base.protocol
    );
  } catch {
    return false;
  }
}

/** Fetch only the admitted request; never let Chromium or APIRequest follow a redirect. */
export async function routeOwnResponse(route, baseUrl, recordFailure) {
  const url = route.request().url();
  if (!allowOwnRequest(url, baseUrl) || !/^https?:/.test(url)) {
    recordFailure({ kind: 'external-request', url: safeEvidenceURL(url) });
    await route.abort('blockedbyclient');
    return 'blocked-external';
  }
  let response;
  try {
    // Route.continue() does not re-enter this handler for redirected requests.
    // The locked Playwright API returns the original 30x when maxRedirects=0.
    response = await route.fetch({ maxRedirects: 0, maxRetries: 0, timeout: 30_000 });
    const status = response.status();
    if (status >= 300 && status < 400) {
      recordFailure({
        kind: 'redirect-response',
        url: safeEvidenceURL(url),
        status,
        location: response.headers().location ? safeEvidenceURL(response.headers().location) : null,
      });
      await route.abort('blockedbyclient');
      return 'blocked-redirect';
    }
    await route.fulfill({ response });
    return 'fulfilled';
  } catch (error) {
    recordFailure({
      kind: 'request-error',
      url: safeEvidenceURL(url),
      error: sanitizeDiagnostic(error),
    });
    await route.abort('failed').catch(() => {});
    return 'failed-request';
  } finally {
    // APIRequestContext otherwise retains every font/module/image response.
    await response?.dispose();
  }
}

/** Diagnostics retain origin/path only; query, fragment and user-info may be transient secrets. */
export function safeEvidenceURL(value) {
  try {
    const relative = !/^[a-z][a-z0-9+.-]*:/i.test(value);
    const url = new URL(value, 'http://evidence.invalid');
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return relative ? url.pathname : url.href;
  } catch {
    return '[invalid-url-redacted]';
  }
}

export function sanitizeDiagnostic(value) {
  return String(value)
    .replace(/\b(?:https?|wss?):\/\/[^\s"'<>`]+/gi, (url) => safeEvidenceURL(url))
    .replace(/(\bLocation:?[\t ]+)([^\r\n]*)/gi, (_match, label, location) => {
      if (location === '(absent)') return `${label}${location}`;
      // A rejected Location can be relative or protocol-relative. Preserve only
      // a valid URL's safe path; never persist arbitrary header text as a URL.
      return `${label}${/[\s"'<>`]/.test(location) ? '[location-redacted]' : safeEvidenceURL(location)}`;
    });
}

export function pngDimensions(bytes) {
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.length < 24 ||
    !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    bytes.toString('ascii', 12, 16) !== 'IHDR'
  )
    throw new Error('Expected an original PNG with an IHDR header.');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

export function observationFailures(
  observation,
  requestedCase,
  expectedViewport = READING_VIEWPORT
) {
  const failures = [...observation.errors];
  const viewport = observation.viewport;
  if (
    viewport.innerWidth !== expectedViewport.width ||
    viewport.innerHeight !== expectedViewport.height
  )
    failures.push(
      `Actual viewport differs from ${expectedViewport.width}x${expectedViewport.height} CSS px.`
    );
  if (viewport.devicePixelRatio !== 1 || viewport.visualViewport?.scale !== 1)
    failures.push('Actual DPR/visual viewport scale differs from 1.');
  for (const zoom of [viewport.rootZoom, viewport.bodyZoom])
    if (!['1', 'normal', '100%'].includes(zoom)) failures.push(`Unexpected CSS zoom: ${zoom}`);
  if (observation.root.attributes['data-theme'] !== requestedCase.colorScheme)
    failures.push('Observed theme differs from the requested color scheme.');
  if (observation.fonts.status !== 'loaded')
    failures.push('document.fonts did not finish loading.');
  if (observation.fonts.faces?.some((font) => font.status === 'error'))
    failures.push('A document font face failed to load.');
  for (const [role, inventory] of Object.entries(observation.roles)) {
    if (inventory.required && inventory.count === 0)
      failures.push(`Required role ${role} has zero samples.`);
    for (const sample of inventory.samples ?? inventory.entries ?? [])
      if (!sample.actualTextLeaves.length)
        failures.push(`Existing role ${role} has zero actual text leaves.`);
  }
  return [...new Set(failures)];
}

/** Hash the exact observed normalized fields in either candidate or external DOM output. */
export function hashReadingObservation(observation) {
  const digest = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.normalizedText === 'string')
      value.normalizedTextSha256 = digest(value.normalizedText);
    for (const child of Object.values(value)) visit(child);
  };
  visit(observation);
  if (observation.prose?.blocks)
    observation.prose.normalizedTextSha256 = digest(
      JSON.stringify(
        observation.prose.blocks.map(({ role, normalizedText }) => [role, normalizedText])
      )
    );
  observation.contentHashStatus = 'sha256-utf8-host-postprocessed';
  return observation;
}
