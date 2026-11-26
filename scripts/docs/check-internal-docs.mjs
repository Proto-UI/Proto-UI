#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';
import { parse as parseYaml } from 'yaml';
import {
  ALLOWED_RECORD_KINDS,
  ALLOWED_RECORD_STATUSES,
  CHRONOLOGICAL_DIARY_OPENER_PATTERN,
  CONCLUSION_FIRST_HEADING_PATTERN,
  DEBT_BASELINE_PATH,
  DEFENSIVE_DISCLAIMER_PATTERNS,
  EXEMPT_FROM_JSON_BUDGET,
  EXEMPT_FROM_PROSE_CHECKS,
  FORBIDDEN_BASENAME_PATTERNS,
  FORBIDDEN_EXTENSIONS,
  IMAGE_EXTENSIONS,
  INTERNAL_DOCS_ROOT,
  LOCAL_PATH_PATTERNS,
  MERGED_TOKEN_PATTERNS,
  PROSE_LIMITS,
  RECEIPTS_SECTION_PATTERN,
  RECORD_FRONTMATTER_CUTOFF_DATE,
  RULE_GUIDANCE,
  SCOPE_SECTION_PATTERN,
  SIZE_BUDGETS,
  STACKED_NEGATIVE_PATTERNS,
  VALE_STYLE_DIR,
} from './internal-doc-policy.mjs';

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const HAN_REGEX = /[\u4e00-\u9fff]/g;
const FULL_SHA_REGEX = /\b[0-9a-f]{40}\b/g;
const SHA256_REGEX = /\b[0-9a-f]{64}\b/g;
const LONG_RUN_ID_REGEX = /\b(?:run|job|artifact|comment)\s+#?\d{9,}\b|\b\d{10,}\b/gi;
const RAW_BYTE_COUNT_REGEX = /\b\d[\d,]{4,}\s*bytes?\b/gi;
const SANDBOX_NOISE_REGEX = /\bsocket(?:\(\))?\s+EPERM\b|\bProcessSingleton\b/gi;

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function isExemptPrefix(relPath, exemptions) {
  return exemptions.some((prefix) =>
    prefix.endsWith('/') ? relPath.startsWith(prefix) : relPath === prefix
  );
}

function splitFrontmatter(raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(raw);
  if (!match) {
    return { frontmatter: null, frontmatterError: null, body: raw, bodyLineOffset: 0 };
  }
  const body = raw.slice(match[0].length);
  const bodyLineOffset = match[0].split(/\r?\n/).length - 1;
  try {
    const parsed = parseYaml(match[1]);
    return {
      frontmatter: parsed && typeof parsed === 'object' ? parsed : null,
      frontmatterError: null,
      body,
      bodyLineOffset,
    };
  } catch (error) {
    return {
      frontmatter: null,
      frontmatterError: error.message,
      body,
      bodyLineOffset,
    };
  }
}

function visibleText(node, { includeCode = true } = {}) {
  if (!node) return '';
  if (node.type === 'text') return node.value ?? '';
  if (node.type === 'inlineCode') return includeCode ? (node.value ?? '') : '';
  if (node.type === 'code' || node.type === 'html') return '';
  if (node.type === 'break') return ' ';
  if (node.type === 'image') return node.alt ?? '';
  if (Array.isArray(node.children)) {
    return node.children.map((child) => visibleText(child, { includeCode })).join('');
  }
  return '';
}

function countInlineCode(node) {
  if (!node) return 0;
  if (node.type === 'inlineCode') return 1;
  if (Array.isArray(node.children)) {
    return node.children.reduce((sum, child) => sum + countInlineCode(child), 0);
  }
  return 0;
}

function isZhDominant(text) {
  const trimmed = text.replace(/\s+/g, '');
  if (!trimmed.length) return false;
  const hanCount = (trimmed.match(HAN_REGEX) ?? []).length;
  return hanCount / trimmed.length >= 0.35;
}

function extractRecordDate(relPath) {
  const base = path.posix.basename(relPath);
  const match = /^(20\d\d-\d\d-\d\d)-/.exec(base);
  return match ? match[1] : null;
}

