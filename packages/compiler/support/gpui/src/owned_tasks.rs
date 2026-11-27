//! Per-declaration tasks owned by one GPUI entity or a shorter explicit scope.
//! Each segment is an ordinary synchronous action. It returns its next step only
//! after committing, or propagates the action's failure. Only owned values and
//! callbacks can leave the segment. No transaction or entity borrow is stored.

use gpui::{App, AsyncApp, Context, Subscription, Task, WeakEntity};
use std::{
    cell::{Cell, OnceCell, RefCell},
    collections::BTreeMap,
    future::{poll_fn, Future},
    mem,
    pin::Pin,
    rc::{Rc, Weak},
    task::Poll,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TaskPolicy {
    Latest,
    Parallel,
    Serial,
}

#[derive(Debug, PartialEq, Eq)]
pub enum TaskOutcome<V, E> {
    Completed(V),
    Cancelled,
    Superseded,
    OwnerEnded,
    Failed(E),
}

type Terminal<V, E> = Rc<OnceCell<TaskOutcome<V, E>>>;

/// A started native extern. GPUI cancels a spawned task when its handle drops.
/// Uncancellable work instead retains a native observer until the result arrives.
pub struct TaskOperation<A> {
    task: Task<A>,
    withdrawal: Withdrawal,
}

impl<A> TaskOperation<A> {
    pub fn cancellable(task: Task<A>) -> Self {
        Self { task, withdrawal: Withdrawal::Cancel(None) }
    }

    pub fn with_cancel(task: Task<A>, cancel: impl FnOnce() + 'static) -> Self {
        Self { task, withdrawal: Withdrawal::Cancel(Some(Box::new(cancel))) }
    }

    pub fn uncancellable(task: Task<A>) -> Self {
        Self { task, withdrawal: Withdrawal::Detach }
    }
}

enum Withdrawal {
    Cancel(Option<Box<dyn FnOnce()>>),
    Detach,
}

impl Withdrawal {
    fn withdraw<A>(self, task: Task<A>) {
        match self {
            Self::Cancel(cancel) => {
                drop(task);
                if let Some(cancel) = cancel {
                    cancel();
                }
            }
            Self::Detach => task.detach(),
        }
    }
}

type Segment<T, V, E> = Box<dyn FnOnce(&mut T, &mut Context<T>) -> Result<TaskStep<T, V, E>, E>>;
type StartWait<T, V, E> = Box<dyn FnOnce(&Rc<Group<T, V, E>>, u64, &mut AsyncApp)>;

struct Awaiting<A, F> {
    source: RefCell<Option<Pin<Box<Task<A>>>>>,
    resume: Cell<Option<F>>,
}

enum Next<T, V, E> {
    Complete(V),
    Await(StartWait<T, V, E>),
}

pub struct TaskStep<T, V, E>(Next<T, V, E>);

impl<T: 'static, V: 'static, E: 'static> TaskStep<T, V, E> {
    pub fn complete(value: V) -> Self {
        Self(Next::Complete(value))
    }

    /// Constructing this step does not start the extern. Its factory runs after
    /// the caller's transaction returns successfully and releases its owner borrow.
    /// The continuation can move an owned snapshot. Trying to write through
    /// the preceding segment's borrowed write set fails at compile time.
    ///
    /// ```compile_fail,E0521
    /// use gpui::Task;
    /// use proto_ui_gpui_support::{owned_tasks::{TaskOperation, TaskStep}, PendingWrite};
    ///
    /// fn suspend(count: &mut PendingWrite<'_, u32>) -> TaskStep<(), (), ()> {
    ///     TaskStep::awaiting(
    ///         |_| TaskOperation::cancellable(Task::ready(5_u32)),
    ///         move |_, _, result| {
    ///             count.write(result);
    ///             Ok(TaskStep::complete(()))
    ///         },
    ///     )
    /// }
    /// ```
    pub fn awaiting<A: 'static>(
        start: impl FnOnce(&mut AsyncApp) -> TaskOperation<A> + 'static,
        resume: impl FnOnce(&mut T, &mut Context<T>, A) -> Result<Self, E> + 'static,
    ) -> Self {
        Self(Next::Await(Box::new(move |group, id, cx| {
            let TaskOperation { task, withdrawal } = start(cx);
            // Starting a host operation can itself synchronously cancel this task.
            if !group.owner_alive() || !group.contains(id) {
                withdrawal.withdraw(task);
                return;
            }

            // Keep the actual native task accessible for immediate cancellation,
            // including when its observer was woken but has not run yet.
            let awaiting = Rc::new(Awaiting {
                source: RefCell::new(Some(Box::pin(task))),
                resume: Cell::new(Some(resume)),
            });
            let delivery = awaiting.clone();
            let weak_group = Rc::downgrade(group);
            let observer = cx.foreground_executor().spawn(async move {
                let value = poll_fn(|cx| {
                    match delivery.source.borrow_mut().as_mut() {
                        Some(task) => task.as_mut().poll(cx).map(Some),
                        None => Poll::Ready(None),
                    }
                }).await;
                if let (Some(value), Some(resume), Some(group)) =
                    (value, delivery.resume.take(), weak_group.upgrade())
                {
                    group.submit(id, Box::new(move |owner, cx| resume(owner, cx, value)));
                }
            });
            // ForegroundExecutor::spawn enqueues the observer without polling inline.
            let end_wait: EndWait = Box::new(move |end| {
                match end {
                    WaitEnd::Delivered => observer.detach(),
                    WaitEnd::Withdrawn => {
                        if matches!(&withdrawal, Withdrawal::Cancel(_)) {
                            let source = awaiting.source.borrow_mut().take();
                            drop(source);
                        }
                        // An uncancellable producer may never finish. Drop all
                        // authored continuation captures on withdrawal anyway.
                        drop(awaiting.resume.take());
                        withdrawal.withdraw(observer);
                    }
                }
            });
            group.state.borrow_mut().tasks.get_mut(&id).unwrap().waiting = Some(end_wait);
        })))
    }
}

