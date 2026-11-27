//! Application binding for the keyed item fixture. The native producer can finish an
//! already-withdrawn request. The generated task owner decides whether to consume it.

use gpui::{AsyncApp, Global};
use proto_ui_gpui_support::owned_tasks::TaskOperation;
use std::{
    cell::{Cell, RefCell}, fs, future::poll_fn, path::Path, rc::Rc, task::{Poll, Waker},
};

#[derive(Clone)]
pub struct FileRequest(Rc<Read>);

struct Read {
    id: String,
    revision: Cell<Option<&'static str>>,
    waker: RefCell<Option<Waker>>,
    returned: RefCell<Option<String>>,
}

impl FileRequest {
    pub fn same_request(&self, other: &Self) -> bool { Rc::ptr_eq(&self.0, &other.0) }

    pub fn deliver(&self, revision: &'static str) {
        assert!(self.0.revision.replace(Some(revision)).is_none(), "duplicate file delivery");
        let waiting = self.0.waker.borrow_mut().take();
        if let Some(waker) = waiting { waker.wake(); }
    }

    pub fn returned(&self) -> Option<String> { self.0.returned.borrow().clone() }

    async fn read(&self) -> String {
        let revision = poll_fn(|cx| {
            if let Some(revision) = self.0.revision.get() { return Poll::Ready(revision); }
            *self.0.waker.borrow_mut() = Some(cx.waker().clone());
            Poll::Pending
        }).await;
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/keyed_task_source/documents.tsv");
        let document = fs::read_to_string(path).expect("read keyed item documents");
        let key = format!("{}/{revision}", self.0.id);
        let text = document.lines().filter_map(|line| line.split_once('\t'))
            .find(|(name, _)| *name == key).expect("the requested item revision exists").1.to_owned();
        assert!(self.0.returned.borrow_mut().replace(text.clone()).is_none());
        text
    }
}

#[derive(Clone, Default)]
pub struct KeyedFiles(Rc<RefCell<Vec<FileRequest>>>);
impl Global for KeyedFiles {}

impl KeyedFiles {
    pub fn len(&self) -> usize { self.0.borrow().len() }

    pub fn requests_for(&self, id: &str) -> Vec<FileRequest> {
        self.0.borrow().iter().filter(|r| r.0.id == id).cloned().collect()
    }
}

pub fn load_keyed_item(id: String, cx: &mut AsyncApp) -> TaskOperation<String> {
    let request = FileRequest(Rc::new(Read {
        id, revision: Cell::new(None), waker: RefCell::new(None), returned: RefCell::new(None),
    }));
    cx.read_global::<KeyedFiles, _>(|files, _| files.0.borrow_mut().push(request.clone()));
    let task = cx.foreground_executor().spawn(async move { request.read().await });
    TaskOperation::uncancellable(task)
}
