// @vitest-environment node
import { revealHeaderPreferences } from './site-header-browser';
import { chromium, type Browser, type Locator, type Page } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { Socket } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { TLSSocket, createSecureContext } from 'node:tls';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  chromeExecutable,
  launchBrowser,
  RUNTIMES,
  startServer,
  stopServer,
} from './browser-harness';
import { nativeLinkEvidenceIssues } from './site-native-link-evidence';
import {
  localePairIssues,
  localizedShellHref,
  shellNavigationIssues,
  type ShellLinkExpectation,
  type ShellLinkFact,
} from './site-native-links-locale';
import { sitePrimaryNavigation, siteShellLabels } from '../../../components/site-navigation';
import { SITE_LINK_ICONS, type SiteLinkIcon } from '../../../prototypes/site-link-icons';
import socialDestinations from '../../../../../../shared/links.json';
import { safeError, safeUrl } from '../../../../../../scripts/test/search-startup-profile.mjs';

let browser: Browser;
let baseUrl: string;
const evidenceDirectory = path.join(
  process.env.RUNNER_TEMP ?? os.tmpdir(),
  'homepage-evidence',
  'native-links'
);
let evidenceSource: { sha: string; dirty: boolean };
async function captureLinks(
  page: Page,
  id: string,
  family: string,
  runtime: string,
  state: string,
  paintEvidence?: unknown
) {
  await mkdir(evidenceDirectory, { recursive: true });
  const file = `${id}.png`;
  await page.screenshot({ path: path.join(evidenceDirectory, file) });
  const observed = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    documentFamily: document.documentElement.dataset.siteLibraryFamily,
    homepageRuntime:
      document.querySelector<HTMLElement>('[data-homepage-runtime]')?.dataset.runtime ?? null,
    menuExpanded: document
      .querySelector('[data-site-menu-button], [data-homepage-menu-label] [role="button"]')
      ?.getAttribute('aria-expanded'),
    focusedName: document.activeElement?.getAttribute('aria-label'),
    focusedRole: document.activeElement?.tagName,
  }));
  await writeFile(
    path.join(evidenceDirectory, `${id}.json`),
    JSON.stringify(
      {
        schemaVersion: 1,
        source: evidenceSource,
        capturedAt: new Date().toISOString(),
        screenshot: file,
        url: safeUrl(page.url(), baseUrl),
        viewport: page.viewportSize(),
        family,
        runtime,
        state,
        observed,
        paintEvidence,
        renderer: 'Real Chromium via existing repository browser harness',
      },
      null,
      2
    )
  );
}
const labels = { wc: 'Web Components', react: 'React', vue: 'Vue', vue2: 'Vue 2' } as const;
beforeAll(async () => {
  evidenceSource = {
    sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: !!execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      encoding: 'utf8',
    }).trim(),
  };
  baseUrl = await startServer('/zh-cn/');
  browser = await launchBrowser();
}, 150_000);
afterAll(async () => {
  await browser?.close();
  await stopServer();
}, 60_000);
async function choose(page: Page, selector: string, label: string) {
  await revealHeaderPreferences(page);
  const trigger = page.locator(`${selector} [role="combobox"]`);
  await trigger.click();
  const id = await trigger.getAttribute('aria-controls');
  const portal = page.locator(`[id=${JSON.stringify(id)}]`);
  await portal.getByRole('option', { name: label, exact: true }).click();
  // Selecting the already-current value need not remount the page. Its real
  // Select closing transition must finish before unrelated native hit samples.
  await portal.waitFor({ state: 'hidden' });
}
async function ready(page: Page, runtime: string, family: string) {
  await page.waitForFunction(
    ({ runtime, family }) => {
      const root = document.querySelector<HTMLElement>('[data-homepage-runtime]');
      return (
        root?.dataset.runtimeState === 'ready' &&
        root.dataset.runtime === runtime &&
        root.dataset.family === family
      );
    },
    { runtime, family }
  );
}
async function openSettings(page: Page) {
  const button = page.locator(
    '[data-homepage-menu-label] [role="button"], [data-site-menu-button]'
  );
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
}

async function installNativeTrace(page: Page, currentDocument = false) {
  const initialize = () => {
    const state = {
      action: 'initial',
      events: [] as Array<{
        event: Event;
        target: Node;
        anchor: HTMLAnchorElement;
        at: number;
        action: string;
        targetTag: string;
        hitIsAnchor: boolean;
        connectedAtCapture: boolean;
        x: number;
        y: number;
      }>,
    };
    (window as Window & { __siteNativeTrace?: typeof state }).__siteNativeTrace = state;
    for (const type of [
      'pointerenter',
      'pointerleave',
      'pointerdown',
      'pointerup',
      'mousedown',
      'mouseup',
      'click',
      'auxclick',
      'focus',
      'blur',
      'keydown',
      'keyup',
    ]) {
      document.addEventListener(
        type,
        (event) => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          const anchor = target.closest('a');
          if (!anchor) return;
          const { clientX: x = 0, clientY: y = 0 } = event as MouseEvent;
          state.events.push({
            event,
            target,
            anchor,
            at: performance.now(),
            action: state.action,
            targetTag: target.tagName,
            hitIsAnchor: document.elementFromPoint(x, y) === anchor,
            connectedAtCapture: target.isConnected,
            x,
            y,
          });
          if (state.events.length > 150) state.events.shift();
        },
        { capture: true }
      );
    }
  };
  await page.addInitScript(initialize);
  if (currentDocument) await page.evaluate(initialize);
}
async function nativeActionLabel(page: Page, action: string) {
  await page.evaluate((action) => {
    const state = (window as Window & { __siteNativeTrace?: { action: string } }).__siteNativeTrace;
    if (state) state.action = action;
  }, action);
}
async function saveNativeTrace(page: Page, id: string, detail: unknown = null) {
  const events = await page.evaluate(() => {
    const state = (
      window as Window & {
        __siteNativeTrace?: {
          events: Array<{
            event: Event;
            target: Node;
            anchor: HTMLAnchorElement;
            at: number;
            action: string;
            targetTag: string;
            hitIsAnchor: boolean;
            connectedAtCapture: boolean;
            x: number;
            y: number;
          }>;
        };
      }
    ).__siteNativeTrace;
    return (state?.events ?? []).map(({ event, target, anchor, ...entry }) => ({
      ...entry,
      type: event.type,
      trusted: event.isTrusted,
      preventedAfterDispatch: event.defaultPrevented,
      button: (event as MouseEvent).button,
      buttons: (event as MouseEvent).buttons,
      key: (event as KeyboardEvent).key,
      ctrl: (event as MouseEvent).ctrlKey,
      meta: (event as MouseEvent).metaKey,
      targetConnectedAfterDispatch: target.isConnected,
      anchorConnected: anchor.isConnected,
      targetWasAnchor: target === anchor,
      href: anchor.getAttribute('href'),
      name: anchor.getAttribute('aria-label'),
    }));
  });
  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(
    path.join(evidenceDirectory, `${id}-events.json`),
    JSON.stringify(
      { source: evidenceSource, url: page.url(), viewport: page.viewportSize(), detail, events },
      null,
      2
    )
  );
  return events;
}

const NATIVE_DESTINATION_FIXTURE_TITLE = 'External link fixture';
const NATIVE_DESTINATION_FIXTURE_MARKER = 'admitted-native-destination';
const NATIVE_DESTINATION_HOSTS = Object.freeze(['github.com']);
const NATIVE_DESTINATION_HTML = `<!doctype html><html data-native-destination-fixture="${NATIVE_DESTINATION_FIXTURE_MARKER}"><head><meta charset="utf-8"><title>${NATIVE_DESTINATION_FIXTURE_TITLE}</title></head><body><h1>Admitted native destination</h1></body></html>`;
/** Throwaway self-signed EC material for the admitted fixture host only. The
 * proxy never forwards an admitted host, and only this cell's own browser
 * instance ignores certificate errors; no site or shared harness path sees it. */
const NATIVE_DESTINATION_TLS_KEY_BASE64 =
  'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgA/M06pocQzYu+O1aOfG4PrC3sK8upJ6ZGlEQZjGjGSChRANCAARRFF3SzmCtg5W4+Di0h/QrctYJlQKKgVbC83sCtetpTdvhX+DDC8ysvtGKwgP4VWP7WctIRs+F7HnSDfpzQJ9T';
const NATIVE_DESTINATION_TLS_CERT_BASE64 =
  'MIIBmTCCAT6gAwIBAgIUSDCWfn1/g2gZGDspDyiF48uk/nwwCgYIKoZIzj0EAwIwFTETMBEGA1UEAwwKZ2l0aHViLmNvbTAgFw0yNjExMDYwMDU1MTVaGA8yMTI2MTAxMzAwNTUxNVowFTETMBEGA1UEAwwKZ2l0aHViLmNvbTBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABFEUXdLOYK2Dlbj4OLSH9Cty1gmVAoqBVsLzewK162lN2+Ff4MMLzKy+0YrCA/hVY/tZy0hGz4XsedIN+nNAn1OjajBoMB0GA1UdDgQWBBSz1Nd2ar6WOfQt/ZipatHrUNUfATAfBgNVHSMEGDAWgBSz1Nd2ar6WOfQt/ZipatHrUNUfATAPBgNVHRMBAf8EBTADAQH/MBUGA1UdEQQOMAyCCmdpdGh1Yi5jb20wCgYIKoZIzj0EAwIDSQAwRgIhALgt70QZ5mzzfhFoM4YiEPAZ5ZHkRxxuULVYu7SxmTCtAiEA9nkevilsC6Abh3M9btLA2H2xTxfGqZSOpEBDqZpju8o=';
const nativeDestinationPem = (label: 'PRIVATE KEY' | 'CERTIFICATE', base64: string) =>
  `-----BEGIN ${label}-----\n${base64.replace(/(.{64})/g, '$1\n').trimEnd()}\n-----END ${label}-----\n`;

type NativeDestinationRecord = {
  host: string;
  method: string;
  path: string;
  destination: string | null;
};

type NativeDestinationIsolation = {
  proxyServer: string;
  documents: NativeDestinationRecord[];
  refusedHosts: string[];
  close: () => Promise<void>;
};

/**
 * Trusted Ctrl/middle activation is issued by the browser before any
 * Playwright target exists, so `context.route()` cannot serve its first
 * document (microsoft/playwright#30229 records the same popup boundary). Such a
 * popup therefore leaves the fixture's control and reaches whatever the
 * ambient network provides. This cell instead owns the only network path to an
 * admitted external host: a loopback CONNECT proxy that answers with the
 * fixture document and refuses every other host, so the popup still commits a
 * real DOMContentLoaded document at the exact product URL without contacting
 * the admitted host.
 */
async function startNativeDestinationIsolation(): Promise<NativeDestinationIsolation> {
  const documents: NativeDestinationRecord[] = [];
  const refusedHosts: string[] = [];
  const secureContext = createSecureContext({
    key: nativeDestinationPem('PRIVATE KEY', NATIVE_DESTINATION_TLS_KEY_BASE64),
    cert: nativeDestinationPem('CERTIFICATE', NATIVE_DESTINATION_TLS_CERT_BASE64),
  });
  const server = createServer((_request, response) => {
    response.writeHead(405, { 'content-type': 'text/plain' });
    response.end('CONNECT required');
  });
  // A leaked listener must never keep the test process alive.
  server.unref();
  const sockets = new Set<Socket>();
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.unref();
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
  });
  server.on('connect', (request, socket, head) => {
    const tunnel = socket as Socket;
    tunnel.on('error', () => {});
    const target = request.url ?? '';
    const host = target.startsWith('[')
      ? target.slice(1, target.indexOf(']'))
      : (target.split(':')[0] ?? '');
    if (!NATIVE_DESTINATION_HOSTS.includes(host)) {
      refusedHosts.push(host);
      tunnel.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n');
      return;
    }
    tunnel.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (head.length) tunnel.unshift(head);
    const secure = new TLSSocket(tunnel, {
      isServer: true,
      secureContext,
      ALPNProtocols: ['http/1.1'],
    });
    secure.on('error', () => {});
    let pending = '';
    secure.on('data', (chunk) => {
      pending += chunk.toString('latin1');
      const headerEnd = pending.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;
      const [requestLine = '', ...headerLines] = pending.slice(0, headerEnd).split('\r\n');
      const [method = '', requestPath = ''] = requestLine.split(' ');
      const destination =
        headerLines
          .find((line) => line.toLowerCase().startsWith('sec-fetch-dest:'))
          ?.slice('sec-fetch-dest:'.length)
          .trim() ?? null;
      documents.push({ host, method, path: requestPath, destination });
      secure.end(
        [
          'HTTP/1.1 200 OK',
          'Content-Type: text/html; charset=utf-8',
          `Content-Length: ${Buffer.byteLength(NATIVE_DESTINATION_HTML)}`,
          'Cache-Control: no-store',
          'Connection: close',
          '',
          NATIVE_DESTINATION_HTML,
        ].join('\r\n')
      );
    });
  });
  const listening = Promise.withResolvers<number>();
  server.once('error', listening.reject);
  server.listen(0, '127.0.0.1', () => {
    server.off('error', listening.reject);
    const address = server.address();
    if (!address || typeof address === 'string') {
      listening.reject(new Error('Native destination isolation did not bind a loopback port'));
      return;
    }
    listening.resolve(address.port);
  });
  const port = await listening.promise;
  return {
    proxyServer: `http://127.0.0.1:${port}`,
    documents,
    refusedHosts,
    close: () => {
      const closed = Promise.withResolvers<void>();
      for (const socket of sockets) socket.destroy();
      server.closeAllConnections();
      server.close((error) => (error ? closed.reject(error) : closed.resolve()));
      return closed.promise;
    },
  };
}

/**
 * One cell only: the admitted native destination is served by the loopback
 * proxy with fixture TLS material, so the destination document never depends
 * on the ambient network. The documentation server keeps its direct loopback
 * path through the bypass list.
 */
async function launchNativeDestinationBrowser(proxyServer: string): Promise<Browser> {
  return chromium.launch({
    executablePath: await chromeExecutable(),
    headless: true,
    args: [
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--ignore-certificate-errors',
      `--proxy-server=${proxyServer}`,
      '--proxy-bypass-list=127.0.0.1;localhost',
    ],
  });
}

async function nativePopup(
  page: Page,
  link: Locator,
  action: 'modifier' | 'middle' | 'enter',
  owner: string,
  isolation: NativeDestinationIsolation
) {
  const label = `${owner}:${action}`;
  const href = await link.getAttribute('href');
  console.info(`[native-link] ${label} begin href=${href}`);
  const admittedBefore = isolation.documents.length;
  await nativeActionLabel(page, label);
  const outcome = page
    .context()
    .waitForEvent('page')
    .then(
      (popup) => ({ popup }),
      (error: unknown) => ({ error })
    );
  try {
    if (action === 'modifier') await link.click({ modifiers: ['ControlOrMeta'] });
    else if (action === 'middle') await link.click({ button: 'middle' });
    else {
      await link.focus();
      await page.keyboard.press('Enter');
    }
    const result = await outcome;
    if ('error' in result) throw result.error;
    // A popup can first report the initial empty document as loaded. Wait
    // for this activation's exact routed destination before accepting it.
    if (!href) throw new Error('Native navigation destination is missing');
    await result.popup.waitForURL(href, { waitUntil: 'domcontentloaded' });
    expect(result.popup.url(), label).toBe(href);
    // The committed destination must be this fixture's document. A real
    // external page, a certificate/error page or a refused host cannot pass.
    expect(await result.popup.title(), `${label} destination document`).toBe(
      NATIVE_DESTINATION_FIXTURE_TITLE
    );
    expect(
      await result.popup.evaluate(
        () => document.documentElement.dataset.nativeDestinationFixture ?? null
      ),
      `${label} destination marker`
    ).toBe(NATIVE_DESTINATION_FIXTURE_MARKER);
    expect(
      isolation.documents
        .slice(admittedBefore)
        .filter(
          (document) =>
            document.destination === 'document' && document.path === new URL(href).pathname
        ),
      `${label} admitted destination request`
    ).toHaveLength(1);
    await result.popup.close();
    console.info(`[native-link] ${label} passed`);
  } catch (error) {
    await saveNativeTrace(page, `${owner}-${action}-failure`, {
      action,
      owner,
      href,
      error: String(error),
    });
    throw new Error(`[native-link] ${label} failed for ${href}`, { cause: error });
  }
}

