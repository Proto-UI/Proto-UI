# Accordion native evidence：保留首轮失败，隔离执行证据

- PR：[#872](https://github.com/Proto-UI/Proto-UI/pull/872)
- 原始 head：`fc5effc99779aca637acaa06789937cef1414cf1`。
- 实际 CI merge checkout：`b4e678f591ed0459075493a1bcc6db675810ef67`。
- Run：[37530646662](https://github.com/Proto-UI/Proto-UI/actions/runs/37530646662)。
- Job：[112500064505，browser 6/8](https://github.com/Proto-UI/Proto-UI/actions/runs/37530646662/job/112500064505)。
- Artifact：[11444823382](https://github.com/Proto-UI/Proto-UI/actions/runs/37530646662/artifacts/11444823382)，ZIP SHA-256 `f75fde95c44edb6f42d3cc023ab6f96a04d94eb7b55f736ef80a54037ca39678`。

## 实际结果

标准 browser 6/8 在 900 秒超时后以 exit 124 结束。日志先完成其他原生套件，随后停留在 `demo-matrix.browser.test.ts` 的长等待，Accordion 文件尚未执行。十个双语 Accordion 路由预热 HTTP 200 只证明路由可服务，不证明任何 Accordion 行为。

已下载并校验归档。110 个归档文件中没有 Accordion 截图或结果，terminal receipt 为 failure、payload=null；不能把其他组件图、缺失报告或路由预热当作本 family 的通过证据。旧失败完整保留。

## 有限补救

新增 `accordion-family-evidence.yml`，仅把已有 `demo-accordion-family.browser.test.ts` 的 25 条旅程在独立、只读权限的 runner 中直接执行。锁定真实 PR head，保留 Node/Chromium/CJK 字体版本、完整 console 与 Vitest JSON、真实截图和各图 sidecar。整套 25 条必须运行且全部通过；缺失/跳过/失败不通过。

该补充 workflow 不改标准 required CI、不移除原分片文件、不提高原超时、不消除任何历史失败、不修改仓库保护或发布权限。新组件没有历史 UI，截图只做同 source/runtime/viewport/theme 的 family 与状态对照，不伪造“改前图”。

本次尚没有本 family 的 native 结果；后续须在新精确 head 运行、诊断真正失败并逐张审图。Material optical paint、GPUI 以及完整九维验收仍未完成。
