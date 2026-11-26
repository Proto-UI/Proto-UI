// Policy for internal engineering documents (`internal/**`).
// Enforces repository hygiene (no binary archives/logs in main), file budgets,
// and human-readable engineering prose structure via AST checks plus Vale YAML rules.

export const INTERNAL_DOCS_ROOT = 'internal';
export const DEBT_BASELINE_PATH = 'internal/baselines/internal-docs-debt.json';
export const VALE_STYLE_DIR = '.vale/styles/ProtoUI';

// Records dated on or after this cutoff must include minimal YAML frontmatter
// (`kind`, `status`, `date`) so metadata stays out of narrative prose.
export const RECORD_FRONTMATTER_CUTOFF_DATE = '2026-11-27';

export const ALLOWED_RECORD_KINDS = Object.freeze([
  'design',
  'decision',
  'investigation',
  'audit',
  'ops',
  'deep-audit',
  'blueprint',
]);

export const ALLOWED_RECORD_STATUSES = Object.freeze([
  'active',
  'promoted',
  'archived',
  'superseded',
]);

export const FORBIDDEN_EXTENSIONS = Object.freeze([
  '.gz',
  '.tar',
  '.tgz',
  '.zip',
  '.xz',
  '.7z',
  '.bz2',
  '.bundle',
  '.log',
  '.sh',
  '.py',
  '.patch',
]);

export const IMAGE_EXTENSIONS = Object.freeze(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);

// Split archive volumes such as `original-commits.bundle.part-01`.
export const FORBIDDEN_BASENAME_PATTERNS = Object.freeze([/\.part-\d+$/i, /\.bundle(?:\.|$)/i]);

export const SIZE_BUDGETS = Object.freeze({
  // Directory entry READMEs should stay scannable navigation indexes, not PR changelogs.
  readmeMaxBytes: 8 * 1024,
  readmeMaxLines: 160,
  // Ordinary dated engineering records stay crisp and scannable.
  recordMaxBytes: 12 * 1024,
  recordMaxLines: 260,
  // Opt-in deep audits or blueprints (`kind: deep-audit` / `blueprint`).
  deepRecordMaxBytes: 24 * 1024,
  deepRecordMaxLines: 500,
  // Maintained living docs under internal/{governance,compiler,agent-operations,contracts,...}.
  livingDocMaxBytes: 24 * 1024,
  livingDocMaxLines: 450,
  // Structured JSON artifacts under internal/** (larger ones should be slimmed or generated on demand).
  jsonMaxBytes: 512 * 1024,
  // Images retained under internal/** (larger captures belong in PR comments or external storage).
  imageMaxBytes: 100 * 1024,
});

export const PROSE_LIMITS = Object.freeze({
  maxParagraphCharsEn: 450,
  maxParagraphCharsZh: 240,
  maxListItemCharsEn: 360,
  maxListItemCharsZh: 220,
  maxConsecutiveProseParagraphs: 4,
  minConsecutiveProseRunChars: 650,
  minStructuralRatio: 0.35,
  minProseCharsForRhythmCheck: 1200,
  maxTableColumns: 7,
  maxTableCellChars: 240,
  maxInlineCodePerBlock: 8,
  maxDefensiveParagraphsOutsideScope: 1,
  maxFullShasInProse: 2,
});

// Paths intentionally exempt from specific rules (never wildcard-exempt all of internal/records).
export const EXEMPT_FROM_PROSE_CHECKS = Object.freeze([
  // Upstream reference fixtures & frozen snapshots.
  'internal/fixtures/',
  'internal/coverage-matrices/snapshots/',
  // The debt ratchet ledger itself and style guide containing negative examples.
  'internal/governance/prototype-docs-style-guide.md',
  'internal/governance/engineering-writing-guide.md',
]);

export const EXEMPT_FROM_JSON_BUDGET = Object.freeze([
  DEBT_BASELINE_PATH,
  // Historical frozen release source ledger; archive to internal/releases/0.3.0/ upon release.
  'internal/governance/release-0.3-source-ledger.json',
  // Upstream shadcn style source inventory fixture.
  'internal/fixtures/shadcn-style-source/inventory.json',
]);

