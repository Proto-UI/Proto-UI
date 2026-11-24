use gpui::prelude::*;
pub struct EscapedTextProps {}
impl Default for EscapedTextProps {
    fn default() -> Self {
        Self {}
    }
}
pub struct EscapedText {
    props: EscapedTextProps,
    last_error: Option<String>,
}
impl EscapedText {
    pub fn new(props: EscapedTextProps) -> Result<Self, String> {
        let mut component = Self {
            props: EscapedTextProps::default(),
            last_error: None,
        };
        component.update_props(props)?;
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
        self.update_props(props)?;
        cx.notify();
        Ok(())
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
            .child("\"; panic!(\"injected\"); //\n\u{2028} <script>& 😀".to_owned())
            .id(("proto-root", cx.entity_id()));
        root.into_any_element()
    }
}
