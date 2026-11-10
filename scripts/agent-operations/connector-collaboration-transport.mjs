// The trusted parent maps these API envelopes to its authenticated connector.
// This is only a runner for the existing collector/writer, never an authority
// source, a second admission path, or a fallback after an uncertain write.
import { randomUUID } from 'node:crypto';
import { readSync, writeSync } from 'node:fs';
import { StringDecoder } from 'node:string_decoder';
import { COLLABORATION_ACTIONS } from './collaboration-runtime.mjs';
import { MAX_LIVE_RESPONSE_BYTES, parseRepositoryId } from './collect-live-review-input.mjs';

export const CONNECTOR_COLLABORATION_PROTOCOL = 'proto-ui.connector-collaboration.v1';
export const CONNECTOR_REQUIRED_FIELDS = Object.freeze([
  'authenticated-viewer',
  'repository-permission',
  'repository-identity',
  'target-revision',
  'pagination-link-header',
  'raw-mutation-acknowledgement',
]);

// These are endpoint properties, not promises that a particular connector has
// these tools. The trusted parent reports supportedActions and missingFields.
export const COLLABORATION_TRANSPORT_BOUNDARIES = Object.freeze(
  Object.fromEntries(
    COLLABORATION_ACTIONS.map((action) => [
      action,
      Object.freeze({
        expectedHead: action === 'update-pull-request-branch-at-expected-head',
        atomicMetadataRevision: false,
      }),
    ])
  )
);

function requireValue(value, message) {
  if (!value) throw new Error(message);
}

function jsonBytes(value) {
  const text = JSON.stringify(value);
  requireValue(typeof text === 'string', 'connector returned no JSON value');
  requireValue(
    Buffer.byteLength(text) <= MAX_LIVE_RESPONSE_BYTES,
    'connector response exceeds the live collaboration payload bound'
  );
  return text;
}

// The launcher owns both pipes. Never feed task-authored response files to
// stdin, or derive launcher options/trust anchors from a request or handoff.
// Tool traffic uses stderr; stdout remains the canonical CLI result only.
export function createStdioConnectorExchange({ inputFd = 0, outputFd = 2 } = {}) {
  const chunk = Buffer.alloc(64 * 1024);
  const decoder = new StringDecoder('utf8');
  let buffered = '';
  return (message) => {
    const outgoing = Buffer.from(`${JSON.stringify(message)}\n`);
    let offset = 0;
    while (offset < outgoing.length) {
      const length = writeSync(outputFd, outgoing, offset, outgoing.length - offset);
      requireValue(length > 0, 'trusted connector parent disconnected during dispatch');
      offset += length;
    }
    for (;;) {
      const newline = buffered.indexOf('\n');
      if (newline !== -1) {
        const line = buffered.slice(0, newline);
        buffered = buffered.slice(newline + 1);
        requireValue(
          Buffer.byteLength(line) <= MAX_LIVE_RESPONSE_BYTES,
          'connector bridge response exceeds the live collaboration payload bound'
        );
        return JSON.parse(line);
      }
      requireValue(
        Buffer.byteLength(buffered) <= MAX_LIVE_RESPONSE_BYTES,
        'connector bridge response exceeds the live collaboration payload bound'
      );
      const length = readSync(inputFd, chunk, 0, chunk.length, null);
      requireValue(length > 0, 'trusted connector parent disconnected; no fallback is allowed');
      buffered += decoder.write(chunk.subarray(0, length));
    }
  };
}

function decodeRunnerCall(command, args, options) {
  requireValue(command === 'gh' && args[0] === 'api', 'connector accepts only shared API calls');
  let method = 'GET';
  let path = null;
  let paginate = false;
  let slurp = false;
  let hasInput = false;
  const fields = {};
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--method') method = args[++index];
    else if (arg === '--paginate') paginate = true;
    else if (arg === '--slurp') slurp = true;
    else if (arg === '--input') {
      requireValue(args[++index] === '-', 'connector API input must come from the shared writer');
      hasInput = true;
    } else if (arg === '-f' || arg === '-F') {
      const field = args[++index];
      const separator = field?.indexOf('=') ?? -1;
      requireValue(separator > 0, 'invalid shared GraphQL field');
      const key = field.slice(0, separator);
      requireValue(!Object.hasOwn(fields, key), 'duplicate shared GraphQL field');
      fields[key] = field.slice(separator + 1);
    } else {
      requireValue(!arg.startsWith('-') && path === null, 'unsupported shared API argument');
      path = arg;
    }
  }
  requireValue(typeof path === 'string', 'shared API path is required');
  requireValue(paginate === slurp, 'connector pagination requires complete page aggregation');
  if (path === 'graphql') {
    requireValue(!hasInput && !paginate && method === 'GET', 'invalid shared GraphQL call');
    const { query, ...variables } = fields;
    requireValue(typeof query === 'string', 'shared GraphQL query is required');
    return { graphql: true, method: 'POST', path: '/graphql', body: { query, variables } };
  }
  requireValue(Object.keys(fields).length === 0, 'REST fields must use the shared writer input');
  requireValue(hasInput === (options.input !== undefined), 'shared API input binding is invalid');
  requireValue(['GET', 'POST', 'PATCH', 'PUT'].includes(method), 'unsupported shared API method');
  return {
    graphql: false,
    method,
    path: `/${path}`,
    body: hasInput ? JSON.parse(options.input) : null,
    paginate,
  };
}