// Section headings that serve as the single-slot epistemic boundary or receipts section.
export const SCOPE_SECTION_PATTERN =
  /(?:scope|limit|boundar|non-goal|caveat|disclaimer|deferred|not\s+claimed|范围|边界|限制|非目标|未覆盖|当前不应作出的宣称|遗留|已知限制)/i;

export const RECEIPTS_SECTION_PATTERN =
  /(?:receipt|evidence|reference|provenance|verification|appendix|凭据|证据|参考|校验|验证记录|附录)/i;

export const CONCLUSION_FIRST_HEADING_PATTERN =
  /(?:tl;?dr|summary|conclusion|decision|root\s+cause|context|overview|problem|goal|background|defect|purpose|positioning|背景|结论|决策|根因|概述|问题|目标|原则|现状)/i;

export const CHRONOLOGICAL_DIARY_OPENER_PATTERN =
  /\b(?:first\s+attempt|initial\s+dispatch|second\s+attempt|attempt\s+#?\d+|run\s+\d{8,}|on\s+the\s+first\s+try)\b|第一次尝试|首次触发|第一轮重试/i;

export const DEFENSIVE_DISCLAIMER_PATTERNS = Object.freeze([
  /\b(?:does|do|did|will|can|cannot|may|must)\s+not\s+(?:claim|prove|establish|substitute|imply|replace|certify|create|override|grant|convert|turn|erase|mark|close|approve|validate|represent|demonstrate|waive|alter|introduce|activate|authorize|supply|promote|relieve|satisfy|infer)\b/i,
  /\bnot\s+a\s+(?:claim|proof|substitute|receipt|guarantee|approval|acceptance|certification|blanket|replacement|sufficient|waiver|promise|passing|completed)\b/i,
  /\bwithout\s+(?:claiming|implying|proving|establishing|certifying|rewriting|altering|waiving|changing)\b/i,
  /(?:不宣称|不伪报|不混称|不代表[^。！？\n]{0,30}验收|不替代|不构成[^。！？\n]{0,20}(?:验收|证明|承诺|批准)|不证明|不算完成|不作为[^。！？\n]{0,16}(?:验收|通过|证据|证明)|验收缺口)/,
]);

export const STACKED_NEGATIVE_PATTERNS = Object.freeze([
  // e.g. "does not claim A, B, C, or D" / "not A, B, C, or D"
  /\b(?:does|do|did|cannot|will|must)\s+not\s+[^.!?\n]{5,140},\s*[^.!?\n]{3,80},\s*(?:or|nor)\s+/i,
  /\bneither\s+[^.!?\n]{3,80},\s*[^.!?\n]{3,80},\s*nor\s+/i,
  /(?:不|非)[^。！？\n]{1,20}[、,，]\s*(?:不|非)?[^。！？\n]{1,20}[、,，]\s*(?:不|非|也?不|或)[^。！？\n]{1,20}/,
]);

export const LOCAL_PATH_PATTERNS = Object.freeze([
  /(?:^|[\s(`'"])(\/tmp\/[A-Za-z0-9._/-]+)/g,
  /(?:^|[\s(`'"])(\/(?:home|Users|tank)\/[A-Za-z0-9._/-]+)/g,
  /(?:^|[\s(`'"])(\/workspace\/scratch\/[A-Za-z0-9._/-]+)/g,
]);

export const MERGED_TOKEN_PATTERNS = Object.freeze([
  /\b(?:to|by|at|of|from|under|over|prior|real|are|was|were|is|be|than|minimum|maximum|around|about)\d+(?:px|rem|em|ms|%|s)\b/g,
  /\b(?:Existing|existing|authentic|unchanged|yield)\d+\b/g,
  /\bThe\d+\b/g,
  /\bfullCI\b/g,
]);

export const RULE_GUIDANCE = Object.freeze({
  'internal/no-binary-or-archive': {
    why: 'Binary archives, logs, and raw test dumps bloat Git history for every clone.',
    fix: 'Store raw artifacts in GitHub Actions, PR attachments, or the archive branch and link them by URL + SHA-256 instead of committing them under internal/.',
  },
  'internal/size-budget': {
    why: 'Oversized internal files turn navigation guides and records into unreadable patch dumps.',
    fix: 'Distill current state into crisp sections, move historical logs to git history/PR comments, split large guides into focused subpages, or generate large JSONs on demand.',
  },
  'internal/single-h1': {
    why: 'Multiple top-level H1 headings indicate an append-only stitched document rather than one coherent document.',
    fix: 'Keep exactly one `#` H1 title at the top and integrate updates under `##` sections (or archive obsolete proposals separately).',
  },
  'internal/record-frontmatter': {
    why: 'Putting date, status, kind, baseline SHA, and receipts in YAML frontmatter keeps narrative prose clean.',
    fix: 'Add YAML frontmatter with `kind`, `status`, and `date` (plus optional `baseline` and `receipts` list) at line 1.',
  },
  'internal/no-local-paths': {
    why: 'Machine-local paths (`/tmp/...`, `/home/...`, `/Users/...`, `/tank/...`) cannot be verified or opened by teammates.',
    fix: 'Remove ephemeral scratch paths or replace them with repository-relative paths or durable URLs.',
  },
  'internal/no-inline-forensics': {
    why: '64-char SHA-256 digests, long commit-hash lists, Actions job IDs, byte counts, and `socket EPERM` traces obscure the engineering story.',
    fix: 'Move hashes, run/job IDs, and raw execution receipts into frontmatter `receipts:` or a PR comment; cite short SHAs or concise links in prose.',
  },
  'internal/no-merged-tokens': {
    why: 'Missing spaces between words and numbers (e.g. `to2rem`, `Existing2026`) signal unedited mechanical text assembly.',
    fix: 'Restore normal spacing and proofread the sentence as a human reader.',
  },
  'prose/max-paragraph-length': {
    why: 'Unbroken 450+ char wall-of-text paragraphs are hard to scan and hide the main takeaway.',
    fix: 'Break into 1–3 sentence paragraphs (one idea per paragraph), bullet lists, a compact table, or a concrete code/type snippet.',
  },
  'prose/single-slot-disclaimer': {
    why: 'Repeating "does not claim/prove/establish" across multiple body paragraphs buries the engineering point in defensive boilerplate.',
    fix: 'State authority and evidence limits ONCE in frontmatter or a single `## Scope & Limits` section; write body paragraphs positively.',
  },
  'prose/structural-rhythm': {
    why: 'Long runs of unbroken prose without headings, lists, tables, or code lack visual anchors for engineers scanning the doc.',
    fix: 'Add descriptive `##`/`###` claim headings, short bullet takeaways, comparison tables, or concrete code/interface snippets.',
  },
  'prose/compact-table': {
    why: 'Wide tables (>7 columns) or paragraph-length cells (>240 chars) break readability in terminals, diffs, and GitHub.',
    fix: 'Keep tables to concise comparison fields and move detailed explanations into subsections or structured JSON.',
  },
  'prose/no-inline-code-stuffing': {
    why: 'Stuffing dozens of inline file paths or entity IDs into one bullet line creates unreadable 2,000+ char lines.',
    fix: 'Format inventories as a compact table, a fenced list, or a linked JSON manifest.',
  },
  'prose/no-stacked-negatives': {
    why: 'Stacking 3+ negated clauses in one sentence forces readers to decode what something is NOT instead of what it IS.',
    fix: 'State responsibilities positively and list 1–2 concrete boundaries clearly.',
  },
  'prose/conclusion-first': {
    why: 'Opening a record with attempt-by-attempt debugging chronology forces teammates to read to the end to learn the root cause or outcome.',
    fix: 'Start with a short TL;DR / Root Cause / Decision section so a teammate gets the core conclusion in 30 seconds.',
  },
});
