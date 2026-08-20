# Expose Event npm identity bootstrap 与 Trusted Publisher 准备记录

## 结论

`@proto.ui/module-expose-event` 已于 2026-08-16 建立公开 npm package identity，并完成面向受保护发布 workflow 的 Trusted Publisher 配置。此次动作没有发布 `0.3.0-alpha.0`，没有创建 Git tag 或 GitHub Release，也没有占用 npm `next` channel。

## Identity bootstrap

- bootstrap version：`0.0.0-bootstrap.0`
- registry publish time：`2026-08-16T08:17:43.526Z`
- tarball content：仅 `package.json` 与 `README.md`，不含 Proto UI runtime code
- unpacked size：545 bytes
- shasum：`b838c480bc68e50f889348f45429c6eb48b9a5b1`
- integrity：`sha512-D1GApLnQK/Ioq/Rvw3NrWGVi/beIxEivEfbFqey4/AuHl2CVkj6lFIMMOUK82hzn/vdTvNxRJLQwrrguSNcktA==`
- deprecation：`Registry identity bootstrap only; contains no runtime code. Use a published Proto UI release version.`

bootstrap 使用维护者 `gl2018` 的 npm web authentication 完成直接创建。发布前 dry-run 确认 tarball 只包含两个占位文件；发布后 `pnpm release:registry:check` 已从 1 个缺失 identity 收敛为 41 个公开 identity 全部就绪。

## Trusted Publisher

新 package 通过 npm 12 CLI 建立以下 package-scoped binding：

- provider：GitHub Actions
- repository：`Proto-UI/Proto-UI`
- workflow：`release-packages.yml`
- environment：`npm`
- allowed action：`npm publish` only

`npm trust list @proto.ui/module-expose-event` 已返回上述精确配置。仓库 workflow 已具备 GitHub-hosted runner、`id-token: write`、Node 22、npm >= 11.5.1、无 `NODE_AUTH_TOKEN`/`NPM_TOKEN` 以及 `npm` environment 保护。该配置核对证明 publisher identity 已就绪；端到端 OIDC publish 仍只能由后续真实、已评审的全局 release workflow 证明，本记录不把配置存在误写为已经发布 release package。

## Dist-tag 现状

首次 scoped package publish 即使显式使用 `--tag bootstrap`，registry 仍同时创建了 `bootstrap` 与 `latest`。`bootstrap` tag 已成功移除；精确移除唯一版本上的 `latest` 经 web authentication 后仍返回 npm registry `400 Bad Request`。因此当前仅剩：

- `latest -> 0.0.0-bootstrap.0`
- 不存在 `bootstrap`
- 不存在 `next`

占位版本已经 deprecated，以降低裸安装误用风险。不得为了覆盖 `latest` 发布虚假的 stable 或 release-train version；后续应继续向 npm 核对唯一 bootstrap identity 的 `latest` 清理能力，并在真实版本发布证据中重新审计 dist-tag 状态。

## 发布边界

本次完成的是 package identity 与认证准备，不是 `0.3.0-alpha.0` publication。后续真实发布仍必须从合入后的 `main` 运行受保护的 `release-packages.yml`，使用 `workspace` profile 完成 41 包全局精确版本发布，并在发布后独立核对 registry integrity、dist-tag、Git tag、GitHub prerelease 与 spec snapshot evidence。
