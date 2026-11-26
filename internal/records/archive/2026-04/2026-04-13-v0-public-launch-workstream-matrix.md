# 2026-04-13 v0 Public Launch Workstream Matrix

> Internal record. Not normative. This document breaks down the first public release into concrete workstreams, defining priority, minimum launch threshold, and what can safely wait until after launch.

---

## 1) Scope Of This Matrix

This matrix is meant to answer, for each workstream:

- why it matters for v0
- whether it is `P0`, `P1`, or `P2`
- what "enough for first release" means
- what should be deferred on purpose

Priority meanings:

- `P0`: release blocker
- `P1`: important launch hardening
- `P2`: post-launch expansion

---

## 2) Summary Matrix

| Workstream | Priority | Enough For First Release | Safe To Defer |
| --- | --- | --- | --- |
| 最小使用场景闭环 | P0 | One official path from docs to running component | Multiple onboarding paths, richer DX polish |
| 原型库建设 | P1 | Freeze a small official prototype set with tests and docs | Large component expansion |
| 文档建设 | P0 | README + Quick Start + status + contributing + reference entry all aligned | Deep reference completeness |
| 契约编目、契约测试编目 | P1 | One discoverable index from contract to implementation/test | Full catalog polish and exhaustive mapping |
| CLI 开发、测试；npm package 的发布与管理 | P0 for package flow, P1 for CLI | Installable package path and repeatable release flow | Rich CLI ergonomics and wider commands |
| 组织管理、CI/CD 等后勤建设 | P1 | Baseline PR CI, issue intake, release ownership/checklist | Advanced governance and automation |
| 适配器覆盖范围扩充 | P2 | Document the current coverage truthfully | New adapters |
| 网站运营、社交媒体运营 | P2 | Launch page and one release message set | Ongoing content calendar |

---

## 3) Workstream Breakdown

### 3.1 最小使用场景闭环（Quick Start 可跑通）

**Priority:** `P0`

**Why it matters**

This is the single most important external proof. If a newcomer cannot go from docs to a working component, v0 has no trustworthy release story.

**Current repo facts**

- Quick Start already exists in EN/ZH
- but it explicitly says the CLI is not ready and should not be used yet
- homepage demos already show meaningful component behavior across runtimes

**Enough for first release**

- choose one blessed onboarding stack, preferably React
- choose one official example path, preferably `Button` plus one composite/overlay example such as `Dialog`
- ensure the docs path is runnable exactly as written
- ensure one smoke verification flow exists for that path
- remove all "future only / do not run" wording from the shipped Quick Start

**Concrete pre-launch tasks**

- decide whether Quick Start is `manual install` or `CLI init/add`
- create one official minimal sample path
- test the sample path from a clean environment
- align README and docs wording with the chosen path
- make "first 10 minutes" friction a launch criterion

**Safe to defer**

- multiple framework-specific quick starts
- multiple starter templates
- richer scaffolding ergonomics
- auto-migration or upgrade flows

**Recommended rule**

Do not ship a public Quick Start that describes an aspirational flow.

Ship only the path we can actually support.

---

### 3.2 原型库建设

**Priority:** `P1`

**Why it matters**

The release needs a credible prototype surface, but credibility comes from coherence and stability, not raw count.

**Current repo facts**

Current base prototypes already include at least:

- button-related behavior tooling
- dialog
- dropdown
- hover-card
- select
- switch
- tabs
- toggle
- transition

Current shadcn prototypes already include at least:

- button
- dialog
- dropdown
- hover-card
- switch
- tabs
- toggle

These are already enough to support a respectable v0 launch set.

**Enough for first release**

- freeze one explicit official launch set
- every launch-set prototype has passing tests
- every launch-set prototype has docs or demo coverage
- docs clearly distinguish official launch set from later candidates

**Recommended launch-set shape**

