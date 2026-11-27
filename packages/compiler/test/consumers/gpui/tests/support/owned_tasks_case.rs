//! Independent native clients of the owned-task primitive. The action below
//! uses the support crate's PendingWrite and reads its currently bound provider.

use gpui::{App, AppContext, AsyncApp, Context, Entity, Task, TestAppContext};
use proto_ui_gpui_support::{
    owned_tasks::{OwnedTaskGroup, TaskHandle, TaskOperation, TaskOutcome, TaskPolicy, TaskStep},
    PendingWrite,
};
use std::{
    cell::{Cell, RefCell},
    future::{poll_fn, Future},
    rc::Rc,
    task::{Poll, Waker},
};

#[derive(Debug, PartialEq, Eq)]
enum BusinessError { Unavailable }

#[derive(Debug, PartialEq, Eq)]
enum ActionFailure { BeforeCommit, AfterAwait }

type Value = Result<u32, BusinessError>;
type Step = TaskStep<Owner, Value, ActionFailure>;
type Receipt = TaskHandle<Owner, Value, ActionFailure>;
type Group = OwnedTaskGroup<Owner, Value, ActionFailure>;

struct Factor(u32);

struct Owner {
    group: Rc<Group>,
    provider: Entity<Factor>,
    count: u32,
    starts: Vec<u32>,
    resumes: Vec<u32>,
}

impl Owner {
    fn action<R>(
        &mut self,
        cx: &mut Context<Self>,
        body: impl FnOnce(&mut PendingWrite<u32>, u32) -> Result<R, ActionFailure>,
    ) -> Result<R, ActionFailure> {
        let mut count = PendingWrite::new(&self.count);
        let result = body(&mut count, self.provider.read(cx).0)?;
        if let Some(next) = count.finish() {
            self.count = next;
            cx.notify();
        }
        Ok(result)
    }

    fn snapshot(&self, app: &App) -> (u32, u32, u32) {
        let factor = self.provider.read(app).0;
        (self.count, factor, self.count * factor)
    }

    fn cancel_action(&mut self, cx: &mut Context<Self>, commit: bool) -> Result<usize, ActionFailure> {
        self.action(cx, |count, _| {
            count.write(7);
            if commit { Ok(()) } else { Err(ActionFailure::BeforeCommit) }
        })?;
        Ok(self.group.cancel_all())
    }
}

fn owner(cx: &mut TestAppContext, policy: TaskPolicy) -> Entity<Owner> {
    let provider = cx.new(|_| Factor(10));
    cx.new(|cx| Owner {
        group: Rc::new(Group::new(cx, policy)),
        provider,
        count: 1,
        starts: Vec::new(),
        resumes: Vec::new(),
    })
}

// Release one real foreground producer at a time, without timers or sleeps.
fn gate<A: 'static>() -> (impl FnOnce(A), impl Future<Output = A>) {
    let slot = Rc::new(RefCell::new((None::<A>, None::<Waker>)));
    let sender = slot.clone();
    let send = move |value| {
        let wake = {
            let mut state = sender.borrow_mut();
            state.0 = Some(value);
            state.1.take()
        };
        if let Some(wake) = wake {
            wake.wake();
        }
    };
    let result = poll_fn(move |cx| {
        let mut state = slot.borrow_mut();
        match state.0.take() {
            Some(value) => Poll::Ready(value),
            None => {
                state.1 = Some(cx.waker().clone());
                Poll::Pending
            }
        }
    });
    (send, result)
}

fn uncancellable(
    input: impl Future<Output = u32> + 'static,
    produced: Rc<Cell<usize>>,
) -> impl FnOnce(&mut AsyncApp) -> TaskOperation<u32> {
    move |cx| TaskOperation::uncancellable(cx.foreground_executor().spawn(async move {
        let value = input.await;
        produced.set(produced.get() + 1);
        value
    }))
}

fn issue(
    owner: &Entity<Owner>,
    cx: &mut TestAppContext,
    tag: u32,
    start: impl FnOnce(&mut AsyncApp) -> TaskOperation<u32> + 'static,
) -> Receipt {
    owner.update(cx, |owner, _| owner.group.start(move |owner, cx| {
        let step = owner.action(cx, |_, _| Ok(Step::awaiting(start, move |owner, cx, value| {
            let step = owner.action(cx, |count, _| {
                count.write(value);
                Ok(Step::complete(Ok(value)))
            })?;
            owner.resumes.push(tag);
            Ok(step)
        })))?;
        owner.starts.push(tag);
        Ok(step)
    }))
}

