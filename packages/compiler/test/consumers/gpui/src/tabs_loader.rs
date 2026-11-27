//! The application's binding for `authoring.load-tab`. Each invocation reads the
//! selected document from the generated consumer crate. Each GPUI app independently
//! controls when a pending read proceeds and whether it supports cancellation.

use crate::{async_tab_panel, tabs_owner};
use gpui::{App, AsyncApp, Global, Task};
use proto_ui_gpui_support::owned_tasks::TaskOperation;
use std::{
    cell::{Cell, RefCell},
    collections::VecDeque,
    ffi::OsStr,
    fs,
    future::poll_fn,
    io::ErrorKind,
    path::Path,
    rc::Rc,
    task::{Poll, Waker},
};

#[derive(Clone, Copy)]
pub enum Delivery {
    Ready,
    Cancellable,
    Uncancellable,
}

#[derive(Clone)]
pub struct Request(Rc<ReadRequest>);

struct ReadRequest {
    selected: String,
    released: Cell<bool>,
    waker: RefCell<Option<Waker>>,
    result: RefCell<Option<Result<String, String>>>,
    withdrawn: Cell<bool>,
}

impl Request {
    pub fn selected(&self) -> &str { &self.0.selected }
    pub fn result(&self) -> Option<Result<String, String>> { self.0.result.borrow().clone() }
    pub fn was_withdrawn(&self) -> bool { self.0.withdrawn.get() }

    pub fn release(&self) {
        self.0.released.set(true);
        let waker = self.0.waker.borrow_mut().take();
        if let Some(waker) = waker { waker.wake(); }
    }

    fn read_document(&self) -> Result<String, String> {
        let selected = self.selected();
        let result = if Path::new(selected).file_name() == Some(OsStr::new(selected)) {
            let path = Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("tests/tabs_source/documents")
                .join(format!("{selected}.txt"));
            fs::read_to_string(path).map_err(|error| match error.kind() {
                ErrorKind::NotFound => format!("No document for {selected}"),
                _ => format!("Cannot read {selected}: {error}"),
            })
        } else {
            Err(format!("Invalid document name {selected:?}"))
        };
        assert!(self.0.result.borrow_mut().replace(result.clone()).is_none(), "an invocation read twice");
        result
    }

    async fn wait(&self) {
        poll_fn(|cx| {
            if self.0.released.get() { Poll::Ready(()) } else {
                *self.0.waker.borrow_mut() = Some(cx.waker().clone());
                Poll::Pending
            }
        }).await;
    }
}

type StartObserver = Box<dyn FnOnce(&str, &App)>;

#[derive(Default)]
struct Control {
    plans: VecDeque<Delivery>,
    requests: Vec<Request>,
    observer: Option<StartObserver>,
}

#[derive(Clone, Default)]
pub struct TabsLoader(Rc<RefCell<Control>>);

impl Global for TabsLoader {}

impl TabsLoader {
    pub fn plan(&self, delivery: Delivery) { self.0.borrow_mut().plans.push_back(delivery); }
    pub fn call_count(&self) -> usize { self.0.borrow().requests.len() }
    pub fn request(&self, index: usize) -> Request { self.0.borrow().requests[index].clone() }

    pub fn observe_next_start(&self, observer: impl FnOnce(&str, &App) + 'static) {
        assert!(self.0.borrow_mut().observer.replace(Box::new(observer)).is_none());
    }

    fn start(&self, selected: String, app: &App) -> (Delivery, Request) {
        let request = Request(Rc::new(ReadRequest {
            selected, released: Cell::new(false), waker: RefCell::new(None),
            result: RefCell::new(None), withdrawn: Cell::new(false),
        }));
        let (mode, observer) = {
            let mut control = self.0.borrow_mut();
            let mode = control.plans.pop_front()
                .unwrap_or_else(|| panic!("unexpected native load of {:?}", request.selected()));
            control.requests.push(request.clone());
            (mode, control.observer.take())
        };
        if let Some(observer) = observer { observer(request.selected(), app); }
        (mode, request)
    }
}

fn load<T: 'static>(
    selected: String,
    cx: &mut AsyncApp,
    convert: impl FnOnce(Result<String, String>) -> T + 'static,
) -> TaskOperation<T> {
    let (mode, request) = cx.read_global::<TabsLoader, _>(|loader, app| loader.start(selected, app));
    let cancellable = match mode {
        Delivery::Ready => return TaskOperation::cancellable(Task::ready(convert(request.read_document()))),
        Delivery::Cancellable => true,
        Delivery::Uncancellable => false,
    };
    let pending = request.clone();
    let task = cx.foreground_executor().spawn(async move {
        pending.wait().await;
        convert(pending.read_document())
    });
    if cancellable {
        TaskOperation::with_cancel(task, move || {
            request.0.withdrawn.set(true);
            drop(request.0.waker.borrow_mut().take());
        })
    } else {
        TaskOperation::uncancellable(task)
    }
}

pub fn load_owner_tab(selected: String, cx: &mut AsyncApp) -> TaskOperation<tabs_owner::LoadTabResult> {
    load(selected, cx, |result| match result {
        Ok(text) => tabs_owner::LoadTabResult::ok(text),
        Err(message) => tabs_owner::LoadTabResult::err(tabs_owner::LoadTabResultErrError {
            kind: Default::default(), message,
        }),
    })
}

pub fn load_panel_tab(selected: String, cx: &mut AsyncApp) -> TaskOperation<async_tab_panel::LoadTabResult> {
    load(selected, cx, |result| match result {
        Ok(text) => async_tab_panel::LoadTabResult::ok(text),
        Err(message) => async_tab_panel::LoadTabResult::err(async_tab_panel::LoadTabResultErrError {
            kind: Default::default(), message,
        }),
    })
}