- headless/base set: `dialog`, `hover-card`, `select or dropdown`, `switch`, `tabs`, `toggle`, `transition`
- styled/shadcn set: `button`, `dialog`, `hover-card`, `switch`, `tabs`, `toggle`

This is already enough to tell the story.

**Concrete pre-launch tasks**

- mark the launch set explicitly in docs and release notes
- audit each launch-set prototype for naming, README presence, tests, and demo visibility
- remove accidental implication that unsupported components are already part of the public contract

**Safe to defer**

- more design-language libraries
- long-tail components
- aggressive prototype breadth expansion
- perfect parity with external UI libraries

---

### 3.3 文档建设

**Priority:** `P0`

**Why it matters**

Proto UI is still early enough that the release quality depends heavily on how accurately the project explains itself.

**Current repo facts**

The repo already has substantial docs in EN/ZH, including:

- homepage and status pages
- roadmap
- whitepaper and specification content
- build/contribution guides
- prototype library pages

The main docs gap is not absence.

It is alignment.

**Enough for first release**

- README, docs homepage, status page, roadmap, and Quick Start tell one consistent story
- docs explicitly state what v0 is and is not
- contributor entry path is easy to find
- reference entry is discoverable even if incomplete
- docs use actual install/use flow rather than future placeholders

**Concrete pre-launch tasks**

- rewrite Quick Start around the real shipped path
- audit wording consistency across README, status, roadmap, homepage hero, and links
- make package names and supported adapters easy to find
- add one concise "start here if you only want to use it" path
- add one concise "start here if you want to contribute" path

**Safe to defer**

- exhaustive reference coverage
- full bilingual parity in every deeper page
- polished long-form tutorials for every workstream

---

### 3.4 契约编目、契约测试编目

**Priority:** `P1`

**Why it matters**

The project already has many contracts and contract tests. What is missing is a clean map that helps contributors and reviewers answer:

- which contract exists
- where it is implemented
- where it is tested
- what is still debt or uncovered

**Current repo facts**

- `internal/contracts` already contains a large number of v0 documents
- runtime, module, prototype, and adapter tests already exercise many contracts
- there is no obvious single catalog that connects these together for internal planning or contributor onboarding

**Enough for first release**

- one internal index of contract families
- one internal index of key contract-test locations
- one simple convention for adding new contract coverage
- one visible list of known debt / intentionally deferred contract areas

**Concrete pre-launch tasks**

- create a contract catalog page or internal record index
- create a test catalog that maps major contracts to representative tests
- document minimum review rule: new adapter/prototype changes must mention contracts and tests affected

**Safe to defer**

- exhaustive one-to-one mapping for every file
- automated coverage dashboards
- deeper taxonomy cleanup for every contract family

---

### 3.5 CLI 开发、测试；npm package 的发布与管理

**Priority:** `P0` for publish/install flow, `P1` for CLI

**Why it matters**

Users do not adopt the architecture directly. They adopt packages and commands.

So public release needs a real install path, but it does not necessarily need a rich CLI.

**Current repo facts**

- release scripts already exist
- package metadata already exists across core, modules, runtime, prototypes, and adapters
- release scan still reports publish-readiness issues such as `src/*.ts` exports and missing READMEs
- there is currently no visible CLI package in the repo
- current Quick Start depends on an unshipped CLI

**Enough for first release**

- select the public package subset for launch
- make staging/publish succeed for that subset
- resolve README / export / metadata blockers for launch packages
- document the supported install path

For CLI specifically, enough means one of:

1. do not use CLI in Quick Start, or
2. ship a tiny CLI that only covers the official onboarding path

Anything beyond that is optional for v0.

**Concrete pre-launch tasks**

- decide whether CLI is in or out of the launch story
- if out: rewrite Quick Start to manual install and assembly path
- if in: build only `init` + one `add` path and smoke test it
- define launch package subset instead of assuming all internal packages must go public immediately
- run release staging on the chosen subset until clean

**Safe to defer**

