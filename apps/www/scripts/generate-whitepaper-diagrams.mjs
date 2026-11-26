// Editorial illustrations for whitepaper chapters 3–7, not normative diagrams.
// Run with Node 24: node apps/www/scripts/generate-whitepaper-diagrams.mjs
// Edit this source and regenerate the SVGs; user-authored diagrams are not touched.
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const output = new URL('../public/diagrams/', import.meta.url);
const handFonts = JSON.parse(
  await readFile(new URL('./whitepaper-diagram-fonts.json', import.meta.url), 'utf8')
).fonts;
const esc = (s) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
let parts = [];
let en = false;
const tr = (zh, english) => (en ? english : zh);
const text = (x, y, value, size = 24, anchor = 'middle', cls = '') => {
  const lines = value.split('|');
  parts.push(
    `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" class="${cls}">${lines.map((l, i) => `<tspan x="${x}" dy="${i ? size * 1.4 : 0}">${esc(l)}</tspan>`).join('')}</text>`
  );
};
const rect = (x, y, w, h, cls = 'panel', r = 14) =>
  parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" class="${cls}"/>`);
const path = (d, arrow = true, cls = '') =>
  parts.push(`<path d="${d}" class="line ${cls}"${arrow ? ' marker-end="url(#arrow)"' : ''}/>`);
const box = (x, y, w, h, label, cls = 'panel', size = 24) => {
  rect(x, y, w, h, cls);
  const count = label.split('|').length;
  text(x + w / 2, y + h / 2 + size * 0.35 - (count - 1) * size * 0.7, label, size);
};
const heading = (number, title, sub) => {
  text(48, 48, number, 20, 'start', 'muted');
  text(48, 94, title, 32, 'start', 'strong');
  text(48, 132, sub, 22, 'start', 'muted');
};
const foot = (y, value) => text(48, y, value, 21, 'start', 'muted');

function anatomyDescription() {
  parts.push(
    `<desc id="description">${esc(
      tr(
        'Switch Root 是 checked 值与 activation 的唯一 owner。Thumb 通过同域 Context 获取 checked 和 disabled，只派生展示状态，不成为第二个开关控件。Select Root 拥有 open 与选中值，Trigger、Value、Content 和 Item 各自承担独立关系。固定 Caret 只有 Feedback 时可以附属于 Trigger；一旦拥有独立 Event、Props、Expose 或 Context，就需要独立 Component 边界。Caret 是边界判断的设计案例，不是新增的 Base Select part；图中位置不规定实际 Host tree。',
        'Switch Root alone owns checked and activation. Thumb receives checked and disabled through same-domain Context and derives display state without becoming a second switch control. Select Root owns open and selection; Trigger, Value, Content and Item have independent relations. A fixed, Feedback-only Caret may remain inside Trigger; its own Event, Props, Expose or Context requires a separate Component boundary. Caret is a boundary-design example, not a new Base Select part. Placement does not prescribe a Host tree.'
      )
    )}</desc>`
  );
}

function anatomy() {
  anatomyDescription();
  heading(
    '03',
    tr('看得见的结构，不等于组件边界', 'Visible structure and component boundaries'),
    tr(
      'Switch 与 Select：用责任解释拆分',
      'Switch and Select: explain each boundary through responsibility'
    )
  );
  rect(48, 170, 864, 240);
  text(74, 211, 'Switch', 28, 'start', 'strong');
  rect(90, 248, 238, 94, 'blue', 47);
  parts.push('<circle cx="276" cy="295" r="35" class="green"/>');
  text(145, 304, 'Root', 25);
  text(278, 383, 'Thumb', 23);
  path('M278 359 V335', false);
  text(390, 241, tr('Root：checked 的唯一 owner', 'Root: sole owner of checked'), 24, 'start');
  text(390, 274, tr('由 Root 处理 activation', 'Root handles activation'), 22, 'start');
  text(390, 314, 'Root → Context → Thumb', 25, 'start', 'strong');
  text(390, 352, tr('Thumb：派生展示状态', 'Thumb: derived display state'), 24, 'start');
  text(
    390,
    374,
    tr('两个 Component，一个 Switch', 'Two Components, one Switch'),
    23,
    'start',
    'muted'
  );

  rect(48, 434, 864, 398);
  text(74, 477, tr('Select：结构示意', 'Select: structural illustration'), 28, 'start', 'strong');
  rect(80, 503, 294, 288, 'scope');
  text(96, 535, tr('Root 范围', 'Root scope'), 22, 'start', 'muted');
  rect(98, 553, 258, 64, 'blue');
  text(122, 593, 'Value', 24, 'start');
  path('M311 578 L324 591 L337 578', false);
  path('M344 584 H387 V649 H402', false);
  text(220, 642, 'Trigger', 22, 'middle', 'muted');
  rect(98, 663, 258, 108, 'green');
  text(122, 693, 'Content', 22, 'start', 'muted');
  box(113, 708, 228, 45, 'Item', 'panel', 23);
  text(
    413,
    549,
    tr('Trigger / Value / Content / Item', 'Trigger / Value / Content / Item'),
    23,
    'start',
    'strong'
  );
  text(413, 589, tr('各自承担独立交互关系', 'Each has independent relations'), 24, 'start');
  text(
    413,
    656,
    tr('固定 Caret：只有 Feedback', 'Fixed Caret: Feedback only'),
    24,
    'start',
    'strong'
  );
  text(413, 695, tr('可以附属于 Trigger', 'May remain inside Trigger'), 24, 'start');
  text(
    413,
    754,
    tr(
      '独立的 Event / Props / Expose|或 Context：需要独立 Component。',
      'Own Event / Props / Expose|or Context: a separate Component.'
    ),
    21,
    'start',
    'muted'
  );
  foot(
    877,
    tr(
      'Caret 是设计对照案例；结构示意不规定实际 Host tree。',
      'Caret is a design example; this does not prescribe a Host tree.'
    )
  );
  return 920;
}