function mutationAction(call) {
  if (call.graphql) {
    const match = /^\s*(query|mutation)\s+(ProtoUi[A-Za-z]+)\s*\(/.exec(call.body.query);
    requireValue(match, 'connector refuses an unregistered GraphQL operation');
    if (match[1] === 'query') {
      requireValue(
        ['ProtoUiCollaborationViewer', 'ProtoUiCollaborationCommitter', 'ProtoUiCollaborationThread'].includes(match[2]),
        'connector refuses an unregistered GraphQL query'
      );
      return null;
    }
    const action = {
      ProtoUiMarkReady: 'mark-exact-head-ready-for-review',
      ProtoUiResolveThread: 'resolve-fixed-review-thread',
    }[match[2]];
    requireValue(action, 'connector refuses an unregistered GraphQL mutation');
    return action;
  }
  return call.method === 'GET' ? null : true;
}

function validateWriteTarget(call, request, repositoryPath) {
  const number = request.target?.number;
  const restTarget = {
    'post-bounded-reconciliation-comment': ['POST', `${repositoryPath}/issues/${number}/comments`],
    'update-governed-issue-or-pull-request-metadata': ['PATCH', `${repositoryPath}/issues/${number}`],
    'update-pull-request-branch-at-expected-head': ['PUT', `${repositoryPath}/pulls/${number}/update-branch`],
    'request-independent-review': ['POST', `${repositoryPath}/pulls/${number}/requested_reviewers`],
    'rerun-exact-trusted-workflow': [
      'POST',
      `${repositoryPath}/actions/runs/${request.target?.runId}/${request.desired?.mode === 'failed-jobs' ? 'rerun-failed-jobs' : 'rerun'}`,
    ],
  }[request.action];
  if (call.graphql) {
    requireValue(mutationAction(call) === request.action, 'connector mutation action changed');
    if (request.action === 'resolve-fixed-review-thread')
      requireValue(call.body.variables.threadId === request.target.threadId, 'connector thread target changed');
  } else {
    requireValue(
      restTarget && call.method === restTarget[0] && call.path === restTarget[1],
      'connector mutation does not match the exact collaboration target'
    );
    if (request.action === 'update-pull-request-branch-at-expected-head')
      requireValue(
        call.body?.expected_head_sha === request.target.headSha,
        'connector must retain the server-side expected_head_sha condition'
      );
  }
}

function nextPagePath(headers, currentPath, originalPath) {
  requireValue(
    headers && Object.hasOwn(headers, 'link') && (headers.link === null || typeof headers.link === 'string'),
    'connector pagination Link header is unavailable; completeness is unknown'
  );
  if (!headers.link) return null;
  const links = headers.link.split(',');
  let next = null;
  for (const link of links) {
    const match = /^\s*<([^>]+)>\s*;\s*rel="([^"]+)"\s*$/.exec(link);
    requireValue(match, 'connector returned an invalid pagination Link header');
    if (!match[2].split(' ').includes('next')) continue;
    requireValue(next === null, 'connector returned multiple next-page links');
    const url = new URL(match[1], `https://api.github.com${currentPath}`);
    const original = new URL(originalPath, 'https://api.github.com');
    requireValue(
      url.origin === original.origin && url.pathname === original.pathname &&
        !url.username && !url['pass' + 'word'] && !url.hash,
      'connector pagination left the exact GitHub collection'
    );
    const expected = new URLSearchParams(original.search);
    expected.delete('page');
    const actual = new URLSearchParams(url.search);
    const page = actual.getAll('page');
    actual.delete('page');
    expected.sort();
    actual.sort();
    const current = new URL(currentPath, 'https://api.github.com');
    const currentPage = Number(current.searchParams.get('page') ?? '1');
    requireValue(
      page.length === 1 && /^[1-9]\d*$/.test(page[0]) &&
        Number.isSafeInteger(currentPage) && Number(page[0]) === currentPage + 1 &&
        actual.toString() === expected.toString(),
      'connector pagination changed collection parameters'
    );
    next = url.pathname + url.search;
  }
  return next;
}