/// The group retains work independently of this receipt. Each terminal value
/// stays available to the holder without requiring Clone on a result or failure.
pub struct TaskHandle<T, V, E> {
    group: Weak<Group<T, V, E>>,
    id: u64,
    terminal: Terminal<V, E>,
}

impl<T, V, E> Clone for TaskHandle<T, V, E> {
    fn clone(&self) -> Self {
        Self { group: self.group.clone(), id: self.id, terminal: self.terminal.clone() }
    }
}

impl<T: 'static, V: 'static, E: 'static> TaskHandle<T, V, E> {
    pub fn outcome(&self) -> Option<&TaskOutcome<V, E>> {
        self.terminal.get()
    }

    /// Invoke from a committed effect to withdraw just this submission.
    pub fn cancel(&self) -> bool {
        if self.outcome().is_some() {
            return false;
        }
        self.group.upgrade().is_some_and(|group| {
            group.owner_alive() && group.finish(self.id, TaskOutcome::Cancelled).is_ok()
        })
    }
}

pub struct OwnedTaskGroup<T: 'static, V: 'static, E: 'static> {
    inner: Rc<Group<T, V, E>>,
    _release: Subscription,
}

impl<T: 'static, V: 'static, E: 'static> OwnedTaskGroup<T, V, E> {
    pub fn new(cx: &Context<T>, policy: TaskPolicy) -> Self {
        let inner = Rc::new(Group {
            owner: cx.weak_entity(),
            app: cx.to_async(),
            policy,
            state: RefCell::new(GroupState { ended: false, next_id: 0, tasks: BTreeMap::new() }),
        });
        let weak = Rc::downgrade(&inner);
        let release = cx.on_release(move |_, _| {
            if let Some(group) = weak.upgrade() {
                group.withdraw_all(Stop::OwnerEnded);
            }
        });
        Self { inner, _release: release }
    }

    /// Invoke from a committed effect. Serial queues the whole first segment,
    /// including acquisition of any inputs that the segment reads at start.
    pub fn start(
        &self,
        first: impl FnOnce(&mut T, &mut Context<T>) -> Result<TaskStep<T, V, E>, E> + 'static,
    ) -> TaskHandle<T, V, E> {
        let group = &self.inner;
        let terminal = Rc::new(OnceCell::new());
        if !group.owner_alive() {
            assert!(terminal.set(TaskOutcome::OwnerEnded).is_ok());
            return TaskHandle { group: Weak::new(), id: 0, terminal };
        }
        let mut state = group.state.borrow_mut();
        let id = state.next_id;
        state.next_id = id.checked_add(1).expect("owned task identity exhausted");
        let old = if group.policy == TaskPolicy::Latest { mem::take(&mut state.tasks) } else { BTreeMap::new() };
        let start_now = group.policy != TaskPolicy::Serial || state.tasks.is_empty();
        state.tasks.insert(id, Entry {
            terminal: terminal.clone(), next: Some(Box::new(first)), waiting: None,
        });
        drop(state);
        // The replacement already occupies its slot if an old cancel hook reenters.
        retire(old, Stop::Superseded);
        if start_now {
            group.enqueue(id);
        }
        TaskHandle { group: Rc::downgrade(group), id, terminal }
    }

    /// Cancel the currently submitted tasks, including queued serial work.
    pub fn cancel_all(&self) -> usize {
        if self.inner.owner_alive() { self.inner.withdraw_all(Stop::Cancelled) } else { 0 }
    }

    /// End a shorter logical scope even while its GPUI entity remains live.
    pub fn dispose(&self) {
        self.inner.withdraw_all(Stop::OwnerEnded);
    }

    /// A retained child can be removed inside another entity's update. Make every
    /// receipt terminal now, then release native work once both entities are readable.
    pub(crate) fn dispose_after_update(&self, app: &mut App) {
        let tasks = self.inner.take_all(Stop::OwnerEnded);
        if tasks.is_empty() { return; }
        settle(&tasks, Stop::OwnerEnded);
        app.defer(move |_| release(tasks));
    }
}

