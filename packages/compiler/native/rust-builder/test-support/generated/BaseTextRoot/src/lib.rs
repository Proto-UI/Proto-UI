use gpui::prelude::*;
pub struct BaseTextRootProps {
    pub prop_size: Option<Option<String>>,
    pub prop_tone: Option<Option<String>>,
    pub prop_weight: Option<Option<String>>,
    pub prop_font: Option<Option<String>>,
    pub prop_leading: Option<Option<String>>,
    pub prop_tracking: Option<Option<String>>,
    pub prop_emphasis: Option<Option<String>>,
    pub prop_decoration: Option<Option<String>>,
}
impl Default for BaseTextRootProps {
    fn default() -> Self {
        Self {
            prop_size: None,
            prop_tone: None,
            prop_weight: None,
            prop_font: None,
            prop_leading: None,
            prop_tracking: None,
            prop_emphasis: None,
            prop_decoration: None,
        }
    }
}
pub enum BaseTextRootChild {
    Text(String),
    View(gpui::AnyView),
}
pub struct BaseTextRoot {
    props: BaseTextRootProps,
    update_requested: bool,
    feedback_dirty: bool,
    last_error: Option<String>,
    slot_children: Vec<BaseTextRootChild>,
    resolved_prop_size: Option<String>,
    previous_prop_size: Option<String>,
    render_prop_size: Option<String>,
    resolved_prop_tone: Option<String>,
    previous_prop_tone: Option<String>,
    render_prop_tone: Option<String>,
    resolved_prop_weight: Option<String>,
    previous_prop_weight: Option<String>,
    render_prop_weight: Option<String>,
    resolved_prop_font: Option<String>,
    previous_prop_font: Option<String>,
    render_prop_font: Option<String>,
    resolved_prop_leading: Option<String>,
    previous_prop_leading: Option<String>,
    render_prop_leading: Option<String>,
    resolved_prop_tracking: Option<String>,
    previous_prop_tracking: Option<String>,
    render_prop_tracking: Option<String>,
    resolved_prop_emphasis: Option<String>,
    previous_prop_emphasis: Option<String>,
    render_prop_emphasis: Option<String>,
    resolved_prop_decoration: Option<String>,
    previous_prop_decoration: Option<String>,
    render_prop_decoration: Option<String>,
}
impl BaseTextRoot {
    pub fn set_children(
        &mut self,
        children: Vec<BaseTextRootChild>,
        cx: &mut gpui::Context<Self>,
    ) -> () {
        self.slot_children = children;
        cx.notify();
    }
    pub fn read_prop_size(&self) -> Option<String> {
        self.resolved_prop_size.clone()
    }
    pub fn read_prop_tone(&self) -> Option<String> {
        self.resolved_prop_tone.clone()
    }
    pub fn read_prop_weight(&self) -> Option<String> {
        self.resolved_prop_weight.clone()
    }
    pub fn read_prop_font(&self) -> Option<String> {
        self.resolved_prop_font.clone()
    }
    pub fn read_prop_leading(&self) -> Option<String> {
        self.resolved_prop_leading.clone()
    }
    pub fn read_prop_tracking(&self) -> Option<String> {
        self.resolved_prop_tracking.clone()
    }
    pub fn read_prop_emphasis(&self) -> Option<String> {
        self.resolved_prop_emphasis.clone()
    }
    pub fn read_prop_decoration(&self) -> Option<String> {
        self.resolved_prop_decoration.clone()
    }
    fn capture_render_snapshot(&mut self) -> () {
        self.render_prop_size = self.resolved_prop_size.clone();
        self.render_prop_tone = self.resolved_prop_tone.clone();
        self.render_prop_weight = self.resolved_prop_weight.clone();
        self.render_prop_font = self.resolved_prop_font.clone();
        self.render_prop_leading = self.resolved_prop_leading.clone();
        self.render_prop_tracking = self.resolved_prop_tracking.clone();
        self.render_prop_emphasis = self.resolved_prop_emphasis.clone();
        self.render_prop_decoration = self.resolved_prop_decoration.clone();
    }
    pub fn new(props: BaseTextRootProps) -> Result<Self, String> {
        let mut component = Self {
            props: BaseTextRootProps::default(),
            last_error: None,
            update_requested: false,
            feedback_dirty: false,
            slot_children: Vec::new(),
            resolved_prop_size: None,
            previous_prop_size: None,
            render_prop_size: None,
            resolved_prop_tone: None,
            previous_prop_tone: None,
            render_prop_tone: None,
            resolved_prop_weight: None,
            previous_prop_weight: None,
            render_prop_weight: None,
            resolved_prop_font: None,
            previous_prop_font: None,
            render_prop_font: None,
            resolved_prop_leading: None,
            previous_prop_leading: None,
            render_prop_leading: None,
            resolved_prop_tracking: None,
            previous_prop_tracking: None,
            render_prop_tracking: None,
            resolved_prop_emphasis: None,
            previous_prop_emphasis: None,
            render_prop_emphasis: None,
            resolved_prop_decoration: None,
            previous_prop_decoration: None,
            render_prop_decoration: None,
        };
        component.update_props(props)?;
        component.capture_render_snapshot();
        component.update_requested = false;
        component.feedback_dirty = false;
        Ok(component)
    }
    pub fn update_props(&mut self, props: BaseTextRootProps) -> Result<(), String> {
        self.props = props;
        let resolved_size = if let Some(raw) = self.props.prop_size.clone() {
            if let Some(value) = raw {
                if true
                    && (false || value == "xs".to_owned() || value == "sm".to_owned()
                        || value == "base".to_owned() || value == "lg".to_owned()
                        || value == "xl".to_owned() || value == "2xl".to_owned()
                        || value == "3xl".to_owned() || value == "4xl".to_owned()
                        || value == "5xl".to_owned())
                {
                    self.previous_prop_size = Some(value.clone());
                    Some(value)
                } else {
                    let fallback = self
                        .previous_prop_size
                        .clone()
                        .or(Some("base".to_owned()));
                    self.previous_prop_size = fallback.clone();
                    fallback
                }
            } else {
                let fallback = self
                    .previous_prop_size
                    .clone()
                    .or(Some("base".to_owned()));
                self.previous_prop_size = fallback.clone();
                fallback
            }
        } else {
            Some("base".to_owned())
        };
        let resolved_tone = if let Some(raw) = self.props.prop_tone.clone() {
            if let Some(value) = raw {
                if true
                    && (false || value == "default".to_owned()
                        || value == "muted".to_owned() || value == "inherit".to_owned())
                {
                    self.previous_prop_tone = Some(value.clone());
                    Some(value)
                } else {
                    let fallback = self
                        .previous_prop_tone
                        .clone()
                        .or(Some("default".to_owned()));
                    self.previous_prop_tone = fallback.clone();
                    fallback
                }
            } else {
                let fallback = self
                    .previous_prop_tone
                    .clone()
                    .or(Some("default".to_owned()));
                self.previous_prop_tone = fallback.clone();
                fallback
            }
        } else {
            Some("default".to_owned())
        };
        let resolved_weight = if let Some(raw) = self.props.prop_weight.clone() {
            if let Some(value) = raw {
                if true
                    && (false || value == "normal".to_owned()
                        || value == "medium".to_owned() || value == "semibold".to_owned()
                        || value == "bold".to_owned())
                {
                    self.previous_prop_weight = Some(value.clone());
                    Some(value)
                } else {
                    let fallback = self
                        .previous_prop_weight
                        .clone()
                        .or(Some("normal".to_owned()));
                    self.previous_prop_weight = fallback.clone();
                    fallback
                }
            } else {
                let fallback = self
                    .previous_prop_weight
                    .clone()
                    .or(Some("normal".to_owned()));
                self.previous_prop_weight = fallback.clone();
                fallback
            }
        } else {
            Some("normal".to_owned())
        };
        let resolved_font = if let Some(raw) = self.props.prop_font.clone() {
            if let Some(value) = raw {
                if true
                    && (false || value == "body".to_owned()
                        || value == "heading".to_owned() || value == "mono".to_owned())
                {
                    self.previous_prop_font = Some(value.clone());
                    Some(value)
                } else {
                    let fallback = self
                        .previous_prop_font
                        .clone()
                        .or(Some("body".to_owned()));
                    self.previous_prop_font = fallback.clone();
                    fallback
                }
            } else {
                let fallback = self
                    .previous_prop_font
                    .clone()
                    .or(Some("body".to_owned()));
                self.previous_prop_font = fallback.clone();
                fallback
            }
        } else {
            Some("body".to_owned())
        };
        let resolved_leading = if let Some(raw) = self.props.prop_leading.clone() {
            if let Some(value) = raw {
                if true
                    && (false || value == "size".to_owned()
                        || value == "tighter".to_owned() || value == "tight".to_owned()
                        || value == "snug".to_owned() || value == "normal".to_owned()
                        || value == "relaxed".to_owned())
                {
                    self.previous_prop_leading = Some(value.clone());
                    Some(value)
                } else {
                    let fallback = self
                        .previous_prop_leading
                        .clone()
                        .or(Some("normal".to_owned()));
                    self.previous_prop_leading = fallback.clone();
                    fallback
                }
            } else {
                let fallback = self
                    .previous_prop_leading
                    .clone()
                    .or(Some("normal".to_owned()));
                self.previous_prop_leading = fallback.clone();
                fallback
            }
        } else {
            Some("normal".to_owned())
        };
        let resolved_tracking = if let Some(raw) = self.props.prop_tracking.clone() {
            if let Some(value) = raw {
                if true
                    && (false || value == "normal".to_owned()
                        || value == "tight".to_owned() || value == "tighter".to_owned())
                {
                    self.previous_prop_tracking = Some(value.clone());
                    Some(value)
                } else {
                    let fallback = self
                        .previous_prop_tracking
                        .clone()
                        .or(Some("normal".to_owned()));
                    self.previous_prop_tracking = fallback.clone();
                    fallback
                }
            } else {
                let fallback = self
                    .previous_prop_tracking
                    .clone()
                    .or(Some("normal".to_owned()));
                self.previous_prop_tracking = fallback.clone();
                fallback
            }
        } else {
            Some("normal".to_owned())
        };
        let resolved_emphasis = if let Some(raw) = self.props.prop_emphasis.clone() {
            if let Some(value) = raw {
                if true
                    && (false || value == "normal".to_owned()
                        || value == "italic".to_owned())
                {
                    self.previous_prop_emphasis = Some(value.clone());
                    Some(value)
                } else {
                    let fallback = self
                        .previous_prop_emphasis
                        .clone()
                        .or(Some("normal".to_owned()));
                    self.previous_prop_emphasis = fallback.clone();
                    fallback
                }
            } else {
                let fallback = self
                    .previous_prop_emphasis
                    .clone()
                    .or(Some("normal".to_owned()));
                self.previous_prop_emphasis = fallback.clone();
                fallback
            }
        } else {
            Some("normal".to_owned())
        };
        let resolved_decoration = if let Some(raw) = self.props.prop_decoration.clone() {
            if let Some(value) = raw {
                if true
                    && (false || value == "none".to_owned()
                        || value == "underline".to_owned()
                        || value == "line-through".to_owned())
                {
                    self.previous_prop_decoration = Some(value.clone());
                    Some(value)
                } else {
                    let fallback = self
                        .previous_prop_decoration
                        .clone()
                        .or(Some("none".to_owned()));
                    self.previous_prop_decoration = fallback.clone();
                    fallback
                }
            } else {
                let fallback = self
                    .previous_prop_decoration
                    .clone()
                    .or(Some("none".to_owned()));
                self.previous_prop_decoration = fallback.clone();
                fallback
            }
        } else {
            Some("none".to_owned())
        };
        self.resolved_prop_size = resolved_size;
        self.resolved_prop_tone = resolved_tone;
        self.resolved_prop_weight = resolved_weight;
        self.resolved_prop_font = resolved_font;
        self.resolved_prop_leading = resolved_leading;
        self.resolved_prop_tracking = resolved_tracking;
        self.resolved_prop_emphasis = resolved_emphasis;
        self.resolved_prop_decoration = resolved_decoration;
        Ok(())
    }
    pub fn set_props(
        &mut self,
        props: BaseTextRootProps,
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
impl gpui::Render for BaseTextRoot {
    fn render(
        &mut self,
        _window: &mut gpui::Window,
        cx: &mut gpui::Context<Self>,
    ) -> impl gpui::IntoElement {
        let root = {
            let mut node = gpui::div();
            for child in &self.slot_children {
                node = match child {
                    BaseTextRootChild::Text(value) => node.child(value.clone()),
                    BaseTextRootChild::View(value) => node.child(value.clone()),
                };
            }
            node
        }
            .id(("proto-root", cx.entity_id()));
        root.into_any_element()
    }
}