async function linkPaint(link: Locator) {
  return link.evaluate((anchor) => {
    const surface = anchor.querySelector<HTMLElement>('[data-pui-root]')!;
    const style = getComputedStyle(surface);
    const textSurface = surface.querySelector<HTMLElement>('[data-pui-root]');
    const textStyle = textSurface ? getComputedStyle(textSurface) : style;
    const box = surface.getBoundingClientRect();
    const nativeBox = anchor.getBoundingClientRect();
    // Observe the painted body's edge midpoints, not its decorative shadow or
    // rounded corner. The passive child may move; the native a remains the only
    // activation owner and must still cover the visible target at that endpoint.
    const edgeHits = [
      { edge: 'right', x: box.right - 1, y: box.top + box.height / 2 },
      { edge: 'bottom', x: box.left + box.width / 2, y: box.bottom - 1 },
    ].map((point) => {
      const hit = document.elementFromPoint(point.x, point.y);
      return {
        ...point,
        hitIsAnchor: hit === anchor,
        hitTag: hit?.tagName ?? null,
        hitHref: hit?.closest('a')?.getAttribute('href') ?? null,
      };
    });
    const ringExtent = 4;
    let unclipped =
      box.left >= ringExtent &&
      box.top >= ringExtent &&
      box.right + ringExtent <= innerWidth &&
      box.bottom + ringExtent <= innerHeight;
    for (let parent = surface.parentElement; parent; parent = parent.parentElement) {
      const clip = getComputedStyle(parent);
      const bounds = parent.getBoundingClientRect();
      if (['hidden', 'clip', 'scroll', 'auto'].includes(clip.overflowX))
        unclipped &&=
          box.left - ringExtent >= bounds.left && box.right + ringExtent <= bounds.right;
      if (['hidden', 'clip', 'scroll', 'auto'].includes(clip.overflowY))
        unclipped &&=
          box.top - ringExtent >= bounds.top && box.bottom + ringExtent <= bounds.bottom;
    }
    return {
      tokens: (surface.getAttribute('data-pui-style') ?? '').split(/\s+/),
      textTokens: (textSurface?.getAttribute('data-pui-style') ?? '').split(/\s+/),
      background: style.backgroundColor,
      shadow: style.boxShadow,
      paintSettled: surface
        .getAnimations()
        .every((animation) => !animation.pending && animation.playState === 'finished'),
      transform: style.transform,
      weight: textStyle.fontWeight,
      font: textStyle.fontFamily,
      decoration: textStyle.textDecorationLine,
      whiteSpace: style.whiteSpace,
      ringWidth: style.getPropertyValue('--pui-ring-width').trim(),
      ringOffset: style.getPropertyValue('--pui-ring-offset-width').trim(),
      ringColor: style.getPropertyValue('--pui-ring-color').trim(),
      focused: anchor === document.activeElement && anchor.matches(':focus-visible'),
      nativePressed: anchor.matches(':active'),
      nativeRect: {
        x: nativeBox.x,
        y: nativeBox.y,
        width: nativeBox.width,
        height: nativeBox.height,
      },
      surfaceRect: { x: box.x, y: box.y, width: box.width, height: box.height },
      edgeHits,
      visibleTarget:
        box.width > 0 &&
        box.height > 0 &&
        anchor === document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2),
      unclipped,
      // Record the native root outline too: the Prototype ring alone does not
      // prove that a browser focus outline is absent or visually acceptable.
      nativeOutline: getComputedStyle(anchor).outline,
    };
  });
}

/** Bounded observation of a real emitted transition endpoint: wait for the
 * painted value, then require it to hold across consecutive animation frames
 * before it is asserted. This is not a fixed delay, a forced reduced-motion
 * switch or a synthetic dispatch, so the emitted motion stays observable. */