impl<T: 'static, V: 'static, E: 'static> Drop for OwnedTaskGroup<T, V, E> {
    fn drop(&mut self) {
        self.dispose();
    }
}

struct Group<T, V, E> {
    owner: WeakEntity<T>,
    app: AsyncApp,
    policy: TaskPolicy,
    state: RefCell<GroupState<T, V, E>>,
}

struct GroupState<T, V, E> {
    ended: bool,
    next_id: u64,
    // Submission order also identifies the sole active serial task.
    tasks: BTreeMap<u64, Entry<T, V, E>>,
}

struct Entry<T, V, E> {
    terminal: Terminal<V, E>,
    next: Option<Segment<T, V, E>>,
    waiting: Option<EndWait>,
}

type EndWait = Box<dyn FnOnce(WaitEnd)>;
enum WaitEnd { Delivered, Withdrawn }

#[derive(Clone, Copy)]
enum Stop { Cancelled, Superseded, OwnerEnded }

fn retire<T, V, E>(tasks: BTreeMap<u64, Entry<T, V, E>>, reason: Stop) -> usize {
    let count = tasks.len();
    settle(&tasks, reason);
    release(tasks);
    count
}

fn settle<T, V, E>(tasks: &BTreeMap<u64, Entry<T, V, E>>, reason: Stop) {
    // A cancel hook can inspect another receipt or reenter this group. Publish
    // every withdrawal before releasing a single closure or calling host code.
    for entry in tasks.values() {
        let outcome = match reason {
            Stop::Cancelled => TaskOutcome::Cancelled,
            Stop::Superseded => TaskOutcome::Superseded,
            Stop::OwnerEnded => TaskOutcome::OwnerEnded,
        };
        assert!(entry.terminal.set(outcome).is_ok());
    }
}

