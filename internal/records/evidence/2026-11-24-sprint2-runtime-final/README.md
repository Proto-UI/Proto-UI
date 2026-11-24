# Sprint 2 Runtime / Adapter 原完整分母

本目录保存干净来源 `5cb80eb937f20982dd7dc8cbc93a90e91d665c31` 的 462 份完整测试文件执行，不把后继修复结果写回原记录。

- 唯一已执行文件：462；缺失 0；重复 0。
- 原断言：5,593 通过、11 失败、1 TODO。
- 原文件：452 全通过、9 失败或未完成、1 有未接受的 TODO。
- 第一次运行 exit 130，接受已完成的 208 份；当时正在执行的第 209 份不计完成。
- 续验 exit 1，完成其余 254 份。每份都有原 argv、环境、开始/结束、原 JSON、输出与前后源码身份。
- 同一原作者 adoption TODO 不由 Happy DOM green 冒充真实浏览器执行；后继原生 adoption 另有自己的证据。

`execution.tar.gz`：7,064,463 B，SHA-256 `0a38760cf04e9149d8090735c71124cb5d8a1f5c7be332aca8d80ee3c801ccdb`。归档中的 1,418 个 payload 已逐成员核对大小与 SHA-256，完整原清单见 `raw-manifest.json`。传输记录保持原名字 `raw-evidence.tar.gz`，提交时只将外层文件改名为 `execution.tar.gz`，内部字节未变。

具体后继修复、有效反例、测试夹具前提和独立续验见 [整合回归记录](../../2026-11-24-sprint2-regression-repairs.zh-CN.md)。这份历史全分母没有宣称最终候选全绿；Button ghost 的正常 preset 再生成和最终完整 Compiler / CLI 库存各有自己的后继范围。