function activationPrelude() {
  // One main sequence belongs to Root. Horizontal arrows cross owner boundaries;
  // their position is not a promise of synchronous Context callback delivery.
  parts.push(
    `<desc id="description">${esc(
      tr(
        '非受控、未禁用的 Switch：User 通过 Event 激活 Root；Root 读取 checked、计算并保存新值，再通过 Expose 通知 App Maker，并显式更新 Context 与请求自己的 Feedback 重新求值。Thumb 接收 Context，保存派生展示状态，并请求自己的 Feedback 重新求值。Root 始终是 checked 的唯一 owner；跨组件箭头不规定 callback 的同步时序。',
        'An uncontrolled, enabled Switch: User activates Root through Event. Root reads checked, computes and stores the new value, emits checkedChange to App Maker through Expose, and explicitly updates Context and requests its own Feedback refresh. Thumb receives Context, stores derived display state, and requests its own Feedback refresh. Root remains the sole checked owner. Cross-component arrows do not prescribe synchronous callback timing.'
      )
    )}</desc>`
  );
  parts.push(`<style>
${handFonts
  .filter((font) => !en || font.family.endsWith('Latin'))
  .map(
    (font) =>
      `@font-face{font-family:"${font.family}";src:url(data:font/woff2;base64,${font.woff2}) format("woff2");unicode-range:${font.unicodeRange};font-weight:400;font-style:normal;}`
  )
  .join('\n')}
text{font-family:"Proto Diagram Hand Latin","Proto Diagram Hand CJK",sans-serif;font-weight:400}.strong{font-weight:400}.hand-stroke{fill:none;stroke:var(--ink);stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.hand-echo{opacity:.45;stroke-width:1}.hand-muted{stroke:var(--muted)}
</style><defs><marker id="hand-arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" orient="auto-start-reverse"><path d="M2 1 Q6 4 10 6 Q6 7 1 11" fill="none" stroke="var(--ink)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>`);
}

function activation() {
  activationPrelude();
  const pen = (d, cls = '') => parts.push(`<path d="${d}" class="hand-stroke ${cls}"/>`);
  const arrow = (id, d) =>
    parts.push(
      `<path data-edge="${id}" d="${d}" class="hand-stroke" marker-end="url(#hand-arrow)"/>`
    );
  const index = (n, x, y) => {
    pen(
      `M${x - 13} ${y - 6} C${x - 10} ${y - 20} ${x + 13} ${y - 18} ${x + 14} ${y - 3} C${x + 17} ${y + 14} ${x - 11} ${y + 18} ${x - 14} ${y + 3} Q${x - 16} ${y - 2} ${x - 13} ${y - 6}`
    );
    text(x, y + 6, String(n), 21);
  };
  text(48, 66, tr('一次 Switch 激活', 'One Switch activation'), 32, 'start', 'strong');
  text(
    48,
    103,
    tr(
      '非受控、未禁用 · 本章伪代码的执行关系',
      'Uncontrolled and enabled · relations in this chapter’s pseudocode'
    ),
    21,
    'start',
    'muted'
  );

  text(314, 166, 'User', 26, 'middle', 'strong');
  arrow('event-to-root', 'M314 181 C311 199 317 218 314 235');
  text(334, 211, 'Event · activate', 21, 'start', 'muted');

  parts.push('<g data-owner="root">');
  pen(
    'M55 238 C207 234 410 240 573 236 Q581 237 579 248 C583 393 576 535 580 679 Q581 689 569 687 C405 692 231 684 56 689 Q47 688 49 677 C46 529 51 385 47 247 Q46 236 55 238'
  );
  pen(
    'M52 240 C211 237 411 241 572 239 M577 248 C580 404 575 548 578 680 M568 690 C404 693 225 687 57 691 M46 677 C44 532 49 384 46 249',
    'hand-echo'
  );
  text(76, 280, 'Switch Root', 28, 'start', 'strong');
  text(76, 311, tr('checked 的唯一 owner', 'The sole owner of checked'), 20, 'start', 'muted');
  const step = (n, y, label, detail) => {
    index(n, 92, y - 8);
    text(126, y, label, 24, 'start', 'strong');
    if (detail) text(126, y + 31, detail, 21, 'start', 'muted');
  };
  step(1, 365, tr('读取 checked', 'Read checked'), 'nextChecked = !checked');
  step(2, 455, tr('保存 State', 'Store State'), 'checked ← nextChecked');
  step(3, 545, tr('发出 checkedChange', 'Emit checkedChange'));
  step(
    4,
    635,
    tr('更新 Context', 'Update Context'),
    tr('请求 Root 的 Feedback 重新求值', 'Request Root’s Feedback refresh')
  );
  [391, 481, 571].forEach((y, i) =>
    arrow(`root-step-${i + 1}-to-${i + 2}`, `M92 ${y} C90 ${y + 10} 95 ${y + 24} 92 ${y + 35}`)
  );
  parts.push('</g>');

  arrow('expose-to-maker', 'M580 536 C631 532 693 539 747 536');
  text(662, 519, 'Expose', 21, 'middle', 'muted');
  text(774, 543, 'App Maker', 24, 'start', 'strong');

  arrow('context-to-thumb', 'M580 626 C622 623 663 629 708 626');
  text(644, 609, 'Context', 21, 'middle', 'muted');
  text(738, 613, 'Switch Thumb', 25, 'start', 'strong');
  pen('M724 631 Q723 635 724 637 M724 675 C724 706 727 750 724 797 Q812 801 936 797', 'hand-muted');
  index(5, 724, 656);
  text(751, 656, tr('接收 Context', 'Receive Context'), 21, 'start');
  text(751, 687, tr('保存派生展示状态', 'Store derived state'), 21, 'start');
  text(751, 714, 'checked / disabled', 20, 'start', 'muted');
  text(751, 749, tr('请求自己的', 'Request its own'), 21, 'start');
  text(751, 777, tr('Feedback 重新求值', 'Feedback refresh'), 21, 'start');

  foot(
    838,
    tr(
      'State 只保存事实；对外效果由 Root 与 Thumb 分别显式发起。',
      'State stores facts. Root and Thumb request their effects explicitly.'
    )
  );
  foot(
    872,
    tr(
      '跨组件箭头表示信息通路，不规定 callback 的同步时序。',
      'Cross-component arrows show channels, not synchronous callback timing.'
    )
  );
  return 920;
}