async function assertSettledTransform(link: Locator, endpoint: string, timeout = 1_000) {
  await expect.poll(async () => (await linkPaint(link)).transform, { timeout }).toBe(endpoint);
  return link.evaluate(
    (anchor, expected) =>
      new Promise<string>((resolve, reject) => {
        const surface = anchor.querySelector<HTMLElement>('[data-pui-root]') ?? anchor;
        let previous = '';
        let stable = 0;
        let frame = 0;
        const step = () => {
          const next = getComputedStyle(surface).transform;
          stable = next === previous ? stable + 1 : 0;
          previous = next;
          if (stable >= 2 && next === expected) return resolve(next);
          if (++frame > 240)
            return reject(new Error(`native transition did not settle at ${expected}`));
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    endpoint
  );
}

async function assertSocialPaint(
  page: Page,
  links: Locator,
  family: string,
  capture: (state: string, evidence: unknown) => Promise<void>
) {
  const first = links.first();
  await page.mouse.move(1400, 950);
  // P-SHADCN-SURFACE-ACTION-APPEARANCE (draft): community icons opt into Rhea.
  // MIT shadcn-ui/ui@3d98900e9b73c45f035f8109e9d41ba6a51685e7,
  // style-rhea.css .cn-button and .cn-button-variant-secondary.
  // Both SocialIcons entries and the static chrome default author secondary.
  const hoverToken =
    family === 'brutalist'
      ? 'translate-x-1'
      : 'bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]';
  const pressToken = family === 'brutalist' ? 'translate-y-1' : 'translate-y-px';
  await expect.poll(async () => (await linkPaint(first)).tokens).not.toContain(hoverToken);
  const baseline = await linkPaint(first);
  if (family === 'shadcn') expect(baseline.tokens).toContain('bg-secondary');
  await capture('baseline', { observed: baseline });
  await first.hover();
  await expect.poll(async () => (await linkPaint(first)).tokens).toContain(hoverToken);
  if (family === 'shadcn')
    await expect
      .poll(async () => (await linkPaint(first)).background)
      .not.toBe(baseline.background);
  const hoverTransform =
    family === 'brutalist' ? await assertSettledTransform(first, 'matrix(1, 0, 0, 1, 4, 4)') : null;
  const hovered = await linkPaint(first);
  if (family === 'brutalist') {
    // Accepted #800 Button-like role: settle +4/+4 into its 4px shadow.
    expect(baseline.shadow).toContain('4px 4px 0px');
    // SVG-only content has no typography subject. Text is verified on the
    // actual public Text owner by assertHostCurrentProjection below.
    expect(hoverTransform).toBe('matrix(1, 0, 0, 1, 4, 4)');
    expect(hovered.transform, 'hover must keep the settled endpoint').toBe(hoverTransform);
    expect(hovered.tokens).toContain('shadow-none');
    expect(hovered.shadow).not.toBe(baseline.shadow);
    expect(hovered.background).toBe(baseline.background);
  }
  await capture('hover', { baseline, observed: hovered, hoverTransform });
  for (const hit of hovered.edgeHits)
    expect(hit.hitIsAnchor, `${family} hovered ${hit.edge} paint must hit its native anchor`).toBe(
      true
    );

  await nativeActionLabel(page, `social-${family}-primary-down`);
  await page.mouse.down();
  try {
    await expect.poll(async () => (await linkPaint(first)).nativePressed).toBe(true);
    if (family === 'brutalist')
      await expect.poll(async () => (await linkPaint(first)).tokens).toContain(pressToken);
    else {
      await expect.poll(async () => (await linkPaint(first)).tokens).toContain(pressToken);
      // transition-all is the repository's 150ms emitter; sample its endpoint
      // within the unchanged 1000ms Vitest poll budget, not a longer delay.
      await expect
        .poll(async () => (await linkPaint(first)).transform, { timeout: 1000 })
        .toBe('matrix(1, 0, 0, 1, 0, 1)');
    }
  } catch (error) {
    await saveNativeTrace(page, `social-${family}-press-failure`, {
      family,
      observed: await linkPaint(first),
    });
    throw error;
  }
  const pressed = await linkPaint(first);
  if (family === 'brutalist') {
    expect(pressed.tokens).toContain('shadow-none');
    expect(pressed.transform).toBe(hovered.transform);
    expect(pressed.shadow).toBe(hovered.shadow);
  } else {
    // Explicit Rhea appearance adds only the specified one-pixel press feedback.
    // The anchor still owns activation; no Button semantics or shadow removal.
    expect(pressed.tokens).not.toContain('shadow-none');
    expect(pressed.transform).toBe('matrix(1, 0, 0, 1, 0, 1)');
    expect(pressed.shadow).toBe(hovered.shadow);
  }
  await capture('pressed', { baseline: hovered, observed: pressed });
  for (const hit of pressed.edgeHits)
    expect(hit.hitIsAnchor, `${family} pressed ${hit.edge} paint must hit its native anchor`).toBe(
      true
    );
  // Release off the link: observe real pointer facts without navigating.
  await page.mouse.move(1400, 950);
  await page.mouse.up();
  await expect.poll(async () => (await linkPaint(first)).tokens).not.toContain(pressToken);
  await expect.poll(async () => (await linkPaint(first)).background).toBe(baseline.background);

  await first.focus();
  await page.keyboard.press('Tab');
  expect(await links.nth(1).evaluate((anchor) => anchor === document.activeElement)).toBe(true);
  const focusToken = family === 'brutalist' ? 'ring-2' : 'ring-3';
  // Token admission can precede the real Surface transition endpoint. Retain
  // both painted endpoints within the existing 1s paint-observation budget.
  await expect
    .poll(
      async () => {
        const paint = await linkPaint(first);
        return !paint.tokens.includes(focusToken) && paint.paintSettled;
      },
      { timeout: 1_000 }
    )
    .toBe(true);
  const unfocused = await linkPaint(first);
  expect(unfocused.tokens).not.toContain(focusToken);
  await page.keyboard.press('Shift+Tab');
  await expect
    .poll(
      async () => {
        const paint = await linkPaint(first);
        return paint.tokens.includes(focusToken) && paint.paintSettled;
      },
      { timeout: 1_000 }
    )
    .toBe(true);
  const focused = await linkPaint(first);
  expect(focused.focused).toBe(true);
  if (family === 'brutalist') {
    expect(focused.tokens).toEqual(
      expect.arrayContaining(['ring-ring', 'ring-offset-2', 'ring-offset-background'])
    );
    expect(focused.ringWidth).toBe('2px');
    expect(focused.ringOffset).toBe('2px');
  } else {
    expect(focused.tokens).toEqual(expect.arrayContaining(['border-ring', 'ring-ring/30']));
    expect(focused.tokens).not.toContain('ring-offset-2');
    expect(focused.ringWidth).toBe('3px');
    // No offset is authored; the CSS emitter uses a 0px fallback when unset.
    expect(['', '0px']).toContain(focused.ringOffset);
  }
  expect(focused.ringColor).not.toMatch(/^(?:|transparent|rgba\(0, 0, 0, 0\))$/);
  expect(focused.shadow).not.toBe(unfocused.shadow);
  expect(focused.visibleTarget).toBe(true);
  expect(focused.unclipped).toBe(true);
  await capture('focus', { baseline: unfocused, observed: focused });
}

async function assertHostCurrentProjection(link: Locator, family: string) {
  const baseline = await linkPaint(link);
  if (family === 'brutalist') {
    expect(baseline.textTokens).toContain('font-sans');
    expect(baseline.font).toContain('DM Sans');
  }
  const original = await link.getAttribute('aria-current');
  // Explicit host fixture, not a claim that route selection changed itself.
  await link.evaluate((anchor) => anchor.setAttribute('aria-current', 'page'));
  try {
    // The current projection is family specific. The Brutalist navigation row
    // underlines its current entry; the Rhea navigation row is a public minimal
    // action profile whose current signal is the ghost background on the
    // passive Surface, never a text underline.
    // P-SHADCN-SURFACE-ACTION-APPEARANCE and
    // internal/records/2026-10-29-header-shared-control-recipes.md own that
    // decision: hover/current background replaces the shared nav/text
    // underline for navigation.
    await expect
      .poll(async () => (await linkPaint(link)).textTokens)
      .toContain(family === 'brutalist' ? 'underline' : 'font-semibold');
    const current = await linkPaint(link);
    expect(current.textTokens).toContain('font-semibold');
    if (family === 'brutalist') {
      expect(current.textTokens).toContain('underline');
      expect(current.decoration).toContain('underline');
      expect(current.decoration).not.toBe(baseline.decoration);
    } else {
      expect(current.textTokens).not.toContain('underline');
      expect(current.decoration).not.toContain('underline');
      expect(current.decoration).toBe(baseline.decoration);
      // The current navigation row carries the public ghost background.
      expect(current.tokens).toContain('bg-muted');
    }
    expect(Number(current.weight)).toBeGreaterThan(Number(baseline.weight));
  } finally {
    await link.evaluate((anchor, original) => {
      if (original === null) anchor.removeAttribute('aria-current');
      else anchor.setAttribute('aria-current', original);
    }, original);
  }
  await expect.poll(async () => (await linkPaint(link)).decoration).toBe(baseline.decoration);
  await expect.poll(async () => (await linkPaint(link)).weight).toBe(baseline.weight);
}

async function assertNavigationFocus(page: Page, link: Locator) {
  await link.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await link.focus();
  await page.keyboard.press('Tab');
  await expect
    .poll(
      async () => {
        const paint = await linkPaint(link);
        return !paint.tokens.includes('ring-2') && paint.paintSettled;
      },
      { timeout: 1_000 }
    )
    .toBe(true);
  const baseline = await linkPaint(link);
  await page.keyboard.press('Shift+Tab');
  await expect
    .poll(
      async () => {
        const paint = await linkPaint(link);
        return paint.tokens.includes('ring-2') && paint.paintSettled;
      },
      { timeout: 1_000 }
    )
    .toBe(true);
  const observed = await linkPaint(link);
  expect(observed.focused).toBe(true);
  expect(observed.tokens).toEqual(
    expect.arrayContaining(['ring-ring', 'ring-offset-2', 'ring-offset-background'])
  );
  expect(observed.ringWidth).toBe('2px');
  expect(observed.ringOffset).toBe('2px');
  expect(observed.ringColor).not.toMatch(/^(?:|transparent|rgba\(0, 0, 0, 0\))$/);
  expect(observed.shadow).not.toBe(baseline.shadow);
  expect(observed.visibleTarget).toBe(true);
  expect(observed.unclipped).toBe(true);
  return { baseline, observed };
}

async function assertHeaderPopupSurface(
  page: Page,
  family: 'shadcn' | 'brutalist',
  runtime: string,
  homepage: boolean
) {
  const panel = page.locator('[data-site-header-panel]');
  await expect
    .poll(() => panel.getAttribute('data-header-surface-runtime'), { timeout: 10000 })
    .toBe(runtime);
  expect(await panel.locator('.site-header-popup-surface').count()).toBe(1);
  const paint = await panel.evaluate((panel) => {
    const surface = panel.querySelector<HTMLElement>('.site-header-popup-surface')!;
    const content = panel.querySelector('[data-site-header-panel-content]')!;
    const style = getComputedStyle(surface);
    const outer = getComputedStyle(panel);
    const bounds = surface.getBoundingClientRect();
    const value = document.createElement('span');
    value.style.cssText = 'position:absolute;visibility:hidden;width:var(--pui-radius-xl);height:0';
    value.style.setProperty('--pui-radius', style.getPropertyValue('--pui-radius'));
    value.style.setProperty('--pui-radius-xl', style.getPropertyValue('--pui-radius-xl'));
    document.body.append(value);
    const declaredShadcnRadius = parseFloat(getComputedStyle(value).width);
    value.remove();
    return {
      role: surface.getAttribute('role'),
      tabindex: surface.getAttribute('tabindex'),
      contentInside: surface.contains(content),
      prototype: surface.getAttribute('data-projection-prototype'),
      tokens: surface.getAttribute('data-pui-style'),
      runtime: (panel as HTMLElement).dataset.headerSurfaceRuntime,
      family: (panel as HTMLElement).dataset.headerSurfaceFamily,
      generation: (panel as HTMLElement).dataset.headerSurfaceGeneration,
      pageGeneration:
        document.querySelector<HTMLElement>('[data-homepage-runtime]')?.dataset.runtimeGeneration,
      width: bounds.width,
      height: bounds.height,
      right: bounds.right,
      left: bounds.left,
      radius: parseFloat(style.borderTopLeftRadius),
      declaredShadcnRadius,
      border: parseFloat(style.borderTopWidth),
      shadow: style.boxShadow,
      outerBorder: parseFloat(outer.borderTopWidth),
      outerShadow: outer.boxShadow,
      outerBackground: outer.backgroundColor,
      nestedNativeMenus: panel.querySelectorAll('[role="menu"], [role="dialog"]').length,
    };
  });
  await captureLinks(
    page,
    `${homepage ? 'home' : 'docs'}-${family}-${runtime}-menu-surface`,
    family,
    runtime,
    'open-native-disclosure; one-real-family-surface',
    paint
  );
  expect(paint.family).toBe(family);
  expect(paint.runtime).toBe(runtime);
  if (homepage) expect(paint.generation).toBe(paint.pageGeneration);
  expect(paint.prototype).toBe(`${family}-surface-root`);
  expect(paint.contentInside).toBe(true);
  expect(paint.role).toBeNull();
  expect(paint.tabindex).toBeNull();
  expect(paint.nestedNativeMenus).toBe(0);
  expect(paint.width).toBeGreaterThan(200);
  expect(paint.height).toBeGreaterThan(44);
  expect(paint.left).toBeGreaterThanOrEqual(0);
  expect(paint.right).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(paint.outerBorder).toBe(0);
  expect(paint.outerShadow).toBe('none');
  expect(['transparent', 'rgba(0, 0, 0, 0)']).toContain(paint.outerBackground);
  expect(paint.border).toBe(family === 'brutalist' ? 2 : 1);
  // Popup role is flat in both app families; #800 Brutalist uses the 5px base radius.
  expect(paint.radius).toBe(family === 'brutalist' ? 5 : paint.declaredShadcnRadius);
  expect(paint.shadow).toBe('none');
}

describe.sequential('native links with app-owned Proto visual surfaces', () => {
  it('preserves real link targets and uniform social visuals through all runtime/family transitions', async () => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      colorScheme: 'light',
    });
    const page = await context.newPage();
    await installNativeTrace(page);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.goto(`${baseUrl}/zh-cn/`, { waitUntil: 'networkidle' });
      await ready(page, 'wc', 'shadcn');
      for (const family of ['brutalist', 'shadcn'] as const) {
        await choose(
          page,
          '[data-homepage-runtime] [data-projection-generation-state="active"] [data-projection-control="family"]',
          family === 'brutalist' ? 'Brutalist' : 'Shadcn'
        );
        await page.waitForFunction((family) => {
          const root = document.querySelector<HTMLElement>('[data-homepage-runtime]');
          return root?.dataset.runtimeState === 'ready' && root.dataset.family === family;
        }, family);
        for (const runtime of RUNTIMES) {
          await choose(
            page,
            '[data-homepage-runtime] [data-projection-generation-state="active"] [data-projection-control="runtime"]',
            labels[runtime]
          );
          await ready(page, runtime, family);
          const heroCTA = page.locator(
            '#homepage-hero-actions [data-projection-generation-state="active"] a[href="#home-demo-previewer"]'
          );
          expect(await heroCTA.count()).toBe(1);
          expect((await heroCTA.textContent())?.trim()).toBe('试试 Demo');
          expect(await heroCTA.getAttribute('href')).toBe('#home-demo-previewer');
          expect(await heroCTA.getAttribute('data-home-action-icon')).toBeNull();
          expect(await heroCTA.locator('svg').count()).toBe(0);
          expect(
            (
              (await heroCTA
                .locator(`[data-projection-prototype="${family}-surface-root"]`)
                .getAttribute('data-pui-style')) ?? ''
            ).split(/\s+/)
          ).toContain(family === 'brutalist' ? 'bg-secondary-background' : 'bg-secondary');
          await openSettings(page);
          // Each journey measures viewport hit targets. Earlier keyboard/focus
          // actions may scroll the document while the Header remains sticky.
          await page.evaluate(() => scrollTo(0, 0));
          const links = page.locator('#home-social [data-projection-generation-state="active"] a');
          await expect.poll(() => links.count()).toBe(4);
          const facts = await links.evaluateAll((anchors) =>
            anchors.map((anchor) => {
              const surface = anchor.querySelector<HTMLElement>('[data-pui-root]')!;
              const box = anchor.getBoundingClientRect();
              const visual = surface.getBoundingClientRect();
              const style = getComputedStyle(surface);
              return {
                name: anchor.getAttribute('aria-label'),
                href: anchor.getAttribute('href'),
                target: anchor.getAttribute('target'),
                rel: anchor.getAttribute('rel'),
                role: anchor.getAttribute('role'),
                tag: anchor.tagName,
                tabStops: anchor.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')
                  .length,
                anchorRect: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
                surfaceRect: {
                  left: visual.left,
                  top: visual.top,
                  right: visual.right,
                  bottom: visual.bottom,
                },
                width: visual.width,
                height: visual.height,
                border: style.borderTopWidth,
                radius: style.borderTopLeftRadius,
                shadow: style.boxShadow,
                nativeCoversSurface:
                  box.left <= visual.left + 0.5 &&
                  box.top <= visual.top + 0.5 &&
                  box.right >= visual.right - 0.5 &&
                  box.bottom >= visual.bottom - 0.5,
                topLeftHitInside:
                  anchor === document.elementFromPoint(visual.left + 3, visual.top + 3),
                centerHitIsAnchor:
                  anchor ===
                  document.elementFromPoint(
                    visual.left + visual.width / 2,
                    visual.top + visual.height / 2
                  ),
              };
            })
          );
          expect(facts.map((fact) => fact.name)).toEqual(['GitHub', 'Discord', 'X', 'Bluesky']);
          expect(
            new Set(
              facts.map((fact) => `${fact.width}/${fact.height}/${fact.border}/${fact.radius}`)
            ).size
          ).toBe(1);
          const expectedSocial = [
            { name: 'GitHub', href: socialDestinations.github },
            { name: 'Discord', href: socialDestinations.discord },
            { name: 'X', href: socialDestinations.x },
            { name: 'Bluesky', href: socialDestinations.bluesky },
          ];
          for (const [index, fact] of facts.entries()) {
            expect(
              nativeLinkEvidenceIssues(
                { ...fact, nestedFocus: fact.tabStops, cornerHitIsAnchor: fact.topLeftHitInside },
                { ...expectedSocial[index]!, target: '_blank', rel: 'noreferrer' }
              )
            ).toEqual([]);
            expect(fact.tag).toBe('A');
            expect(fact.role).toBeNull();
            expect(fact.target).toBe('_blank');
            expect(fact.rel).toBe('noreferrer');
            expect(fact.href).toMatch(/^https:\/\//);
            expect(fact.tabStops).toBe(0);
            expect(fact.width).toBeGreaterThanOrEqual(44);
            expect(fact.height).toBeGreaterThanOrEqual(44);
            expect(fact.nativeCoversSurface).toBe(true);
            expect(fact.topLeftHitInside).toBe(true);
            expect(fact.centerHitIsAnchor).toBe(true);
            if (family === 'brutalist') {
              expect(fact.border).toBe('2px');
              expect(fact.radius).toBe('5px');
              expect(fact.shadow).toContain('4px 4px 0px');
            }
          }
          const footprints = await page
            .locator(
              '[data-homepage-actions] [data-projection-generation-state="active"] a:visible'
            )
            .evaluateAll((anchors) =>
              anchors.map((anchor) => {
                const surface = anchor.querySelector<HTMLElement>('[data-pui-root]')!;
                const visual = surface.getBoundingClientRect();
                const native = anchor.getBoundingClientRect();
                const group = anchor.closest('[data-homepage-actions]')!;
                // owner-bounded-start: use direct generation children, not an ancestor selector.
                const mount = Array.from(group.children).find((node) =>
                  node.hasAttribute('data-homepage-mount')
                );
                if (!mount) throw new Error('Native action group mount is missing');
                const generations = Array.from(mount.children).filter(
                  (node) => node.getAttribute('data-projection-generation-state') === 'active'
                );
                if (generations.length !== 1)
                  throw new Error('Native action group requires exactly one active generation');
                if (!(anchor instanceof HTMLAnchorElement))
                  throw new Error('Expected a native anchor in its navigation owner');
                const index = Array.from(generations[0].querySelectorAll('a')).indexOf(anchor);
                const source = group
                  .querySelector('[data-homepage-fallback]')
                  ?.querySelectorAll('a')[index];
                if (index < 0 || !source)
                  throw new Error('Native anchor has no source in its own action group');
                // owner-bounded-end
                const identity = (link: Element) => ({
                  href: link.getAttribute('href'),
                  name: link.getAttribute('aria-label') ?? link.textContent?.trim() ?? null,
                  target: link.getAttribute('target'),
                  rel: link.getAttribute('rel'),
                });
                const describe = (element: Element | null) => {
                  if (!element) return null;
                  const rect = element.getBoundingClientRect();
                  const style = getComputedStyle(element);
                  return {
                    tag: element.tagName,
                    id: element.id,
                    class: element.getAttribute('class'),
                    html: element.outerHTML.slice(0, 800),
                    rect: {
                      left: rect.left,
                      top: rect.top,
                      right: rect.right,
                      bottom: rect.bottom,
                    },
                    pointerEvents: style.pointerEvents,
                    position: style.position,
                    zIndex: style.zIndex,
                    transform: style.transform,
                    visibility: style.visibility,
                  };
                };
                const hit = (x: number, y: number) => {
                  const target = document.elementFromPoint(x, y);
                  return {
                    x,
                    y,
                    isAnchor: target === anchor,
                    insideViewport: x >= 0 && y >= 0 && x < innerWidth && y < innerHeight,
                    target: describe(target),
                    stack: document.elementsFromPoint(x, y).slice(0, 6).map(describe),
                  };
                };
                const centerHit = hit(
                  visual.left + visual.width / 2,
                  visual.top + visual.height / 2
                );
                const cornerHit = hit(visual.left + 3, visual.top + 3);
                return {
                  ...identity(anchor),
                  expected: identity(source),
                  tag: anchor.tagName,
                  role: anchor.getAttribute('role'),
                  centerHitIsAnchor: centerHit.isAnchor,
                  cornerHitIsAnchor: cornerHit.isAnchor,
                  hitDiagnostics: {
                    centerHit,
                    cornerHit,
                    anchor: describe(anchor),
                    surface: describe(surface),
                    documentX: scrollX,
                    documentY: scrollY,
                    viewport: { width: innerWidth, height: innerHeight },
                  },
                  anchorRect: {
                    left: native.left,
                    top: native.top,
                    right: native.right,
                    bottom: native.bottom,
                  },
                  surfaceRect: {
                    left: visual.left,
                    top: visual.top,
                    right: visual.right,
                    bottom: visual.bottom,
                  },
                  nestedFocus: anchor.querySelectorAll(
                    'a[href],button,input,select,textarea,[tabindex]'
                  ).length,
                };
              })
            );
          // Persist the actual hit node/stack and both rectangles before a
          // strict assertion can fail; descendant or overlaid hits remain red.
          await captureLinks(
            page,
            `homepage-${family}-${runtime}-native-hit-targets`,
            family,
            runtime,
            'menu-open; exact-native-anchor-hit-samples',
            { social: facts, footprints }
          );
          expect(footprints.length).toBeGreaterThan(4);
          for (const footprint of footprints)
            expect(
              nativeLinkEvidenceIssues(footprint, footprint.expected),
              String(footprint.name)
            ).toEqual([]);
          await assertHeaderPopupSurface(page, family, runtime, true);
          for (const direction of ['ltr', 'rtl'] as const) {
            await page.evaluate((direction) => {
              document.documentElement.dir = direction;
            }, direction);
            // Reopen from the actual command so its anchor is measured after
            // host direction changes; do not inject panel geometry in evidence.
            const menu = page.locator(
              '[data-homepage-menu-label] [role="button"], [data-site-menu-button]'
            );
            if ((await menu.getAttribute('aria-expanded')) === 'true') await menu.click();
            await openSettings(page);
            await assertSocialPaint(page, links, family, async (state, evidence) => {
              await captureLinks(
                page,
                `homepage-${family}-${runtime}-${direction}-${state}`,
                family,
                runtime,
                `menu-open; actual-${direction}-social-${state}`,
                evidence
              );
            });
          }
          await page.evaluate(() => {
            document.documentElement.dir = 'ltr';
          });
          await assertHostCurrentProjection(
            page
              .locator('#home-navigation-desktop [data-projection-generation-state="active"] a')
              .first(),
            family
          );
          expect(
            (
              await linkPaint(
                page
                  .locator('#homepage-whitepaper [data-projection-generation-state="active"] a')
                  .first()
              )
            ).whiteSpace
          ).toBe('normal');
          await page.keyboard.press('Escape');
        }
      }
      expect(errors).toEqual([]);
    } finally {
      await saveNativeTrace(page, 'homepage-native-paint-final');
      await context.close();
    }
  }, 150_000);

  it('keeps Enter/new-tab/modifier/middle/context-menu semantics native and does not activate on Space', async () => {
    // Trusted Ctrl/middle activation is issued by the browser before any
    // Playwright target exists, so `context.route` cannot serve its first
    // document. This cell owns the only network path to an admitted external
    // host instead; see startNativeDestinationIsolation.
    const isolation = await startNativeDestinationIsolation();
    let isolatedBrowser: Browser;
    try {
      isolatedBrowser = await launchNativeDestinationBrowser(isolation.proxyServer);
    } catch (error) {
      await isolation.close();
      throw error;
    }
    const context = await isolatedBrowser
      .newContext({
        viewport: { width: 1440, height: 1000 },
        colorScheme: 'light',
      })
      .catch(async (error: unknown) => {
        await isolatedBrowser.close();
        await isolation.close();
        throw error;
      });
    const page = await context.newPage().catch(async (error: unknown) => {
      await context.close();
      await isolatedBrowser.close();
      await isolation.close();
      throw error;
    });
    await installNativeTrace(page);
    try {
      await page.goto(`${baseUrl}/zh-cn/`, { waitUntil: 'networkidle' });
      await ready(page, 'wc', 'shadcn');
      await openSettings(page);
      const link = page.locator(
        '#home-social [data-projection-generation-state="active"] a[aria-label="GitHub"]'
      );
      const href = (await link.getAttribute('href'))!;
      // Plain-native controls distinguish a broken browser/popup fixture from
      // the application bridge. This page is not claimed as product UI.
      const controlPage = await context.newPage();
      await controlPage.setContent(
        '<a id="native-control" target="_blank" rel="noreferrer">Native navigation control</a>'
      );
      await installNativeTrace(controlPage, true);
      const control = controlPage.locator('#native-control');
      await control.evaluate((anchor, href) => anchor.setAttribute('href', href), href);
      try {
        await nativeActionLabel(controlPage, 'plain-native:cancel-negative-control');
        await control.evaluate((anchor) =>
          anchor.addEventListener('click', (event) => event.preventDefault(), { once: true })
        );
        const count = context.pages().length;
        await control.click({ modifiers: ['ControlOrMeta'] });
        const cancelled = await saveNativeTrace(controlPage, 'plain-native-negative-control');
        expect(cancelled.filter((event) => event.type === 'click').at(-1)).toMatchObject({
          trusted: true,
          preventedAfterDispatch: true,
        });
        expect(context.pages()).toHaveLength(count);
        for (const action of ['modifier', 'middle', 'enter'] as const)
          await nativePopup(controlPage, control, action, 'plain-native', isolation);
        await saveNativeTrace(controlPage, 'plain-native-positive-controls');
      } finally {
        await controlPage.close();
      }
      await page.bringToFront();
      await openSettings(page);
      for (const action of ['modifier', 'middle', 'enter'] as const) {
        // Successful native navigation intentionally dismisses its parent menu.
        await page.bringToFront();
        await openSettings(page);
        await nativePopup(page, link, action, 'homepage-social', isolation);
      }
      await page.bringToFront();
      await openSettings(page);
      const location = page.url();
      await link.focus();
      await page.keyboard.press('Space');
      // Store the actual Event during capture, then inspect it in a new
      // evaluate task after right-click dispatch has returned. A capture-phase
      // microtask can run before native target/bubble handlers finish.
      for (const cancelAtTarget of [true, false]) {
        await link.evaluate((anchor, cancelAtTarget) => {
          const observed = anchor as HTMLElement & { __testContextMenuEvent?: Event };
          delete observed.__testContextMenuEvent;
          document.addEventListener(
            'contextmenu',
            (event) => {
              observed.__testContextMenuEvent = event;
            },
            { capture: true, once: true }
          );
          if (cancelAtTarget)
            anchor.addEventListener('contextmenu', (event) => event.preventDefault(), {
              once: true,
            });
        }, cancelAtTarget);
        await link.click({ button: 'right' });
        const observed = await link.evaluate((anchor) => {
          const event = (anchor as HTMLElement & { __testContextMenuEvent?: Event })
            .__testContextMenuEvent;
          return { prevented: event?.defaultPrevented, trusted: event?.isTrusted };
        });
        // The negative control must catch a later target listener's cancel.
        expect(observed.prevented).toBe(cancelAtTarget);
        expect(observed.trusted).toBe(true);
      }
      // Negative control: an unadmitted external document must be refused, so a
      // leaked popup can neither look green nor reach another host.
      const leaked = await context.newPage();
      const leakOutcome = await leaked
        .goto('https://example.test/native-navigation-leak', {
          waitUntil: 'domcontentloaded',
          timeout: 10_000,
        })
        .then(
          () => null,
          (error: unknown) => String(error)
        );
      expect(leakOutcome, 'unadmitted external host must not resolve').not.toBeNull();
      expect(isolation.refusedHosts, 'unadmitted probe is refused').toContain('example.test');
      expect(
        isolation.documents.filter((entry) => entry.destination === 'document'),
        'one admitted document per trusted activation'
      ).toHaveLength(6);
      await leaked.close();
      await captureLinks(
        page,
        'homepage-native-navigation-destinations',
        'shadcn',
        'wc',
        'trusted-native-activation-through-loopback-destination-proxy',
        { documents: isolation.documents, refusedHosts: isolation.refusedHosts }
      );
      expect(page.url()).toBe(location);
      expect(context.pages()).toHaveLength(1);
      expect(await link.getAttribute('role')).toBeNull();
    } finally {
      await saveNativeTrace(page, 'homepage-native-navigation-final');
      await context.close();
      await isolatedBrowser.close();
      await isolation.close();
    }
  }, 90_000);

  it('records the documentation menu with four same-family social links and native focus', async () => {
    for (const [family, route] of [
      ['shadcn', '/zh-cn/ui-libraries/shadcn/button/'],
      ['brutalist', '/zh-cn/ui-libraries/brutalist/components/button/'],
    ] as const) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        colorScheme: family === 'brutalist' ? 'dark' : 'light',
      });
      const page = await context.newPage();
      try {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
        await page
          .locator(
            'a[data-site-native-link][aria-label="GitHub"] :is(wc-site-shadcn-surface,wc-site-brutalist-surface)'
          )
          .waitFor({ state: 'attached' });
        const group = page
          .locator('.sidebar-pane details')
          .filter({ has: page.locator('a[aria-current="page"]') })
          .last();
        const summary = group.locator(':scope > summary');
        await summary.scrollIntoViewIfNeeded();
        const summaryPaint = () =>
          summary.evaluate((element) => {
            const surface = element.querySelector<HTMLElement>('[data-pui-root]')!;
            const style = getComputedStyle(surface);
            return {
              open: (element.parentElement as HTMLDetailsElement).open,
              surface: surface.localName,
              tokens: surface.getAttribute('data-pui-style'),
              border: style.borderBottomWidth,
              height: surface.getBoundingClientRect().height,
              focused: element === document.activeElement,
              nestedInteractive: element.querySelectorAll('a,button,[tabindex]').length,
            };
          });
        const original = await summaryPaint();
        expect(original.open).toBe(true);
        expect(original.surface).toBe(`wc-site-${family}-surface`);
        expect(original.height).toBeCloseTo(32, 0);
        expect(original.nestedInteractive).toBe(0);
        if (family === 'brutalist') expect(original.border).toBe('2px');
        await summary.click();
        await expect.poll(async () => (await summaryPaint()).open).toBe(false);
        await page.keyboard.press('Space');
        await expect.poll(async () => (await summaryPaint()).open).toBe(true);
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        const focused = await summaryPaint();
        expect(focused.focused).toBe(true);
        expect(focused.tokens).toContain('ring-2');
        await captureLinks(
          page,
          `docs-${family}-group-focus`,
          family,
          'wc',
          'native-summary; Space restores open; family Surface/Text focus',
          { original, focused }
        );
        await openSettings(page);
        await assertHeaderPopupSurface(page, family, 'wc', false);
        const links = page.locator('.site-social-links a[data-site-native-link]');
        expect(await links.count()).toBe(4);
        await assertSocialPaint(page, links, family, async (state, evidence) => {
          await captureLinks(
            page,
            `docs-${family}-${state}`,
            family,
            'wc',
            `menu-open; four-social-group; first-social-${state}`,
            evidence
          );
        });
        await assertHostCurrentProjection(
          page.locator('[data-site-header-desktop-navigation] a').first(),
          family
        );
      } finally {
        await context.close();
      }
    }
  }, 90_000);

  it('projects a same-event CSSOM theme edit by the next frame after native focus', async () => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      colorScheme: 'light',
    });
    const page = await context.newPage();
    let phase = 'navigation';
    try {
      await page.goto(`${baseUrl}/zh-cn/ui-libraries/shadcn/button/`, { waitUntil: 'networkidle' });
      const links = page.locator(
        '.sidebar-pane .top-level a[data-site-link-enhanced]:not([aria-current="page"]):visible'
      );
      phase = 'waiting for two enhanced inactive sidebar anchors';
      await links.nth(1).waitFor();
      await links.first().scrollIntoViewIfNeeded();
      await page.mouse.move(0, 0);
      phase = 'installing same-event CSSOM observation';
      await links.evaluateAll((links) => {
        const [first, second] = links as HTMLAnchorElement[];
        const style = document.createElement('style');
        document.head.append(style);
        // Installed after the native fact bridge. Its first sample precedes
        // this CSSOM edit; actual focus publishes another fact in this event.
        (window as Window & { __nativeThemeFrame?: Promise<unknown> }).__nativeThemeFrame =
          new Promise((resolve) => {
            first.addEventListener(
              'pointerenter',
              () => {
                style.sheet!.insertRule(':root{--pui-foreground:#ff0000!important}');
                second.focus();
                requestAnimationFrame(() => {
                  const text = second.querySelector<HTMLElement>('wc-site-shadcn-text')!;
                  resolve({
                    rootTheme: getComputedStyle(document.documentElement)
                      .getPropertyValue('--pui-foreground')
                      .trim(),
                    textTheme: text.style.getPropertyValue('--pui-foreground').trim(),
                    textColor: getComputedStyle(text).color,
                    focused: document.activeElement === second,
                    nativeOwnerRetained: text.closest('a') === second,
                  });
                });
              },
              { once: true }
            );
          });
      });
      phase = 'triggering native pointerenter';
      await links.first().hover();
      phase = 'reading the first animation frame';
      const observed = await page.evaluate(
        () => (window as Window & { __nativeThemeFrame?: Promise<unknown> }).__nativeThemeFrame
      );
      await captureLinks(
        page,
        'docs-shadcn-cssom-focus-next-frame',
        'shadcn',
        'wc',
        'native-pointerenter; CSSOM-theme-edit; native-focus; first-frame-observation',
        observed
      );
      phase = 'asserting first-frame palette and native focus';
      expect(observed).toEqual({
        rootTheme: '#ff0000',
        textTheme: '#ff0000',
        textColor: 'rgb(255, 0, 0)',
        focused: true,
        nativeOwnerRetained: true,
      });
    } catch (error) {
      // Keep the original failure, including a failed precondition. Do not
      // leave a selector timeout without the actual sidebar marker values.
      const sidebar = await page
        .evaluate(() => {
          const anchors = Array.from(
            document.querySelectorAll<HTMLAnchorElement>('.sidebar-pane .top-level a')
          ).map((link) => ({
            href: new URL(link.href).pathname,
            ariaCurrent: link.getAttribute('aria-current'),
            enhanced: link.dataset.siteLinkEnhanced ?? null,
            visible: link.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
            publicText: !!link.querySelector('wc-site-shadcn-text'),
          }));
          return {
            route: location.pathname,
            total: anchors.length,
            visibleInactiveEnhanced: anchors.filter(
              (anchor) => anchor.visible && anchor.enhanced && anchor.ariaCurrent !== 'page'
            ).length,
            anchors: anchors.slice(0, 40),
          };
        })
        .catch((diagnosticError) => ({ diagnosticError: safeError(diagnosticError, baseUrl) }));
      await captureLinks(
        page,
        'docs-shadcn-cssom-focus-next-frame-failure',
        'shadcn',
        'wc',
        phase,
        { error: safeError(error, baseUrl), sidebar }
      ).catch((captureError) =>
        console.error('CSSOM fixture diagnostic capture failed', safeError(captureError, baseUrl))
      );
      throw error;
    } finally {
      await context.close();
    }
  }, 60_000);

  it('preserves real pagination selection endpoints and arrow layout through family replacement', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/en/ui-libraries/shadcn/button/`, { waitUntil: 'networkidle' });
      await page.locator('.pagination-links a[data-site-link-enhanced]').first().waitFor();
      for (const endpoint of ['text', 'container', 'text-wrapper', 'surface-wrapper'] as const)
        for (const direction of ['forward', 'backward'] as const) {
          await page.evaluate(
            ({ kind, direction }) => {
              const link = document.querySelector<HTMLAnchorElement>(
                '.pagination-links a[data-site-link-enhanced]'
              )!;
              const label = link.querySelector<HTMLElement>('.link-title')!;
              const node =
                kind === 'text'
                  ? label.firstChild!
                  : kind === 'container'
                    ? label
                    : kind === 'text-wrapper'
                      ? label.closest('[data-site-link-text]')!
                      : link.firstElementChild!;
              const end = kind === 'text' ? node.textContent!.length : node.childNodes.length;
              const selection = document.getSelection()!;
              selection.setBaseAndExtent(
                node,
                direction === 'backward' ? end : 0,
                node,
                direction === 'backward' ? 0 : end
              );
              (window as any).__paginationSelection = {
                link,
                label,
                node,
                end,
                text: selection.toString(),
                href: link.getAttribute('href'),
                direction,
                wrapper: kind.endsWith('wrapper'),
              };
            },
            { kind: endpoint, direction }
          );
          for (const family of ['brutalist', 'shadcn'] as const) {
            await page.evaluate((value) => {
              document.documentElement.dataset.siteLibraryFamily = value;
            }, family);
            await page.waitForFunction(
              (value) =>
                Array.from(
                  document.querySelectorAll('.pagination-links a[data-site-link-enhanced]')
                ).every((link) => link.firstElementChild?.localName === `wc-site-${value}-surface`),
              family
            );
            const evidence = await page.evaluate(() => {
              const saved = (window as any).__paginationSelection;
              const selection = document.getSelection()!;
              return {
                sameLink: saved.link.isConnected,
                sameLabel: saved.label.isConnected,
                anchor: saved.wrapper
                  ? saved.link.contains(selection.anchorNode)
                  : selection.anchorNode === saved.node,
                focus: saved.wrapper
                  ? saved.link.contains(selection.focusNode)
                  : selection.focusNode === saved.node,
                anchorOffset: selection.anchorOffset,
                wrapperRetired: saved.wrapper ? !saved.node.isConnected : false,
                wrapper: saved.wrapper,
                backward:
                  !selection.isCollapsed &&
                  !(
                    selection.getRangeAt(0).startContainer === selection.anchorNode &&
                    selection.getRangeAt(0).startOffset === selection.anchorOffset
                  ),
                focusOffset: selection.focusOffset,
                expectedEnd: saved.end,
                text: selection.toString(),
                expectedText: saved.text,
                sameHref: saved.link.getAttribute('href') === saved.href,
                layout: Array.from(
                  document.querySelectorAll<HTMLAnchorElement>(
                    '.pagination-links a[data-site-link-enhanced]'
                  )
                ).map((link) => {
                  const surface = link.firstElementChild!;
                  const arrow = surface.querySelector('svg')!;
                  const label = surface.querySelector('[data-site-link-text]')!;
                  return {
                    rel: link.rel,
                    marker: surface.hasAttribute('data-site-link-content'),
                    siblings: arrow.parentElement === label.parentElement,
                    arrowLeft: arrow.getBoundingClientRect().left,
                    labelLeft: label.getBoundingClientRect().left,
                  };
                }),
              };
            });
            expect(evidence).toMatchObject({
              sameLink: true,
              sameLabel: true,
              anchor: true,
              focus: true,

              sameHref: true,
            });
            expect(evidence.backward).toBe(direction === 'backward');
            if (!evidence.wrapper) {
              expect(evidence.anchorOffset).toBe(
                direction === 'backward' ? evidence.expectedEnd : 0
              );
              expect(evidence.focusOffset).toBe(
                direction === 'backward' ? 0 : evidence.expectedEnd
              );
            } else expect(evidence.wrapperRetired).toBe(true);
            expect(evidence.text).toBe(evidence.expectedText);
            for (const item of evidence.layout) {
              expect(item.marker).toBe(true);
              expect(item.siblings).toBe(true);
              if (item.rel === 'next') expect(item.arrowLeft).toBeGreaterThan(item.labelLeft);
              else expect(item.arrowLeft).toBeLessThan(item.labelLeft);
            }
            await captureLinks(
              page,
              `docs-pagination-${endpoint}-${direction}-${family}`,
              family,
              'wc',
              'native-directional-selection-retained',
              evidence
            );
          }
        }
    } finally {
      await context.close();
    }
  }, 90_000);

  it('keeps all social destinations available without JavaScript', async () => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/zh-cn/`, { waitUntil: 'networkidle' });
      const heroCTA = page.locator(
        '#homepage-hero-actions [data-homepage-fallback] a[href="#home-demo-previewer"]'
      );
      expect(await heroCTA.count()).toBe(1);
      expect((await heroCTA.textContent())?.trim()).toBe('试试 Demo');
      expect(await heroCTA.getAttribute('href')).toBe('#home-demo-previewer');
      expect(await heroCTA.getAttribute('data-home-action-variant')).toBe('secondary');
      expect(await heroCTA.getAttribute('data-home-action-icon')).toBeNull();
      expect(await heroCTA.locator('svg').count()).toBe(0);
      const links = page.locator('#home-social a');
      expect(await links.count()).toBe(4);
      const summary = page.locator('[data-site-header-fallback-summary]');
      expect(await summary.isVisible()).toBe(true);
      expect(await links.first().isVisible()).toBe(false);
      await summary.press('Enter');
      for (let index = 0; index < 4; index++) {
        expect(await links.nth(index).isVisible()).toBe(true);
        expect(await links.nth(index).getAttribute('href')).toMatch(/^https:\/\//);
      }
      await captureLinks(
        page,
        'hero-cta-no-js',
        'shadcn',
        'native-no-js',
        'secondary-icon-free-hero-and-native-disclosure'
      );
      await summary.press('Enter');
      expect(await links.first().isVisible()).toBe(false);
      await summary.click();
      expect(await links.first().isVisible()).toBe(true);
    } finally {
      await context.close();
    }
  }, 60_000);

  it('renders docs navigation through the same Prototype while preserving native targets and caption projection', async () => {
    for (const [family, route, colorScheme] of [
      ['shadcn', '/zh-cn/ui-libraries/shadcn/button/', 'light'],
      ['shadcn', '/zh-cn/ui-libraries/shadcn/button/', 'dark'],
      ['brutalist', '/zh-cn/ui-libraries/brutalist/components/textarea/', 'light'],
      ['brutalist', '/zh-cn/ui-libraries/brutalist/components/textarea/', 'dark'],
    ] as const) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        colorScheme,
      });
      const page = await context.newPage();
      try {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
        const selected = page
          .locator('.sidebar-pane a[aria-current="page"][data-site-link-enhanced]')
          .first();
        await selected.waitFor({ state: 'visible' });
        expect((await linkPaint(selected)).tokens).toContain(
          family === 'brutalist' ? 'bg-main' : 'bg-accent'
        );
        const sidebar = page
          .locator('.sidebar-pane a[data-site-link-enhanced]:not([aria-current="page"]):visible')
          .first();
        const baseline = await linkPaint(sidebar);
        await sidebar.hover();
        await expect
          .poll(async () => (await linkPaint(sidebar)).background)
          .not.toBe(baseline.background);
        await captureLinks(
          page,
          `nav-${family}-${colorScheme}-sidebar-hover`,
          family,
          'wc',
          'native-sidebar-hover; real-current-route',
          { baseline, observed: await linkPaint(sidebar) }
        );
        await captureLinks(
          page,
          `nav-${family}-${colorScheme}-sidebar-focus`,
          family,
          'wc',
          'native-sidebar-keyboard-focus',
          await assertNavigationFocus(page, sidebar)
        );

        const brand = page.locator('.site-header a[data-site-link-appearance="brand"]').first();
        expect(await brand.getAttribute('role')).toBeNull();
        expect(await brand.locator('[data-pui-root]').count()).toBe(2);
        expect(
          await brand
            .locator(
              `[data-pui-style~="${family === 'brutalist' ? 'bg-secondary-background' : 'bg-transparent'}"]`
            )
            .count()
        ).toBe(1);
        if (family === 'brutalist') {
          const paint = await linkPaint(brand);
          expect(paint.tokens).toEqual(
            expect.arrayContaining(['border-2', 'border-black', 'shadow-[4px_4px_0_0_#000]'])
          );
        }
        expect(await brand.locator('[data-pui-style~="font-semibold"]').count()).toBe(1);
        expect(await brand.locator('[role], [tabindex]').count()).toBe(0);
        await captureLinks(
          page,
          `nav-${family}-${colorScheme}-brand-focus`,
          family,
          'wc',
          'native-brand-keyboard-focus',
          await assertNavigationFocus(page, brand)
        );
        const toc = page.locator('sl-toc a[data-site-link-appearance="toc"]').nth(1);
        await captureLinks(
          page,
          `nav-${family}-${colorScheme}-toc-focus`,
          family,
          'wc',
          'native-toc-keyboard-focus',
          await assertNavigationFocus(page, toc)
        );
        const hash = await toc.getAttribute('href');
        await toc.click();
        expect(new URL(page.url()).hash).toBe(new URL(hash!, page.url()).hash);
        await expect.poll(() => toc.getAttribute('in-view')).not.toBeNull();
        await captureLinks(
          page,
          `nav-${family}-${colorScheme}-toc-anchor-landing`,
          family,
          'wc',
          'native-anchor-before-current-assertion',
          await page.evaluate(() => {
            const heading = document.getElementById(decodeURIComponent(location.hash.slice(1)));
            return {
              hash: location.hash,
              scrollY,
              scrollPaddingTop: getComputedStyle(document.documentElement).scrollPaddingTop,
              header: document.querySelector('header')?.getBoundingClientRect().toJSON(),
              heading: heading?.getBoundingClientRect().toJSON(),
              scrollMarginTop: heading ? getComputedStyle(heading).scrollMarginTop : null,
              links: [...document.querySelectorAll('sl-toc a')].map((e) => ({
                href: e.getAttribute('href'),
                current: e.getAttribute('aria-current'),
                inView: e.hasAttribute('in-view'),
              })),
            };
          })
        );
        await expect.poll(() => toc.getAttribute('aria-current')).toBe('true');
        // #843: current belongs to native semantics and Text; only the shared
        // range paints a background, including while the pointer stays on current.
        await toc.hover();
        await expect.poll(async () => (await linkPaint(toc)).background).toBe('rgba(0, 0, 0, 0)');
        await expect
          .poll(async () => (await linkPaint(toc)).textTokens)
          .toContain(family === 'brutalist' ? 'font-semibold' : 'font-medium');
        expect(await page.locator('sl-toc a[aria-current="true"]').count()).toBe(1);
        const tocRows = page.locator('sl-toc a[data-site-link-appearance="toc"]');
        for (const row of await tocRows.all()) {
          const paint = await linkPaint(row);
          expect(paint.background).toBe('rgba(0, 0, 0, 0)');
          for (const fill of ['bg-main', 'bg-accent', 'bg-muted'])
            expect(paint.tokens).not.toContain(fill);
        }
        // #843 restores one passive geometry mount, painted only by the
        // existing public family Surface. Keep rejecting legacy private paint.
        const range = page.locator('sl-toc > [data-site-toc-highlight][aria-hidden="true"]');
        expect(await range.count()).toBe(1);
        expect(await range.getAttribute('role')).toBeNull();
        expect(await range.getAttribute('tabindex')).toBeNull();
        const rangeSurface = range.locator(`:scope > wc-site-${family}-surface[data-pui-root]`);
        expect(await rangeSurface.count()).toBe(1);
        await expect.poll(() => rangeSurface.getAttribute('data-pui-style')).toContain('bg-muted');
        expect(
          await range.locator('[role], [tabindex], a, button, input, select, textarea').count()
        ).toBe(0);
        expect(await range.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe(
          'none'
        );
        expect(await range.evaluate((element) => getComputedStyle(element).visibility)).toBe(
          'visible'
        );
        expect(
          await page.locator('sl-toc > div[aria-hidden]:not([data-site-toc-highlight])').count()
        ).toBe(0);
        await captureLinks(
          page,
          `nav-${family}-${colorScheme}-toc-current`,
          family,
          'wc',
          'native-toc-anchor-navigation; observed-in-view',
          { observed: await linkPaint(toc) }
        );

        const pagination = page
          .locator('.pagination-links a[data-site-link-appearance="pagination"]')
          .first();
        await pagination.scrollIntoViewIfNeeded();
        const caption = (await pagination
          .locator('[data-site-pagination-caption]')
          .textContent())!.trim();
        const title = (await pagination.locator('.link-title').textContent())!.trim();
        const accessible = await pagination.ariaSnapshot();
        expect(accessible).toContain(caption);
        expect(accessible).toContain(title);
        const geometry = await pagination.evaluate((anchor) => {
          const root = getComputedStyle(anchor);
          const title = anchor.querySelector<HTMLElement>('.link-title')!;
          const caption = anchor.querySelector<HTMLElement>('[data-site-pagination-caption]')!;
          const rect = title.getBoundingClientRect();
          return {
            titleFont: parseFloat(getComputedStyle(title).fontSize),
            titleWidth: rect.width,
            titleHeight: rect.height,
            captionWidth: caption.getBoundingClientRect().width,
            background: root.backgroundColor,
            border: root.borderTopWidth,
            shadow: root.boxShadow,
            directChild:
              title.parentElement?.parentElement?.matches(
                '[data-site-link-text][data-pui-root]'
              ) === true &&
              title.parentElement.parentElement.parentElement === anchor.firstElementChild &&
              title.parentElement.contains(caption) &&
              anchor.firstElementChild?.matches('[data-site-link-content][data-pui-root]') === true,
            nativeNameOnly:
              anchor.getAttribute('role') === null && !anchor.querySelector('a,button,[tabindex]'),
          };
        });
        expect(geometry.titleFont).toBeGreaterThan(0);
        expect(geometry.titleWidth).toBeGreaterThan(0);
        expect(geometry.titleHeight).toBeGreaterThan(0);
        expect(geometry.captionWidth).toBe(1);
        expect(geometry.background).toBe('rgba(0, 0, 0, 0)');
        expect(geometry.border).toBe('0px');
        expect(geometry.shadow).toBe('none');
        expect(geometry.directChild).toBe(true);
        expect(geometry.nativeNameOnly).toBe(true);
        await captureLinks(
          page,
          `nav-${family}-${colorScheme}-pagination`,
          family,
          'wc',
          'native-pagination-visible-title-preserved-name',
          { geometry, observed: await linkPaint(pagination) }
        );
        await captureLinks(
          page,
          `nav-${family}-${colorScheme}-pagination-focus`,
          family,
          'wc',
          'native-pagination-keyboard-focus',
          await assertNavigationFocus(page, pagination)
        );
        const destination = new URL((await pagination.getAttribute('href'))!, page.url()).href;
        await Promise.all([page.waitForURL(destination), pagination.click()]);
        expect(page.url()).toBe(destination);
      } finally {
        await context.close();
      }
    }
  }, 240_000);

  it('opens the actual narrow-screen contents drawer and keeps long pagination labels within the page', async () => {
    for (const [family, route] of [
      ['shadcn', '/zh-cn/ui-libraries/shadcn/button/'],
      ['brutalist', '/zh-cn/ui-libraries/brutalist/components/textarea/'],
    ] as const) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        colorScheme: 'dark',
      });
      const page = await context.newPage();
      try {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
        const contents = page.locator(
          '.site-header-docs-navigation [data-site-contents-command] [data-projection-generation-state="active"] [data-site-contents-button]'
        );
        const pane = page.locator('#starlight__sidebar');
        const tree = page.locator('nav.docs-sidebar');
        const treeOwnership = () =>
          page.evaluate(() => {
            const state = window as typeof window & {
              __contentsHome?: Element | null;
              __contentsNext?: Node | null;
            };
            const tree = document.querySelector('nav.docs-sidebar');
            return {
              dialogTree: tree?.getAttribute('data-site-contents-popover-tree') ?? null,
              parentRestored: !!tree && tree.parentElement === state.__contentsHome,
              nextRestored: !!tree && tree.nextSibling === state.__contentsNext,
            };
          });
        // Record the authored home of the one navigation tree before the public
        // Dialog borrows it, so restoration is compared to real identities
        // rather than to a selector guess.
        await page.evaluate(() => {
          const tree = document.querySelector('nav.docs-sidebar');
          Object.assign(window, {
            __contentsHome: tree?.parentElement ?? null,
            __contentsNext: tree?.nextSibling ?? null,
          });
        });
        expect(await pane.isVisible()).toBe(false);
        expect(await treeOwnership()).toEqual({
          dialogTree: null,
          parentRestored: true,
          nextRestored: true,
        });
        await contents.click();
        await expect.poll(() => contents.getAttribute('aria-expanded')).toBe('true');
        await pane.waitFor({ state: 'visible' });
        await expect
          .poll(() => treeOwnership())
          .toMatchObject({
            dialogTree: '',
            parentRestored: false,
          });
        const sidebar = pane
          .locator('a[data-site-link-enhanced]:not([aria-current="page"]):visible')
          .first();
        const focus = await assertNavigationFocus(page, sidebar);
        expect(
          await sidebar
            .locator('[data-site-link-content]')
            .evaluate((surface) => surface.getBoundingClientRect().height)
        ).toBeGreaterThanOrEqual(44);
        await captureLinks(
          page,
          `nav-${family}-narrow-sidebar-focus`,
          family,
          'wc',
          '390px; actual-contents-drawer-open; keyboard-focus',
          focus
        );
        const beforeHover = await linkPaint(sidebar);
        await sidebar.hover();
        await expect
          .poll(async () => (await linkPaint(sidebar)).background)
          .not.toBe(beforeHover.background);
        await captureLinks(
          page,
          `nav-${family}-narrow-sidebar-hover`,
          family,
          'wc',
          '390px; actual-contents-drawer-open; native-pointer-hover',
          { baseline: beforeHover, observed: await linkPaint(sidebar) }
        );
        await page.keyboard.press('Escape');
        await expect.poll(() => contents.getAttribute('aria-expanded')).toBe('false');
        // Logical close is application-immediate: the disclosure command itself
        // publishes aria-expanded=false. Physical exit then belongs to the public
        // Dialog's governed leave transition, so the borrowed tree returns only
        // once the Dialog publishes presence=false. Assert both boundaries
        // condition-bound instead of at one instant or after a blind sleep.
        await expect.poll(() => pane.isVisible(), { timeout: 5_000 }).toBe(false);
        await expect
          .poll(() => treeOwnership(), { timeout: 5_000 })
          .toEqual({ dialogTree: null, parentRestored: true, nextRestored: true });
        expect(await tree.count()).toBe(1);
        // The public Dialog owns modal return focus for the enhanced path
        // (site-header-disclosure.ts: Public Dialog owns modal close/restore);
        // the returned tree must not become a second focus owner.
        await expect
          .poll(() => contents.evaluate((element) => element === document.activeElement), {
            timeout: 5_000,
          })
          .toBe(true);
        // This site has a desktop-only TOC; do not force it visible or claim a
        // nonexistent mobile TOC interaction. The heading targets still exist.
        expect(await page.locator('sl-toc').count()).toBeGreaterThan(0);
        expect(await page.locator('sl-toc:visible').count()).toBe(0);
        const tocTarget = await page.locator('sl-toc a').nth(1).getAttribute('href');
        expect(
          await page
            .locator(`[id=${JSON.stringify(decodeURIComponent(tocTarget!.slice(1)))}]`)
            .count()
        ).toBe(1);

        const pagination = page.locator('.pagination-links a[data-site-link-enhanced]').first();
        const title = pagination.locator('.link-title');
        const originalTitle = await title.textContent();
        const fixtureTitle =
          '窄屏长标题换行检查 / A long public navigation title with multiple words '.repeat(4);
        // Deliberate content stress fixture; captures identify it as injected,
        // not as the page's real editorial title.
        await title.evaluate((node, text) => {
          node.textContent = text;
        }, fixtureTitle);
        await pagination.scrollIntoViewIfNeeded();
        const layout = await pagination.evaluate((anchor) => {
          const title = anchor.querySelector('.link-title')!.getBoundingClientRect();
          const link = anchor.getBoundingClientRect();
          return {
            pageWidth: document.documentElement.scrollWidth,
            viewportWidth: document.documentElement.clientWidth,
            titleLeft: title.left,
            titleRight: title.right,
            linkLeft: link.left,
            linkRight: link.right,
            titleHeight: title.height,
            caption: anchor.querySelector('[data-site-pagination-caption]')?.textContent,
          };
        });
        expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
        expect(layout.titleLeft).toBeGreaterThanOrEqual(layout.linkLeft - 0.5);
        expect(layout.titleRight).toBeLessThanOrEqual(layout.linkRight + 0.5);
        expect(layout.titleHeight).toBeGreaterThan(20);
        expect(await pagination.ariaSnapshot()).toContain(layout.caption!.trim());
        await captureLinks(
          page,
          `nav-${family}-narrow-long-pagination`,
          family,
          'wc',
          '390px; injected-long-title-stress-fixture',
          { layout, originalTitle, fixtureTitle }
        );
        await title.evaluate((node, text) => {
          node.textContent = text;
        }, originalTitle);
        await captureLinks(
          page,
          `nav-${family}-narrow-pagination-focus`,
          family,
          'wc',
          '390px; original-title-restored; keyboard-focus',
          await assertNavigationFocus(page, pagination)
        );
      } finally {
        await context.close();
      }
    }
  }, 150_000);

  it('keeps docs native destinations, current truth, heading navigation and keyboard focus without JavaScript', async () => {
    for (const [family, route] of [
      ['shadcn', '/zh-cn/ui-libraries/shadcn/button/'],
      ['brutalist', '/zh-cn/ui-libraries/brutalist/components/textarea/'],
    ] as const) {
      const context = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width: 1440, height: 1000 },
      });
      const page = await context.newPage();
      try {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
        const targets = [
          ['brand', '.site-header a[data-site-link-appearance="brand"]'],
          ['sidebar', '.sidebar-pane a[aria-current="page"]'],
          ['toc', 'sl-toc a'],
          ['pagination', '.pagination-links a'],
        ] as const;
        for (const [role, selector] of targets) {
          const link = page.locator(selector).first();
          expect(await link.getAttribute('href')).toBeTruthy();
          expect(await link.getAttribute('data-site-link-enhanced')).toBeNull();
          expect(await link.getAttribute('role')).toBeNull();
          expect(await link.locator('[data-pui-root],button,[tabindex]').count()).toBe(0);
          await link.scrollIntoViewIfNeeded();
          await page.mouse.move(0, 0);
          await link.focus();
          await page.keyboard.press('Tab');
          const read = () =>
            link.evaluate((anchor) => {
              const style = getComputedStyle(anchor);
              const box = anchor.getBoundingClientRect();
              return {
                outline: style.outline,
                outlineOffset: style.outlineOffset,
                shadow: style.boxShadow,
                current: anchor.getAttribute('aria-current'),
                rect: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
                focused: anchor === document.activeElement && anchor.matches(':focus-visible'),
                nativePressed: anchor.matches(':active'),
                visible: anchor.contains(
                  document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
                ),
              };
            });
          await expect.poll(async () => (await read()).focused).toBe(false);
          const baseline = await read();
          await page.keyboard.press('Shift+Tab');
          let focusPassed = false;
          try {
            await expect
              .poll(
                async () => {
                  const observed = await read();
                  return (
                    observed.focused &&
                    observed.visible &&
                    (observed.outline !== baseline.outline || observed.shadow !== baseline.shadow)
                  );
                },
                { timeout: 10_000 }
              )
              .toBe(true);
            focusPassed = true;
          } finally {
            await captureLinks(
              page,
              `nav-${family}-no-js-${role}-focus${focusPassed ? '' : '-failure'}`,
              family,
              'native-no-js',
              `no-JavaScript; native-${role}-keyboard-focus; ${focusPassed ? 'passed' : 'failed'}`,
              { baseline, observed: await read() }
            );
          }
        }
        const current = page.locator('.sidebar-pane a[aria-current="page"]').first();
        expect(new URL((await current.getAttribute('href'))!, page.url()).pathname).toBe(
          new URL(page.url()).pathname
        );
        const toc = page.locator('sl-toc a').nth(1);
        const href = (await toc.getAttribute('href'))!;
        const heading = page.locator(`[id=${JSON.stringify(decodeURIComponent(href.slice(1)))}]`);
        expect(await heading.count()).toBe(1);
        await toc.click();
        expect(new URL(page.url()).hash).toBe(new URL(href, page.url()).hash);
        await expect
          .poll(() =>
            heading.evaluate((node) => {
              const box = node.getBoundingClientRect();
              return box.top < innerHeight && box.bottom > 0;
            })
          )
          .toBe(true);
        expect(await toc.getAttribute('in-view')).toBeNull();
        const pagination = page.locator('.pagination-links a').first();
        expect(['prev', 'next']).toContain(await pagination.getAttribute('rel'));
        const destination = new URL((await pagination.getAttribute('href'))!, page.url()).href;
        await Promise.all([page.waitForURL(destination), pagination.click()]);
        expect(page.url()).toBe(destination);
      } finally {
        await context.close();
      }
    }
  }, 150_000);
  it('reveals the current article in only the sidebar scroll owner and yields to manual scrolling', async () => {
    for (const width of [1440, 390, 320]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        colorScheme: 'light',
      });
      const page = await context.newPage();
      try {
        // Keep the native content area aligned with the emulated viewport for wheel input.
        const cdp = await context.newCDPSession(page);
        try {
          const { windowId } = await cdp.send('Browser.getWindowForTarget');
          await cdp.send('Browser.setContentsSize', { windowId, width, height: 900 });
        } finally {
          await cdp.detach();
        }
        await page.goto(`${baseUrl}/zh-cn/contribute/automation/`, { waitUntil: 'networkidle' });
        const sidebar = page.locator('.docs-sidebar');
        const current = sidebar.locator('.top-level a[aria-current="page"]');
        expect(await current.count()).toBe(1);
        expect(await current.getAttribute('href')).toContain('/contribute/automation/');
        if (width < 1024)
          await page
            .locator(
              '[data-site-contents-command] [data-projection-generation-state="active"] [data-site-contents-button]'
            )
            .click();
        const facts = () =>
          current.evaluate((link) => {
            const boundary = link.closest<HTMLElement>('.docs-sidebar')!;
            let owner: HTMLElement | null = null;
            for (
              let node = link.parentElement;
              node && boundary.contains(node);
              node = node.parentElement
            ) {
              if (
                node.clientHeight > 0 &&
                node.scrollHeight > node.clientHeight &&
                /^(auto|scroll|overlay)$/.test(getComputedStyle(node).overflowY)
              ) {
                owner = node;
                break;
              }
              if (node === boundary) break;
            }
            const empty = {
              visible: false,
              reason: 'missing sidebar owner',
              owner: null,
              scrollTop: 0,
              documentY: scrollY,
              linkTop: 0,
              linkBottom: 0,
              viewportTop: 0,
              viewportHeight: 0,
              viewportBottom: 0,
              ownerBottom: 0,
              ownerScaleY: 1,
              rowRect: { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 },
              ownerRect: { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 },
              contentRect: { top: 0, bottom: 0, width: 0, height: 0 },
              contentTransform: null,
              scrollHeight: 0,
              clientHeight: 0,
              documentViewportHeight: innerHeight,
              documentScrollHeight: document.documentElement.scrollHeight,
              projected: link.getAttribute('data-site-link-enhanced'),
              focus: document.activeElement?.outerHTML.slice(0, 300),
            };
            if (!owner) return empty;
            const row = link.getBoundingClientRect(),
              box = owner.getBoundingClientRect();
            // The owner can sit under a transformed public surface (the narrow
            // drawer's Dialog). Compare the real transformed row rect with the
            // transformed scrollport band, scaling the border offset instead of
            // mixing viewport-space rects with untransformed layout pixels.
            const scaleY = owner.offsetHeight > 0 ? box.height / owner.offsetHeight : 1;
            const top = box.top + owner.clientTop * scaleY;
            const height = owner.clientHeight * scaleY;
            const surface = link.querySelector<HTMLElement>('[data-site-link-content]');
            const content = (surface ?? link).getBoundingClientRect();
            return {
              visible:
                row.width > 0 &&
                row.height > 0 &&
                row.top >= top - 1 &&
                row.bottom <= top + height + 1,
              owner: owner.className,
              scrollTop: owner.scrollTop,
              documentY: scrollY,
              linkTop: row.top,
              linkBottom: row.bottom,
              viewportTop: top,
              viewportHeight: height,
              viewportBottom: top + height,
              ownerBottom: box.bottom,
              ownerScaleY: scaleY,
              rowRect: {
                top: row.top,
                bottom: row.bottom,
                left: row.left,
                right: row.right,
                width: row.width,
                height: row.height,
              },
              ownerRect: {
                top: box.top,
                bottom: box.bottom,
                left: box.left,
                right: box.right,
                width: box.width,
                height: box.height,
              },
              contentRect: {
                top: content.top,
                bottom: content.bottom,
                width: content.width,
                height: content.height,
              },
              contentTransform: surface ? getComputedStyle(surface).transform : null,
              scrollHeight: owner.scrollHeight,
              clientHeight: owner.clientHeight,
              documentViewportHeight: innerHeight,
              documentScrollHeight: document.documentElement.scrollHeight,
              projected: link.getAttribute('data-site-link-enhanced'),
              focus: document.activeElement?.outerHTML.slice(0, 300),
            };
          });
        await expect.poll(async () => (await facts()).visible, { timeout: 10_000 }).toBe(true);
        const entered = await facts();
        expect(entered.documentY).toBe(0);
        // No-pointer control: the route-entry reveal owner keeps adjusting this
        // same scroll owner until its row/owner geometry repeats. Establish that
        // settled endpoint with no pointer input at all, bounded by real frames,
        // so the pointer below cannot be credited with a reveal correction that
        // was still in flight. A stable but clipped or hidden row never settles.
        const settle = async () => {
          let previous = '';
          let stable = 0;
          for (let frame = 0; frame < 120; frame++) {
            const observed = await facts();
            const key = [
              observed.scrollTop,
              observed.documentY,
              observed.rowRect.top,
              observed.rowRect.bottom,
              observed.viewportTop,
              observed.viewportHeight,
              observed.scrollHeight,
            ].join('/');
            stable = key === previous ? stable + 1 : 0;
            previous = key;
            if (stable >= 3) {
              if (
                !observed.visible ||
                observed.rowRect.top < observed.viewportTop - 0.5 ||
                observed.rowRect.bottom > observed.viewportBottom + 0.5
              )
                throw new Error(
                  'Sidebar current article is clipped by its scroll owner while settling'
                );
              return observed;
            }
            await page.evaluate(
              () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
            );
          }
          throw new Error('Sidebar current-article reveal did not settle within 120 frames');
        };
        const before = await settle();
        expect(before.owner, 'entry and settle keep the one sidebar scroll owner').toBe(
          entered.owner
        );
        expect(before.documentY, 'entry and settle must not scroll the document').toBe(
          entered.documentY
        );
        expect(before.visible, 'settled current article is fully inside its owner').toBe(true);
        expect(
          before.rowRect.top >= before.viewportTop - 0.5 &&
            before.rowRect.bottom <= before.viewportBottom + 0.5,
          'settled row is fully contained, never a stable but clipped row'
        ).toBe(true);
        expect(
          before.contentRect.width,
          'painted current-row content has real geometry'
        ).toBeGreaterThan(0);
        expect(
          before.contentRect.top >= before.viewportTop - 1 &&
            before.contentRect.bottom <= before.viewportBottom + 1,
          'painted current-row content is inside the transformed scrollport'
        ).toBe(true);
        const nearestEdgeSlack = Math.min(
          before.rowRect.top - before.viewportTop,
          before.viewportBottom - before.rowRect.bottom
        );
        const ownerAtStart = before.scrollTop <= 0.5;
        const ownerAtEnd = before.scrollTop >= before.scrollHeight - before.clientHeight - 0.5;
        expect(
          nearestEdgeSlack <= 1 || ownerAtStart || ownerAtEnd,
          'reveal must stop at the nearest edge instead of overscrolling'
        ).toBe(true);
        await captureLinks(
          page,
          `sidebar-current-${width}`,
          'shadcn',
          'wc',
          'current-article-entered-and-settled',
          { entered, settled: before, nearestEdgeSlack, ownerAtStart, ownerAtEnd }
        );
        expect(
          before.ownerBottom,
          'sidebar owner must fit inside the document viewport'
        ).toBeLessThanOrEqual(before.documentViewportHeight!);
        const pointer = await current.evaluate((link) => {
          const row = link.getBoundingClientRect();
          const left = Math.max(0, row.left),
            right = Math.min(innerWidth, row.right);
          const top = Math.max(0, row.top),
            bottom = Math.min(innerHeight, row.bottom);
          if (right <= left || bottom <= top)
            throw new Error('Current article has no visible pointer target');
          const x = (left + right) / 2,
            y = (top + bottom) / 2;
          const target = document.elementFromPoint(x, y);
          return {
            x,
            y,
            hitIsCurrent: target === link,
            hit: target?.outerHTML.slice(0, 500) ?? null,
          };
        });
        expect(pointer.hitIsCurrent, 'actual visible native current-article target').toBe(true);
        // locator.hover() first scrolls all ancestors to expose the entire row.
        // Use a measured visible point so this test's wheel is the only scroll request.
        await page.mouse.move(pointer.x, pointer.y);
        const beforeWheel = await facts();
        await captureLinks(
          page,
          `sidebar-current-${width}-pointer`,
          'shadcn',
          'wc',
          'native-pointer-move; no-scrollIntoView',
          { before, pointer, beforeWheel }
        );
        expect(beforeWheel.documentY, 'pointer must not move document scroll').toBe(
          before.documentY
        );
        expect(beforeWheel.visible, 'pointer keeps the current row fully inside its owner').toBe(
          true
        );
        expect(beforeWheel.scrollTop, 'pointer must not move sidebar scroll').toBe(
          before.scrollTop
        );
        await page.mouse.wheel(0, -400);
        // Observe the actual scroll event rather than guessing a fixed delay.
        await expect
          .poll(async () => (await facts()).scrollTop)
          .toBeLessThan(beforeWheel.scrollTop!);
        await current.evaluate(async (link) => {
          const boundary = link.closest<HTMLElement>('.docs-sidebar')!;
          let owner = link.parentElement!;
          while (
            boundary.contains(owner) &&
            !(
              owner.clientHeight > 0 &&
              owner.scrollHeight > owner.clientHeight &&
              /^(auto|scroll|overlay)$/.test(getComputedStyle(owner).overflowY)
            )
          ) {
            if (owner === boundary || !owner.parentElement)
              throw new Error('Missing actual scroll owner');
            owner = owner.parentElement;
          }
          let previous = owner.scrollTop,
            stable = 0;
          for (let frame = 0; frame < 60; frame++) {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            const next = owner.scrollTop;
            stable = next === previous ? stable + 1 : 0;
            previous = next;
            if (stable >= 2) return;
          }
          throw new Error('Manual scrolling did not settle');
        });
        const manuallyScrolled = await facts();
        await captureLinks(
          page,
          `sidebar-current-${width}-wheel`,
          'shadcn',
          'wc',
          'native-wheel-settled; owner-and-document-deltas',
          { beforeWheel, manuallyScrolled }
        );
        expect(manuallyScrolled.owner, 'wheel preserves the actual sidebar scroll owner').toBe(
          beforeWheel.owner
        );
        expect(manuallyScrolled.documentY, 'sidebar wheel must not scroll the document').toBe(
          beforeWheel.documentY
        );
        await current.evaluate((link) => {
          // A delayed projection/font-sized geometry mutation must not revoke manual ownership.
          link.style.paddingBlock = '16px';
          link.setAttribute('data-site-link-enhanced', 'true');
        });
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
            )
        );
        const afterMutation = await facts();
        await captureLinks(
          page,
          `sidebar-current-${width}-mutation`,
          'shadcn',
          'wc',
          'injected-late-geometry; manual-scroll-ownership-retained',
          { manuallyScrolled, afterMutation }
        );
        expect(afterMutation.owner, 'late geometry retains the sidebar scroll owner').toBe(
          manuallyScrolled.owner
        );
        expect(afterMutation.scrollTop, 'late geometry must not recenter the sidebar').toBe(
          manuallyScrolled.scrollTop
        );
        expect(afterMutation.documentY, 'late geometry must not scroll the document').toBe(
          manuallyScrolled.documentY
        );
        await page.reload({ waitUntil: 'networkidle' });
        if (width < 1024)
          await page
            .locator(
              '[data-site-contents-command] [data-projection-generation-state="active"] [data-site-contents-button]'
            )
            .click();
        await expect.poll(async () => (await facts()).visible, { timeout: 10_000 }).toBe(true);
        await captureLinks(
          page,
          `sidebar-current-${width}-reload`,
          'shadcn',
          'wc',
          'current-article-after-reload',
          await facts()
        );
      } finally {
        await context.close();
      }
    }
  }, 180_000);
});

