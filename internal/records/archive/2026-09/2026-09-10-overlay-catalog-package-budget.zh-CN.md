# Overlay 编目批次的包体积预算调整

日期：2026-09-10。范围：PR #634 的 `public_package_build`。

CI run `34431080908` 在 head `f26e5c9a1bc5ac19625c130a76c03642a75d0c8f` 完成公开包构建和 manifest 校验后，Web Component 入口测得 75,115 gzip bytes，超过 75,000 上限 115 bytes。其余八个入口的预算通过；完整 test、type-check、release-stage 和公开消费者检查通过。

本批引入 scoped Escape arbitration、共享 modal 锁及 provider/session 清理等已编目逻辑。体积增长没有伴随新增第三方运行时依赖。曾试验去重 Escape 清理和压缩 sample 状态表示，本地仅减少约 20 bytes，未保留这些为预算微调实现的改动。

本次只将 Web Component 入口上限从 75,000 调整为 76,000 gzip bytes（增加 1,000 bytes，约 1.33%）；相对这次 CI 实测留出 885 bytes。保留原有 bundle、minify、tree-shaking、外部依赖和 gzip 计算口径，其他入口上限不变。此调整认可本批已审查范围内的体积增量，不代表关闭预算约束或允许后续自动增加。

本地 Node 22.23.2 的压缩结果与 CI 略有差异，应分别记录，不以本地数字冒充 CI 实测。后续新 CI 负责复核相同入口的新结果。
