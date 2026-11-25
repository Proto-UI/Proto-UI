use gpui::{Context, Entity, Subscription};
use std::{cell::{Ref, RefCell}, marker::PhantomData, rc::Rc};

/// Each emitted creation site has its own marker type, even for equal labels and payload types.
pub trait NominalKey: Copy + 'static {
    type Value: 'static;
    fn changed(previous: &Self::Value, next: &Self::Value) -> bool;
}

pub struct Provider<K: NominalKey> {
    value: Rc<RefCell<K::Value>>,
    key: PhantomData<K>,
}

impl<K: NominalKey> Provider<K> {
    pub fn new(value: K::Value) -> Self { Self { value: Rc::new(RefCell::new(value)), key: PhantomData } }

    pub fn publish(&mut self, next: K::Value, cx: &mut Context<Self>) {
        let mut previous = self.value.borrow_mut();
        let changed = K::changed(&previous, &next);
        *previous = next;
        drop(previous);
        if changed { cx.notify(); }
    }
}

/// Reads consult the live committed cell even before a batched native observation is delivered.
/// Dropping this binding cancels its observation when an owner moves or is released.
pub struct BoundContext<K: NominalKey> {
    pub provider: Entity<Provider<K>>,
    value: Rc<RefCell<K::Value>>,
    _subscription: Subscription,
}

impl<K: NominalKey> BoundContext<K> {
    pub fn bind<T: 'static>(
        provider: &Entity<Provider<K>>, cx: &mut Context<T>,
        changed: impl FnMut(&mut T, Entity<Provider<K>>, &mut Context<T>) + 'static,
    ) -> Self {
        let value = provider.read(cx).value.clone();
        let subscription = cx.observe(provider, changed);
        Self { provider: provider.clone(), value, _subscription: subscription }
    }
    pub fn read(&self) -> Ref<'_, K::Value> { self.value.borrow() }
}