// exchange is a synchronous trusted launcher dispatcher, never a callback read
// from task content. The stdio default lets an async parent service the calls
// while the existing synchronous CLI runs unchanged in its own child process.
export function createConnectorCollaborationRunner(request, { exchange = createStdioConnectorExchange() } = {}) {
  const { owner, name } = parseRepositoryId(request.repositoryId);
  const repositoryPath = `/repos/${owner}/${name}`;
  requireValue(typeof exchange === 'function', 'trusted connector dispatcher is required');
  let writeAttempted = false;
  function call(operation, args) {
    const id = randomUUID();
    const response = exchange({ kind: 'tool-call', id, operation, arguments: args });
    requireValue(
      response?.kind === 'tool-result' && response.id === id && response.result?.isError === false &&
        response.result.structuredContent && typeof response.result.structuredContent === 'object',
      'connector returned a missing, failed, or unbound structured result'
    );
    jsonBytes(response);
    return response.result.structuredContent;
  }
  const capabilities = call('github-collaboration-capabilities', {
    protocol: CONNECTOR_COLLABORATION_PROTOCOL,
    repositoryId: request.repositoryId,
    requiredFields: CONNECTOR_REQUIRED_FIELDS,
    actions: COLLABORATION_ACTIONS,
    endpointBoundaries: COLLABORATION_TRANSPORT_BOUNDARIES,
  });
  requireValue(
    capabilities.protocol === CONNECTOR_COLLABORATION_PROTOCOL &&
      capabilities.repositoryId === request.repositoryId &&
      capabilities.rest === true && capabilities.graphql === true &&
      capabilities.pagination === 'link-header' &&
      Array.isArray(capabilities.fields) && Array.isArray(capabilities.supportedActions) &&
      capabilities.supportedActions.every((action) => COLLABORATION_ACTIONS.includes(action)),
    'connector capabilities are unavailable or malformed; no write is admitted'
  );
  const missingFields = CONNECTOR_REQUIRED_FIELDS.filter((field) => !capabilities.fields.includes(field));
  requireValue(missingFields.length === 0, `connector is missing required live fields: ${missingFields.join(', ')}`);
  if (request.action !== null)
    requireValue(
      capabilities.supportedActions.includes(request.action),
      'connector does not support the requested collaboration action; no fallback is allowed'
    );

  function api(call) {
    if (call.graphql) {
      const variables = call.body.variables;
      if (Object.hasOwn(variables, 'owner') || Object.hasOwn(variables, 'name'))
        requireValue(variables.owner === owner && variables.name === name, 'connector GraphQL repository changed');
      if (Object.hasOwn(variables, 'threadId'))
        requireValue(variables.threadId === request.target?.threadId, 'connector GraphQL thread changed');
    } else {
      const url = new URL(call.path, 'https://api.github.com');
      requireValue(
        url.origin === 'https://api.github.com' &&
          (url.pathname === repositoryPath || url.pathname.startsWith(`${repositoryPath}/`)) &&
          !url.hash && !url.username && !url['pass' + 'word'],
        'connector request left the exact repository'
      );
    }
    const writing = mutationAction(call) !== null;
    if (writing) {
      validateWriteTarget(call, request, repositoryPath);
      requireValue(!writeAttempted, 'connector refuses a second mutation or resend');
      // Set before dispatch: a thrown, malformed or lost response consumes the
      // only write attempt. Readback continues through the same collector.
      writeAttempted = true;
    }
    const response = callApi(call);
    requireValue(
      Number.isInteger(response.status) && response.status >= 200 && response.status < 300 &&
        Object.hasOwn(response, 'body'),
      `connector GitHub API failed or returned no raw response (status ${Number.isInteger(response.status) ? response.status : 'unknown'})`
    );
    return response;
  }
  function callApi(apiCall) {
    return call('github-api', {
      method: apiCall.method,
      path: apiCall.path,
      body: apiCall.body,
    });
  }
  const repository = api({ graphql: false, method: 'GET', path: repositoryPath, body: null });
  requireValue(repository.body?.full_name === `${owner}/${name}`, 'live connector repository identity does not match the exact target');

  const runner = (command, args, options = {}) => {
    const decoded = decodeRunnerCall(command, args, options);
    if (!decoded.paginate) {
      const response = api(decoded);
      return response.body === null ? '' : jsonBytes(response.body);
    }
    const pages = [];
    const seenPaths = new Set();
    const seenItems = new Set();
    const originalPath = decoded.path;
    let path = originalPath;
    let bytes = 2;
    while (path !== null) {
      requireValue(!seenPaths.has(path), 'connector pagination repeated a page');
      seenPaths.add(path);
      const response = api({ ...decoded, path });
      requireValue(Array.isArray(response.body), 'connector pagination returned a non-array page');
      bytes += Buffer.byteLength(jsonBytes(response.body)) + 1;
      requireValue(bytes <= MAX_LIVE_RESPONSE_BYTES, 'connector pages exceed the live collaboration payload bound');
      for (const item of response.body) {
        const identity = item?.id ?? item?.sha;
        requireValue(identity !== undefined && identity !== null, 'connector page item identity is unavailable');
        requireValue(!seenItems.has(String(identity)), 'connector pagination repeated an item');
        seenItems.add(String(identity));
      }
      pages.push(response.body);
      path = nextPagePath(response.headers, path, originalPath);
    }
    return jsonBytes(pages);
  };
  return {
    runner,
    capabilities: {
      ...structuredClone(capabilities),
      missingFields,
      unsupportedActions: COLLABORATION_ACTIONS.filter((action) => !capabilities.supportedActions.includes(action)),
      endpointBoundaries: COLLABORATION_TRANSPORT_BOUNDARIES,
    },
  };
}