function makeDiagnostic(rule, file, line, message, severity = 'error') {
  const guidance = RULE_GUIDANCE[rule];
  return {
    rule,
    file,
    line,
    severity,
    message,
    why: guidance?.why ?? null,
    fix: guidance?.fix ?? null,
  };
}

export async function loadValeRules(root = DEFAULT_ROOT) {
  const styleDir = path.join(root, VALE_STYLE_DIR);
  let entries;
  try {
    entries = await fs.readdir(styleDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  const rules = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isFile() || !/\.ya?ml$/.test(entry.name)) continue;
    const raw = await fs.readFile(path.join(styleDir, entry.name), 'utf8');
    const parsed = parseYaml(raw);
    if (!parsed || typeof parsed !== 'object') continue;
    const name = `ProtoUI.${entry.name.replace(/\.ya?ml$/, '')}`;
    const flags = parsed.ignorecase ? 'gi' : 'g';
    if (parsed.extends === 'substitution' && parsed.swap && typeof parsed.swap === 'object') {
      const patterns = Object.entries(parsed.swap).map(([phrase, replacement]) => ({
        regex: new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, flags),
        replacement,
        phrase,
      }));
      rules.push({
        name,
        kind: 'substitution',
        level: parsed.level ?? 'warning',
        message: parsed.message ?? "Prefer '%s' over '%s'.",
        patterns,
      });
    } else if (parsed.extends === 'existence' && Array.isArray(parsed.tokens)) {
      const patterns = parsed.tokens.map((token) => new RegExp(token, flags));
      rules.push({
        name,
        kind: 'existence',
        level: parsed.level ?? 'warning',
        message: parsed.message ?? "Avoid '%s'.",
        patterns,
      });
    }
  }
  return rules;
}

function runValeWarningsOnNode({ file, text, line, valeRules, warnings }) {
  for (const rule of valeRules) {
    if (rule.kind === 'substitution') {
      for (const { regex, replacement } of rule.patterns) {
        regex.lastIndex = 0;
        const match = regex.exec(text);
        if (match) {
          const msg = rule.message.replace('%s', replacement).replace('%s', match[0]);
          warnings.push({
            rule: `vale/${rule.name}`,
            file,
            line,
            severity: 'warning',
            message: msg,
            why: null,
            fix: `Replace "${match[0]}" with "${replacement}".`,
          });
        }
      }
    } else if (rule.kind === 'existence') {
      for (const regex of rule.patterns) {
        regex.lastIndex = 0;
        const match = regex.exec(text);
        if (match) {
          const msg = rule.message.replace('%s', match[0]);
          warnings.push({
            rule: `vale/${rule.name}`,
            file,
            line,
            severity: 'warning',
            message: msg,
            why: null,
            fix: null,
          });
        }
      }
    }
  }
}

export function lintNonMarkdownFile({ relPath, byteSize }) {
  const diagnostics = [];
  const lower = relPath.toLowerCase();
  const base = path.posix.basename(relPath);
  const ext = path.posix.extname(lower);

  if (
    FORBIDDEN_EXTENSIONS.includes(ext) ||
    FORBIDDEN_BASENAME_PATTERNS.some((rx) => rx.test(base))
  ) {
    diagnostics.push(
      makeDiagnostic(
        'internal/no-binary-or-archive',
        relPath,
        1,
        `Forbidden archive/log/script artifact in internal/ (${Math.round(byteSize / 1024)} KB).`
      )
    );
    return diagnostics;
  }

  if (IMAGE_EXTENSIONS.includes(ext) && byteSize > SIZE_BUDGETS.imageMaxBytes) {
    diagnostics.push(
      makeDiagnostic(
        'internal/no-binary-or-archive',
        relPath,
        1,
        `Image is ${Math.round(byteSize / 1024)} KB (limit: ${SIZE_BUDGETS.imageMaxBytes / 1024} KB).`
      )
    );
  }

  if (
    ext === '.json' &&
    !isExemptPrefix(relPath, EXEMPT_FROM_JSON_BUDGET) &&
    byteSize > SIZE_BUDGETS.jsonMaxBytes
  ) {
    diagnostics.push(
      makeDiagnostic(
        'internal/size-budget',
        relPath,
        1,
        `JSON file is ${(byteSize / 1024).toFixed(1)} KB (limit: ${SIZE_BUDGETS.jsonMaxBytes / 1024} KB).`
      )
    );
  }

  return diagnostics;
}