// #1039: native first-frame typography is the independent density oracle.
// This matrix does not claim that TOC first-frame geometry is repaired.
it('keeps compact Sidebar typography across root text, viewport and enhancement', async () => {
  for (const [family, route] of [
    ['shadcn', '/zh-cn/ui-libraries/shadcn/button/'],
    ['brutalist', '/zh-cn/ui-libraries/brutalist/components/textarea/'],
  ] as const) {
    for (const javaScriptEnabled of [false, true]) {
      for (const colorScheme of ['light', 'dark'] as const) {
        const context = await browser.newContext({ javaScriptEnabled, colorScheme });
        const page = await context.newPage();
        try {
          await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
          if (javaScriptEnabled) {
            await page.waitForFunction(() =>
              [
                ...document.querySelectorAll(
                  '.sidebar-pane .top-level a, .sidebar-pane .top-level summary'
                ),
              ].every(
                (link) =>
                  link.hasAttribute('data-site-link-enhanced') &&
                  link.querySelector('[data-site-link-text]')
              )
            );
          }
          for (const width of [320, 390, 1280, 1920]) {
            await page.setViewportSize({ width, height: 1000 });
            for (const rootSize of [16, 20, 24]) {
              await page.evaluate((size) => {
                document.documentElement.style.fontSize = `${size}px`;
              }, rootSize);
              const rows = await page
                .locator('.sidebar-pane .top-level a, .sidebar-pane .top-level summary')
                .evaluateAll((links) =>
                  links.map((link) => {
                    const text = link.querySelector<HTMLElement>('[data-site-link-text]') ?? link;
                    const surface =
                      link.querySelector<HTMLElement>('[data-site-link-content]') ?? link;
                    const style = getComputedStyle(text);
                    const layout = getComputedStyle(surface);
                    const topGroup =
                      link.localName === 'summary' && !link.matches('.top-level ul summary');
                    return {
                      topGroup,
                      size: parseFloat(style.fontSize),
                      line: parseFloat(style.lineHeight),
                      margin: parseFloat(layout.marginBottom),
                      minHeight: parseFloat(layout.minHeight),
                      enhanced: link.hasAttribute('data-site-link-enhanced'),
                      role: link.getAttribute('role'),
                    };
                  })
                );
              expect(rows.length).toBeGreaterThan(0);
              for (const row of rows) {
                expect(row.size).toBeCloseTo(rootSize * (row.topGroup ? 0.75 : 0.8125), 2);
                expect(row.line).toBeCloseTo(rootSize * 1.25, 2);
                expect(row.margin).toBe(0);
                expect(row.enhanced).toBe(javaScriptEnabled);
                expect(row.role).toBeNull();
                // Both baseline and enhanced retain the responsive target floor.
                expect(row.minHeight).toBeGreaterThanOrEqual(rootSize * 2);
                if (width <= 390) expect(row.minHeight).toBeGreaterThanOrEqual(rootSize * 2.75);
              }
            }
          }
        } finally {
          await context.close();
        }
      }
    }
  }
}, 150_000);

