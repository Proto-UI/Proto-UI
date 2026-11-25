use gpui::prelude::*;
pub struct BaseSurfaceRootProps {
    pub prop_variant: Option<Option<String>>,
    pub prop_radius: Option<Option<String>>,
    pub prop_border: Option<Option<String>>,
    pub prop_elevation: Option<Option<String>>,
    pub prop_transitionState: Option<Option<String>>,
    pub prop_fade: Option<Option<bool>>,
    pub prop_hovered: Option<Option<bool>>,
    pub prop_focusVisible: Option<Option<bool>>,
    pub prop_pressed: Option<Option<bool>>,
    pub prop_current: Option<Option<bool>>,
}
impl Default for BaseSurfaceRootProps {
    fn default() -> Self {
        Self {
            prop_variant: None,
            prop_radius: None,
            prop_border: None,
            prop_elevation: None,
            prop_transitionState: None,
            prop_fade: None,
            prop_hovered: None,
            prop_focusVisible: None,
            prop_pressed: None,
            prop_current: None,
        }
    }
}
pub enum BaseSurfaceRootChild {
    Text(String),
    View(gpui::AnyView),
}
pub struct BaseSurfaceRoot {
    props: BaseSurfaceRootProps,
    update_requested: bool,
    feedback_dirty: bool,
    last_error: Option<String>,
    slot_children: Vec<BaseSurfaceRootChild>,
    resolved_prop_variant: Option<String>,
    previous_prop_variant: Option<String>,
    render_prop_variant: Option<String>,
    resolved_prop_radius: Option<String>,
    previous_prop_radius: Option<String>,
    render_prop_radius: Option<String>,
    resolved_prop_border: Option<String>,
    previous_prop_border: Option<String>,
    render_prop_border: Option<String>,
    resolved_prop_elevation: Option<String>,
    previous_prop_elevation: Option<String>,
    render_prop_elevation: Option<String>,
    resolved_prop_transitionState: Option<String>,
    previous_prop_transitionState: Option<String>,
    render_prop_transitionState: Option<String>,
    resolved_prop_fade: Option<bool>,
    previous_prop_fade: Option<bool>,
    render_prop_fade: Option<bool>,
    resolved_prop_hovered: Option<bool>,
    previous_prop_hovered: Option<bool>,
    render_prop_hovered: Option<bool>,
    resolved_prop_focusVisible: Option<bool>,
    previous_prop_focusVisible: Option<bool>,
    render_prop_focusVisible: Option<bool>,
    resolved_prop_pressed: Option<bool>,
    previous_prop_pressed: Option<bool>,
    render_prop_pressed: Option<bool>,
    resolved_prop_current: Option<bool>,
    previous_prop_current: Option<bool>,
    render_prop_current: Option<bool>,
}
impl BaseSurfaceRoot {
    pub fn set_children(
        &mut self,
        children: Vec<BaseSurfaceRootChild>,
        cx: &mut gpui::Context<Self>,
    ) -> () {
        self.slot_children = children;
        cx.notify();
    }
    pub fn read_prop_variant(&self) -> Option<String> {
        self.resolved_prop_variant.clone()
    }
    pub fn read_prop_radius(&self) -> Option<String> {
        self.resolved_prop_radius.clone()
    }
    pub fn read_prop_border(&self) -> Option<String> {
        self.resolved_prop_border.clone()
    }
    pub fn read_prop_elevation(&self) -> Option<String> {
        self.resolved_prop_elevation.clone()
    }
    pub fn read_prop_transitionState(&self) -> Option<String> {
        self.resolved_prop_transitionState.clone()
    }
    pub fn read_prop_fade(&self) -> Option<bool> {
        self.resolved_prop_fade.clone()
    }
    pub fn read_prop_hovered(&self) -> Option<bool> {
        self.resolved_prop_hovered.clone()
    }
    pub fn read_prop_focusVisible(&self) -> Option<bool> {
        self.resolved_prop_focusVisible.clone()
    }
    pub fn read_prop_pressed(&self) -> Option<bool> {
        self.resolved_prop_pressed.clone()
    }
    pub fn read_prop_current(&self) -> Option<bool> {
        self.resolved_prop_current.clone()
    }
    fn capture_render_snapshot(&mut self) -> () {
        self.render_prop_variant = self.resolved_prop_variant.clone();
        self.render_prop_radius = self.resolved_prop_radius.clone();
        self.render_prop_border = self.resolved_prop_border.clone();
        self.render_prop_elevation = self.resolved_prop_elevation.clone();
        self.render_prop_transitionState = self.resolved_prop_transitionState.clone();
        self.render_prop_fade = self.resolved_prop_fade.clone();
        self.render_prop_hovered = self.resolved_prop_hovered.clone();
        self.render_prop_focusVisible = self.resolved_prop_focusVisible.clone();
        self.render_prop_pressed = self.resolved_prop_pressed.clone();
        self.render_prop_current = self.resolved_prop_current.clone();
    }
    pub fn new(props: BaseSurfaceRootProps) -> Result<Self, String> {
        let mut component = Self {
            props: BaseSurfaceRootProps::default(),
            last_error: None,
            update_requested: false,
            feedback_dirty: false,
            slot_children: Vec::new(),
            resolved_prop_variant: None,
            previous_prop_variant: None,
            render_prop_variant: None,
            resolved_prop_radius: None,
            previous_prop_radius: None,
            render_prop_radius: None,
            resolved_prop_border: None,
            previous_prop_border: None,
            render_prop_border: None,
            resolved_prop_elevation: None,
            previous_prop_elevation: None,
            render_prop_elevation: None,
            resolved_prop_transitionState: None,
            previous_prop_transitionState: None,
            render_prop_transitionState: None,
            resolved_prop_fade: None,
            previous_prop_fade: None,
            render_prop_fade: None,
            resolved_prop_hovered: None,
            previous_prop_hovered: None,
            render_prop_hovered: None,
            resolved_prop_focusVisible: None,
            previous_prop_focusVisible: None,
            render_prop_focusVisible: None,
            resolved_prop_pressed: None,
            previous_prop_pressed: None,
            render_prop_pressed: None,
            resolved_prop_current: None,
            previous_prop_current: None,
            render_prop_current: None,
        };
        component.update_props(props)?;
        component.capture_render_snapshot();
        component.update_requested = false;
        component.feedback_dirty = false;
        Ok(component)
    }
    pub fn update_props(&mut self, props: BaseSurfaceRootProps) -> Result<(), String> {
        self.props = props;
        let resolved_variant = if let Some(raw) = self.props.prop_variant.clone() {
            if let Some(value) = raw {
                if true
                    && (false || value == "transparent".to_owned()
                        || value == "outline".to_owned()
                        || value == "secondary".to_owned() || value == "muted".to_owned()
                        || value == "accent".to_owned() || value == "solid".to_owned()
                        || value == "scrim".to_owned())
                {
                    self.previous_prop_variant = Some(value.clone());
                    Some(value)
                } else {
                    let fallback = self
                        .previous_prop_variant
                        .clone()
                        .or(Some("outline".to_owned()));
                    self.previous_prop_variant = fallback.clone();
                    fallback
                }
            } else {
                let fallback = self
                    .previous_prop_variant
                    .clone()
                    .or(Some("outline".to_owned()));
                self.previous_prop_variant = fallback.clone();
                fallback
            }
        } else {
            Some("outline".to_owned())
        };
        let resolved_radius = if let Some(raw) = self.props.prop_radius.clone() {
            if let Some(value) = raw {
                if true
                    && (false || value == "default".to_owned()
                        || value == "none".to_owned() || value == "sm".to_owned()
                        || value == "md".to_owned() || value == "lg".to_owned()
                        || value == "xl".to_owned() || value == "full".to_owned())
                {
                    self.previous_prop_radius = Some(value.clone());
                    Some(value)
                } else {
                    let fallback = self
                        .previous_prop_radius
                        .clone()
                        .or(Some("default".to_owned()));
                    self.previous_prop_radius = fallback.clone();
                    fallback
                }
            } else {
                let fallback = self
                    .previous_prop_radius
                    .clone()
                    .or(Some("default".to_owned()));
                self.previous_prop_radius = fallback.clone();
                fallback
            }
        } else {
            Some("default".to_owned())
        };
        let resolved_border = if let Some(raw) = self.props.prop_border.clone() {
            if let Some(value) = raw {
                if true
                    && (false || value == "all".to_owned()
                        || value == "bottom".to_owned() || value == "none".to_owned())
                {
                    self.previous_prop_border = Some(value.clone());
                    Some(value)
                } else {
                    let fallback = self
                        .previous_prop_border
                        .clone()
                        .or(Some("all".to_owned()));
                    self.previous_prop_border = fallback.clone();
                    fallback
                }
            } else {
                let fallback = self
                    .previous_prop_border
                    .clone()
                    .or(Some("all".to_owned()));
                self.previous_prop_border = fallback.clone();
                fallback
            }
        } else {
            Some("all".to_owned())
        };
        let resolved_elevation = if let Some(raw) = self.props.prop_elevation.clone() {
            if let Some(value) = raw {
                if true
                    && (false || value == "none".to_owned()
                        || value == "raised".to_owned())
                {
                    self.previous_prop_elevation = Some(value.clone());
                    Some(value)
                } else {
                    let fallback = self
                        .previous_prop_elevation
                        .clone()
                        .or(Some("none".to_owned()));
                    self.previous_prop_elevation = fallback.clone();
                    fallback
                }
            } else {
                let fallback = self
                    .previous_prop_elevation
                    .clone()
                    .or(Some("none".to_owned()));
                self.previous_prop_elevation = fallback.clone();
                fallback
            }
        } else {
            Some("none".to_owned())
        };
        let resolved_transitionState = if let Some(raw) = self
            .props
            .prop_transitionState
            .clone()
        {
            if let Some(value) = raw {
                if true
                    && (false || value == "closed".to_owned()
                        || value == "entering".to_owned()
                        || value == "entered".to_owned()
                        || value == "leaving".to_owned())
                {
                    self.previous_prop_transitionState = Some(value.clone());
                    Some(value)
                } else {
                    let fallback = self
                        .previous_prop_transitionState
                        .clone()
                        .or(Some("entered".to_owned()));
                    self.previous_prop_transitionState = fallback.clone();
                    fallback
                }
            } else {
                let fallback = self
                    .previous_prop_transitionState
                    .clone()
                    .or(Some("entered".to_owned()));
                self.previous_prop_transitionState = fallback.clone();
                fallback
            }
        } else {
            Some("entered".to_owned())
        };
        let resolved_fade = if let Some(raw) = self.props.prop_fade.clone() {
            if let Some(value) = raw {
                if true {
                    self.previous_prop_fade = Some(value.clone());
                    Some(value)
                } else {
                    let fallback = self.previous_prop_fade.clone().or(Some(false));
                    self.previous_prop_fade = fallback.clone();
                    fallback
                }
            } else {
                let fallback = self.previous_prop_fade.clone().or(Some(false));
                self.previous_prop_fade = fallback.clone();
                fallback
            }
        } else {
            Some(false)
        };
        let resolved_hovered = if let Some(raw) = self.props.prop_hovered.clone() {
            if let Some(value) = raw {
                if true {
                    self.previous_prop_hovered = Some(value.clone());
                    Some(value)
                } else {
                    let fallback = self.previous_prop_hovered.clone().or(Some(false));
                    self.previous_prop_hovered = fallback.clone();
                    fallback
                }
            } else {
                let fallback = self.previous_prop_hovered.clone().or(Some(false));
                self.previous_prop_hovered = fallback.clone();
                fallback
            }
        } else {
            Some(false)
        };
        let resolved_focusVisible = if let Some(raw) = self
            .props
            .prop_focusVisible
            .clone()
        {
            if let Some(value) = raw {
                if true {
                    self.previous_prop_focusVisible = Some(value.clone());
                    Some(value)
                } else {
                    let fallback = self
                        .previous_prop_focusVisible
                        .clone()
                        .or(Some(false));
                    self.previous_prop_focusVisible = fallback.clone();
                    fallback
                }
            } else {
                let fallback = self.previous_prop_focusVisible.clone().or(Some(false));
                self.previous_prop_focusVisible = fallback.clone();
                fallback
            }
        } else {
            Some(false)
        };
        let resolved_pressed = if let Some(raw) = self.props.prop_pressed.clone() {
            if let Some(value) = raw {
                if true {
                    self.previous_prop_pressed = Some(value.clone());
                    Some(value)
                } else {
                    let fallback = self.previous_prop_pressed.clone().or(Some(false));
                    self.previous_prop_pressed = fallback.clone();
                    fallback
                }
            } else {
                let fallback = self.previous_prop_pressed.clone().or(Some(false));
                self.previous_prop_pressed = fallback.clone();
                fallback
            }
        } else {
            Some(false)
        };
        let resolved_current = if let Some(raw) = self.props.prop_current.clone() {
            if let Some(value) = raw {
                if true {
                    self.previous_prop_current = Some(value.clone());
                    Some(value)
                } else {
                    let fallback = self.previous_prop_current.clone().or(Some(false));
                    self.previous_prop_current = fallback.clone();
                    fallback
                }
            } else {
                let fallback = self.previous_prop_current.clone().or(Some(false));
                self.previous_prop_current = fallback.clone();
                fallback
            }
        } else {
            Some(false)
        };
        self.resolved_prop_variant = resolved_variant;
        self.resolved_prop_radius = resolved_radius;
        self.resolved_prop_border = resolved_border;
        self.resolved_prop_elevation = resolved_elevation;
        self.resolved_prop_transitionState = resolved_transitionState;
        self.resolved_prop_fade = resolved_fade;
        self.resolved_prop_hovered = resolved_hovered;
        self.resolved_prop_focusVisible = resolved_focusVisible;
        self.resolved_prop_pressed = resolved_pressed;
        self.resolved_prop_current = resolved_current;
        Ok(())
    }
    pub fn set_props(
        &mut self,
        props: BaseSurfaceRootProps,
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
impl gpui::Render for BaseSurfaceRoot {
    fn render(
        &mut self,
        _window: &mut gpui::Window,
        cx: &mut gpui::Context<Self>,
    ) -> impl gpui::IntoElement {
        let root = {
            let mut node = gpui::div();
            for child in &self.slot_children {
                node = match child {
                    BaseSurfaceRootChild::Text(value) => node.child(value.clone()),
                    BaseSurfaceRootChild::View(value) => node.child(value.clone()),
                };
            }
            node
        }
            .id(("proto-root", cx.entity_id()));
        root.into_any_element()
    }
}