function consistencyDescription() {
  parts.push(
    `<desc id="description">${esc(
      tr(
        'Prototype 与适用 profile 的必要义务构成共同底线：身份、信息通路、State transition、Lifecycle order 与必需 Feedback。共享且受控的输入媒介、viewport、单位与字体允许更细地比较输入行为与 Feedback。同属 Web family，且适用 profile 共享受治理的结构、事件、样式基础与 projection policy 时，可以在排除必要且已声明的 wrapper 与标记后比较 normalized DOM。进一步控制 device metrics、单位比例、字体 shaping、色彩与 rasterization 等条件时，可以比较像素表现。tolerance 与 exclusion 必须事先约定理由与范围。这些是条件到比较对象的映射，不是自动晋级的等级，也不代表已经具备完整的跨 Host 证据。',
        'Prototype and applicable profile obligations form the shared baseline: identity, information channels, State transitions, Lifecycle order, and required Feedback. Shared, controlled input medium, viewport, units, and fonts permit finer comparison of input behavior and Feedback. The same Web family and applicable profiles sharing governed structure, events, style foundations, and projection policy permit comparison of normalized DOM after necessary declared wrappers and markers are excluded. Further control of device metrics, unit scale, font shaping, color, and rasterization permits pixel comparison. Agree the reasons and scope of tolerances and exclusions in advance. These are condition-to-comparison mappings, not automatic tiers, and do not imply complete evidence across Hosts.'
      )
    )}</desc>`
  );
}

function consistency() {
  consistencyDescription();
  heading(
    '06',
    tr('共同条件决定比较精度', 'Shared conditions determine comparison detail'),
    tr(
      '先明确必要义务，再明确两个 realization context',
      'Establish obligations, then define the two realization contexts'
    )
  );
  box(
    48,
    176,
    864,
    100,
    tr(
      '共同底线：Prototype 与适用 profile 的必要义务|身份 · 通路 · 状态转换 · 生命周期秩序 · 必需 Feedback',
      'Shared baseline: obligations of the Prototype and applicable profile|Identity · channels · state transitions · lifecycle order · required Feedback'
    ),
    'blue',
    en ? 22 : 24
  );
  text(72, 329, tr('共享且受控的条件', 'Shared, controlled conditions'), 25, 'start', 'strong');
  text(625, 329, tr('可进一步比较', 'Finer comparison'), 25, 'start', 'strong');
  const rows = [
    [
      355,
      tr(
        '相同输入媒介、viewport、单位、字体等',
        'Same input medium, viewport,|units, fonts, and related conditions'
      ),
      tr('输入行为与 Feedback', 'Input behavior|and Feedback'),
    ],
    [
      491,
      tr(
        '同属 Web family，并共享受治理的|结构、事件、样式基础与 projection policy',
        'Same Web family, with governed|structure, events, styles, and projection policy'
      ),
      'Normalized DOM',
    ],
    [
      627,
      tr(
        '进一步控制 device metrics、字体 shaping、|色彩与 rasterization 等像素相关条件',
        'Also control device metrics, font shaping,|color, rasterization, and related conditions'
      ),
      tr('像素表现', 'Pixel output'),
    ],
  ];
  rows.forEach(([y, left, right]) => {
    rect(48, y, 864, 112);
    text(72, y + (left.includes('|') ? 45 : 64), left, en ? 22 : 23, 'start');
    path(`M562 ${y + 56} H600`);
    text(748, y + (right.includes('|') ? 44 : 65), right, 24);
  });
  foot(
    786,
    tr(
      'tolerance / exclusion 需预先约定；这些条件不是自动晋级的等级。',
      'Agree tolerance / exclusion in advance; these are conditions, not automatic tiers.'
    )
  );
  foot(
    821,
    tr(
      '本图表达比较原则，不代表已有完整的跨 Host 证据。',
      'Comparison principles do not imply complete evidence across Hosts.'
    )
  );
  return 862;
}

function evolutionDescription() {
  parts.push(
    `<desc id="description">${esc(
      tr(
        '理论与内核、原型库和翻译层并行推进。实现、符合性测试与真实使用提供归因证据：实现偏差需要修正实现；Host 能力缺口需要补足翻译能力；必要语义遗漏或定义对某类 Host 过拟合需要修正 Prototype；基础关系出现反例需要重新检查理论。这些是不同的归因方向，不是依次完成的阶段。明确修正对应层并重新检验；实现结果不会静默成为新标准。',
        'Theory and kernel, prototype libraries, and the translation layer advance concurrently. Implementations, conformance tests, and real use provide evidence for diagnosis: implementation drift calls for an implementation fix; a Host capability gap calls for improved translation; omitted necessary semantics or a definition overfitted to a class of Host calls for a Prototype revision; a counterexample to fundamental relations calls for reexamining the theory. These are alternative diagnoses, not sequential stages. Revise the relevant layer explicitly and test again; implementation behavior does not silently become a rule.'
      )
    )}</desc>`
  );
}