// Authored expectation, not a reimplementation of the CSS guard. The right
// reading rail needs BOTH the 80rem viewport media query (viewport rem uses the
// initial font size) and more than the 66rem docs-canvas budget for the computed
// root text, so 1280px at root20 (64rem) legitimately has no rail. The cells
// mirror the reviewed scenario table in site-docs-columns.browser.test.ts.
const READING_RAIL_EXPECTATION: Readonly<Record<string, 'visible' | 'hidden'>> = {
  '1280x16': 'visible',
  '1280x20': 'hidden',
  '1280x24': 'hidden',
  '1920x16': 'visible',
  '1920x20': 'visible',
  '1920x24': 'visible',
};
it('keeps reading TOC native row boxes, depth padding and multiline growth through enhancement', async () => {
  for (const [family, route] of [
    ['shadcn', '/zh-cn/ui-libraries/shadcn/button/'],
    ['brutalist', '/zh-cn/ui-libraries/brutalist/components/textarea/'],
  ] as const) {
    for (const javaScriptEnabled of [false, true]) {
      const context = await browser.newContext({
        javaScriptEnabled,
        viewport: { width: 1920, height: 1000 },
      });
      const page = await context.newPage();
      const id = `reading-toc-${family}-${javaScriptEnabled ? 'enhanced' : 'nojs'}`;
      const samples: unknown[] = [];
      try {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
        if (javaScriptEnabled)
          await page.waitForFunction(() =>
            document.querySelector(
              '.right-sidebar sl-toc a[data-site-link-enhanced] [data-site-link-text]'
            )
          );
        for (const width of [1280, 1920]) {
          await page.setViewportSize({ width, height: 1000 });
          for (const rootSize of [16, 20, 24]) {
            await page.evaluate((size) => {
              document.documentElement.style.fontSize = `${size}px`;
            }, rootSize);
            const rows = await page.locator('.right-sidebar sl-toc a').evaluateAll((links) =>
              links
                .filter((link) => link.checkVisibility())
                .map((link) => {
                  const text = link.querySelector<HTMLElement>('[data-site-link-text]') ?? link;
                  const leaf = link.querySelector<HTMLElement>('[data-site-link-content]') ?? link;
                  const rect = link.getBoundingClientRect();
                  const parent = link.parentElement!.getBoundingClientRect();
                  const style = getComputedStyle(text),
                    layout = getComputedStyle(leaf);
                  return {
                    size: parseFloat(style.fontSize),
                    line: parseFloat(style.lineHeight),
                    height: rect.height,
                    left: rect.left,
                    width: rect.width,
                    parentLeft: parent.left,
                    parentWidth: parent.width,
                    paddingStart: parseFloat(layout.paddingInlineStart),
                    depth: parseFloat(getComputedStyle(link).getPropertyValue('--depth')) || 0,
                    margin: parseFloat(layout.marginBottom),
                  };
                })
            );
            const expected = READING_RAIL_EXPECTATION[`${width}x${rootSize}`];
            expect(
              expected,
              `missing reading-rail expectation for width${width}/root${rootSize}`
            ).toBeDefined();
            const rail = await page.evaluate(() => {
              const container = document.querySelector<HTMLElement>(
                '.docs-reading-columns > .right-sidebar-container'
              );
              const box = container?.getBoundingClientRect() ?? null;
              const anchors = [
                ...document.querySelectorAll<HTMLAnchorElement>('.right-sidebar sl-toc a[href]'),
              ].map((anchor) => {
                const href = anchor.getAttribute('href') ?? '';
                const target = href.startsWith('#')
                  ? document.getElementById(decodeURIComponent(href.slice(1)))
                  : null;
                return {
                  href,
                  target: target?.localName ?? null,
                  inToc: !!anchor.closest('sl-toc'),
                };
              });
              return {
                display: container ? getComputedStyle(container).display : null,
                width: box?.width ?? 0,
                anchors,
                overflow:
                  document.documentElement.scrollWidth - document.documentElement.clientWidth,
              };
            });
            // Native destinations are authored whatever the visual budget does.
            expect(rail.anchors.length).toBeGreaterThan(0);
            for (const anchor of rail.anchors) {
              expect(anchor.href.startsWith('#')).toBe(true);
              expect(anchor.target, `${anchor.href} keeps a real destination`).toBeTruthy();
              expect(anchor.inToc).toBe(true);
            }
            expect(
              rail.overflow,
              'reading rail must not overflow the document'
            ).toBeLessThanOrEqual(1);
            const title = page.locator('.right-sidebar sl-toc h2#starlight__on-this-page');
            if (javaScriptEnabled && expected === 'visible')
              await title.locator('[data-typography-prototype]').waitFor();
            const titlePaint = await title.evaluate((native) => {
              const surface =
                native.querySelector<HTMLElement>('[data-typography-prototype]') ?? native;
              const style = getComputedStyle(surface),
                parent = getComputedStyle(native);
              return {
                tag: native.tagName,
                text: native.textContent?.trim(),
                size: parseFloat(style.fontSize),
                line: parseFloat(style.lineHeight),
                font: style.fontFamily,
                nativeFont: parent.fontFamily,
                weight: style.fontWeight,
                nativeWeight: parent.fontWeight,
                tracking: style.letterSpacing,
                nativeTracking: parent.letterSpacing,
                labelledBy: native.closest('nav')?.getAttribute('aria-labelledby'),
              };
            });
            samples.push({ width, rootSize, expected, rows, rail, titlePaint });
            if (expected === 'visible') {
              // Required-visible cell: prove the rail is displayed and every
              // visible row keeps the governed native box, depth and density.
              expect(rail.display, `${width}px/root${rootSize} shows the reading rail`).not.toBe(
                'none'
              );
              expect(rail.width).toBeGreaterThan(0);
              expect(rows.length).toBeGreaterThan(0);
              expect(titlePaint.tag).toBe('H2');
              expect(titlePaint.text).toBeTruthy();
              expect(titlePaint.labelledBy).toBe('starlight__on-this-page');
              expect(titlePaint.size).toBeCloseTo(rootSize * 0.75, 2);
              expect(titlePaint.line).toBeCloseTo(rootSize, 2);
              expect(titlePaint.font).toBe(titlePaint.nativeFont);
              expect(titlePaint.weight).toBe(titlePaint.nativeWeight);
              expect(titlePaint.tracking).toBe(titlePaint.nativeTracking);
              for (const row of rows) {
                expect(row.size).toBeCloseTo(rootSize * 0.8, 2);
                expect(row.line).toBeCloseTo(rootSize, 2);
                expect(row.height).toBeGreaterThanOrEqual(rootSize * 1.5 - 0.1);
                expect(row.left).toBeCloseTo(row.parentLeft, 0);
                expect(row.width).toBeCloseTo(row.parentWidth, 0);
                expect(row.paddingStart).toBeCloseTo(rootSize * (row.depth + 0.5), 2);
                expect(row.margin).toBe(0);
              }
            } else {
              // Constrained-hidden cell: the 66rem docs-canvas budget removes the
              // rail instead of shortening the article or relocating the TOC above
              // the prose. Row boxes and passive-typography paint are unobservable
              // here, so assert the authored hiding, the retained native
              // destinations and the unclipped document instead.
              expect(rail.display, `${width}px/root${rootSize} hides the reading rail`).toBe(
                'none'
              );
              expect(rail.width).toBe(0);
              expect(rows.length).toBe(0);
              expect(titlePaint.tag).toBe('H2');
              expect(titlePaint.text).toBeTruthy();
              expect(titlePaint.labelledBy).toBe('starlight__on-this-page');
            }
            if (width === 1920 && rootSize === 16)
              await captureLinks(page, id, family, 'wc', 'reading-toc-native-density', { samples });
          }
        }
        const first = page.locator('.right-sidebar sl-toc a').first();
        // Row growth, keyboard focus and the current-range highlight need a
        // genuinely visible rail. Bind them to an explicit required-visible cell
        // instead of inheriting whichever matrix cell ran last.
        await page.setViewportSize({ width: 1920, height: 1000 });
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '16px';
        });
        await expect
          .poll(() => first.evaluate((link) => link.checkVisibility()), { timeout: 10_000 })
          .toBe(true);
        await first.evaluate((link) => {
          const source =
            link.querySelector('[data-site-link-text]')?.firstElementChild ??
            link.querySelector('span')!;
          source.textContent =
            'A deliberately long reading TOC destination that wraps across several lines without a fixed-height clipping shortcut';
        });
        const multiline = await first.evaluate((link) => {
          const text = link.querySelector<HTMLElement>('[data-site-link-text]') ?? link;
          return {
            height: link.getBoundingClientRect().height,
            line: parseFloat(getComputedStyle(text).lineHeight),
            root: parseFloat(getComputedStyle(document.documentElement).fontSize),
          };
        });
        samples.push({ multiline });
        expect(multiline.height).toBeGreaterThan(multiline.root * 1.5);
        expect(multiline.height).toBeGreaterThanOrEqual(
          multiline.line * 2 + multiline.root * 0.5 - 1
        );
        if (javaScriptEnabled) {
          await assertNavigationFocus(page, first);
          for (const position of ['bottom', 'top'] as const) {
            await page.evaluate(
              (position) =>
                window.scrollTo(
                  0,
                  position === 'bottom' ? document.documentElement.scrollHeight : 0
                ),
              position
            );
            await expect
              .poll(() => page.locator('.right-sidebar sl-toc a[aria-current="true"]').count())
              .toBe(1);
            const range = page.locator('.right-sidebar sl-toc > [data-site-toc-highlight]');
            await expect.poll(() => range.getAttribute('data-toc-range-visible')).not.toBeNull();
            expect(await range.locator('[data-pui-root]').count()).toBe(1);
          }
        }
      } catch (error) {
        await captureLinks(page, `${id}-failure`, family, 'wc', 'reading-toc-density-failure', {
          samples,
          error: String(error),
        });
        throw error;
      } finally {
        await context.close();
      }
    }
  }
}, 150_000);

