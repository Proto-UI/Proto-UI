// This file is copied from the trusted default branch after the pull-request
// artifact has been downloaded. It must never come from the artifact itself.
const PREVIEW_PR = __POPPY_PREVIEW_PR__;
const PREVIEW_PROJECT = __POPPY_PREVIEW_PROJECT__;
const CONTROL_PLANE = __POPPY_CONTROL_PLANE__;
const PREVIEW_HEAD_SHA = __POPPY_PREVIEW_HEAD_SHA__;
const PREVIEW_RUN_ID = __POPPY_PREVIEW_RUN_ID__;
const PREVIEW_RUN_ATTEMPT = __POPPY_PREVIEW_RUN_ATTEMPT__;
const SESSION_COOKIE = "__Host-poppy-preview";
const CANONICAL_ORIGIN = `https://${PREVIEW_PROJECT}.pages.dev`;

function securityHeaders(headers = new Headers()) {
  headers.set("Cache-Control", "private, no-store");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  headers.set("Content-Security-Policy", "worker-src 'none'; child-src 'none'");
  // This response header is evaluated when an artifact is fetched as a
  // Service Worker script. The deliberately unrelated scope makes every
  // artifact registration fail even in browsers that do not enforce CSP's
  // worker-src directive consistently.
  headers.set("Service-Worker-Allowed", "/__poppy/no-service-workers");
  return headers;
}

function response(body, init = {}) {
  return new Response(body, { ...init, headers: securityHeaders(new Headers(init.headers)) });
}

function redirect(location, status = 302, clearSession = false) {
  const headers = securityHeaders(new Headers({ Location: location }));
  if (clearSession) {
    headers.append(
      "Set-Cookie",
      `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    );
  }
  return new Response(null, { status, headers });
}

function cookieValue(request, name) {
  for (const part of (request.headers.get("Cookie") || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return "";
    }
  }
  return "";
}

function safeNext(value) {
  try {
    const base = "https://poppy-preview.invalid";
    const candidate = new URL(value || "/", base);
    if (candidate.origin !== base) return "/";
    return `${candidate.pathname}${candidate.search}${candidate.hash}`;
  } catch {
    return "/";
  }
}

function loginURL(request) {
  const requestURL = new URL(request.url);
  const login = new URL("/preview/auth/github", CONTROL_PLANE);
  login.searchParams.set("pr", String(PREVIEW_PR));
  login.searchParams.set("return", requestURL.toString());
  return login.toString();
}

async function controlPlane(env, pathname, payload) {
  const secret = env.POPPY_PREVIEW_EDGE_SECRET;
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("preview edge secret is unavailable");
  }
  return fetch(new URL(pathname, CONTROL_PLANE), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Poppy-Preview-Edge-Secret": secret,
    },
    body: JSON.stringify(payload),
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });
}

function isTransientControlPlaneStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function temporarilyUnavailable() {
  return response("Poppy preview authorization is temporarily unavailable", {
    status: 503,
    headers: { "Retry-After": "5" },
  });
}

async function exchangeTicket(request, env) {
  if (request.method !== "GET") return response("Method not allowed", { status: 405 });
  const url = new URL(request.url);
  const ticket = url.searchParams.get("ticket") || "";
  if (ticket.length < 24 || ticket.length > 4096) {
    return response("Invalid or expired preview ticket", { status: 400 });
  }

  let exchanged;
  try {
    exchanged = await controlPlane(env, "/api/preview/exchange", {
      ticket,
      pr: PREVIEW_PR,
      project: PREVIEW_PROJECT,
      head_sha: PREVIEW_HEAD_SHA,
      run_id: PREVIEW_RUN_ID,
      run_attempt: PREVIEW_RUN_ATTEMPT,
    });
  } catch {
    return temporarilyUnavailable();
  }
  if (isTransientControlPlaneStatus(exchanged.status)) return temporarilyUnavailable();
  if (!exchanged.ok) {
    return response("Invalid or expired preview ticket", { status: 401 });
  }
  const result = await exchanged.json().catch(() => ({}));
  const session = typeof result.session === "string" ? result.session : "";
  if (session.length < 24 || session.length > 4096) {
    return response("Poppy returned an invalid preview session", { status: 502 });
  }
  let expiresIn = Number(result.expires_in);
  if (!Number.isFinite(expiresIn) && typeof result.expires_at === "string") {
    expiresIn = (Date.parse(result.expires_at) - Date.now()) / 1000;
  }
  expiresIn = Math.max(60, Math.min(Math.floor(expiresIn) || 28_800, 86_400));
  const headers = securityHeaders(new Headers({ Location: safeNext(result.return) }));
  headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(session)}; Path=/; Max-Age=${expiresIn}; HttpOnly; Secure; SameSite=Lax`,
  );
  return new Response(null, { status: 303, headers });
}

async function serveAuthorized(request, env) {
  const session = cookieValue(request, SESSION_COOKIE);
  if (!session) return redirect(loginURL(request));

  let authorized;
  try {
    authorized = await controlPlane(env, "/api/preview/authorize", {
      session,
      pr: PREVIEW_PR,
      project: PREVIEW_PROJECT,
      head_sha: PREVIEW_HEAD_SHA,
      run_id: PREVIEW_RUN_ID,
      run_attempt: PREVIEW_RUN_ATTEMPT,
    });
  } catch {
    return temporarilyUnavailable();
  }
  if (isTransientControlPlaneStatus(authorized.status)) return temporarilyUnavailable();
  if (!authorized.ok) return redirect(loginURL(request), 302, true);
  const decision = await authorized.json().catch(() => ({}));
  if (decision.allowed !== true && decision.authorized !== true) {
    return redirect(loginURL(request), 302, true);
  }

  const assetHeaders = new Headers(request.headers);
  assetHeaders.delete("Cookie");
  assetHeaders.delete("Authorization");
  assetHeaders.delete("X-Poppy-Preview-Edge-Secret");
  const assetRequest = new Request(request, { headers: assetHeaders });
  const asset = await fetchAsset(env, assetRequest);
  const headers = securityHeaders(new Headers(asset.headers));
  headers.delete("Set-Cookie");
  return new Response(asset.body, {
    status: asset.status,
    statusText: asset.statusText,
    headers,
  });
}

async function fetchAsset(env, request) {
  let asset = await env.ASSETS.fetch(request);
  if (asset.status !== 404 || request.method !== "GET") return asset;

  // Pages' advanced-mode ASSETS binding does not consistently apply the
  // platform's directory-index routing. Astro emits /route/index.html, so
  // resolve those paths explicitly before returning a genuine 404.
  const url = new URL(request.url);
  if (url.pathname.endsWith("/")) url.pathname += "index.html";
  else if (!url.pathname.split("/").at(-1)?.includes(".")) url.pathname += "/index.html";
  else return asset;
  return env.ASSETS.fetch(new Request(url, request));
}

async function assetHealth(env) {
  const probe = await env.ASSETS.fetch(new Request(`${CANONICAL_ORIGIN}/`));
  return response(null, { status: probe.ok ? 204 : 503 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.origin !== CANONICAL_ORIGIN) {
      return redirect(`${CANONICAL_ORIGIN}${url.pathname}${url.search}`, 308);
    }
    if (url.pathname === "/__poppy/assets-ready") return assetHealth(env);
    if (url.pathname === "/__poppy/session") return exchangeTicket(request, env);
    return serveAuthorized(request, env);
  },
};
