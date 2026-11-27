use crate::owned_tasks::{OwnedTaskGroup, TaskHandle, TaskPolicy, TaskStep};
use gpui::{App, Context};
use std::{cell::RefCell, rc::Rc};

/// One compiled declaration belongs to one logical instance. Its latest receipt may
/// outlive both the view and the native operation without keeping either alive.
pub struct DeclaredTask<T: 'static, V: 'static, E: 'static> {
    state: Rc<State<T, V, E>>,
}

struct State<T: 'static, V: 'static, E: 'static> {
    group: OwnedTaskGroup<T, V, E>,
    last: RefCell<Option<TaskHandle<T, V, E>>>,
}

impl<T: 'static, V: 'static, E: 'static> DeclaredTask<T, V, E> {
    pub fn new(cx: &Context<T>, policy: TaskPolicy) -> Self {
        Self { state: Rc::new(State { group: OwnedTaskGroup::new(cx, policy), last: RefCell::new(None) }) }
    }

    pub fn latest(&self) -> Option<TaskHandle<T, V, E>> { self.state.last.borrow().clone() }

    /// GPUI drains these effects in publication order after returning the entity to the app.
    /// A native cancellation hook can therefore read or synchronously reenter the owner.
    pub fn start(&self, cx: &mut Context<T>, first: impl FnOnce(&mut T, &mut Context<T>) -> Result<TaskStep<T, V, E>, E> + 'static) {
        let weak = Rc::downgrade(&self.state);
        cx.defer(move |_| {
            if let Some(state) = weak.upgrade() {
                let handle = state.group.start(first);
                state.last.replace(Some(handle));
            }
        });
    }

    pub fn cancel(&self, cx: &mut Context<T>) {
        let weak = Rc::downgrade(&self.state);
        cx.defer(move |_| { if let Some(state) = weak.upgrade() { state.group.cancel_all(); } });
    }

    pub fn retire(&self, app: &mut App) { self.state.group.dispose_after_update(app); }
}