#[gpui::test]
fn owned_tasks_start_runs_only_after_the_submitting_action_commits(cx: &mut TestAppContext) {
    let entity = owner(cx, TaskPolicy::Latest);
    let launch = |cx: &mut TestAppContext, commit| -> Result<Receipt, ActionFailure> {
        entity.update(cx, |owner, cx| {
            owner.action(cx, |count, _| {
                count.write(8);
                if commit { Ok(()) } else { Err(ActionFailure::BeforeCommit) }
            })?;
            Ok(owner.group.start(|owner, cx| owner.action(cx, |count, _| {
                assert_eq!(*count.read(), 8);
                count.write(9);
                Ok(Step::complete(Ok(9)))
            })))
        })
    };
    assert!(matches!(launch(cx, false), Err(ActionFailure::BeforeCommit)));
    cx.run_until_parked();
    assert_eq!(entity.read_with(cx, |owner, _| owner.count), 1);
    let handle = launch(cx, true).unwrap();
    assert_eq!(entity.read_with(cx, |owner, _| owner.count), 8);
    assert_eq!(handle.outcome(), None);
    cx.run_until_parked();
    assert_eq!(entity.read_with(cx, |owner, _| owner.count), 9);
    assert_eq!(handle.outcome(), Some(&TaskOutcome::Completed(Ok(9))));
}

#[gpui::test]
fn owned_tasks_ready_boundaries_publish_and_return_a_business_error(cx: &mut TestAppContext) {
    let entity = owner(cx, TaskPolicy::Parallel);
    let publications = Rc::new(RefCell::new(Vec::new()));
    let observed = publications.clone();
    let _subscription = cx.update(|app| app.observe(&entity, move |owner, app| {
        observed.borrow_mut().push(owner.read(app).count);
    }));
    let handle = entity.update(cx, |owner, _| owner.group.start(|owner, cx| {
        owner.action(cx, |count, _| {
            count.write(2);
            Ok(Step::awaiting(
                |_| TaskOperation::cancellable(Task::ready(Err::<u32, _>(BusinessError::Unavailable))),
                |owner, cx, result| owner.action(cx, |count, _| {
                    assert_eq!(*count.read(), 2);
                    count.write(3);
                    Ok(Step::awaiting(
                        move |_| TaskOperation::cancellable(Task::ready(result)),
                        |owner, cx, result| owner.action(cx, |count, _| {
                            assert_eq!(*count.read(), 3);
                            count.write(4);
                            Ok(Step::complete(result))
                        }),
                    ))
                }),
            ))
        })
    }));
    // Inspect the actual test dispatcher's turns: an inline ready continuation
    // would skip one of the externally readable states even if it called notify.
    for (before, after) in [(1, 2), (2, 3)] {
        while entity.read_with(cx, |owner, _| owner.count) == before {
            assert!(cx.dispatcher.tick(false), "no runnable could publish {after}");
        }
        assert_eq!(entity.read_with(cx, |owner, _| owner.count), after);
        assert_eq!(handle.outcome(), None);
    }
    cx.run_until_parked();
    assert_eq!(handle.outcome(), Some(&TaskOutcome::Completed(Err(BusinessError::Unavailable))));
    assert_eq!(&*publications.borrow(), &[2, 3, 4]);
    assert!(!handle.cancel());
}

#[gpui::test]
fn owned_tasks_pending_failure_keeps_the_first_commit_and_reads_the_current_provider(cx: &mut TestAppContext) {
    let entity = owner(cx, TaskPolicy::Parallel);
    assert_eq!(entity.read_with(cx, Owner::snapshot), (1, 10, 10));
    let (send, pending) = gate();
    let original = entity.downgrade();
    let handle = entity.update(cx, |owner, _| owner.group.start(move |owner, cx| {
        owner.action(cx, |count, factor| {
            let captured = (*count.read(), factor);
            count.write(2);
            assert_eq!(*count.read() * factor, 20);
            Ok(Step::awaiting(
                move |cx| {
                    // The extern can independently read the released GPUI entity.
                    assert_eq!(original.read_with(cx, Owner::snapshot).unwrap(), (2, 10, 20));
                    TaskOperation::cancellable(cx.foreground_executor().spawn(pending))
                },
                move |owner, cx, value| owner.action(cx, |count, factor| {
                    assert_eq!(captured, (1, 10));
                    assert_eq!((*count.read(), factor), (2, 3));
                    count.write(value);
                    assert_eq!(*count.read() * factor, 15);
                    Err(ActionFailure::AfterAwait)
                }),
            ))
        })
    }));
    cx.run_until_parked();
    assert_eq!(handle.outcome(), None);
    assert_eq!(entity.read_with(cx, Owner::snapshot), (2, 10, 20));
    let next_provider = cx.new(|_| Factor(3));
    entity.update(cx, |owner, cx| { owner.provider = next_provider; cx.notify(); });
    assert_eq!(entity.read_with(cx, Owner::snapshot), (2, 3, 6));
    send(5);
    cx.run_until_parked();
    assert_eq!(handle.outcome(), Some(&TaskOutcome::Failed(ActionFailure::AfterAwait)));
    assert_eq!(entity.read_with(cx, Owner::snapshot), (2, 3, 6));
}

