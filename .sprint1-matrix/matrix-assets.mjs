// Carrier-only, opt-in observation of the original candidate's Playwright
// responses. This never routes requests, rewrites responses, evaluates page
// code, changes launch/context options or decides a product assertion.
import assert from "node:assert/strict";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import {
  SOURCE_SHA,
  SOURCE_TREE,
  fileHash,
  git,
  loadManifest,
  readJson,
  runtimeOrigin,
  sha256,
  writeJson,
} from "./common.mjs";

const ROUTE = "/zh-cn/internal/demo-matrix/";
const MAX_FILES = 4096;
const MAX_BYTES = 128 * 1024 * 1024;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_IN_FLIGHT = 32;
const CLOSE_CAPTURE_MS = 2000;

export function installMatrixAssetObservation(
  chromium,
  { output, source, origin },
) {
  assert.equal(
    chromium[Symbol.for("sprint1.matrix.asset-observation")],
    undefined,
  );
  chromium[Symbol.for("sprint1.matrix.asset-observation")] = true;
  mkdirSync(path.join(output, "bytes"), { recursive: true });
  const journal = path.join(output, `responses-${process.pid}.ndjson`);
  const statusFile = path.join(output, `observer-${process.pid}.json`);
  const counters = {
    contexts: 0,
    pages: 0,
    responses: 0,
    captured: 0,
    bytes: 0,
    ignoredOrigin: 0,
    ignoredNonScript: 0,
    unavailable: 0,
    overLimit: 0,
    pendingAtClose: 0,
    started: 0,
    inFlight: 0,
    peakInFlight: 0,
    droppedInFlight: 0,
    droppedAfterClose: 0,
    retiredPending: 0,
    lateResultsDiscarded: 0,
    closeCaptureTimeouts: 0,
    writeErrors: 0,
  };
  const writeStatus = () => {
    try {
      writeJson(statusFile, {
        schemaVersion: 1,
        source,
        origin,
        diagnosticOnly: true,
        formalAcceptance: false,
        processId: process.pid,
        at: new Date().toISOString(),
        counters: { ...counters },
        limits: {
          MAX_FILES,
          MAX_BYTES,
          MAX_FILE_BYTES,
          MAX_IN_FLIGHT,
          CLOSE_CAPTURE_MS,
        },
        retainedByteLimitsOnly: true,
        boundary:
          "Observed response.body bytes from the original local Matrix navigation. Query/fragment and headers are not retained. In-flight reads are capped; byte limits cap retained artifacts, not the transient Playwright buffer for an unknown-length response. Observation and bounded cleanup add diagnostic overhead. Retired body results never write bytes or journal rows; final process-exit counters settle before the owner wrapper permits mapping.",
      });
    } catch {
      counters.writeErrors++;
    }
  };
  const append = (row) => {
    try {
      appendFileSync(
        journal,
        JSON.stringify({ at: new Date().toISOString(), ...row }) + "\n",
      );
    } catch {
      counters.writeErrors++;
    }
  };
  writeStatus();
  const launch = chromium.launch.bind(chromium);
  chromium.launch = async (...launchArguments) => {
    const browser = await launch(...launchArguments);
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async (...contextArguments) => {
      const context = await newContext(...contextArguments);
      const contextId = ++counters.contexts;
      const pending = new Set();
      const seenPages = new WeakSet();
      const listeners = [];
      let accepting = true;
      let retired = false;
      let finalized = false;
      const observe = (page) => {
        if (!accepting) {
          counters.droppedAfterClose++;
          return;
        }
        if (seenPages.has(page)) return;
        seenPages.add(page);
        const pageId = ++counters.pages;
        let ownedOrigin = null;
        const listener = (response) => {
          if (!accepting) {
            counters.droppedAfterClose++;
            return;
          }
          if (counters.inFlight >= MAX_IN_FLIGHT) {
            counters.droppedInFlight++;
            return;
          }
          if (counters.started >= MAX_FILES) {
            counters.overLimit++;
            return;
          }
          counters.started++;
          counters.inFlight++;
          counters.peakInFlight = Math.max(
            counters.peakInFlight,
            counters.inFlight,
          );
          const work = (async () => {
            counters.responses++;
            let url;
            try {
              url = new URL(response.url());
            } catch {
              counters.ignoredOrigin++;
              return;
            }
            if (
              url.username ||
              url.password ||
              url.protocol !== "http:" ||
              url.hostname !== "127.0.0.1" ||
              !url.port
            ) {
              counters.ignoredOrigin++;
              return;
            }
            const request = response.request();
            if (
              request.isNavigationRequest() &&
              request.resourceType() === "document" &&
              url.pathname === ROUTE
            )
              ownedOrigin ??= url.origin;
            if (!ownedOrigin || url.origin !== ownedOrigin) {
              counters.ignoredOrigin++;
              return;
            }
            if (request.resourceType() !== "script") {
              counters.ignoredNonScript++;
              return;
            }
            const headers = await response.allHeaders();
            if (retired) {
              counters.lateResultsDiscarded++;
              return;
            }
            const contentType = headers["content-type"] ?? "";
            const row = {
              contextId,
              pageId,
              observedUrl: `${url.origin}${url.pathname}`,
              urlPath: url.pathname,
              querySha256: url.search ? sha256(url.search) : null,
              status: response.status(),
              contentType,
              resourceType: request.resourceType(),
            };
            if (
              response.status() !== 200 ||
              !/(?:javascript|ecmascript)/i.test(contentType)
            ) {
              counters.unavailable++;
              append({ ...row, capture: "non-success-javascript-response" });
              return;
            }
            const declaredBytes = Number(headers["content-length"] ?? 0);
            if (
              counters.captured >= MAX_FILES ||
              counters.bytes >= MAX_BYTES ||
              declaredBytes > MAX_FILE_BYTES
            ) {
              counters.overLimit++;
              append({ ...row, capture: "bounded-capture-limit" });
              return;
            }
            try {
              const body = await response.body();
              if (retired) {
                counters.lateResultsDiscarded++;
                return;
              }
              if (
                body.length > MAX_FILE_BYTES ||
                counters.bytes + body.length > MAX_BYTES ||
                counters.captured >= MAX_FILES
              ) {
                counters.overLimit++;
                append({
                  ...row,
                  capture: "bounded-capture-limit",
                  observedBytes: body.length,
                });
                return;
              }
              const digest = sha256(body);
              const artifactPath = `bytes/${digest}.js`;
              const file = path.join(output, artifactPath);
              if (!existsSync(file)) writeFileSync(file, body, { flag: "wx" });
              else assert.equal(fileHash(file), digest);
              counters.captured++;
              counters.bytes += body.length;
              append({
                ...row,
                capture: "captured-original-response",
                bytes: body.length,
                sha256: digest,
                artifactPath,
              });
            } catch (error) {
              if (retired) {
                counters.lateResultsDiscarded++;
                return;
              }
              counters.unavailable++;
              append({
                ...row,
                capture: "response-body-unavailable",
                errorName: error?.name ?? "Error",
              });
            }
          })().catch((error) => {
            if (retired) {
              counters.lateResultsDiscarded++;
              return;
            }
            counters.unavailable++;
            append({
              contextId,
              pageId,
              capture: "observer-error",
              errorName: error?.name ?? "Error",
            });
          });
          pending.add(work);
          void work.finally(() => {
            pending.delete(work);
            counters.inFlight--;
          });
        };
        page.on("response", listener);
        listeners.push([page, listener]);
      };
      context.on("page", observe);
      for (const page of context.pages()) observe(page);
      const close = context.close.bind(context);
      context.close = async (...arguments_) => {
        accepting = false;
        context.off("page", observe);
        for (const [page, listener] of listeners)
          page.off("response", listener);
        try {
          return await close(...arguments_);
        } finally {
          if (!finalized) {
            let timer;
            try {
              await Promise.race([
                Promise.allSettled([...pending]),
                new Promise((resolve) => {
                  timer = setTimeout(() => {
                    counters.closeCaptureTimeouts++;
                    resolve();
                  }, CLOSE_CAPTURE_MS);
                }),
              ]);
            } finally {
              clearTimeout(timer);
              retired = true;
              finalized = true;
              counters.pendingAtClose += pending.size;
              counters.retiredPending += pending.size;
              writeStatus();
            }
          }
        }
      };
      return context;
    };
    return browser;
  };
  process.once("exit", writeStatus);
  return { counters, writeStatus };
}