export function lintMarkdownDocument({ relPath, text, valeRules = [] }) {
  const diagnostics = [];
  const warnings = [];
  const byteSize = Buffer.byteLength(text, 'utf8');
  const lines = text.split(/\r?\n/);

  if (isExemptPrefix(relPath, EXEMPT_FROM_PROSE_CHECKS)) {
    return { diagnostics, warnings };
  }

  const { frontmatter, frontmatterError, body, bodyLineOffset } = splitFrontmatter(text);
  const isReadme = path.posix.basename(relPath).toLowerCase() === 'readme.md';
  const isRecord = relPath.startsWith('internal/records/') && !isReadme;
  const recordDate = isRecord ? extractRecordDate(relPath) : null;

  // 1. Frontmatter validation for new records (or any file opting into frontmatter)
  if (frontmatterError) {
    diagnostics.push(
      makeDiagnostic(
        'internal/record-frontmatter',
        relPath,
        1,
        `Invalid YAML frontmatter: ${frontmatterError}`
      )
    );
  } else if (
    isRecord &&
    ((recordDate && recordDate >= RECORD_FRONTMATTER_CUTOFF_DATE) || frontmatter)
  ) {
    if (!frontmatter) {
      diagnostics.push(
        makeDiagnostic(
          'internal/record-frontmatter',
          relPath,
          1,
          `New dated record (${recordDate}) is missing YAML frontmatter (\`kind\`, \`status\`, \`date\`).`
        )
      );
    } else {
      if (!ALLOWED_RECORD_KINDS.includes(frontmatter.kind)) {
        diagnostics.push(
          makeDiagnostic(
            'internal/record-frontmatter',
            relPath,
            1,
            `Frontmatter \`kind\` must be one of: ${ALLOWED_RECORD_KINDS.join(', ')}.`
          )
        );
      }
      if (!ALLOWED_RECORD_STATUSES.includes(frontmatter.status)) {
        diagnostics.push(
          makeDiagnostic(
            'internal/record-frontmatter',
            relPath,
            1,
            `Frontmatter \`status\` must be one of: ${ALLOWED_RECORD_STATUSES.join(', ')}.`
          )
        );
      }
      const dateStr =
        frontmatter.date instanceof Date
          ? frontmatter.date.toISOString().slice(0, 10)
          : String(frontmatter.date ?? '');
      if (!/^20\d\d-\d\d-\d\d$/.test(dateStr)) {
        diagnostics.push(
          makeDiagnostic(
            'internal/record-frontmatter',
            relPath,
            1,
            `Frontmatter \`date\` must be an ISO YYYY-MM-DD date.`
          )
        );
      }
    }
  }

  // 2. Size budgets by document role
  const isDeepRecord =
    isRecord &&
    frontmatter &&
    (frontmatter.kind === 'deep-audit' || frontmatter.kind === 'blueprint');
  const maxBytes = isReadme
    ? SIZE_BUDGETS.readmeMaxBytes
    : isDeepRecord
      ? SIZE_BUDGETS.deepRecordMaxBytes
      : isRecord
        ? SIZE_BUDGETS.recordMaxBytes
        : SIZE_BUDGETS.livingDocMaxBytes;
  const maxLines = isReadme
    ? SIZE_BUDGETS.readmeMaxLines
    : isDeepRecord
      ? SIZE_BUDGETS.deepRecordMaxLines
      : isRecord
        ? SIZE_BUDGETS.recordMaxLines
        : SIZE_BUDGETS.livingDocMaxLines;

  if (byteSize > maxBytes || lines.length > maxLines) {
    diagnostics.push(
      makeDiagnostic(
        'internal/size-budget',
        relPath,
        1,
        `Document is ${(byteSize / 1024).toFixed(1)} KB / ${lines.length} lines (limit: ${(maxBytes / 1024).toFixed(0)} KB / ${maxLines} lines).`
      )
    );
  }

  // Parse Markdown AST with GFM (tables, task lists, strikethrough)
  const tree = fromMarkdown(body, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });

  let h1Count = 0;
  let seenSectionHeading = false;
  let inScopeSection = false;
  let inReceiptsSection = false;
  let consecutiveProse = 0;
  let consecutiveProseChars = 0;
  let reportedConsecutiveProse = false;
  let structuralBlocks = 0;
  let totalBlocks = 0;
  let totalProseChars = 0;
  let defensiveOutsideScope = 0;
  let firstDefensiveLine = null;
  let fullShaCount = 0;
  let firstFullShaLine = null;
  let openingHasConclusionHeading = false;
  let openingDiaryLine = null;

  const lineOf = (node) => (node?.position?.start?.line ?? 1) + bodyLineOffset;

  function inspectProseBlock({ node, isListItem = false, isTopBanner = false }) {
    const line = lineOf(node);
    const fullText = visibleText(node, { includeCode: true }).replace(/\s+/g, ' ').trim();
    const proseOnly = visibleText(node, { includeCode: false }).replace(/\s+/g, ' ').trim();
    if (!fullText) return;

    totalProseChars += fullText.length;

    // Paragraph / listItem length budget
    const zh = isZhDominant(fullText);
    const charLimit = isListItem
      ? zh
        ? PROSE_LIMITS.maxListItemCharsZh
        : PROSE_LIMITS.maxListItemCharsEn
      : zh
        ? PROSE_LIMITS.maxParagraphCharsZh
        : PROSE_LIMITS.maxParagraphCharsEn;

    if (fullText.length > charLimit) {
      diagnostics.push(
        makeDiagnostic(
          'prose/max-paragraph-length',
          relPath,
          line,
          `${isListItem ? 'List item' : 'Paragraph'} is ${fullText.length} chars (limit: ${charLimit}).`
        )
      );
    }

    // Inline code stuffing (e.g. 66 file paths in one bullet)
    const inlineCodeCount = countInlineCode(node);
    if (inlineCodeCount > PROSE_LIMITS.maxInlineCodePerBlock) {
      diagnostics.push(
        makeDiagnostic(
          'prose/no-inline-code-stuffing',
          relPath,
          line,
          `Block stuffs ${inlineCodeCount} inline-code spans into one ${isListItem ? 'list item' : 'paragraph'} (limit: ${PROSE_LIMITS.maxInlineCodePerBlock}).`
        )
      );
    }

    // Machine-local / ephemeral path leaks
    for (const pattern of LOCAL_PATH_PATTERNS) {
      pattern.lastIndex = 0;
      const match = pattern.exec(fullText);
      if (match) {
        diagnostics.push(
          makeDiagnostic(
            'internal/no-local-paths',
            relPath,
            line,
            `Prose leaks ephemeral/machine-local path "${match[1]}".`
          )
        );
        break;
      }
    }

    // Merged-token AI glitches (only on non-code prose text)
    for (const pattern of MERGED_TOKEN_PATTERNS) {
      pattern.lastIndex = 0;
      const match = pattern.exec(proseOnly);
      if (match) {
        diagnostics.push(
          makeDiagnostic(
            'internal/no-merged-tokens',
            relPath,
            line,
            `Likely dropped-space token "${match[0]}" in prose.`
          )
        );
        break;
      }
    }

    // Inline forensics outside Receipts / Evidence sections
    if (!inReceiptsSection) {
      const sha256s = fullText.match(SHA256_REGEX) ?? [];
      if (sha256s.length > 0) {
        diagnostics.push(
          makeDiagnostic(
            'internal/no-inline-forensics',
            relPath,
            line,
            `Inline 64-char SHA-256 digest in narrative prose ("${sha256s[0].slice(0, 12)}...").`
          )
        );
      }
      const fullShas = fullText.replace(SHA256_REGEX, '').match(FULL_SHA_REGEX) ?? [];
      if (fullShas.length > 0) {
        if (firstFullShaLine === null) firstFullShaLine = line;
        fullShaCount += fullShas.length;
      }
      const runIds = proseOnly.match(LONG_RUN_ID_REGEX) ?? [];
      if (runIds.length > 0) {
        diagnostics.push(
          makeDiagnostic(
            'internal/no-inline-forensics',
            relPath,
            line,
            `Bare CI run/job numeric ID "${runIds[0]}" in narrative prose.`
          )
        );
      }
      const byteCounts = proseOnly.match(RAW_BYTE_COUNT_REGEX) ?? [];
      if (byteCounts.length > 0) {
        diagnostics.push(
          makeDiagnostic(
            'internal/no-inline-forensics',
            relPath,
            line,
            `Raw byte count "${byteCounts[0]}" in narrative prose.`
          )
        );
      }
      const sandboxNoise = fullText.match(SANDBOX_NOISE_REGEX) ?? [];
      if (sandboxNoise.length > 0) {
        diagnostics.push(
          makeDiagnostic(
            'internal/no-inline-forensics',
            relPath,
            line,
            `Sandbox/environment noise ("${sandboxNoise[0]}") in narrative prose.`
          )
        );
      }
    }

    // Defensive disclaimers outside dedicated Scope/Limits section
    if (!inScopeSection && !isTopBanner) {
      if (DEFENSIVE_DISCLAIMER_PATTERNS.some((rx) => rx.test(proseOnly))) {
        defensiveOutsideScope += 1;
        if (firstDefensiveLine === null) firstDefensiveLine = line;
      }
    }

    // Stacked negative enumerations in one sentence (outside dedicated Scope/Deferred sections)
    if (!inScopeSection && STACKED_NEGATIVE_PATTERNS.some((rx) => rx.test(proseOnly))) {
      diagnostics.push(
        makeDiagnostic(
          'prose/no-stacked-negatives',
          relPath,
          line,
          `Sentence stacks 3+ negative clauses instead of stating responsibilities positively.`
        )
      );
    }

    // Chronological diary opener detection in first 20 lines of records
    if (
      isRecord &&
      line <= 25 &&
      openingDiaryLine === null &&
      CHRONOLOGICAL_DIARY_OPENER_PATTERN.test(proseOnly)
    ) {
      openingDiaryLine = line;
    }

    // Vale YAML prose warnings (always non-blocking warnings)
    if (valeRules.length > 0 && !zh) {
      runValeWarningsOnNode({ file: relPath, text: proseOnly, line, valeRules, warnings });
    }
  }

  for (let i = 0; i < tree.children.length; i += 1) {
    const node = tree.children[i];
    const line = lineOf(node);
    totalBlocks += 1;

    if (node.type === 'heading') {
      structuralBlocks += 1;
      consecutiveProse = 0;
      consecutiveProseChars = 0;
      reportedConsecutiveProse = false;
      const headingText = visibleText(node).trim();
      if (node.depth === 1) {
        h1Count += 1;
        if (h1Count > 1) {
          diagnostics.push(
            makeDiagnostic(
              'internal/single-h1',
              relPath,
              line,
              `Additional top-level H1 "# ${headingText}" found (document already has an H1).`
            )
          );
        }
      } else {
        seenSectionHeading = true;
        if (node.depth === 2) {
          inScopeSection = SCOPE_SECTION_PATTERN.test(headingText);
          inReceiptsSection = RECEIPTS_SECTION_PATTERN.test(headingText);
        }
        if (line <= 30 && CONCLUSION_FIRST_HEADING_PATTERN.test(headingText)) {
          openingHasConclusionHeading = true;
        }
      }
      continue;
    }

    if (node.type === 'paragraph') {
      const isTopBanner = !seenSectionHeading && i <= 2;
      const paraLen = visibleText(node, { includeCode: true }).replace(/\s+/g, ' ').trim().length;
      consecutiveProse += 1;
      consecutiveProseChars += paraLen;
      if (
        !reportedConsecutiveProse &&
        consecutiveProse > PROSE_LIMITS.maxConsecutiveProseParagraphs &&
        consecutiveProseChars >= PROSE_LIMITS.minConsecutiveProseRunChars
      ) {
        reportedConsecutiveProse = true;
        diagnostics.push(
          makeDiagnostic(
            'prose/structural-rhythm',
            relPath,
            line,
            `More than ${PROSE_LIMITS.maxConsecutiveProseParagraphs} consecutive prose paragraphs (${consecutiveProseChars} chars) without a heading, list, table, or code block.`
          )
        );
      }
      inspectProseBlock({ node, isListItem: false, isTopBanner });
      continue;
    }

    consecutiveProse = 0;
    consecutiveProseChars = 0;
    reportedConsecutiveProse = false;
    if (['list', 'table', 'code', 'blockquote', 'thematicBreak'].includes(node.type)) {
      structuralBlocks += 1;
    }

    if (node.type === 'list') {
      for (const item of node.children ?? []) {
        for (const child of item.children ?? []) {
          if (child.type === 'paragraph') {
            inspectProseBlock({ node: child, isListItem: true, isTopBanner: false });
          }
        }
      }
    } else if (node.type === 'table') {
      const rows = node.children ?? [];
      const headerCols = rows[0]?.children?.length ?? 0;
      if (headerCols > PROSE_LIMITS.maxTableColumns) {
        diagnostics.push(
          makeDiagnostic(
            'prose/compact-table',
            relPath,
            line,
            `Table has ${headerCols} columns (limit: ${PROSE_LIMITS.maxTableColumns}).`
          )
        );
      }
      let reportedOversizedCell = false;
      for (const row of rows) {
        for (const cell of row.children ?? []) {
          const cellText = visibleText(cell).replace(/\s+/g, ' ').trim();
          if (cellText.length > PROSE_LIMITS.maxTableCellChars) {
            if (!reportedOversizedCell) {
              diagnostics.push(
                makeDiagnostic(
                  'prose/compact-table',
                  relPath,
                  lineOf(cell),
                  `Table cell is ${cellText.length} chars (limit: ${PROSE_LIMITS.maxTableCellChars}).`
                )
              );
              reportedOversizedCell = true;
            }
          }
        }
      }
    }
  }

  // Document-level aggregate checks
  if (h1Count === 0 && lines.length > 5) {
    diagnostics.push(
      makeDiagnostic(
        'internal/single-h1',
        relPath,
        1,
        `Document is missing a top-level "# Title" H1.`
      )
    );
  }

  if (fullShaCount > PROSE_LIMITS.maxFullShasInProse) {
    diagnostics.push(
      makeDiagnostic(
        'internal/no-inline-forensics',
        relPath,
        firstFullShaLine ?? 1,
        `Found ${fullShaCount} full 40-char commit SHAs in narrative prose (limit: ${PROSE_LIMITS.maxFullShasInProse}).`
      )
    );
  }

  if (defensiveOutsideScope > PROSE_LIMITS.maxDefensiveParagraphsOutsideScope) {
    diagnostics.push(
      makeDiagnostic(
        'prose/single-slot-disclaimer',
        relPath,
        firstDefensiveLine ?? 1,
        `Found ${defensiveOutsideScope} paragraphs with defensive disclaimers outside \`## Scope & Limits\` (limit: ${PROSE_LIMITS.maxDefensiveParagraphsOutsideScope}).`
      )
    );
  }

  if (
    totalProseChars >= PROSE_LIMITS.minProseCharsForRhythmCheck &&
    totalBlocks > 0 &&
    structuralBlocks / totalBlocks < PROSE_LIMITS.minStructuralRatio
  ) {
    diagnostics.push(
      makeDiagnostic(
        'prose/structural-rhythm',
        relPath,
        1,
        `Structural elements make up only ${Math.round((100 * structuralBlocks) / totalBlocks)}% of top-level blocks (minimum: ${Math.round(100 * PROSE_LIMITS.minStructuralRatio)}%).`
      )
    );
  }

  if (
    isRecord &&
    totalProseChars >= 1500 &&
    openingDiaryLine !== null &&
    !openingHasConclusionHeading
  ) {
    const sev = recordDate && recordDate >= RECORD_FRONTMATTER_CUTOFF_DATE ? 'error' : 'warning';
    const diag = makeDiagnostic(
      'prose/conclusion-first',
      relPath,
      openingDiaryLine,
      `Record opens with a chronological attempt/run log without an upfront summary, decision, or root-cause section.`,
      sev
    );
    if (sev === 'error') diagnostics.push(diag);
    else warnings.push(diag);
  }

  return { diagnostics, warnings };
}