#[gpui::test]
fn owned_tasks_latest_rejects_a_late_uncancellable_result(cx: &mut TestAppContext) {
    let entity = owner(cx, TaskPolicy::Latest);
    let produced = Rc::new(Cell::new(0));
    let (send, pending) = gate();
    let old = issue(&entity, cx, 1, uncancellable(pending, produced.clone()));
    cx.run_until_parked();
    let current = issue(&entity, cx, 2, |_| TaskOperation::cancellable(Task::ready(20)));
    assert_eq!(old.outcome(), Some(&TaskOutcome::Superseded));
    assert!(!old.cancel());
    cx.run_until_parked();
    assert_eq!(current.outcome(), Some(&TaskOutcome::Completed(Ok(20))));
    send(10);
    cx.run_until_parked();
    assert_eq!(produced.get(), 1, "the superseded producer actually completed");
    entity.read_with(cx, |owner, _| {
        assert_eq!(owner.starts, [1, 2]);
        assert_eq!(owner.resumes, [2]);
        assert_eq!(owner.count, 20);
    });
}

#[gpui::test]
fn owned_tasks_latest_keeps_a_completed_result_when_its_subscriber_starts_again(cx: &mut TestAppContext) {
    let entity = owner(cx, TaskPolicy::Latest);
    let replacement = Rc::new(RefCell::new(None::<Receipt>));
    let published = replacement.clone();
    let _subscription = cx.update(|app| app.observe(&entity, move |entity, app| {
        if entity.read(app).count == 2 {
            let next = entity.update(app, |owner, _| owner.group.start(|owner, cx| {
                owner.action(cx, |count, _| {
                    count.write(3);
                    Ok(Step::complete(Ok(3)))
                })
            }));
            assert_eq!(next.outcome(), None);
            assert_eq!(entity.read(app).count, 2);
            assert!(published.borrow_mut().replace(next).is_none());
        }
    }));
    let first = entity.update(cx, |owner, _| owner.group.start(|owner, cx| {
        owner.action(cx, |count, _| {
            count.write(2);
            Ok(Step::complete(Ok(2)))
        })
    }));
    cx.run_until_parked();
    assert_eq!(first.outcome(), Some(&TaskOutcome::Completed(Ok(2))));
    let replacement = replacement.borrow();
    assert_eq!(replacement.as_ref().unwrap().outcome(), Some(&TaskOutcome::Completed(Ok(3))));
    assert_eq!(entity.read_with(cx, |owner, _| owner.count), 3);
}

#[gpui::test]
fn owned_tasks_release_unretained_native_results_after_the_entity_update(cx: &mut TestAppContext) {
    struct NativeResource {
        owner: gpui::WeakEntity<Owner>,
        app: AsyncApp,
        observed: Rc<Cell<Option<u32>>>,
    }

    impl Drop for NativeResource {
        fn drop(&mut self) {
            let count = self.owner.read_with(&self.app, |owner, _| owner.count).unwrap();
            self.observed.set(Some(count));
        }
    }

    let entity = owner(cx, TaskPolicy::Parallel);
    let group = entity.update(cx, |_, cx| {
        Rc::new(OwnedTaskGroup::<Owner, NativeResource, ActionFailure>::new(cx, TaskPolicy::Parallel))
    });
    for (value, cancel) in [(4, false), (5, true)] {
        let observed = Rc::new(Cell::new(None));
        let resource = NativeResource {
            owner: entity.downgrade(), app: cx.to_async(), observed: observed.clone(),
        };
        let scope = group.clone();
        let handle = group.start(move |owner, cx| {
            let step = owner.action(cx, |count, _| {
                count.write(value);
                Ok(TaskStep::complete(resource))
            })?;
            if cancel { assert_eq!(scope.cancel_all(), 1); }
            Ok(step)
        });
        drop(handle);
        cx.run_until_parked();
        assert_eq!(observed.get(), Some(value));
    }
}

