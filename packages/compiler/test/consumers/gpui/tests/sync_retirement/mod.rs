use generated_gpui_consumer::sync_tree::{
    ContextScope, MissingContext, SyncBranch, SyncLeaf, SyncLeafProps, SyncTree, SyncTreeProps, BRANCH_CHOICE, SYNC_TONE,
};
use gpui::{div, prelude::*, px, rgb, AnyView, Entity, Hsla, StyleRefinement, Subscription, TestAppContext, WeakEntity, Window, WindowHandle};
use proto_ui_gpui_support::{context::{NominalKey, Provider}, ActionOutcome};
use std::{cell::{Cell, RefCell}, rc::Rc};

const LEAF_FILL: u32 = 0x394f6a;

fn theme(token: &str, style: &mut StyleRefinement) {
    assert_eq!(token, "sync-leaf");
    style.background = Some(rgb(LEAF_FILL).into());
    style.size.width = Some(px(140.).into());
    style.size.height = Some(px(28.).into());
}

struct Surface { view: Option<AnyView>, hidden: bool }

impl Render for Surface {
    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
        let root = div().size_full();
        let root = if self.hidden { root.hidden() } else { root };
        root.children(self.view.clone())
    }
}

fn place(window: WindowHandle<Surface>, cx: &mut TestAppContext, view: Option<AnyView>, hidden: bool) {
    window.update(cx, |surface, _, cx| { surface.view = view; surface.hidden = hidden; cx.notify(); }).unwrap();
}

fn painted(window: WindowHandle<Surface>, cx: &mut TestAppContext, expected: usize) {
    cx.run_until_parked();
    window.update(cx, |_, window, _| {
        let color = Hsla::from(rgb(LEAF_FILL));
        let quads = window.painted_quads();
        let count = quads.iter().filter(|q| q.background.as_solid() == Some(color)).count();
        assert_eq!(count, expected, "unexpected number of visible generated leaves");
    }).unwrap();
}

struct Births<T: 'static> { items: Rc<RefCell<Vec<Entity<T>>>>, _watch: Subscription }

impl<T: 'static> Births<T> {
    fn record(cx: &TestAppContext) -> Self {
        let items = Rc::new(RefCell::new(Vec::new()));
        let seen = Rc::clone(&items);
        let watch = cx.update(|app| app.observe_new::<T>(move |_, _, cx| seen.borrow_mut().push(cx.entity())));
        Self { items, _watch: watch }
    }

    fn take(&self, cx: &TestAppContext, matches: impl Fn(&T) -> bool) -> Entity<T> {
        let mut items = self.items.borrow_mut();
        let index = items.iter().position(|item| item.read_with(cx, |item, _| matches(item))).expect("unobserved generated entity");
        items.remove(index)
    }

    fn empty(&self) { assert!(self.items.borrow().is_empty(), "unexpected generated entity"); }
}

fn channels<K: NominalKey>(_: K, cx: &TestAppContext) -> (Rc<RefCell<Vec<WeakEntity<Provider<K>>>>>, Subscription) {
    let channels = Rc::new(RefCell::new(Vec::new()));
    let observed = Rc::clone(&channels);
    let watch = cx.update(|app| app.observe_new::<Provider<K>>(move |_, _, cx| observed.borrow_mut().push(cx.weak_entity())));
    (channels, watch)
}

struct Notices { count: Rc<Cell<usize>>, _watch: Subscription }

impl Notices {
    fn for_entity<T: 'static>(item: &Entity<T>, cx: &TestAppContext) -> Self {
        let count = Rc::new(Cell::new(0));
        let observed = Rc::clone(&count);
        let watch = cx.update(|app| app.observe(item, move |_, _| observed.set(observed.get() + 1)));
        Self { count, _watch: watch }
    }

    fn take(&self) -> usize { self.count.replace(0) }
}

fn select(item: &Entity<SyncBranch>, cx: &mut TestAppContext, value: &str) -> ActionOutcome {
    item.update(cx, |branch, cx| branch.actions(cx).select(value.into()))
}

fn keys(tree: &Entity<SyncTree>, cx: &mut TestAppContext, first: &str, second: &str) {
    tree.update(cx, |tree, cx| tree.set_props(SyncTreeProps { first: first.into(), second: second.into() }, cx));
}

