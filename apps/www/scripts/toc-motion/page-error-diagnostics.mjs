/** Bounded diagnostics only; every observed page error remains a failed run. */
export function createPageErrorDiagnostics({ sanitize, fail, limit = 64, textLimit = 16384 }) {
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(textLimit) || textLimit < 1)
    throw new Error('Invalid page-error diagnostic bounds');
  const report = {
    limit,
    textLimit,
    total: 0,
    dropped: 0,
    entries: [],
    contextAssociation: 'same-page message FIFO; temporal diagnostic, not causal attribution',
  };
  const text = (value) => String(sanitize(String(value ?? ''))).slice(0, textLimit);
  const record = (error, context) => {
    report.total++;
    if (report.entries.length >= limit) {
      report.dropped++;
      if (report.dropped === 1)
        fail('pageerror: further diagnostics capped; see pageErrors.dropped');
      return null;
    }
    const entry = {
      sequence: report.total,
      name: text(error?.name),
      message: text(error?.message ?? error),
      stack: text(error?.stack),
      sourceHead: text(context.sourceHead),
      expectedHead: text(context.expectedHead),
      phase: text(context.phase),
      pageURL: text(context.pageURL),
      observedAtUTC: text(context.observedAtUTC),
      inputContext: null,
      inputContextError: null,
    };
    report.entries.push(entry);
    fail(`pageerror: ${entry.message}`);
    return entry;
  };
  const annotate = (entry, context) => {
    if (!entry || !report.entries.includes(entry)) return;
    entry.inputContext = {
      attribution: text(context?.attribution),
      browserDropped: Number.isInteger(context?.browserDropped) ? context.browserDropped : null,
      phase: text(context?.phase),
      route: text(context?.route),
      sourceURL: text(context?.sourceURL),
      line: Number.isFinite(context?.line) ? context.line : null,
      column: Number.isFinite(context?.column) ? context.column : null,
      lastTrustedInput: context?.lastTrustedInput
        ? {
            type: text(context.lastTrustedInput.type),
            key: text(context.lastTrustedInput.key),
            targetTag: text(context.lastTrustedInput.targetTag),
            timestamp: Number.isFinite(context.lastTrustedInput.timestamp)
              ? context.lastTrustedInput.timestamp
              : null,
          }
        : null,
    };
  };
  return {
    report,
    record,
    annotate,
    contextFailed: (entry, error) => {
      if (entry && report.entries.includes(entry))
        entry.inputContextError = text(error?.message ?? error);
    },
  };
}

/** Retain only the original own public fixture response, never serialized live DOM. */
export function createDocumentResponseDiagnostics({
  hash,
  write,
  limit = 8,
  byteLimit = 2_097_152,
  readTimeoutMs = 1000,
}) {
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    !Number.isInteger(byteLimit) ||
    byteLimit < 1 ||
    !Number.isInteger(readTimeoutMs) ||
    readTimeoutMs < 1
  )
    throw new Error('Invalid document response diagnostic bounds');
  const report = { limit, byteLimit, readTimeoutMs, total: 0, dropped: 0, entries: [] };
  return {
    report,
    async retain(response, expectedURL, source) {
      report.total++;
      if (report.entries.length >= limit) {
        report.dropped++;
        return;
      }
      const sequence = report.total;
      const entry = {
        sequence,
        sourceHead: source?.actualGitHead,
        sourceTree: source?.actualGitTree,
        expectedHead: source?.expectedHead,
      };
      let timeout;
      report.entries.push(entry);
      try {
        const expected = new URL(expectedURL);
        if (
          !['127.0.0.1', 'localhost', '[::1]'].includes(expected.hostname) ||
          !['http:', 'https:'].includes(expected.protocol) ||
          expected.username ||
          expected.password ||
          expected.pathname !== '/zh-cn/start-here/quick-start/' ||
          expected.search ||
          expected.hash
        )
          throw new Error('Not the own public quick-start fixture');
        if (
          !response ||
          response.url() !== expectedURL ||
          response.status() !== 200 ||
          !response.request().isNavigationRequest() ||
          response.request().method() !== 'GET' ||
          response.request().resourceType() !== 'document' ||
          !/^text\/html(?:;|$)/i.test(response.headers()['content-type'] ?? '')
        )
          throw new Error('Exact public document response admission failed');
        if (
          ![entry.sourceHead, entry.sourceTree, entry.expectedHead].every((value) =>
            /^[0-9a-f]{40}$/.test(value ?? '')
          ) ||
          entry.sourceHead !== entry.expectedHead
        )
          throw new Error('Document response source binding failed');
        entry.url = expectedURL;
        entry.status = response.status();
        const bytes = await Promise.race([
          response.body(),
          new Promise((_, reject) => {
            timeout = setTimeout(
              () => reject(new Error('Document response body exceeded diagnostic deadline')),
              readTimeoutMs
            );
          }),
        ]);
        entry.bytes = bytes.length;
        if (bytes.length > byteLimit) throw new Error('Document response exceeds byte cap');
        entry.sha256 = hash(bytes);
        entry.path = `original-document-${sequence}.html`;
        await write(entry.path, bytes);
        entry.saved = true;
      } catch (error) {
        entry.saved = false;
        // Do not copy rejected page URLs, HTML or user input into the diagnostic.
        entry.error = error instanceof Error ? error.message : 'Document response capture failed';
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