- richer CLI subcommands
- broad code generation ergonomics
- package management niceties beyond the official path
- publishing every internal module as a polished standalone surface

**Important release heuristic**

Package reality is mandatory.

CLI polish is optional.

---

### 3.6 组织管理、CI/CD 等后勤建设

**Priority:** `P1`

**Why it matters**

Public release increases the cost of ambiguity. Minimal project operations reduce chaos without requiring heavyweight management.

**Current repo facts**

- contribution guide exists
- issue templates exist
- no visible GitHub workflow files are currently present

**Enough for first release**

- PR CI runs type checks and tests
- docs build is validated somewhere in CI or release checks
- release checklist has a named owner or explicit execution order
- issue intake remains clear for adapters, prototypes, and docs

**Concrete pre-launch tasks**

- add baseline GitHub Actions for test and type check
- add docs build check if lightweight enough
- formalize release checklist into an execution routine
- define basic post-launch triage rhythm

**Safe to defer**

- automated changelog pipelines
- multi-stage release promotion
- advanced contributor governance
- formal maintainer rotation processes

---

### 3.7 适配器覆盖范围扩充

**Priority:** `P2`

**Why it matters**

It matters strategically, but not for the first public proof.

**Current repo facts**

React, Vue, and Web Components already provide meaningful cross-host validation.

That is enough to demonstrate:

- the protocol is not framework-specific
- the adapter boundary is real
- the same prototype can survive multiple host mappings

**Enough for first release**

- keep the current three adapters healthy
- document supported status honestly
- provide one compatibility/coverage view

**Concrete pre-launch tasks**

- no major expansion required
- only fix launch-blocking defects in current adapters
- document current adapter support level and known caveats

**Safe to defer**

- new framework adapters
- non-web adapters
- deeper adapter feature parity work unless needed by launch demos

---

### 3.8 网站运营、社交媒体运营

**Priority:** `P2`

**Why it matters**

For a first release, messaging needs to exist, but a full operation system does not.

**Current repo facts**

- website and docs already exist
- homepage already has demo-driven storytelling
- project links already point to GitHub, Discord, Discussions, and website

**Enough for first release**

- homepage and key docs routes work
- links are correct
- one release announcement set exists
- one short positioning message is consistent across channels

**Concrete pre-launch tasks**

- prepare one launch post/thread
- prepare one release summary page or changelog entry
- audit site entry links and CTAs

**Safe to defer**

- content calendar
- long-running social cadence
- multi-platform growth experiments
- ongoing campaign analytics

---

## 4) Recommended Launch Ordering

### Wave A: unblock reality

- Quick Start path decision
- package subset decision
- publish/stage cleanup for launch packages
- docs rewrite for real onboarding path

### Wave B: make it trustworthy

- freeze launch prototype set
- add contract/test catalog indexes
- add baseline CI
- align README, status, roadmap, and homepage messaging

### Wave C: support the announcement

- launch page audit
- release note / announcement preparation
- contributor intake sanity check

No Wave C work should preempt unfinished Wave A work.

---

## 5) Minimum Deliverables Checklist

The following deliverables should exist before first public release:

- one real Quick Start
- one explicit launch package subset
- one explicit launch prototype subset
- one docs alignment pass across README and docs site
- one internal contract/test catalog index
- one baseline CI workflow
- one release announcement pack

Everything else is allowed to trail.

---

## 6) Follow-up Questions That Still Need A Decision

### 6.1 Is the official launch onboarding path CLI-based or manual-install-based?

This is the most important unresolved scope decision.

### 6.2 What is the exact public package subset for v0?

The release scripts currently see a large package graph, but v0 does not need every internal package to become a polished public promise at once.

### 6.3 Which prototype set is explicitly called "officially supported at launch"?

This should be a named subset, not an inferred one.

### 6.4 What does baseline CI include on every PR?

Recommended minimum:

- type checks
- runtime tests
- optional docs build if runtime is acceptable