fn leaf_state(leaf: &Entity<SyncLeaf>, cx: &TestAppContext, id: &str, tone: &str, choice: &str) {
    leaf.read_with(cx, |leaf, _| {
        let view = leaf.projection();
        assert_eq!((view.id(), view.tone(), view.choice()), (id, tone, choice));
    });
}

#[gpui::test]
fn removing_a_synchronous_keyed_branch_retires_actions_and_descendant_observers(cx: &mut TestAppContext) {
    let branches = Births::<SyncBranch>::record(cx);
    let leaves = Births::<SyncLeaf>::record(cx);
    let (owned_channels, _channel_watch) = channels(BRANCH_CHOICE, cx);
    let shared = cx.new(|_| SYNC_TONE.provider("shared".into()));
    let scope = ContextScope::new(theme).with(SYNC_TONE, shared.clone());
    let tree = cx.update(|app| SyncTree::mount(SyncTreeProps::default(), &scope, app)).unwrap();
    let window = cx.add_window(|_, _| Surface { view: Some(tree.clone().into()), hidden: false });
    painted(window, cx, 2);
    let a = branches.take(cx, |item| item.projection().id() == "A");
    let b = branches.take(cx, |item| item.projection().id() == "B");
    let a_leaf = leaves.take(cx, |item| item.projection().id() == "A");
    let b_leaf = leaves.take(cx, |item| item.projection().id() == "B");
    let initial_channels = owned_channels.borrow().clone();
    assert_eq!(initial_channels.len(), 2);
    keys(&tree, cx, "B", "A");
    painted(window, cx, 2);
    branches.empty();
    leaves.empty();

    // Give only A and its descendant this provider and host binding. Retain the
    // entities independently of their physical placement and native paint.
    let former = cx.new(|_| SYNC_TONE.provider("private".into()));
    let former_weak = former.downgrade();
    let theme_resource = Rc::new(());
    let theme_weak = Rc::downgrade(&theme_resource);
    let private = ContextScope::new(move |token, style| { let _keep = &theme_resource; theme(token, style); })
        .with(SYNC_TONE, former.clone());
    a.update(cx, |branch, cx| branch.rebind(&private, cx)).unwrap();
    drop(private);
    let appearance = Rc::new(());
    let appearance_weak = Rc::downgrade(&appearance);
    a_leaf.update(cx, |leaf, cx| leaf.set_appearance(move |_, _| { let _keep = &appearance; }, cx));
    let a_notices = Notices::for_entity(&a, cx);
    let leaf_notices = Notices::for_entity(&a_leaf, cx);
    let b_notices = Notices::for_entity(&b_leaf, cx);

    place(window, cx, Some(tree.clone().into()), true);
    painted(window, cx, 0);
    former.update(cx, |provider, cx| provider.publish("while hidden".into(), cx));
    assert!(a_notices.take() > 0 && leaf_notices.take() > 0);
    leaf_state(&a_leaf, cx, "A", "while hidden", "A");
    place(window, cx, None, false);
    painted(window, cx, 0);
    former.update(cx, |provider, cx| provider.publish("while detached".into(), cx));
    assert!(a_notices.take() > 0 && leaf_notices.take() > 0);
    assert_eq!(select(&a, cx, "detached choice"), ActionOutcome::Committed);
    leaf_state(&a_leaf, cx, "A", "while detached", "detached choice");
    assert!(theme_weak.upgrade().is_some() && appearance_weak.upgrade().is_some());
    place(window, cx, Some(tree.clone().into()), false);
    painted(window, cx, 2);
    branches.empty();
    leaves.empty();

    keys(&tree, cx, "B", "C");
    painted(window, cx, 2);
    let _c = branches.take(cx, |item| item.projection().id() == "C");
    let _c_leaf = leaves.take(cx, |item| item.projection().id() == "C");
    keys(&tree, cx, "B", "A");
    painted(window, cx, 2);
    let new_a = branches.take(cx, |item| item.projection().id() == "A");
    let new_leaf = leaves.take(cx, |item| item.projection().id() == "A");
    assert_ne!(new_a, a);
    assert_ne!(new_leaf, a_leaf);
    branches.empty();
    leaves.empty();
    let new_notices = Notices::for_entity(&new_leaf, cx);
    a_notices.take(); leaf_notices.take(); b_notices.take();

    former.update(cx, |provider, cx| provider.publish("after removal".into(), cx));
    let late_notifications = (a_notices.take(), leaf_notices.take());
    let stale_action = select(&a, cx, "stale choice");
    assert_eq!((late_notifications, stale_action), ((0, 0), ActionOutcome::Disposed),
        "a logically removed branch still receives provider notifications or submits public actions");
    leaf_state(&new_leaf, cx, "A", "shared", "A");
    shared.update(cx, |provider, cx| provider.publish("current".into(), cx));
    assert!(b_notices.take() > 0 && new_notices.take() > 0);
    assert_eq!(select(&b, cx, "retained B"), ActionOutcome::Committed);
    assert_eq!(select(&new_a, cx, "replacement A"), ActionOutcome::Committed);
    leaf_state(&b_leaf, cx, "B", "current", "retained B");
    leaf_state(&new_leaf, cx, "A", "current", "replacement A");
    assert_eq!(a.read_with(cx, |branch, _| branch.projection().choice().to_owned()), "detached choice");

    // No observer or host capability may be reacquired through the strongly
    // held native entities, including this child's nontransactional prop path.
    let attempted = cx.new(|_| SYNC_TONE.provider("attempt".into()));
    let attempted_choice = cx.new(|_| BRANCH_CHOICE.provider("attempt".into()));
    let attempt_scope = ContextScope::new(theme).with(SYNC_TONE, attempted.clone()).with(BRANCH_CHOICE, attempted_choice);
    a.update(cx, |branch, cx| branch.rebind(&attempt_scope, cx)).unwrap();
    a_leaf.update(cx, |leaf, cx| leaf.rebind(&attempt_scope, cx)).unwrap();
    a_leaf.update(cx, |leaf, cx| leaf.set_props(SyncLeafProps { id: "stale prop".into() }, cx));
    let late_appearance = Rc::new(());
    let late_weak = Rc::downgrade(&late_appearance);
    a_leaf.update(cx, |leaf, cx| leaf.set_appearance(move |_, _| { let _keep = &late_appearance; }, cx));
    attempted.update(cx, |provider, cx| provider.publish("late".into(), cx));
    assert_eq!((a_notices.take(), leaf_notices.take()), (0, 0));
    assert!(late_weak.upgrade().is_none());
    assert_eq!(a_leaf.read_with(cx, |leaf, _| leaf.projection().id().to_owned()), "A");
    drop(former);
    cx.run_until_parked();
    assert!(former_weak.upgrade().is_none(), "the retired entities kept their old provider entity alive");
    assert!(theme_weak.upgrade().is_none() && appearance_weak.upgrade().is_none(), "the retired entities kept their host bindings alive");
    assert_eq!(initial_channels.iter().filter(|provider| provider.upgrade().is_some()).count(), 1,
        "only the retained B branch still owns its original per-branch provider");
    painted(window, cx, 2);
}