#[gpui::test]
fn owned_tasks_cancel_after_native_completion_prevents_the_next_segment(cx: &mut TestAppContext) {
    let entity = owner(cx, TaskPolicy::Parallel);
    let produced = Rc::new(Cell::new(0));
    let (send, pending) = gate();
    let handle = issue(&entity, cx, 1, uncancellable(pending, produced.clone()));
    cx.run_until_parked();
    send(40);
    while produced.get() == 0 {
        assert!(cx.dispatcher.tick(false), "the native producer was woken");
    }
    assert_eq!(handle.outcome(), None);
    assert!(handle.cancel());
    cx.run_until_parked();
    assert_eq!(handle.outcome(), Some(&TaskOutcome::Cancelled));
    entity.read_with(cx, |owner, _| {
        assert!(owner.resumes.is_empty());
        assert_eq!(owner.count, 1);
    });
}

#[gpui::test]
fn owned_tasks_parallel_accepts_both_completions_in_reverse_order(cx: &mut TestAppContext) {
    let entity = owner(cx, TaskPolicy::Parallel);
    let (send_a, a) = gate();
    let (send_b, b) = gate();
    let first = issue(&entity, cx, 1, |cx| TaskOperation::cancellable(cx.foreground_executor().spawn(a)));
    let second = issue(&entity, cx, 2, |cx| TaskOperation::cancellable(cx.foreground_executor().spawn(b)));
    cx.run_until_parked();
    entity.read_with(cx, |owner, _| {
        assert_eq!(owner.starts.len(), 2);
        assert!(owner.starts.contains(&1) && owner.starts.contains(&2));
    });
    send_b(20);
    cx.run_until_parked();
    assert_eq!(first.outcome(), None);
    assert_eq!(second.outcome(), Some(&TaskOutcome::Completed(Ok(20))));
    send_a(10);
    cx.run_until_parked();
    assert_eq!(first.outcome(), Some(&TaskOutcome::Completed(Ok(10))));
    entity.read_with(cx, |owner, _| {
        assert_eq!(owner.resumes, [2, 1]);
        assert_eq!(owner.count, 10);
    });
}

#[gpui::test]
fn owned_tasks_serial_defers_first_segments_and_skips_cancelled_queue_entries(cx: &mut TestAppContext) {
    let entity = owner(cx, TaskPolicy::Serial);
    let (send, pending) = gate();
    let first = issue(&entity, cx, 1, |cx| TaskOperation::cancellable(cx.foreground_executor().spawn(pending)));
    let skipped = issue(&entity, cx, 2, |_| panic!("cancelled serial operation started"));
    let third = issue(&entity, cx, 3, |_| TaskOperation::cancellable(Task::ready(30)));
    cx.run_until_parked();
    entity.read_with(cx, |owner, _| assert_eq!(owner.starts, [1]));
    assert!(skipped.cancel());
    assert!(!skipped.cancel());
    assert_eq!(skipped.outcome(), Some(&TaskOutcome::Cancelled));
    cx.run_until_parked();
    entity.read_with(cx, |owner, _| assert_eq!(owner.starts, [1]));
    assert_eq!(third.outcome(), None);
    send(10);
    cx.run_until_parked();
    assert_eq!(first.outcome(), Some(&TaskOutcome::Completed(Ok(10))));
    assert_eq!(third.outcome(), Some(&TaskOutcome::Completed(Ok(30))));
    entity.read_with(cx, |owner, _| {
        assert_eq!(owner.starts, [1, 3]);
        assert_eq!(owner.resumes, [1, 3]);
    });
}

#[gpui::test]
fn owned_tasks_post_commit_cancellation_withdraws_native_work_before_host_reentry(cx: &mut TestAppContext) {
    let entity = owner(cx, TaskPolicy::Parallel);
    let (send, pending) = gate();
    let produced = Rc::new(Cell::new(false));
    let cancelled = Rc::new(Cell::new(0));
    let receipts = Rc::new(RefCell::new(Vec::<Receipt>::new()));
    let observed = receipts.clone();
    let finished = produced.clone();
    let hooks = cancelled.clone();
    let group = entity.read_with(cx, |owner, _| Rc::downgrade(&owner.group));
    let first = issue(&entity, cx, 1, move |cx| {
        let task = cx.foreground_executor().spawn(async move {
            let value = pending.await;
            finished.set(true);
            value
        });
        TaskOperation::with_cancel(task, move || {
            hooks.set(hooks.get() + 1);
            assert!(observed.borrow().iter().all(|h| h.outcome() == Some(&TaskOutcome::Cancelled)));
            assert_eq!(group.upgrade().unwrap().cancel_all(), 0);
            send(99); // The synchronous host hook wakes the withdrawn native work.
        })
    });
    let second = issue(&entity, cx, 2, |cx| {
        TaskOperation::cancellable(cx.foreground_executor().spawn(std::future::pending::<u32>()))
    });
    receipts.borrow_mut().extend([first.clone(), second.clone()]);
    cx.run_until_parked();
    assert_eq!(entity.update(cx, |owner, cx| owner.cancel_action(cx, false)), Err(ActionFailure::BeforeCommit));
    assert_eq!(entity.read_with(cx, |owner, _| owner.count), 1);
    assert_eq!(first.outcome(), None);
    assert_eq!(cancelled.get(), 0);
    assert_eq!(entity.update(cx, |owner, cx| owner.cancel_action(cx, true)), Ok(2));
    assert_eq!(entity.read_with(cx, |owner, _| owner.count), 7);
    assert_eq!(first.outcome(), Some(&TaskOutcome::Cancelled));
    assert_eq!(second.outcome(), Some(&TaskOutcome::Cancelled));
    cx.run_until_parked();
    assert_eq!(cancelled.get(), 1);
    assert!(!produced.get(), "the cancellable producer ran after withdrawal");
    entity.read_with(cx, |owner, _| assert!(owner.resumes.is_empty()));
}

