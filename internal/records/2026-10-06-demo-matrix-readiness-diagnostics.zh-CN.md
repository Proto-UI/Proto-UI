# Demo Matrix：只读的失败前阶段诊断

## 来源与有限目标

- 基线：`fc5effc99779aca637acaa06789937cef1414cf1`。
- 原失败：CI [37530646662](https://github.com/Proto-UI/Proto-UI/actions/runs/37530646662)，browser 6/8 job [112500064505](https://github.com/Proto-UI/Proto-UI/actions/runs/37530646662/job/112500064505)，900秒 SIGTERM / exit124。
- 原日志只到 Demo Matrix 套件开始与多次 route reload；没有逐case timeout stack。该信息缺口不能靠猜测具体 locator 或根因填补。

本批只给现有四个 matrix cases 增加诊断；不修改产品、等待条件、断言、availability 或超时，也不把该套件的失败视为可忽略。Accordion 25条独立 evidence workflow 的启动与本诊断互不依赖。

## 诊断内容

1. 在导航前注册 pageerror，立即输出精确 source SHA、case、阶段及错误；保留最多100个 bounded error记录。
2. 分开标记 `route-open`、`inited-count`、`committed-host-readiness`，每阶段在 page evaluation 之前先输出日志与持久 JSON header，再记录通过或原始失败。
3. 只读 DOM facts 包括 demo/previewer/inited/expected/unavailable计数，未初始化与未ready的 demo ID、adapter label、previewer ID、projection状态、active generation数、渲染出的Preview Error。此collector不参与任何就绪或成功判断。
4. JSON写在现有runtime evidence目录的 `demo-matrix/readiness/`。页面线程阻塞时，附加snapshot最多等待1000ms并明确记录unavailable；该上限只约束诊断，不改变原两个60秒等待、四个180秒case或900秒runner。
5. 退出时追加最后可观察的facts；观察失败不替代原始产品错误。原`openRoute`的networkidle导航与首个previewer可见边界保持一致。

## 已验证与未验证

- DOM observer tests：8/8通过，包括原6条与新增2条诊断一致性/只读回归。
- AST对照基线：全部原expect输入、waitForFunction predicate与options、case timeout均一致；既有observation源码完整保留。
- Astro check：519files，0errors/0warnings，6既有hints。
- Prettier及git diff检查通过。
- 新head的真实matrix执行与具体失败诊断尚未得到；本补丁不宣称修复了底层matrix故障。
