use gpui::prelude::*;
pub struct EscapedTextProps {}
impl Default for EscapedTextProps {
    fn default() -> Self {
        Self {}
    }
}
pub struct EscapedText {
    props: EscapedTextProps,
    update_requested: bool,
    feedback_dirty: bool,
    last_error: Option<String>,
}
impl EscapedText {
    fn capture_render_snapshot(&mut self) -> () {}
    pub fn new(props: EscapedTextProps) -> Result<Self, String> {
        let mut component = Self {
            props: EscapedTextProps::default(),
            last_error: None,
            update_requested: false,
            feedback_dirty: false,
        };
        component.update_props(props)?;
        component.capture_render_snapshot();
        component.update_requested = false;
        component.feedback_dirty = false;
        Ok(component)
    }
    pub fn update_props(&mut self, props: EscapedTextProps) -> Result<(), String> {
        self.props = props;
        Ok(())
    }
    pub fn set_props(
        &mut self,
        props: EscapedTextProps,
        cx: &mut gpui::Context<Self>,
    ) -> Result<(), String> {
        let result = self.update_props(props);
        let requested = self.take_update_request();
        let feedback = self.take_feedback_update();
        if result.is_ok() {
            self.capture_render_snapshot();
            cx.notify();
        } else {
            if requested || feedback {
                cx.notify();
            }
        };
        result
    }
    fn take_update_request(&mut self) -> bool {
        let requested = self.update_requested;
        self.update_requested = false;
        requested
    }
    fn take_feedback_update(&mut self) -> bool {
        let dirty = self.feedback_dirty;
        self.feedback_dirty = false;
        dirty
    }
    pub fn take_error(&mut self) -> Option<String> {
        self.last_error.take()
    }
}
impl gpui::Render for EscapedText {
    fn render(
        &mut self,
        _window: &mut gpui::Window,
        cx: &mut gpui::Context<Self>,
    ) -> impl gpui::IntoElement {
        let root = gpui::div()
            .child(
                gpui::div()
                    .child(
                        "\"; panic!(\"injected\"); //\n\u{2028} <script>& 😀"
                            .to_owned(),
                    ),
            )
            .id(("proto-root", cx.entity_id()));
        root.into_any_element()
    }
}