export function mapMatrixProfileAssets(output, profileFile, source, origin) {
  const rows = readdirSync(output)
    .filter((name) => /^responses-\d+\.ndjson$/.test(name))
    .flatMap((name) =>
      readFileSync(path.join(output, name), "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line)),
    );
  const records = rows.filter(
    (row) => row.capture === "captured-original-response",
  );
  for (const row of records) {
    assert.match(row.artifactPath, /^bytes\/[a-f0-9]{64}\.js$/);
    assert.equal(fileHash(path.join(output, row.artifactPath)), row.sha256);
  }
  const profilePresent = existsSync(profileFile);
  const profile = profilePresent ? readJson(profileFile) : null;
  const urls = [
    ...new Set(
      (profile?.profile?.nodes ?? [])
        .map((node) => node.callFrame.url)
        .filter(Boolean),
    ),
  ];
  const frames = urls.map((observedUrl) => {
    const versions = [
      ...new Map(
        records
          .filter((row) => row.observedUrl === observedUrl)
          .map((row) => [row.sha256, row]),
      ).values(),
    ];
    return {
      observedUrl,
      mapping:
        versions.length === 1
          ? "one-observed-response-byte-version"
          : versions.length
            ? "ambiguous-observed-response-versions"
            : "not-captured-as-local-script-response",
      versions: versions.map(({ artifactPath, sha256, bytes }) => ({
        artifactPath,
        sha256,
        bytes,
      })),
    };
  });
  const value = {
    schemaVersion: 1,
    source,
    origin,
    diagnosticOnly: true,
    formalAcceptance: false,
    profilePresent,
    profileFile,
    profileSha256: profilePresent ? fileHash(profileFile) : null,
    records,
    nonCaptured: rows.filter(
      (row) => row.capture !== "captured-original-response",
    ),
    frames,
    observers: readdirSync(output)
      .filter((name) => /^observer-\d+\.json$/.test(name))
      .map((name) => readJson(path.join(output, name))),
    boundary:
      "CPU frame URLs are sanitized by the original startup profiler. Only exact sanitized URL matches with one observed byte version are mapped; missing or multiple versions remain explicit. No URL is replayed or fetched by the mapper.",
  };
  writeJson(path.join(output, "index.json"), value);
  return {
    capturedResponses: records.length,
    profilePresent,
    frameUrls: frames.length,
    ambiguous: frames.filter((row) => row.mapping.startsWith("ambiguous"))
      .length,
    missing: frames.filter((row) => row.mapping.startsWith("not-captured"))
      .length,
  };
}

if (process.env.S1_MATRIX_ASSET_CAPTURE === "1") {
  loadManifest();
  const origin = runtimeOrigin();
  const candidate = path.join(process.env.GITHUB_WORKSPACE, "candidate");
  assert.equal(git(candidate, ["rev-parse", "HEAD"]), SOURCE_SHA);
  assert.equal(git(candidate, ["rev-parse", "HEAD^{tree}"]), SOURCE_TREE);
  assert.equal(
    git(candidate, ["status", "--porcelain", "--untracked-files=no"]),
    "",
  );
  const output = path.join(
    process.env.RUNNER_TEMP,
    "sprint1-matrix-profile",
    "matrix-accessibility-consumer",
    "compiled-scripts",
  );
  const require = createRequire(path.join(candidate, "apps/www/package.json"));
  const { chromium } = require("playwright-core");
  installMatrixAssetObservation(chromium, {
    output,
    source: { sha: SOURCE_SHA, tree: SOURCE_TREE, dirty: false },
    origin,
  });
}
