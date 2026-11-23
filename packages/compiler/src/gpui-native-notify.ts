/** Native observer delivery must happen outside GPUI's draw/focus phase. */
export const gpuiNativeNotifySource = `
/// Source state and platform effects have already settled when this is called.
/// GPUI suppresses Notify effects while drawing (including focus callbacks),
/// so wake retained consumers after the current host lease has returned. A
/// terminal owner can still have a live generated entity whose consumers need
/// its final events; only the entity's actual lifetime gates this notification.
pub fn notify_native_change<T:'static>(cx:&mut gpui::Context<T>) {
    let view=cx.entity().downgrade();
    cx.defer(move |cx| {
        if let Some(view)=view.upgrade(){cx.notify(view.entity_id());}
    });
}

/// An undelivered event queue is not a standing request for more notifications.
/// Consume only the fact that a new event was emitted, including a terminal
/// event whose owner is already disposed. Drawing may clear ordinary dirty;
/// it must not clear this independent pending delivery fact.
pub fn notify_native_events<T:'static>(owner:&OwnerRef,cx:&mut gpui::Context<T>)->bool {
    if !std::mem::take(&mut owner.borrow_mut().pending_native_events){return false}
    notify_native_change(cx);
    true
}

/// A public operation can publish before it throws. Its caller must retain
/// that exact error while the existing coalesced native drive delivers the
/// already-published events. Do not drive failed calls that published nothing.
pub fn drive_pending_native_events(owner:&OwnerRef,window:&mut Window,cx:&mut App) {
    let drive={let owner=owner.borrow();if !owner.pending_native_events{return}owner.native_drive.clone()};
    if let Some(drive)=drive{native_host_callback(owner,"event-notification",||drive(window,cx));}
}

`;