fn missing_style<T>(result: Result<T, MissingContext>) {
    let Err(error) = result else { panic!("admitted a live styled component without its native style resolver") };
    assert_eq!(error.key, "gpui:host/style-resolver");
    assert_eq!(error.file, "packages/compiler/test/fixtures/authoring-sync-retirement/owner.proto.ts.txt");
    let source = include_str!("../../sync-retirement.proto.ts.txt");
    assert_eq!(source.get(error.start as usize..error.end as usize), Some("tw('sync-leaf')"));
}

#[gpui::test]
fn withdrawn_style_binding_rejects_mount_and_rebind_before_mutation(cx: &mut TestAppContext) {
    let trees = Births::<SyncTree>::record(cx);
    let branches = Births::<SyncBranch>::record(cx);
    let leaves = Births::<SyncLeaf>::record(cx);
    let original = cx.new(|_| SYNC_TONE.provider("original".into()));
    let choice = cx.new(|_| BRANCH_CHOICE.provider("standalone".into()));
    let original_scope = ContextScope::new(theme).with(SYNC_TONE, original.clone()).with(BRANCH_CHOICE, choice.clone());
    let tree = cx.update(|app| SyncTree::mount(SyncTreeProps::default(), &original_scope, app)).unwrap();
    assert_eq!(trees.take(cx, |_| true), tree);
    let old = branches.take(cx, |item| item.projection().id() == "A");
    let b = branches.take(cx, |item| item.projection().id() == "B");
    let _old_leaf = leaves.take(cx, |item| item.projection().id() == "A");
    let b_leaf = leaves.take(cx, |item| item.projection().id() == "B");
    let leaf = cx.update(|app| SyncLeaf::mount(SyncLeafProps { id: "separate".into() }, &original_scope, app)).unwrap();
    assert_eq!(leaves.take(cx, |item| item.projection().id() == "separate"), leaf);
    let tree_window = cx.add_window(|_, _| Surface { view: Some(tree.clone().into()), hidden: false });
    let leaf_window = cx.add_window(|_, _| Surface { view: Some(leaf.clone().into()), hidden: false });
    painted(tree_window, cx, 2);
    painted(leaf_window, cx, 1);
    keys(&tree, cx, "B", "C");
    painted(tree_window, cx, 2);
    let _c = branches.take(cx, |item| item.projection().id() == "C");
    let _c_leaf = leaves.take(cx, |item| item.projection().id() == "C");

    let withdrawn = old.read_with(cx, |branch, _| branch.child_scope());
    let other = cx.new(|_| SYNC_TONE.provider("other".into()));
    let only_tone = withdrawn.with(SYNC_TONE, other.clone());
    let missing = cx.update(|app| SyncLeaf::mount(SyncLeafProps::default(), &only_tone, app)).unwrap_err();
    assert_eq!(missing.key, BRANCH_CHOICE.binding_id(), "missing nominal keys keep their existing diagnostic");
    let restored_cells = only_tone.with(BRANCH_CHOICE, choice.clone());
    missing_style(cx.update(|app| SyncLeaf::mount(SyncLeafProps::default(), &restored_cells, app)));
    // SyncTree has no local style. Its required host binding belongs to its grandchild.
    missing_style(cx.update(|app| SyncTree::mount(SyncTreeProps::default(), &restored_cells, app)));
    trees.empty(); branches.empty(); leaves.empty();

    let leaf_notifications = Notices::for_entity(&leaf, cx);
    let branch_notifications = Notices::for_entity(&b_leaf, cx);
    missing_style(leaf.update(cx, |leaf, cx| leaf.rebind(&restored_cells, cx)));
    missing_style(tree.update(cx, |tree, cx| tree.rebind(&restored_cells, cx)));
    assert_eq!((leaf_notifications.take(), branch_notifications.take()), (0, 0));
    missing_style(b.update(cx, |branch, cx| {
        assert_eq!(branch.actions(cx).select("committed".into()), ActionOutcome::Committed);
        // The prior action's publication is still in progress within this same SDK update.
        branch.rebind(&restored_cells, cx)
    }));
    cx.run_until_parked();
    leaf_state(&b_leaf, cx, "B", "original", "committed");
    leaf_state(&leaf, cx, "separate", "original", "standalone");
    branch_notifications.take();
    other.update(cx, |provider, cx| provider.publish("rejected provider".into(), cx));
    assert_eq!((leaf_notifications.take(), branch_notifications.take()), (0, 0));
    original.update(cx, |provider, cx| provider.publish("still bound".into(), cx));
    assert!(leaf_notifications.take() > 0 && branch_notifications.take() > 0);
    painted(tree_window, cx, 2);
    painted(leaf_window, cx, 1);

    let valid = ContextScope::new(theme).with(SYNC_TONE, other).with(BRANCH_CHOICE, choice);
    leaf.update(cx, |leaf, cx| leaf.rebind(&valid, cx)).unwrap();
    tree.update(cx, |tree, cx| tree.rebind(&valid, cx)).unwrap();
    cx.run_until_parked();
    leaf_state(&b_leaf, cx, "B", "rejected provider", "committed");
    leaf_state(&leaf, cx, "separate", "rejected provider", "standalone");
    painted(tree_window, cx, 2);
    painted(leaf_window, cx, 1);
}