function evolutionStyles() {
  parts.push(`<defs>
  <style>
    .evo-root {
      --evo-bg: #fafaf9;
      --evo-surface: #ffffff;
      --evo-surface-subtle: #f4f4f5;
      --evo-border: #d4d4d8;
      --evo-border-strong: #a1a1aa;
      --evo-ink: #18181b;
      --evo-muted: #52525b;
      --evo-faint: #71717a;
      --evo-line: #71717a;
      --evo-blue: #2563eb;
      --evo-blue-soft: #eff6ff;
      --evo-green: #059669;
      --evo-green-soft: #ecfdf5;
      --evo-amber: #d97706;
      --evo-amber-soft: #fffbeb;
      --evo-slate: #475569;
      --evo-slate-soft: #f1f5f9;
    }
    @media (prefers-color-scheme: dark) {
      .evo-root {
        --evo-bg: #111113;
        --evo-surface: #18181b;
        --evo-surface-subtle: #202024;
        --evo-border: #2e2e33;
        --evo-border-strong: #52525b;
        --evo-ink: #f4f4f5;
        --evo-muted: #a1a1aa;
        --evo-faint: #71717a;
        --evo-line: #71717a;
        --evo-blue: #60a5fa;
        --evo-blue-soft: #172554;
        --evo-green: #34d399;
        --evo-green-soft: #064e3b;
        --evo-amber: #fbbf24;
        --evo-amber-soft: #451a03;
        --evo-slate: #94a3b8;
        --evo-slate-soft: #1e293b;
      }
    }
    .evo-root text {
      font-family: -apple-system, BlinkMacSystemFont, "Inter", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      fill: var(--evo-ink);
    }
    .evo-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
      letter-spacing: 0.06em;
    }
    .evo-title { font-weight: 650; letter-spacing: -0.02em; fill: var(--evo-ink); }
    .evo-sub { font-weight: 450; fill: var(--evo-muted); }
    .evo-kicker { font-weight: 600; fill: var(--evo-faint); }
    .evo-card { fill: var(--evo-surface); stroke: var(--evo-border); stroke-width: 1.25; }
    .evo-zone { fill: var(--evo-surface-subtle); stroke: var(--evo-border); stroke-width: 1; }
    .evo-pill { fill: var(--evo-surface); stroke: var(--evo-border); stroke-width: 1; }
    .evo-wire { fill: none; stroke: var(--evo-line); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
    .evo-wire-dash { fill: none; stroke: var(--evo-border-strong); stroke-width: 1.5; stroke-dasharray: 5 4; stroke-linecap: round; stroke-linejoin: round; }
  </style>
  <filter id="evo-shadow" x="-6%" y="-10%" width="112%" height="126%">
    <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.06"/>
  </filter>
  <marker id="evo-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M1.5 1.5 L8.5 5 L1.5 8.5 Z" fill="var(--evo-line)"/>
  </marker>
  <marker id="evo-arrow-sm" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M1.5 2 L8.5 5 L1.5 8 Z" fill="var(--evo-line)"/>
  </marker>
</defs>`);
}

function evolutionEdge(relation, from, to, d, arrow = true) {
  parts.push(
    `<path data-relation="${relation}" data-from="${from}" data-to="${to}" d="${d}" class="evo-wire"${arrow ? ' marker-end="url(#evo-arrow-sm)"' : ''}/>`
  );
}

