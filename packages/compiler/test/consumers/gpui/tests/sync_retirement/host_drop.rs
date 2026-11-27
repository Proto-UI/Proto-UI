use super::*;
use gpui::AsyncApp;
use std::panic::{catch_unwind, AssertUnwindSafe};

type DropLog = Rc<RefCell<Vec<(&'static str, Result<String, String>)>>>;

struct HostCapture {
    label: &'static str,
    owner: WeakEntity<SyncLeaf>,
    app: AsyncApp,
    log: DropLog,
    paints: Rc<Cell<usize>>,
}

impl HostCapture {
    fn painted(&self) { self.paints.set(self.paints.get() + 1); }
}

impl Drop for HostCapture {
    fn drop(&mut self) {
        // Preserve the SDK's actual read failure at the test boundary. The host
        // destructor itself neither asserts nor requires its entity to survive.
        let read = catch_unwind(AssertUnwindSafe(|| {
            self.owner.read_with(&self.app, |leaf, _| leaf.projection().id().to_owned())
        }));
        let result = match read {
            Ok(result) => result.map_err(|e| e.to_string()),
            Err(panic) => {
                let message = panic.downcast_ref::<String>().map(String::as_str)
                    .or_else(|| panic.downcast_ref::<&str>().copied()).unwrap_or("non-string SDK panic");
                Err(message.to_owned())
            }
        };
        self.log.borrow_mut().push((self.label, result));
    }
}

struct Mounted {
    tree: Entity<SyncTree>,
    a: Entity<SyncBranch>,
    leaf: Entity<SyncLeaf>,
    scope: ContextScope,
    make_scope: Box<dyn Fn(HostCapture) -> ContextScope>,
    window: WindowHandle<Surface>,
    log: DropLog,
}

impl Mounted {
    fn new(cx: &mut TestAppContext) -> Self {
        let branches = Births::<SyncBranch>::record(cx);
        let leaves = Births::<SyncLeaf>::record(cx);
        let tone = cx.new(|_| SYNC_TONE.provider("shared".into()));
        let scope = ContextScope::new(theme).with(SYNC_TONE, tone.clone());
        let tree = cx.update(|app| SyncTree::mount(SyncTreeProps::default(), &scope, app)).unwrap();
        let window = cx.add_window(|_, _| Surface { view: Some(tree.clone().into()), hidden: false });
        painted(window, cx, 2);
        let a = branches.take(cx, |item| item.projection().id() == "A");
        let leaf = leaves.take(cx, |item| item.projection().id() == "A");
        let make_scope = Box::new(move |capture: HostCapture| {
            ContextScope::new(move |token, style| { capture.painted(); theme(token, style); })
                .with(SYNC_TONE, tone.clone())
        });
        Self { tree, a, leaf, scope, make_scope, window, log: Rc::default() }
    }

    fn capture(&self, label: &'static str, cx: &TestAppContext) -> HostCapture {
        HostCapture { label, owner: self.leaf.downgrade(), app: cx.to_async(), log: self.log.clone(), paints: Rc::default() }
    }

    fn expect_drops(&self, names: &[&'static str]) {
        let mut observed = std::mem::take(&mut *self.log.borrow_mut());
        observed.sort_by_key(|(name, _)| *name);
        let mut expected: Vec<_> = names.iter().map(|&name| (name, Ok("A".to_owned()))).collect();
        expected.sort_by_key(|(name, _)| *name);
        assert_eq!(observed, expected, "each host resource must read the retained descendant once at destruction");
    }

    fn bind(&self, cx: &mut TestAppContext) {
        drop(self.capture("outside SDK update", cx));
        self.expect_drops(&["outside SDK update"]);
        let appearance = self.capture("appearance", cx);
        let appearance_paints = appearance.paints.clone();
        self.leaf.update(cx, |leaf, cx| leaf.set_appearance(move |_, _| appearance.painted(), cx));
        let resolver = self.capture("resolver", cx);
        let resolver_paints = resolver.paints.clone();
        let scope = (self.make_scope)(resolver);
        self.a.update(cx, |branch, cx| branch.rebind(&scope, cx)).unwrap();
        drop(scope);
        painted(self.window, cx, 2);
        assert!(appearance_paints.get() > 0 && resolver_paints.get() > 0, "the installed host callbacks must actually paint");
        self.expect_drops(&[]);
    }
}

#[gpui::test]
fn key_removal_releases_host_captures_after_logical_withdrawal(cx: &mut TestAppContext) {
    let ui = Mounted::new(cx);
    ui.bind(cx);
    place(ui.window, cx, None, false);
    painted(ui.window, cx, 0);
    assert_eq!(select(&ui.a, cx, "detached"), ActionOutcome::Committed);
    ui.expect_drops(&[]);
    place(ui.window, cx, Some(ui.tree.clone().into()), false);
    painted(ui.window, cx, 2);

    let queued = ui.capture("queued resolver", cx);
    let queued_paints = queued.paints.clone();
    let queued_scope = (ui.make_scope)(queued);
    cx.update(|app| {
        ui.a.update(app, |branch, cx| {
            assert_eq!(branch.actions(cx).select("published".into()), ActionOutcome::Committed);
            // This rebind queues behind the current publication.
            branch.rebind(&queued_scope, cx).unwrap();
        });
        drop(queued_scope);
        ui.tree.update(app, |tree, cx| tree.set_props(SyncTreeProps { first: "B".into(), second: "C".into() }, cx));
        assert_eq!(ui.a.update(app, |branch, cx| branch.actions(cx).select("stale".into())), ActionOutcome::Disposed);
    });
    painted(ui.window, cx, 2);
    assert_eq!(queued_paints.get(), 0, "an abandoned queued scope reached paint");
    ui.expect_drops(&["appearance", "resolver", "queued resolver"]);

    let late = ui.capture("rejected appearance", cx);
    ui.leaf.update(cx, |leaf, cx| leaf.set_appearance(move |_, _| late.painted(), cx));
    cx.run_until_parked();
    ui.expect_drops(&["rejected appearance"]);
}

#[gpui::test]
fn live_replacement_releases_old_appearance_and_resolver_captures(cx: &mut TestAppContext) {
    let ui = Mounted::new(cx);
    ui.bind(cx);
    let new_paints = Rc::new(Cell::new(0));
    let observed = new_paints.clone();
    ui.leaf.update(cx, |leaf, cx| leaf.set_appearance(move |_, _| observed.set(observed.get() + 1), cx));
    ui.a.update(cx, |branch, cx| branch.rebind(&ui.scope, cx)).unwrap();
    painted(ui.window, cx, 2);
    ui.expect_drops(&["appearance", "resolver"]);
    assert!(new_paints.get() > 0);
    assert_eq!(select(&ui.a, cx, "after replacement"), ActionOutcome::Committed);
    leaf_state(&ui.leaf, cx, "A", "shared", "after replacement");
}

#[gpui::test]
fn independent_leaf_release_drops_host_resources_while_another_owner_is_live(cx: &mut TestAppContext) {
    let ui = Mounted::new(cx);
    drop(ui.capture("outside SDK update", cx));
    ui.expect_drops(&["outside SDK update"]);

    let resolver = ui.capture("standalone resolver", cx);
    let resolver_paints = resolver.paints.clone();
    let choice = cx.new(|_| BRANCH_CHOICE.provider("standalone choice".into()));
    let scope = (ui.make_scope)(resolver).with(BRANCH_CHOICE, choice);
    let leaf = cx.update(|app| SyncLeaf::mount(SyncLeafProps { id: "standalone".into() }, &scope, app)).unwrap();
    let dead = leaf.downgrade();
    let appearance = ui.capture("standalone appearance", cx);
    let appearance_paints = appearance.paints.clone();
    leaf.update(cx, |leaf, cx| leaf.set_appearance(move |_, _| appearance.painted(), cx));
    let window = cx.add_window(|_, _| Surface { view: Some(leaf.clone().into()), hidden: false });
    painted(window, cx, 1);
    assert!(resolver_paints.get() > 0 && appearance_paints.get() > 0);
    drop(scope);
    drop(leaf);
    ui.expect_drops(&[]);

    place(window, cx, None, false);
    painted(window, cx, 0);
    assert!(dead.upgrade().is_none(), "the window released the last standalone leaf handle");
    ui.expect_drops(&["standalone appearance", "standalone resolver"]);
    assert_eq!(select(&ui.a, cx, "after leaf release"), ActionOutcome::Committed);
}

#[gpui::test]
fn host_appearance_on_an_unstyled_reader_releases_after_the_window_drops_it(cx: &mut TestAppContext) {
    use generated_gpui_consumer::context_owner as level;

    let ui = Mounted::new(cx);
    let value = cx.new(|_| level::LEVEL.provider("reader".into()));
    let scope = level::ContextScope::default().with(level::LEVEL, value);
    let reader = cx.update(|app| level::LevelReader::mount(level::LevelReaderProps::default(), &scope, app)).unwrap();
    let weak = reader.downgrade();
    let appearance = ui.capture("host-supplied appearance", cx);
    let paints = appearance.paints.clone();
    reader.update(cx, |reader, cx| reader.set_appearance(move |_, style| {
        appearance.painted();
        style.background = Some(rgb(LEAF_FILL).into());
        style.size.height = Some(px(28.).into());
        style.size.width = Some(px(140.).into());
    }, cx));
    let window = cx.add_window(|_, _| Surface { view: Some(reader.clone().into()), hidden: false });
    painted(window, cx, 1);
    assert!(paints.get() > 0);
    drop(reader);
    ui.expect_drops(&[]);
    place(window, cx, None, false);
    painted(window, cx, 0);
    assert!(weak.upgrade().is_none());
    ui.expect_drops(&["host-supplied appearance"]);
}