function summarizeByFileAndRule(diagnostics) {
  const counts = {};
  for (const d of diagnostics) {
    counts[d.file] ??= {};
    counts[d.file][d.rule] = (counts[d.file][d.rule] ?? 0) + 1;
  }
  const sorted = {};
  for (const file of Object.keys(counts).sort()) {
    sorted[file] = {};
    for (const rule of Object.keys(counts[file]).sort()) {
      sorted[file][rule] = counts[file][rule];
    }
  }
  return sorted;
}

export function applyDebtRatchet({ diagnostics, baseline, checkedFiles }) {
  const baselineFiles = baseline?.files ?? {};
  const actualCounts = summarizeByFileAndRule(diagnostics);
  const failures = [];
  const staleEntries = [];
  const checkedSet = new Set(checkedFiles);

  // Check every actual violation against baseline ceiling
  for (const [file, rules] of Object.entries(actualCounts)) {
    const allowedRules = baselineFiles[file] ?? {};
    for (const [rule, count] of Object.entries(rules)) {
      const allowed = allowedRules[rule] ?? 0;
      if (count > allowed) {
        const sample = diagnostics.find((d) => d.file === file && d.rule === rule);
        failures.push({
          ...sample,
          actualCount: count,
          baselineCount: allowed,
          kind: allowed === 0 ? 'new-violation' : 'debt-increase',
        });
      }
    }
  }

  // Reject stale baseline entries (debt ratchet: shrinking debt must update baseline)
  for (const [file, allowedRules] of Object.entries(baselineFiles)) {
    if (!checkedSet.has(file)) continue;
    const actualRules = actualCounts[file] ?? {};
    for (const [rule, allowed] of Object.entries(allowedRules)) {
      const actual = actualRules[rule] ?? 0;
      if (actual < allowed) {
        staleEntries.push({ file, rule, baselineCount: allowed, actualCount: actual });
      }
    }
  }

  return { failures, staleEntries, actualCounts };
}