#[gpui::test]
fn owned_tasks_disposal_releases_captures_and_protects_replacement_entities(cx: &mut TestAppContext) {
    let original = owner(cx, TaskPolicy::Parallel);
    let old_entity = original.downgrade();
    // Keep a group capability deliberately live after its GPUI owner is released.
    let old_group = original.read_with(cx, |owner, _| owner.group.clone());
    let (send, pending) = gate();
    let produced = Rc::new(Cell::new(0));
    let start = uncancellable(pending, produced.clone());
    let capture = Rc::new(String::from("owned value"));
    let capture_lifetime = Rc::downgrade(&capture);
    let late = old_group.start(move |owner, cx| owner.action(cx, |_, _| {
        Ok(Step::awaiting(start, move |owner, cx, value| owner.action(cx, |count, _| {
            assert_eq!(capture.as_str(), "owned value");
            count.write(value);
            Ok(Step::complete(Ok(value)))
        })))
    }));
    let cancellations = Rc::new(Cell::new(0));
    let hooks = cancellations.clone();
    let cancellable = issue(&original, cx, 2, move |cx| TaskOperation::with_cancel(
        cx.foreground_executor().spawn(std::future::pending::<u32>()),
        move || hooks.set(hooks.get() + 1),
    ));
    cx.run_until_parked();
    assert!(capture_lifetime.upgrade().is_some());
    drop(original);
    cx.update(|_| {}); // Flush GPUI's actual entity-release effects.
    assert!(old_entity.upgrade().is_none());
    assert_eq!(late.outcome(), Some(&TaskOutcome::OwnerEnded));
    assert_eq!(cancellable.outcome(), Some(&TaskOutcome::OwnerEnded));
    assert_eq!(cancellations.get(), 1);
    assert!(capture_lifetime.upgrade().is_none());
    let replacement = owner(cx, TaskPolicy::Parallel);
    let rejected = old_group.start(|_, _| panic!("released owner accepted another action"));
    assert_eq!(rejected.outcome(), Some(&TaskOutcome::OwnerEnded));
    send(80);
    cx.run_until_parked();
    assert_eq!(produced.get(), 1, "late native work must have really finished");
    assert_eq!(replacement.read_with(cx, Owner::snapshot), (1, 10, 10));
    old_group.dispose();
    assert_eq!(cancellations.get(), 1);
}

#[gpui::test]
fn owned_tasks_reentrant_extern_start_withdraws_the_returned_operation(cx: &mut TestAppContext) {
    let entity = owner(cx, TaskPolicy::Latest);
    let group = entity.read_with(cx, |owner, _| owner.group.clone());
    let closing = group.clone();
    let cancelled = Rc::new(Cell::new(0));
    let calls = cancelled.clone();
    let handle = issue(&entity, cx, 1, move |cx| {
        closing.dispose();
        TaskOperation::with_cancel(cx.foreground_executor().spawn(std::future::pending::<u32>()), move || {
            calls.set(calls.get() + 1);
        })
    });
    cx.run_until_parked();
    assert_eq!(handle.outcome(), Some(&TaskOutcome::OwnerEnded));
    assert_eq!(cancelled.get(), 1);
    assert_eq!(group.start(|_, _| panic!("ended scope ran")).outcome(), Some(&TaskOutcome::OwnerEnded));
    assert!(!handle.cancel());
    entity.read_with(cx, |owner, _| assert!(owner.resumes.is_empty()));
}
