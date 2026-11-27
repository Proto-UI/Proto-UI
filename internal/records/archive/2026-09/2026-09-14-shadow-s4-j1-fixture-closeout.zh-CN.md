# S4 回归收口：J1 Context fixture 映射校准

日期：2026-09-14；non-normative，evidence-only。

S4 扩展检查发现 `packages/spec/fixtures/test/context-fixtures.test.ts` 的 runtime-surface 用例仍失败。进一步 Git 溯源表明，这不是本轮未提交 Context 文件引起的：S3 的 `3e85aa0b` 为 `T-CONTEXT-0002` 加入 REENTRANCY case，并已映射独立 module/framework/browser 实现；原 runtime-surface fixture 继续只声明它自身六个 case。

旧校验把“某一 fixture 的 case 集”错误等同于“整个 T 实体的 case 集”。改为与该 implementation 的 `consumesCases` 精确相等，仍逐项验证 case/criterion 存在、status 与 path。新增负向断言确保删掉自己的 case 或吞入其它 implementation 的 case 仍失败。全 T 的覆盖完整性继续由 `catalog-evidence-integrity` 检查，不增加空 fixture，不改 Context 运行时或已批准语义。

此项属于 S1–S3 回归收口；保留工作区其它 Context/governance 变更。

验证：原 Context fixture 2 项中 1 项失败；修复后 `packages/spec/fixtures/test` 与 catalog evidence integrity 共 17 文件、54 项全部通过，workspace types 与 diff 检查通过。缺少自身 case/错误增加他处 case 的负向断言也通过。
