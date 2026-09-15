// Editorial illustrations for whitepaper chapters 3–7, not normative diagrams.
// Run with Node 22: node apps/www/scripts/generate-whitepaper-diagrams.mjs
// Edit this source and regenerate the SVGs; user-authored diagrams are not touched.
import { mkdir, writeFile } from 'node:fs/promises';

const output = new URL('../public/diagrams/', import.meta.url);
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

function anatomy() {
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
  text(390, 252, tr('Root：唯一的 value owner', 'Root: the sole value owner'), 24, 'start');
  text(390, 294, 'Root → Context → Thumb', 25, 'start', 'strong');
  text(390, 338, tr('Thumb：派生展示状态', 'Thumb: derived display state'), 24, 'start');
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
      '可独立配置或订阅 Context 时，|需要重新判断它的组件边界。',
      'Independent configuration or Context|requires a new boundary decision.'
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

function activation() {
  heading(
    '05',
    tr('一次 Switch 激活如何展开', 'How one Switch activation unfolds'),
    tr(
      '非受控、未禁用的情形 · 对应本章伪代码',
      'Uncontrolled and enabled · an illustration of this chapter’s pseudocode'
    )
  );
  box(48, 174, 864, 64, 'User → Event activate → Switch Root', 'blue', 26);
  rect(48, 266, 864, 405, 'scope');
  text(74, 309, 'Switch Root', 26, 'start', 'strong');
  const rows = [
    [336, tr('01  读取 checked，计算 nextChecked', '01  Read checked; compute nextChecked')],
    [418, tr('02  保存新的 State', '02  Store the new State')],
    [500, '03  Expose checkedChange → App Maker'],
    [
      582,
      tr(
        '04  更新 Context；请求 Feedback 重新求值',
        '04  Update Context; request Feedback refresh'
      ),
    ],
  ];
  rows.forEach(([y, label], i) => {
    box(88, y, 784, 58, label, i === 3 ? 'blue' : 'panel', 24);
    if (i < rows.length - 1) path(`M480 ${y + 58} V${y + 82}`);
  });
  path('M480 238 V266');
  path('M480 671 V720');
  text(515, 703, 'Context', 22, 'start', 'muted');
  box(
    48,
    720,
    864,
    108,
    tr(
      '05  Thumb 接收 Context，保存派生展示状态|并请求自己的 Feedback 重新求值',
      '05  Thumb receives Context and stores derived display state|then requests its own Feedback refresh'
    ),
    'green',
    24
  );
  foot(
    877,
    tr(
      'State 不会自动发布这些效果；Root 仍是 checked 的唯一 owner。',
      'State does not publish these effects automatically; Root owns checked.'
    )
  );
  return 920;
}

function consistency() {
  heading(
    '07',
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

function evolution() {
  heading(
    '08',
    tr('实践怎样修正当前近似', 'How practice revises the current approximation'),
    tr(
      '三条主线并行推进，用证据判断应该修改哪一层',
      'Three concurrent lines of work; evidence identifies the layer to revise'
    )
  );
  const xs = [112, 400, 688];
  const labels = [
    tr('理论与内核|提供表达与运行基础', 'Theory and kernel|Define and execute'),
    tr('原型库|探索 Component 身份', 'Prototype libraries|Explore identity'),
    tr('翻译层|面对真实 Host', 'Translation layer|Meet real Hosts'),
  ];
  xs.forEach((x, i) => box(x, 181, 224, 115, labels[i], ['blue', 'green', 'amber'][i], 21));
  path('M336 225 H397');
  path('M400 254 H339');
  path('M624 225 H685');
  path('M688 254 H627');
  xs.forEach((x) => path(`M${x + 112} 296 V337 H512`, false));
  path('M512 337 V376');
  box(
    112,
    376,
    800,
    100,
    tr(
      '实现、符合性测试与真实使用|收集行为结果、失败与反例',
      'Implementations, conformance tests, and real use|Collect outcomes, failures, and counterexamples'
    ),
    'panel',
    24
  );
  path('M512 476 V521');
  box(
    112,
    521,
    800,
    68,
    tr('归因：证据指出哪一层的问题？', 'Classify: which layer does the evidence challenge?'),
    'blue',
    25
  );
  const cards = [
    [112, 631, tr('实现偏差|修正实现', 'Implementation drift|Fix implementation')],
    [528, 631, tr('Host 能力缺口|补足翻译能力', 'Host capability gap|Improve translation')],
    [
      112,
      748,
      tr('义务遗漏或过拟合|修正 Prototype', 'Omission or overfitting|Revise the Prototype'),
    ],
    [528, 748, tr('基础关系出现反例|重审理论', 'Counterexample to relations|Revisit the theory')],
  ];
  path('M512 589 V615');
  rect(100, 615, 824, 238, 'scope');
  // The four panels are alternative diagnoses, not sequential stages.
  cards.forEach(([x, y, label]) => box(x, y, 384, 92, label, 'panel', 23));
  path('M100 734 H72 V164 H800', false);
  xs.forEach((x) => path(`M${x + 112} 164 V178`));
  foot(
    886,
    tr(
      '明确修正并重新检验；实现结果不会自动成为新标准。',
      'Make an explicit revision and test again; behavior does not silently become a rule.'
    )
  );
  return 928;
}

const figures = {
  'component-anatomy': anatomy,
  'switch-activation': activation,
  'conditional-consistency': consistency,
  'evolution-feedback': evolution,
};
await mkdir(output, { recursive: true });
for (const locale of ['zh-cn', 'en']) {
  en = locale === 'en';
  for (const [name, render] of Object.entries(figures)) {
    parts = [];
    const height = render();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="${height}" viewBox="0 0 960 ${height}" role="img" aria-labelledby="title" xml:lang="${locale}">
<!-- Generated by apps/www/scripts/generate-whitepaper-diagrams.mjs. -->
<title id="title">${esc(name.replaceAll('-', ' '))}</title>
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
