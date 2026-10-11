# Vue2 正式 Previewer 的首次材质 provider 连接

基线由已冻结 `/tmp/finf-material-v3-base.patch` 重放到 c316，patch SHA256 `347b0df948697315f5dda37f1b976623faf17b60b3fa63fa9e22309fe631b672`。修改前 demo-renderer SHA256 `36a4c35b199406510192a854047523b06552578db9bbd569f607afbfa0ddaf26`；provider SHA256 `ce36d095523815111e0687198986756c2732da602b114fe26efb037917da8fc6`。

正式 `renderDemoVue2` 先对脱离祖先树的 Root 调 `$mount()`，然后才 append `$el`。真实 Vue2 descendant mounted hook 在 `$mount` 内提交 Feedback；此时 `findPreviewMaterialProvider` 找不到注册的祖先。deferred sink 按契约缓存 null 为本 view 的 ordinary 路径，之后再连接不会重新分配。

使用正式 renderer、已安装真实 Vue2、实际 Adapter 和 Liquid Glass Button、真实 WeakMap provider 注册复现 5/5 红，均分配 0 sink。最小修复先把 Vue2 将替换的 mountPoint 连到当前 host，再 `$mount(mountPoint)`。最终 authored root 替换该点，不增加永久包裹；不改 sink null 缓存、不加轮询或重试。

新增用例覆盖直接 Button root、box 下两 Button、卸载后移动同 host 到新 provider 重挂、旧 destroy 不伤新view、作者 setup 抛错释放已分配sink、provider同步替换host lease不重新append退役root。sink记录器仅证明分配/commit/release；不画假玻璃，也不证明浏览器/GPU/光学质量。

修复后首次 frame 的 slot declaration 已到达 provider；最终 committed frame 含实际候选。初轮测试曾不正确要求最早 declaration frame 就有候选，2 条因此失败，日志保留；当前要求最终候选同时保持首次 provider 分配检查。

最终 5 files / 39 tests 通过，包含真实四Adapter renderer输入/可选props、延迟导入与host lease。包边界/import未扩展。联合类型/正式native材质证据由下一精确集成头执行；本地没有尝试受限 Chromium。