function listTrackedInternalFiles(root) {
  const out = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', INTERNAL_DOCS_ROOT],
    { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
  );
  return [...new Set(out.split('\0').filter(Boolean))].sort();
}

export async function runInternalDocsCheck({
  root = DEFAULT_ROOT,
  files = null,
  writeBaseline = false,
  baselinePath = DEBT_BASELINE_PATH,
  useBaseline = true,
} = {}) {
  root = path.resolve(root);
  const partialRun = Array.isArray(files);
  const targetFiles = (
    partialRun
      ? files
          .map((f) => toPosix(path.isAbsolute(f) ? path.relative(root, f) : f))
          .filter((f) => f.startsWith(`${INTERNAL_DOCS_ROOT}/`))
      : listTrackedInternalFiles(root)
  ).sort();

  const valeRules = await loadValeRules(root);
  const allDiagnostics = [];
  const allWarnings = [];

  for (const relPath of targetFiles) {
    const absPath = path.join(root, relPath);
    let stat;
    try {
      stat = await fs.stat(absPath);
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
    if (!stat.isFile()) continue;

    if (/\.mdx?$/i.test(relPath)) {
      const text = await fs.readFile(absPath, 'utf8');
      const { diagnostics, warnings } = lintMarkdownDocument({ relPath, text, valeRules });
      allDiagnostics.push(...diagnostics);
      allWarnings.push(...warnings);
    } else {
      allDiagnostics.push(...lintNonMarkdownFile({ relPath, byteSize: stat.size }));
    }
  }

  if (writeBaseline) {
    if (partialRun) {
      throw new Error('--write-baseline cannot be combined with --files');
    }
    const counts = summarizeByFileAndRule(allDiagnostics);
    const payload = {
      schemaVersion: 1,
      description:
        'Frozen legacy internal-docs debt baseline. New files must pass with zero errors; existing files may only reduce debt. Refresh via `pnpm check:internal-docs:baseline` after cleaning debt.',
      totalFilesWithDebt: Object.keys(counts).length,
      totalViolations: allDiagnostics.length,
      files: counts,
    };
    const absBaseline = path.join(root, baselinePath);
    await fs.mkdir(path.dirname(absBaseline), { recursive: true });
    await fs.writeFile(absBaseline, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return {
      ok: true,
      wroteBaseline: baselinePath,
      checkedCount: targetFiles.length,
      diagnostics: allDiagnostics,
      warnings: allWarnings,
      failures: [],
      staleEntries: [],
    };
  }

  let baseline = { files: {} };
  if (useBaseline) {
    try {
      baseline = JSON.parse(await fs.readFile(path.join(root, baselinePath), 'utf8'));
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }

  // On full run, also flag baseline files that no longer exist on disk as stale
  const checkedForStale = partialRun
    ? targetFiles
    : [...new Set([...targetFiles, ...Object.keys(baseline.files ?? {})])];

  const { failures, staleEntries, actualCounts } = applyDebtRatchet({
    diagnostics: allDiagnostics,
    baseline,
    checkedFiles: checkedForStale,
  });

  // In partial (--files) mode, improving a file shouldn't block pre-commit; report stale debt only on full runs.
  const effectiveStale = partialRun ? [] : staleEntries;
  return {
    ok: failures.length === 0 && effectiveStale.length === 0,
    checkedCount: targetFiles.length,
    diagnostics: allDiagnostics,
    warnings: allWarnings,
    failures,
    staleEntries: effectiveStale,
    actualCounts,
  };
}

function formatReport(result, { showWarnings = false } = {}) {
  const lines = [];
  if (result.wroteBaseline) {
    lines.push(
      `[internal-docs] Wrote debt baseline ${result.wroteBaseline}: ${Object.keys(summarizeByFileAndRule(result.diagnostics)).length} files, ${result.diagnostics.length} legacy violations across ${result.checkedCount} checked files.`
    );
    return lines.join('\n');
  }

  if (result.failures.length > 0) {
    lines.push(`[internal-docs] ${result.failures.length} blocking issue(s) found:`);
    for (const f of result.failures) {
      const delta =
        f.baselineCount > 0 ? ` (count ${f.actualCount} > baseline ${f.baselineCount})` : '';
      lines.push(`\n- ${f.file}:${f.line} [${f.rule}]${delta}`);
      lines.push(`  Problem: ${f.message}`);
      if (f.why) lines.push(`  Why: ${f.why}`);
      if (f.fix) lines.push(`  Fix: ${f.fix}`);
    }
  }

  if (result.staleEntries.length > 0) {
    lines.push(
      `\n[internal-docs] ${result.staleEntries.length} stale debt baseline entry(ies) — debt decreased! Run \`corepack pnpm@10.32.1 check:internal-docs:baseline\` to lock in the reduction:`
    );
    for (const s of result.staleEntries.slice(0, 25)) {
      lines.push(`- ${s.file} [${s.rule}]: baseline ${s.baselineCount} -> actual ${s.actualCount}`);
    }
    if (result.staleEntries.length > 25) {
      lines.push(`- ... and ${result.staleEntries.length - 25} more`);
    }
  }

  if (showWarnings && result.warnings.length > 0) {
    lines.push(`\n[internal-docs] ${result.warnings.length} prose/Vale warning(s) (non-blocking):`);
    for (const w of result.warnings.slice(0, 40)) {
      lines.push(`- ${w.file}:${w.line} [${w.rule}] ${w.message}`);
    }
    if (result.warnings.length > 40) {
      lines.push(`- ... and ${result.warnings.length - 40} more warnings`);
    }
  }

  if (result.ok) {
    lines.push(
      `[internal-docs] OK: ${result.checkedCount} files checked; 0 new/increased violations (${result.diagnostics.length} grandfathered legacy debt items, ${result.warnings.length} prose/Vale warnings).`
    );
  }
  return lines.join('\n');
}

function parseCliArgs(argv) {
  const args = {
    files: null,
    writeBaseline: false,
    json: false,
    showWarnings: false,
    noBaseline: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--write-baseline') args.writeBaseline = true;
    else if (token === '--json') args.json = true;
    else if (token === '--warnings') args.showWarnings = true;
    else if (token === '--no-baseline') args.noBaseline = true;
    else if (token === '--files') {
      args.files = [];
      while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        args.files.push(argv[++i]);
      }
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  return args;
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const result = await runInternalDocsCheck({
    files: args.files,
    writeBaseline: args.writeBaseline,
    useBaseline: !args.noBaseline,
  });
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const out = formatReport(result, { showWarnings: args.showWarnings || Boolean(args.files) });
    if (result.ok) console.log(out);
    else console.error(out);
  }
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[internal-docs] ${error.stack ?? error.message}`);
    process.exitCode = 1;
  });
}