function evolutionCard(kind, id, x, y, width, height, accent) {
  parts.push(`<g data-${kind}="${id}">`);
  parts.push(
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" class="evo-card" filter="url(#evo-shadow)"/>`
  );
  parts.push(
    `<rect x="${x}" y="${y}" width="${width}" height="4" rx="2" fill="var(--evo-${accent})" stroke="none"/>`
  );
}

function evolutionDiagnoses() {
  return [
    [
      'implementation',
      'slate',
      tr('实现偏差', 'Implementation drift'),
      tr('修正实现', 'Fix implementation'),
    ],
    [
      'host-capability',
      'amber',
      tr('Host 能力缺口', 'Host capability gap'),
      tr('补足翻译能力', 'Improve translation'),
    ],
    [
      'prototype',
      'green',
      tr('义务遗漏或过拟合', 'Omission or overfitting'),
      tr('修正 Prototype', 'Revise the Prototype'),
    ],
    [
      'theory',
      'blue',
      tr('基础关系出现反例', 'Relation challenged'),
      tr('重审理论', 'Revisit the theory'),
    ],
  ];
}

function evolution() {
  evolutionDescription();
  parts.push('<g class="evo-root">');
  // Markers inherit the same theme variables as the paths that reference them.
  evolutionStyles();
  parts.push('<rect width="960" height="928" rx="16" fill="var(--evo-bg)" stroke="none"/>');
  text(
    48,
    64,
    tr('实践、证据与明确修正', 'Practice, evidence, and explicit revision'),
    40,
    'start',
    'evo-title'
  );
  text(48, 118, tr('三条主线并行推进', 'Three concurrent lines of work'), 36, 'start', 'evo-sub');

  const lanes = [
    ['theory-kernel', 96, 'blue', tr('理论与|内核', 'Theory &|kernel')],
    ['prototype-libraries', 384, 'green', tr('原型库', 'Prototype|libraries')],
    ['translation-layer', 672, 'amber', tr('翻译层', 'Translation|layer')],
  ];
  for (const [id, x, accent, label] of lanes) {
    evolutionCard('node', id, x, 166, 248, 126, accent);
    text(x + 124, 241.6 - (label.split('|').length - 1) * 25.2, label, 36, 'middle', 'evo-title');
    parts.push('</g>');
  }
  for (let index = 0; index < 2; index++) {
    const [left, x] = lanes[index];
    const [right, next] = lanes[index + 1];
    evolutionEdge('work-exchange', left, right, `M${x + 252} 210 H${next - 4}`);
    evolutionEdge('work-exchange', right, left, `M${next - 4} 252 H${x + 252}`);
  }
  for (const [id, x] of lanes) {
    evolutionEdge(
      'practice-input',
      id,
      'practice-evidence',
      `M${x + 124} 292 V316 Q${x + 124} 328 508 328`,
      false
    );
  }
  evolutionEdge('evidence-entry', 'work', 'practice-evidence', 'M508 328 V348');
  evolutionCard('node', 'practice-evidence', 96, 352, 824, 124, 'slate');
  text(508, 400, tr('实践提供证据', 'Practice provides evidence'), 36, 'middle', 'evo-title');
  text(
    508,
    454,
    tr('行为结果、失败与反例', 'Outcomes, failures, counterexamples'),
    36,
    'middle',
    'evo-sub'
  );
  parts.push('</g>');
  evolutionEdge('diagnose', 'practice-evidence', 'diagnoses', 'M508 476 V492');
  parts.push('<g data-alternatives="diagnoses">');
  parts.push('<rect x="80" y="496" width="856" height="376" rx="16" class="evo-zone"/>');
  text(
    96,
    548,
    tr('归因：哪一层需要修正？', 'Which layer needs revision?'),
    36,
    'start',
    'evo-title'
  );
  evolutionDiagnoses().forEach(([id, accent, condition, action], index) => {
    const x = 96 + (index % 2) * 424;
    const y = 578 + Math.floor(index / 2) * 152;
    evolutionCard('diagnosis', id, x, y, 400, 128, accent);
    text(x + 200, y + 48, condition, 36, 'middle', 'evo-title');
    text(x + 200, y + 102, action, 36, 'middle', 'evo-sub');
    parts.push('</g>');
  });
  parts.push('</g>');
  evolutionEdge(
    'revision-loop',
    'diagnoses',
    'work',
    'M80 684 H58 Q44 684 44 670 V146 Q44 136 58 136 H796',
    false
  );
  for (const [id, x] of lanes) {
    evolutionEdge('revision-return', 'diagnoses', id, `M${x + 124} 136 V162`);
  }
  text(
    48,
    908,
    tr('明确修正，再次检验。', 'Revise explicitly, then test again.'),
    36,
    'start',
    'evo-sub'
  );
  parts.push('</g>');
  return 928;
}

function evolutionMobile() {
  evolutionDescription();
  parts.push('<g class="evo-root">');
  // Markers inherit the same theme variables as the paths that reference them.
  evolutionStyles();
  parts.push('<rect width="500" height="1000" rx="14" fill="var(--evo-bg)" stroke="none"/>');
  text(32, 40, tr('从实践到明确修正', 'Practice to explicit revision'), 28, 'start', 'evo-title');
  text(32, 80, tr('三条主线并行推进', 'Three concurrent lines of work'), 26, 'start', 'evo-sub');

  const lanes = [
    ['theory-kernel', 32, 140, 'blue', tr('理论|与内核', 'Theory &|kernel')],
    ['prototype-libraries', 188, 140, 'green', tr('原型库', 'Prototype|libraries')],
    ['translation-layer', 342, 144, 'amber', tr('翻译层', 'Translation|layer')],
  ];
  for (const [id, x, width, accent, label] of lanes) {
    evolutionCard('node', id, x, 108, width, 116, accent);
    text(
      x + width / 2,
      175.1 - (label.split('|').length - 1) * 18.2,
      label,
      26,
      'middle',
      'evo-title'
    );
    parts.push('</g>');
  }
  for (let index = 0; index < 2; index++) {
    const [left, x, width] = lanes[index];
    const [right, next] = lanes[index + 1];
    evolutionEdge('work-exchange', left, right, `M${x + width} 152 H${next - 2}`);
    evolutionEdge('work-exchange', right, left, `M${next} 181 H${x + width + 2}`);
  }
  for (const [id, x, width] of lanes) {
    evolutionEdge(
      'practice-input',
      id,
      'practice-evidence',
      `M${x + width / 2} 224 V246 H258`,
      false
    );
  }
  evolutionEdge('evidence-entry', 'work', 'practice-evidence', 'M258 246 V267');
  evolutionCard('node', 'practice-evidence', 32, 270, 452, 120, 'slate');
  text(258, 306, tr('实践提供证据', 'Practice provides evidence'), 26, 'middle', 'evo-title');
  text(
    258,
    en ? 341 : 347,
    tr('行为结果、失败与反例', 'Outcomes, failures,|counterexamples'),
    26,
    'middle',
    'evo-sub'
  );
  parts.push('</g>');
  evolutionEdge('diagnose', 'practice-evidence', 'diagnoses', 'M258 390 V402');
  text(32, 427, tr('哪一层需要修正？', 'Which layer needs revision?'), 26, 'start', 'evo-title');
  text(
    32,
    461,
    tr('不同归因，并非先后阶段', 'Alternative diagnoses, not stages'),
    26,
    'start',
    'evo-sub'
  );

  parts.push('<g data-alternatives="diagnoses">');
  parts.push('<rect x="32" y="478" width="452" height="416" rx="14" class="evo-zone"/>');
  evolutionDiagnoses().forEach(([id, accent, condition, action], index) => {
    const y = 488 + index * 100;
    evolutionCard('diagnosis', id, 44, y, 428, 92, accent);
    text(258, y + 36, condition, 26, 'middle', 'evo-title');
    text(258, y + 76, action, 26, 'middle', 'evo-sub');
    parts.push('</g>');
  });
  parts.push('</g>');
  evolutionEdge(
    'revision-loop',
    'diagnoses',
    'work',
    'M32 686 H22 Q12 686 12 676 V104 Q12 94 22 94 H414',
    false
  );
  for (const [id, x, width] of lanes) {
    evolutionEdge('revision-return', 'diagnoses', id, `M${x + width / 2} 94 V105`);
  }
  text(32, 930, tr('明确修正，再次检验。', 'Revise, then test again.'), 26, 'start', 'evo-sub');
  text(32, 966, tr('实现结果不静默成为标准。', 'No silent rule changes.'), 26, 'start', 'evo-sub');
  parts.push('</g>');
  return 1000;
}

function anatomyMobile() {
  anatomyDescription();
  text(
    32,
    44,
    tr('看得见的结构，|不等于组件边界', 'Visible structure and|component boundaries'),
    28,
    'start',
    'strong'
  );
  text(32, 132, tr('用责任解释拆分', 'Boundaries follow responsibility'), 26, 'start', 'muted');

  parts.push('<g data-comparison="switch" data-node="switch">');
  rect(24, 170, 452, 544);
  text(48, 214, 'Switch', 30, 'start', 'strong');
  rect(48, 242, 404, 94, 'blue', 47);
  parts.push('<g data-part="switch-root">');
  text(138, 299, 'Root', 28);
  parts.push('</g><g data-part="switch-thumb">');
  parts.push('<circle cx="398" cy="289" r="32" class="green"/>');
  text(398, 382, 'Thumb', 26);
  path('M398 354 V326', false);
  parts.push('</g>');
  text(
    48,
    425,
    tr('Root：checked 的唯一 owner', 'Root: sole owner of checked'),
    26,
    'start',
    'strong'
  );
  text(48, 466, tr('由 Root 处理 activation', 'Root handles activation'), 26, 'start');
  parts.push('<g data-relation="context" data-from="switch-root" data-to="switch-thumb">');
  text(90, 534, 'Root', 26);
  text(251, 513, 'Context', 26);
  path('M132 528 H349');
  text(397, 534, 'Thumb', 26);
  parts.push('</g>');
  text(48, 598, tr('Thumb：派生展示状态', 'Thumb: derived display state'), 26, 'start');
  text(48, 638, 'checked / disabled', 26, 'start', 'muted');
  text(
    48,
    682,
    tr('两个 Component，一个 Switch', 'Two Components, one Switch'),
    26,
    'start',
    'muted'
  );
  parts.push('</g>');

  parts.push('<g data-comparison="select">');
  text(32, 782, tr('Select：结构示意', 'Select: structural illustration'), 28, 'start', 'strong');
  parts.push('<g data-part="select-root" data-node="select-root">');
  rect(44, 816, 412, 320, 'scope');
  text(64, 858, tr('Root：open 与选中值', 'Root: open and selection'), 26, 'start', 'muted');
  parts.push('<g data-part="trigger">');
  rect(62, 890, 376, 70, 'blue');
  text(80, 1000, 'Trigger', 26, 'start', 'muted');
  parts.push('<g data-part="value">');
  text(86, 935, 'Value', 28, 'start');
  parts.push('</g><g data-example="fixed-caret">');
  path('M379 916 L393 930 L407 916', false);
  parts.push('</g></g>');
  parts.push('<g data-part="content">');
  rect(62, 1020, 376, 96, 'green');
  text(80, 1055, 'Content', 26, 'start', 'muted');
  parts.push('<g data-part="item">');
  box(216, 1037, 204, 62, 'Item', 'panel', 26);
  parts.push('</g></g></g>');
  text(32, 1200, 'Trigger / Value / Content / Item', 26, 'start', 'strong');
  text(32, 1240, tr('各自承担独立交互关系', 'Each has independent relations'), 26, 'start');
  parts.push('<g data-boundary-rule="caret">');
  text(
    32,
    1310,
    tr('固定 Caret：只有 Feedback', 'Fixed Caret: Feedback only'),
    26,
    'start',
    'strong'
  );
  text(32, 1352, tr('可以附属于 Trigger', 'May remain inside Trigger'), 26, 'start');
  text(
    32,
    1414,
    tr(
      '独立的 Event / Props / Expose|或 Context：|需要独立 Component。',
      'Own Event / Props / Expose|or Context: a separate|Component.'
    ),
    26,
    'start',
    'muted'
  );
  parts.push('</g></g>');
  text(
    32,
    1558,
    tr(
      'Caret 是设计对照案例，|不是新增的 Base Select part；|结构示意不规定实际 Host tree。',
      'Caret is a design example,|not a new Base Select part.|This does not prescribe|a Host tree.'
    ),
    26,
    'start',
    'muted'
  );
  return 1740;
}

function activationMobile() {
  activationPrelude();
  const pen = (d, cls = '') => parts.push('<path d="' + d + '" class="hand-stroke ' + cls + '"/>');
  const arrow = (id, d) =>
    parts.push(
      '<path data-edge="' +
        id +
        '" d="' +
        d +
        '" class="hand-stroke" marker-end="url(#hand-arrow)"/>'
    );
  const index = (n, x, y) => {
    pen(
      'M' +
        (x - 18) +
        ' ' +
        (y - 8) +
        ' C' +
        (x - 14) +
        ' ' +
        (y - 25) +
        ' ' +
        (x + 17) +
        ' ' +
        (y - 23) +
        ' ' +
        (x + 19) +
        ' ' +
        (y - 4) +
        ' C' +
        (x + 22) +
        ' ' +
        (y + 17) +
        ' ' +
        (x - 15) +
        ' ' +
        (y + 23) +
        ' ' +
        (x - 19) +
        ' ' +
        (y + 4) +
        ' Q' +
        (x - 22) +
        ' ' +
        (y - 3) +
        ' ' +
        (x - 18) +
        ' ' +
        (y - 8)
    );
    text(x, y + 8, String(n), 26);
  };
  text(32, 48, tr('一次 Switch 激活', 'One Switch activation'), 32, 'start', 'strong');
  text(
    32,
    96,
    tr('非受控、未禁用|本章伪代码的执行关系', 'Uncontrolled and enabled|This chapter’s pseudocode'),
    26,
    'start',
    'muted'
  );
  text(150, 198, 'User', 28, 'middle', 'strong');
  arrow('event-to-root', 'M150 215 C147 225 153 240 150 251');
  text(182, 235, 'Event · activate', 26, 'start', 'muted');

  parts.push('<g data-owner="root">');
  pen(
    'M47 260 C171 256 317 263 452 258 Q463 258 461 270 C465 455 458 664 462 856 Q463 870 450 868 C319 872 182 865 49 870 Q38 870 40 856 C37 661 43 457 39 273 Q38 260 47 260'
  );
  pen(
    'M44 263 C178 260 322 265 452 261 M459 273 C462 455 456 660 459 857 M449 872 C316 875 181 868 49 873 M37 855 C35 663 41 457 36 274',
    'hand-echo'
  );
  text(66, 310, 'Switch Root', 30, 'start', 'strong');
  text(66, 352, tr('checked 的唯一 owner', 'The sole owner of checked'), 26, 'start', 'muted');
  const step = (n, y, label, detail) => {
    index(n, 76, y - 9);
    text(114, y, label, 28, 'start', 'strong');
    if (detail) text(114, y + 42, detail, 26, 'start', 'muted');
  };
  step(1, 418, tr('读取 checked', 'Read checked'), 'nextChecked = !checked');
  step(2, 536, tr('保存 State', 'Store State'), 'checked ← nextChecked');
  step(3, 654, tr('发出 checkedChange', 'Emit checkedChange'));
  step(
    4,
    772,
    tr('更新 Context', 'Update Context'),
    tr('请求 Root 的|Feedback 重新求值', 'Request Root’s|Feedback refresh')
  );
  [476, 594, 682].forEach((y, i) =>
    arrow(
      'root-step-' + (i + 1) + '-to-' + (i + 2),
      'M76 ' + y + ' C73 ' + (y + 10) + ' 79 ' + (y + 22) + ' 76 ' + (y + 36)
    )
  );
  parts.push('</g>');

  // Each route leaves Root and terminates at its own recipient; there is no
  // Maker-to-Thumb edge and no cross-owner timing promise.
  arrow('expose-to-maker', 'M40 650 C27 651 17 648 17 666 L17 910 Q17 924 34 924 H144 V952');
  text(78, 907, 'Expose', 26, 'start', 'muted');
  parts.push('<g data-owner="maker">');
  text(144, 994, 'App Maker', 28, 'middle', 'strong');
  parts.push('</g>');
  arrow(
    'context-to-thumb',
    'M462 766 C476 764 484 772 484 786 V1030 Q484 1047 467 1047 H250 V1080'
  );
  text(360, 1029, 'Context', 26, 'middle', 'muted');
  parts.push('<g data-owner="thumb">');
  text(66, 1128, 'Switch Thumb', 30, 'start', 'strong');
  pen(
    'M42 1147 Q40 1153 42 1160 M42 1207 C41 1260 45 1323 42 1370 Q222 1375 460 1370',
    'hand-muted'
  );
  index(5, 76, 1190);
  text(114, 1198, tr('接收 Context', 'Receive Context'), 26, 'start');
  text(114, 1240, tr('保存派生展示状态', 'Store derived state'), 26, 'start');
  text(114, 1282, 'checked / disabled', 26, 'start', 'muted');
  text(114, 1324, tr('请求自己的', 'Request its own'), 26, 'start');
  text(114, 1360, tr('Feedback 重新求值', 'Feedback refresh'), 26, 'start');
  parts.push('</g>');
  text(
    32,
    1450,
    tr(
      'State 只保存事实；|对外效果由 Root 与 Thumb|分别显式发起。',
      'State stores facts.|Root and Thumb request|their effects explicitly.'
    ),
    26,
    'start',
    'muted'
  );
  text(
    32,
    1594,
    tr(
      '跨组件箭头表示信息通路，|不规定 callback 的同步时序。',
      'Cross-component arrows show|channels, not synchronous|callback timing.'
    ),
    26,
    'start',
    'muted'
  );
  return 1740;
}

function consistencyMobile() {
  consistencyDescription();
  text(
    32,
    44,
    tr('共同条件决定|比较精度', 'Shared conditions determine|comparison detail'),
    28,
    'start',
    'strong'
  );
  text(
    32,
    136,
    tr(
      '先明确必要义务，|再明确两个 realization context',
      'Establish obligations, then|define both realization contexts'
    ),
    26,
    'start',
    'muted'
  );
  parts.push('<g data-comparison-baseline="obligations" data-node="obligations">');
  rect(24, 236, 452, 252, 'blue');
  text(48, 280, tr('共同底线：必要义务', 'Shared baseline: obligations'), 28, 'start', 'strong');
  text(48, 324, 'Prototype / applicable profile', 26, 'start');
  text(
    48,
    370,
    tr(
      '身份 · 通路 · State transition|Lifecycle order · 必需 Feedback',
      'Identity · channels|State transitions · lifecycle order|required Feedback'
    ),
    26,
    'start'
  );
  parts.push('</g>');

  // Three independent condition-to-comparison mappings, never a promotion ladder.
  const rows = [
    [
      'input-feedback',
      544,
      312,
      tr(
        '相同输入媒介、viewport、|单位、字体等受控条件',
        'Same input medium, viewport,|units, fonts,|and related conditions'
      ),
      tr('输入行为与 Feedback', 'Input behavior and Feedback'),
    ],
    [
      'normalized-dom',
      902,
      312,
      tr(
        '同属 Web family；共享受治理的|结构、事件、样式基础|与 projection policy',
        'Same Web family; governed|structure, events, styles,|and projection policy'
      ),
      'Normalized DOM',
    ],
    [
      'pixels',
      1260,
      354,
      tr(
        '进一步控制 device metrics、|单位比例、字体 shaping、|色彩与 rasterization 等条件',
        'Also control device metrics,|unit scale, font shaping,|color, rasterization|and related conditions'
      ),
      tr('像素表现', 'Pixel output'),
    ],
  ];
  rows.forEach(([id, y, h, conditions, result]) => {
    parts.push('<g data-comparison="' + id + '" data-node="' + id + '">');
    rect(24, y, 452, h);
    text(
      48,
      y + 42,
      tr('共享且受控的条件', 'Shared, controlled conditions'),
      26,
      'start',
      'strong'
    );
    text(48, y + 90, conditions, 26, 'start');
    parts.push(
      '<g data-relation="permits-comparison" data-from="' +
        id +
        '-conditions" data-to="' +
        id +
        '-result">'
    );
    path('M250 ' + (y + h - 104) + ' V' + (y + h - 68));
    parts.push('</g>');
    text(250, y + h - 30, result, 26);
    parts.push('</g>');
  });
  text(
    32,
    1678,
    tr(
      'tolerance / exclusion 的理由与范围|需预先约定。',
      'Agree tolerance / exclusion|reasons and scope in advance.'
    ),
    26,
    'start',
    'muted'
  );
  text(
    32,
    1786,
    tr(
      '这些条件不是自动晋级的等级。|本图不代表已有完整跨 Host 证据。',
      'These are conditions, not tiers.|They do not imply complete|evidence across Hosts.'
    ),
    26,
    'start',
    'muted'
  );
  return 1920;
}

const figures = {
  'component-anatomy': anatomy,
  'component-anatomy.mobile': anatomyMobile,
  'switch-activation': activation,
  'switch-activation.mobile': activationMobile,
  'conditional-consistency': consistency,
  'conditional-consistency.mobile': consistencyMobile,
  'evolution-feedback': evolution,
  'evolution-feedback.mobile': evolutionMobile,
};
await mkdir(output, { recursive: true });
for (const locale of ['zh-cn', 'en']) {
  en = locale === 'en';
  for (const [name, render] of Object.entries(figures)) {
    parts = [];
    const height = render();
    const mobile = name.endsWith('.mobile');
    const baseName = mobile ? name.slice(0, -'.mobile'.length) : name;
    const width = mobile ? 500 : 960;
    const isEvolution = baseName === 'evolution-feedback';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title"${baseName === 'switch-activation' || isEvolution || mobile ? ' aria-describedby="description"' : ''} xml:lang="${locale}"${mobile ? ' data-layout="mobile"' : ''}>
<!-- Generated by apps/www/scripts/generate-whitepaper-diagrams.mjs. -->
<title id="title">${esc(baseName === 'switch-activation' ? tr('一次 Switch 激活', 'One Switch activation') : isEvolution ? tr('实践怎样修正当前近似', 'How practice revises the current approximation') : baseName.replaceAll('-', ' '))}</title>
<defs><style>
  :root { --ink:#24313d; --muted:#596875; --line:#94a3ae; --panel:#f7f9fb; --blue:#eaf2fc; --green:#eaf5ee; --amber:#fbf2e2; }
  @media(prefers-color-scheme:dark) { :root { --ink:#e1e8ed; --muted:#a6b5c0; --line:#667986; --panel:#161c22; --blue:#192d43; --green:#1a3028; --amber:#362d1c; } }
  text { fill:var(--ink); font-family:Arial,"PingFang SC","Microsoft YaHei",sans-serif; }
  .muted { fill:var(--muted); } .strong { font-weight:600; }
  rect,circle { stroke:var(--line); stroke-width:1.5; }
  .panel { fill:var(--panel); } .blue { fill:var(--blue); } .green { fill:var(--green); } .amber { fill:var(--amber); }
  .scope { fill:none; stroke-dasharray:6 6; }
  .line { fill:none; stroke:var(--muted); stroke-width:2; stroke-linejoin:round; }
</style><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M1 1 L9 5 L1 9" fill="none" stroke="var(--muted)" stroke-width="1.5"/></marker></defs>
${parts.join('\n')}
</svg>\n`;
    await writeFile(new URL(`whitepaper-${name}.${locale}.svg`, output), svg);
  }
}
console.log(`Generated ${Object.keys(figures).length * 2} localized whitepaper SVGs.`);