fn release<T, V, E>(tasks: BTreeMap<u64, Entry<T, V, E>>) {
    for mut entry in tasks.into_values() {
        if let Some(wait) = entry.waiting.take() {
            wait(WaitEnd::Withdrawn);
        }
    }
}

impl<T: 'static, V: 'static, E: 'static> Group<T, V, E> {
    fn owner_alive(&self) -> bool {
        if self.state.borrow().ended {
            return false;
        }
        if self.owner.upgrade().is_some() {
            return true;
        }
        // A retained capability can be invoked between the last entity handle's
        // drop and GPUI's next release-effect flush.
        self.withdraw_all(Stop::OwnerEnded);
        false
    }

    fn contains(&self, id: u64) -> bool {
        self.state.borrow().tasks.contains_key(&id)
    }

    fn take_all(&self, reason: Stop) -> BTreeMap<u64, Entry<T, V, E>> {
        let mut state = self.state.borrow_mut();
        if matches!(reason, Stop::OwnerEnded) { state.ended = true; }
        mem::take(&mut state.tasks)
    }

    fn withdraw_all(&self, reason: Stop) -> usize {
        retire(self.take_all(reason), reason)
    }

    fn enqueue(self: &Rc<Self>, id: u64) {
        let weak = Rc::downgrade(self);
        self.app.spawn(async move |cx| {
            if let Some(group) = weak.upgrade() {
                group.run(id, cx);
            }
        }).detach();
    }

    fn run(self: &Rc<Self>, id: u64, cx: &mut AsyncApp) {
        let next = self.state.borrow_mut().tasks.get_mut(&id).and_then(|entry| entry.next.take());
        let Some(next) = next else { return };
        // GPUI flushes notify/emit effects before WeakEntity::update returns.
        // Once the synchronous action has returned its terminal result, a
        // subscriber starting a replacement cannot retroactively supersede it.
        let mut finished = None;
        let waiting = self.owner.update(cx, |owner, cx| match next(owner, cx) {
            Ok(TaskStep(Next::Complete(value))) => {
                finished = Some(self.finish(id, TaskOutcome::Completed(value)));
                None
            }
            Err(failure) => {
                finished = Some(self.finish(id, TaskOutcome::Failed(failure)));
                None
            }
            Ok(TaskStep(Next::Await(start))) => Some(start),
        });
        // An unretained result may own a native resource with a destructor.
        // Release it after GPUI returns the entity to the app.
        drop(finished);
        match waiting {
            Err(_) => { self.withdraw_all(Stop::OwnerEnded); }
            Ok(Some(start)) if self.owner_alive() && self.contains(id) => start(self, id, cx),
            Ok(_) => {}
        }
    }

    fn submit(self: &Rc<Self>, id: u64, next: Segment<T, V, E>) {
        let wait = {
            let mut state = self.state.borrow_mut();
            let Some(entry) = state.tasks.get_mut(&id) else { return };
            entry.next = Some(next);
            entry.waiting.take().expect("a submitted result must have an active await")
        };
        wait(WaitEnd::Delivered);
        // A ready Task receives the same fresh foreground action as a pending one.
        self.enqueue(id);
    }

    fn finish(self: &Rc<Self>, id: u64, outcome: TaskOutcome<V, E>) -> Result<Terminal<V, E>, TaskOutcome<V, E>> {
        let (mut entry, next) = {
            let mut state = self.state.borrow_mut();
            let was_first = self.policy == TaskPolicy::Serial && state.tasks.keys().next() == Some(&id);
            let Some(entry) = state.tasks.remove(&id) else { return Err(outcome) };
            let next = if was_first { state.tasks.keys().next().copied() } else { None };
            (entry, next)
        };
        assert!(entry.terminal.set(outcome).is_ok());
        if let Some(wait) = entry.waiting.take() {
            wait(WaitEnd::Withdrawn);
        }
        drop(entry.next);
        if let Some(next) = next {
            self.enqueue(next);
        }
        Ok(entry.terminal)
    }
}
