# npm bootstrap `latest` 规则协调

## Context

`0.3.0-alpha.0` 的新公开 package identity 需要先发布一个明确不属于正式 release 的 bootstrap 版本，才能为该 package 绑定 npm Trusted Publisher。`V-PROTO-UI-0009-NEW-PACKAGE` 与 release workflow 投射原先要求 bootstrap 不占用 `latest` 或 `next`。

## Observed facts

- npm 首次发布 scoped bootstrap package 时，即使使用 `--tag bootstrap`，registry 仍会创建 `latest`。
- 当该 package 只有这一个版本时，移除 `latest` 返回 npm registry `400 Bad Request`。
- 已验证的 bootstrap package 可以移除 `bootstrap` tag，保留 deprecated 的唯一 bootstrap 版本，并且不占用 `next`。
- `pnpm release:registry:check` 只证明公开 identity 可读取；Trusted Publisher 仍须以 `npm trust list <package>` 核对，正式 OIDC publication 仍须由受保护 GitHub workflow 实证。

## Decision

将 bootstrap 的禁止条件收窄为：不得占用 `next` 或保留 `bootstrap` tag。若 npm 拒绝删除唯一、明确不属于正式发行且已 deprecated 的 bootstrap 版本上的 `latest`，允许该 `latest` 暂留。

此例外不允许发布虚假的 stable 或 release-train 版本来覆盖 `latest`，不改变 prerelease 发布到 `next` 的规则，也不提前激活 V 实体或绕过受保护的 `release-packages.yml`。

## Rationale

该限制来自 npm registry 对唯一已发布版本的行为，而不是 Proto UI 希望把 bootstrap 暴露为默认安装目标。deprecation、移除 `bootstrap` tag、禁止 `next`，以及正式发布仍需通过受保护 workflow，共同保留了对误安装与越权直接发布的防护。

## Follow-up

- 在每次真实发布后审计该 package 的 dist-tag、integrity、Git tag、GitHub prerelease 与 spec snapshot evidence。
- 若 npm 后续允许移除唯一 bootstrap 版本的 `latest`，可在保持同一保护边界的前提下清理该 tag，并重新评估此例外是否仍有必要。
