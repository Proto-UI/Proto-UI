use gpui::prelude::*;
pub struct PropsMatrixProps {
    pub prop_label: Option<Option<String>>,
    pub prop_amount: Option<Option<f64>>,
    pub prop_nullable: Option<Option<String>>,
}
impl Default for PropsMatrixProps {
    fn default() -> Self {
        Self {
            prop_label: None,
            prop_amount: None,
            prop_nullable: None,
        }
    }
}
pub struct PropsMatrix {
    props: PropsMatrixProps,
    last_error: Option<String>,
    resolved_prop_label: Option<String>,
    previous_prop_label: Option<String>,
    resolved_prop_amount: Option<f64>,
    previous_prop_amount: Option<f64>,
    resolved_prop_nullable: Option<String>,
    previous_prop_nullable: Option<String>,
}
impl PropsMatrix {
    pub fn read_prop_label(&self) -> Option<String> {
        self.resolved_prop_label.clone()
    }
    pub fn read_prop_amount(&self) -> Option<f64> {
        self.resolved_prop_amount.clone()
    }
    pub fn read_prop_nullable(&self) -> Option<String> {
        self.resolved_prop_nullable.clone()
    }
    pub fn new(props: PropsMatrixProps) -> Result<Self, String> {
        let mut component = Self {
            props: PropsMatrixProps::default(),
            last_error: None,
            resolved_prop_label: None,
            previous_prop_label: None,
            resolved_prop_amount: None,
            previous_prop_amount: None,
            resolved_prop_nullable: None,
            previous_prop_nullable: None,
        };
        component.update_props(props)?;
        Ok(component)
    }
    pub fn update_props(&mut self, props: PropsMatrixProps) -> Result<(), String> {
        self.props = props;
        let resolved_label = if let Some(raw) = self.props.prop_label.clone() {
            if let Some(value) = raw {
                if true {
                    self.previous_prop_label = Some(value.clone());
                    Some(value)
                } else {
                    let fallback = self
                        .previous_prop_label
                        .clone()
                        .or(Some("Default".to_owned()));
                    self.previous_prop_label = fallback.clone();
                    fallback
                }
            } else {
                let fallback = self
                    .previous_prop_label
                    .clone()
                    .or(Some("Default".to_owned()));
                self.previous_prop_label = fallback.clone();
                fallback
            }
        } else {
            Some("Default".to_owned())
        };
        let resolved_amount = if let Some(raw) = self.props.prop_amount.clone() {
            if let Some(value) = raw {
                if value.is_finite() && !(value < 0f64) && !(value > 100f64) {
                    self.previous_prop_amount = Some(value.clone());
                    Some(value)
                } else {
                    let fallback = self.previous_prop_amount.clone().or(Some(2f64));
                    self.previous_prop_amount = fallback.clone();
                    fallback
                }
            } else {
                let fallback = self.previous_prop_amount.clone().or(Some(2f64));
                self.previous_prop_amount = fallback.clone();
                fallback
            }
        } else {
            Some(2f64)
        };
        let resolved_nullable = if let Some(raw) = self.props.prop_nullable.clone() {
            if let Some(value) = raw {
                if true {
                    self.previous_prop_nullable = Some(value.clone());
                    Some(value)
                } else {
                    let fallback = self
                        .previous_prop_nullable
                        .clone()
                        .or(Some("Fallback".to_owned()));
                    self.previous_prop_nullable = fallback.clone();
                    fallback
                }
            } else {
                None
            }
        } else {
            Some("Fallback".to_owned())
        };
        self.resolved_prop_label = resolved_label;
        self.resolved_prop_amount = resolved_amount;
        self.resolved_prop_nullable = resolved_nullable;
        Ok(())
    }
    pub fn set_props(
        &mut self,
        props: PropsMatrixProps,
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
impl gpui::Render for PropsMatrix {
    fn render(
        &mut self,
        _window: &mut gpui::Window,
        cx: &mut gpui::Context<Self>,
    ) -> impl gpui::IntoElement {
        let root = gpui::div()
            .child(
                self
                    .resolved_prop_label
                    .clone()
                    .map_or_else(String::new, |value| { value.clone() }),
            )
            .child(
                self
                    .resolved_prop_amount
                    .clone()
                    .map_or_else(
                        String::new,
                        |value| { ryu_js::Buffer::new().format(value).to_owned() },
                    ),
            )
            .child(
                self
                    .resolved_prop_nullable
                    .clone()
                    .map_or_else(String::new, |value| { value.clone() }),
            )
            .id(("proto-root", cx.entity_id()));
        root.into_any_element()
    }
}
