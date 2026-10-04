// A real GPUI root is required for window-global key routing: Window's key
// listeners are attached to dispatch nodes, unlike its raw mouse listeners.
export const gpuiNativeHostSource = String.raw`use gpui::{prelude::*, AnyView, App, Context, FocusHandle, Window, div,canvas};
use crate::gpui_native_owner::{global_key_down,global_key_up,global_host_key_up_capture,global_native_click,reset_key,reset_click,native_pointer_press,register_pointer_input,register_key_scope,outer_key_scope};
pub struct GeneratedGpuiHost{pub children:Vec<AnyView>,focus:FocusHandle}
impl GeneratedGpuiHost{
pub fn new(children:Vec<AnyView>,window:&mut Window,cx:&mut Context<Self>)->Self{let focus=cx.focus_handle();window.focus(&focus,cx);Self{children,focus}}
pub fn set_children(&mut self,children:Vec<AnyView>,cx:&mut Context<Self>){self.children=children;cx.notify();}
}
impl gpui::Focusable for GeneratedGpuiHost{fn focus_handle(&self,_:&App)->FocusHandle{self.focus.clone()}}
impl Render for GeneratedGpuiHost{
fn render(&mut self,window:&mut Window,_:&mut Context<Self>)->impl IntoElement{
register_key_scope(&self.focus,window);let capture_focus=self.focus.clone();
div().id("compiled-gpui-host").size_full().track_focus(&self.focus)
.capture_key_down(|_,_,_|reset_key()).capture_key_up(move|event,window,cx|{reset_key();if outer_key_scope(&capture_focus,window){global_host_key_up_capture(event,window,cx);}}).capture_any_mouse_up(|_,_,_|reset_click())
.on_key_down(|event,window,cx|global_key_down(event,window,cx))
.on_key_up(|event,window,cx|global_key_up(event,window,cx))
.on_click(|event,window,cx|global_native_click(event,window,cx))
.children(self.children.clone())
.child(canvas(|_,_,_|(),|_,_,window,_|{register_pointer_input(window,None);window.on_mouse_event::<gpui::MouseDownEvent>(native_pointer_press);}).absolute().size_full())
}
}
`;