const collectShellLinks = (page: Page, selector: string): Promise<ShellLinkFact[]> =>
  page.locator(selector).evaluateAll((anchors) =>
    anchors.map((anchor) => {
      const box = anchor.getBoundingClientRect();
      const role = anchor.getAttribute('role');
      return {
        tag: anchor.tagName,
        name: anchor.getAttribute('aria-label') ?? anchor.textContent?.trim() ?? null,
        href: anchor.getAttribute('href'),
        target: anchor.getAttribute('target'),
        rel: anchor.getAttribute('rel'),
        role,
        current: anchor.getAttribute('aria-current'),
        buttonCommand:
          anchor.getAttribute('data-slot') === 'button' ||
          role === 'button' ||
          anchor.hasAttribute('data-site-native-button'),
        visualOwner: Boolean(anchor.querySelector('[data-pui-root]')),
        nestedInteractive: anchor.querySelectorAll(
          'a[href],button,input,select,textarea,[tabindex]'
        ).length,
        hitIsAnchor:
          anchor === document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2),
      };
    })
  );

const HOMEPAGE_DESKTOP_NAVIGATION =
  '#home-navigation-desktop [data-projection-generation-state="active"] a';
const HOMEPAGE_POPUP_NAVIGATION =
  '#home-navigation-mobile [data-projection-generation-state="active"] a';
const HOMEPAGE_HERO_ACTIONS = [
  '#homepage-whitepaper [data-projection-generation-state="active"] a',
  '#homepage-hero-actions [data-projection-generation-state="active"] a',
].join(', ');

// #559 C6: the governed shell surfaces were previously recorded on /zh-cn
// routes only. This case records the same native-anchor facts on the English
// locale. Accessible names come from the shared navigation definition and the
// site-owned social definitions; content-authored hero actions are checked
// against the other locale's observed names and destinations, never against a
// hand-written translation or an assertion about source text.
it('records the English shell labels, destinations and native activation ownership', async () => {
  const englishNavigation = sitePrimaryNavigation('en');
  const englishExpectation: ShellLinkExpectation[] = englishNavigation.map(
    ({ label, path: target }) => ({ name: label, href: localizedShellHref(target, 'en') })
  );
  const chineseExpectation: ShellLinkExpectation[] = sitePrimaryNavigation('zh-cn').map(
    ({ label, path: target }) => ({ name: label, href: localizedShellHref(target, 'zh-cn') })
  );
  const navigationLabel = siteShellLabels('en').primaryNavigation;
  const socialExpectation: ShellLinkExpectation[] = (
    Object.keys(SITE_LINK_ICONS) as SiteLinkIcon[]
  ).map((icon) => ({
    name: SITE_LINK_ICONS[icon].label,
    href: socialDestinations[icon],
    target: '_blank',
    rel: 'noreferrer',
  }));
  // Locale basis: the Chinese homepage supplies the observed words and
  // destinations of the content-authored hero actions and proves the shared
  // navigation definition on the other locale.
  const zhContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'light',
  });
  let zhHero: ShellLinkFact[] = [];
  try {
    const page = await zhContext.newPage();
    await page.goto(`${baseUrl}/zh-cn/`, { waitUntil: 'networkidle' });
    await ready(page, 'wc', 'shadcn');
    expect(
      shellNavigationIssues(
        await collectShellLinks(page, HOMEPAGE_DESKTOP_NAVIGATION),
        chineseExpectation
      )
    ).toEqual([]);
    zhHero = await collectShellLinks(page, HOMEPAGE_HERO_ACTIONS);
    expect(zhHero).toHaveLength(3);
  } finally {
    await zhContext.close();
  }
  const enContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'light',
  });
  try {
    const page = await enContext.newPage();
    await page.goto(`${baseUrl}/en/`, { waitUntil: 'networkidle' });
    await ready(page, 'wc', 'shadcn');
    const desktopNavigation = await collectShellLinks(page, HOMEPAGE_DESKTOP_NAVIGATION);
    expect(shellNavigationIssues(desktopNavigation, englishExpectation)).toEqual([]);
    const homeNavigationLabels = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-homepage-runtime] nav[aria-label]')).map((nav) =>
        nav.getAttribute('aria-label')
      )
    );
    expect(new Set(homeNavigationLabels)).toEqual(new Set([navigationLabel]));
    const hero = await collectShellLinks(page, HOMEPAGE_HERO_ACTIONS);
    expect(localePairIssues(zhHero, hero)).toEqual([]);
    // Pointer hover and keyboard focus-visible are observed on the English hero
    // group through the existing native paint observer.
    const heroLink = page
      .locator('#homepage-hero-actions [data-projection-generation-state="active"] a')
      .first();
    const resting = await linkPaint(heroLink);
    await heroLink.hover();
    await expect.poll(async () => (await linkPaint(heroLink)).tokens).not.toEqual(resting.tokens);
    await page.mouse.move(0, 0);
    await heroLink.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    const focused = await linkPaint(heroLink);
    expect(focused.focused).toBe(true);
    expect(focused.visibleTarget).toBe(true);
    expect(focused.unclipped).toBe(true);
    // The real homepage theme control flips the document theme; the English
    // labels stay native, unclipped and hit-testable in dark.
    const themeBefore = await page.evaluate(() => document.documentElement.dataset.theme ?? null);
    await page
      .locator(
        '.site-header-theme [data-projection-generation-state="active"] [data-demo-ref="home-theme"]'
      )
      .click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.theme ?? null))
      .toBe('dark');
    expect(themeBefore).not.toBe('dark');
    const darkNavigation = await collectShellLinks(page, HOMEPAGE_DESKTOP_NAVIGATION);
    expect(shellNavigationIssues(darkNavigation, englishExpectation)).toEqual([]);
    // Reflow: the authored root text sizes and both documented wide viewports
    // keep every English row unclipped and inside the page.
    for (const width of [1280, 1920] as const) {
      await page.setViewportSize({ width, height: 1000 });
      for (const rootSize of [16, 24] as const) {
        await page.evaluate((size) => {
          document.documentElement.style.fontSize = `${size}px`;
        }, rootSize);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
        ).toBeLessThanOrEqual(1);
        for (const link of await page.locator(HOMEPAGE_DESKTOP_NAVIGATION).all()) {
          const paint = await linkPaint(link);
          expect(paint.visibleTarget).toBe(true);
          expect(paint.unclipped).toBe(true);
        }
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '';
    });
    // The social entries live inside the header panel, so they are observed
    // with the panel open; the governed navigation owns no current marker.
    await openSettings(page);
    const social = await collectShellLinks(
      page,
      '#home-social [data-projection-generation-state="active"] a'
    );
    expect(shellNavigationIssues(social, socialExpectation)).toEqual([]);
    const popupNavigation = await collectShellLinks(page, HOMEPAGE_POPUP_NAVIGATION);
    expect(shellNavigationIssues(popupNavigation, englishExpectation)).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page
        .locator('[data-homepage-runtime] [data-site-header-desktop-navigation]')
        .isVisible()
    ).toBe(false);
    await openSettings(page);
    const narrowNavigation = await collectShellLinks(page, HOMEPAGE_POPUP_NAVIGATION);
    expect(shellNavigationIssues(narrowNavigation, englishExpectation)).toEqual([]);
    for (const link of await page.locator(HOMEPAGE_POPUP_NAVIGATION).all()) {
      const paint = await linkPaint(link);
      expect(paint.visibleTarget).toBe(true);
      expect(paint.unclipped).toBe(true);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    ).toBeLessThanOrEqual(1);
    await captureLinks(
      page,
      'english-homepage-shell-labels',
      'shadcn',
      'wc',
      'en; hero-keyboard-focus; native-theme-dark; 390px popup-navigation',
      { desktopNavigation, popupNavigation, narrowNavigation, hero, social, focused, themeBefore }
    );
  } finally {
    await enContext.close();
  }
  // English documentation route: the desktop and popup primary navigation, the
  // four social destinations, native keyboard focus and hover, and the current
  // truth remaining with the docs navigation.
  const docsContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'light',
  });
  try {
    const docs = await docsContext.newPage();
    await docs.goto(`${baseUrl}/en/ui-libraries/shadcn/button/`, { waitUntil: 'networkidle' });
    const desktopLinks = docs.locator('[data-site-header-desktop-navigation] a');
    await docs
      .locator('[data-site-header-desktop-navigation] a[data-site-link-enhanced]')
      .nth(2)
      .waitFor();
    const desktopNavigation = await collectShellLinks(
      docs,
      '[data-site-header-desktop-navigation] a'
    );
    expect(shellNavigationIssues(desktopNavigation, englishExpectation)).toEqual([]);
    expect(
      await docs.evaluate(() =>
        Array.from(document.querySelectorAll('[data-site-header-desktop-navigation]')).map((nav) =>
          nav.getAttribute('aria-label')
        )
      )
    ).toEqual([navigationLabel]);
    const navHover = desktopLinks.nth(1);
    const navResting = await linkPaint(navHover);
    await navHover.hover();
    await expect
      .poll(async () => (await linkPaint(navHover)).tokens)
      .not.toEqual(navResting.tokens);
    const navFocus = await assertNavigationFocus(docs, desktopLinks.first());
    await captureLinks(
      docs,
      'english-docs-primary-navigation-focus',
      'shadcn',
      'wc',
      'en; desktop-primary-navigation; keyboard-focus',
      navFocus
    );
    expect(await docs.locator('.sidebar-pane a[aria-current="page"]').count()).toBe(1);
    expect(
      await docs.locator('[data-site-header-desktop-navigation] a[aria-current]').count()
    ).toBe(0);
    await openSettings(docs);
    await assertHeaderPopupSurface(docs, 'shadcn', 'wc', false);
    const popup = await collectShellLinks(docs, '[data-site-header-navigation] a');
    expect(shellNavigationIssues(popup, englishExpectation)).toEqual([]);
    expect(
      await docs.evaluate(() =>
        Array.from(document.querySelectorAll('[data-site-header-navigation]')).map((nav) =>
          nav.getAttribute('aria-label')
        )
      )
    ).toEqual([navigationLabel]);
    expect(await docs.locator('[data-site-header-navigation] a[aria-current]').count()).toBe(0);
    const socialLinks = docs.locator('.site-social-links a[data-site-native-link]');
    const socialFacts = await collectShellLinks(
      docs,
      '.site-social-links a[data-site-native-link]'
    );
    expect(shellNavigationIssues(socialFacts, socialExpectation)).toEqual([]);
    await assertSocialPaint(docs, socialLinks, 'shadcn', async (state, evidence) => {
      await captureLinks(
        docs,
        `english-docs-social-${state}`,
        'shadcn',
        'wc',
        `en; docs-menu-open; first-social-${state}`,
        evidence
      );
    });
    // The panel owns the pointer while it is open, so the real activation
    // control below runs after the native disclosure has closed again.
    await docs.keyboard.press('Escape');
    await expect
      .poll(() =>
        docs.evaluate(
          () => (document.querySelector('[data-site-header-panel]') as HTMLDetailsElement).open
        )
      )
      .toBe(false);
    // Mutation controls: the shared observer must fail closed on the three
    // shapes a translated snapshot or a Button-role regression would produce.
    // Only the collected observation is mutated; the page is never rewritten to
    // make an assertion pass.
    expect(shellNavigationIssues(desktopNavigation.slice(1), englishExpectation)).toContain(
      'anchor count'
    );
    const wrongLocale = desktopNavigation.map((fact, index) =>
      index === 0 ? { ...fact, name: sitePrimaryNavigation('zh-cn')[0]!.label } : fact
    );
    expect(shellNavigationIssues(wrongLocale, englishExpectation)).toContain(
      '0: accessible name mismatch'
    );
    const buttonCommand = desktopNavigation.map((fact, index) =>
      index === 1 ? { ...fact, role: 'button', buttonCommand: true } : fact
    );
    expect(shellNavigationIssues(buttonCommand, englishExpectation)).toEqual(
      expect.arrayContaining(['1: unexpected role', '1: Button command marker'])
    );
    // Real negative control: a target-phase cancel keeps the trusted native
    // click prevented, the document where it was, and the same enhanced anchor
    // as the owner. Space must not activate a native navigation anchor.
    const location = docs.url();
    const pageCount = docsContext.pages().length;
    await installNativeTrace(docs, true);
    await nativeActionLabel(docs, 'english-navigation-cancel');
    await desktopLinks.first().evaluate((anchor) => {
      anchor.addEventListener('click', (event) => event.preventDefault(), { once: true });
    });
    await desktopLinks.first().click();
    const events = await saveNativeTrace(docs, 'english-navigation-cancel-negative-control', {
      href: await desktopLinks.first().getAttribute('href'),
    });
    expect(events.filter((event) => event.type === 'click').at(-1)).toMatchObject({
      trusted: true,
      preventedAfterDispatch: true,
      targetWasAnchor: true,
    });
    expect(docs.url()).toBe(location);
    expect(docsContext.pages()).toHaveLength(pageCount);
    expect(await desktopLinks.first().getAttribute('data-site-link-enhanced')).toBe('true');
    await desktopLinks.first().focus();
    await docs.keyboard.press('Space');
    expect(docs.url()).toBe(location);
    expect(docsContext.pages()).toHaveLength(pageCount);
  } finally {
    await docsContext.close();
  }
  // English narrow dark documentation route: the desktop navigation is not
  // rendered, the popup navigation carries the same labels and destinations,
  // and long English labels stay inside the page.
  const narrowContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: 'dark',
  });
  try {
    const narrow = await narrowContext.newPage();
    await narrow.goto(`${baseUrl}/en/ui-libraries/brutalist/components/button/`, {
      waitUntil: 'networkidle',
    });
    await narrow.locator('.site-social-links a[data-site-native-link]').first().waitFor();
    expect(await narrow.locator('[data-site-header-desktop-navigation]').isVisible()).toBe(false);
    await openSettings(narrow);
    const popupNavigation = await collectShellLinks(narrow, '[data-site-header-navigation] a');
    expect(shellNavigationIssues(popupNavigation, englishExpectation)).toEqual([]);
    for (const link of await narrow.locator('[data-site-header-navigation] a').all()) {
      const paint = await linkPaint(link);
      expect(paint.visibleTarget).toBe(true);
      expect(paint.unclipped).toBe(true);
    }
    expect(
      await narrow.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    ).toBeLessThanOrEqual(1);
    expect(
      shellNavigationIssues(
        await collectShellLinks(narrow, '.site-social-links a[data-site-native-link]'),
        socialExpectation
      )
    ).toEqual([]);
    const focus = await assertNavigationFocus(
      narrow,
      narrow.locator('[data-site-header-navigation] a').first()
    );
    await captureLinks(
      narrow,
      'english-narrow-docs-navigation',
      'brutalist',
      'wc',
      'en; 390px; dark; popup-primary-navigation-focus',
      { popupNavigation, focus }
    );
  } finally {
    await narrowContext.close();
  }
}, 120_000);
