//! Parses a projection's template and builds the surfaces it describes.
//!
//! The wire format is whatever `serializeTemplate` in
//! `packages/adapters/gpui-peer/src/template.ts` produces: a `root` holding
//! `element`, `text`, `svg` and `slot` nodes, where an element may carry Tailwind
//! tokens. `tests/button_projection.rs` parses templates the real peer recorded
//! rather than templates written to match this parser.
//!
//! Parsing is strict. A node of an unknown kind, or one missing a field, is an
//! error naming where it was, not a node skipped: a silently dropped subtree
//! renders as a Prototype with a part missing and nothing to say why.

use std::collections::HashMap;

use gpui::{FocusHandle, SharedString, StyleRefinement};
use proto_ui_style::length::LengthContext;
use proto_ui_style::Theme;
use serde_json::Value;

use crate::host::{SurfaceChild, SurfaceNode};
use crate::input::SurfaceId;
use crate::style::{style_for_tokens, StyleIssue};

/// One node of a template.
#[derive(Debug, Clone, PartialEq)]
pub enum TemplateNode {
    /// A structural element, styled by its tokens.
    Element {
        tag: String,
        tokens: Vec<String>,
        children: Vec<TemplateNode>,
    },
    Text(String),
    /// Where host-owned content enters, named by its slot reference.
    Slot(String),
    /// An SVG subtree. Parsed so its presence is known; not rendered yet.
    Svg {
        tag: String,
    },
}

/// A parsed template: the children of its root.
#[derive(Debug, Clone, PartialEq)]
pub struct Template {
    pub children: Vec<TemplateNode>,
}

/// Why a template did not parse, and where.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TemplateError {
    /// A path such as `template.children[0].style`.
    pub path: String,
    pub problem: String,
}

impl std::fmt::Display for TemplateError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.path, self.problem)
    }
}

impl std::error::Error for TemplateError {}

fn error(path: &str, problem: impl Into<String>) -> TemplateError {
    TemplateError {
        path: path.to_string(),
        problem: problem.into(),
    }
}

fn field<'a>(node: &'a Value, path: &str, name: &str) -> Result<&'a Value, TemplateError> {
    node.get(name)
        .ok_or_else(|| error(path, format!("missing `{name}`")))
}

fn string(node: &Value, path: &str, name: &str) -> Result<String, TemplateError> {
    field(node, path, name)?
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| error(&format!("{path}.{name}"), "expected a string"))
}

fn children(node: &Value, path: &str) -> Result<Vec<TemplateNode>, TemplateError> {
    let list = field(node, path, "children")?
        .as_array()
        .ok_or_else(|| error(&format!("{path}.children"), "expected an array"))?;
    list.iter()
        .enumerate()
        .map(|(index, child)| parse_node(child, &format!("{path}.children[{index}]")))
        .collect()
}

fn parse_node(node: &Value, path: &str) -> Result<TemplateNode, TemplateError> {
    if !node.is_object() {
        return Err(error(path, "expected an object"));
    }
    match string(node, path, "kind")?.as_str() {
        "element" => {
            let tokens = match node.get("style") {
                None => Vec::new(),
                Some(style) => {
                    let style_path = format!("{path}.style");
                    let kind = string(style, &style_path, "kind")?;
                    if kind != "tw" {
                        return Err(error(&style_path, format!("unknown style kind `{kind}`")));
                    }
                    field(style, &style_path, "tokens")?
                        .as_array()
                        .ok_or_else(|| error(&format!("{style_path}.tokens"), "expected an array"))?
                        .iter()
                        .enumerate()
                        .map(|(index, token)| {
                            token.as_str().map(str::to_string).ok_or_else(|| {
                                error(
                                    &format!("{style_path}.tokens[{index}]"),
                                    "expected a string",
                                )
                            })
                        })
                        .collect::<Result<_, _>>()?
                }
            };
            Ok(TemplateNode::Element {
                tag: string(node, path, "type")?,
                tokens,
                children: children(node, path)?,
            })
        }
        "text" => Ok(TemplateNode::Text(string(node, path, "value")?)),
        "slot" => Ok(TemplateNode::Slot(string(node, path, "ref")?)),
        "svg" => Ok(TemplateNode::Svg {
            tag: string(node, path, "tag")?,
        }),
        other => Err(error(path, format!("unknown node kind `{other}`"))),
    }
}

/// Parses a projection's `template` field.
pub fn parse(template: &Value) -> Result<Template, TemplateError> {
    let path = "template";
    if !template.is_object() {
        return Err(error(path, "expected an object"));
    }
    let kind = string(template, path, "kind")?;
    if kind != "root" {
        return Err(error(path, format!("expected `root`, found `{kind}`")));
    }
    Ok(Template {
        children: children(template, path)?,
    })
}

/// Something about a template that did not reach the surfaces.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BuildIssue {
    /// A token list on an element did not become a complete style.
    Style {
        surface: SurfaceId,
        issue: StyleIssue,
    },
    /// An SVG subtree, which this host does not render yet.
    SvgNotRendered { surface: SurfaceId, tag: String },
}

/// What the host supplies when it builds a projection's surfaces.
pub struct BuildContext<'a> {
    pub session_id: &'a str,
    /// The session's root surface, which the router and focus requests use.
    pub root_id: &'a str,
    /// The root's layout, which the host application decides, as a page lays
    /// out the element a Web Component renders into.
    pub root_style: StyleRefinement,
    pub focus: Option<FocusHandle>,
    /// The design language's theme, or `None` for the Base family.
    pub theme: Option<&'a Theme>,
    /// Host-owned content for each slot reference.
    pub slots: &'a HashMap<String, Vec<SurfaceChild>>,
}

/// Builds the surface tree for a template.
///
/// Element surfaces take identifiers from their position under the root, so a
/// re-projection of the same structure keeps them. They belong to the same
/// session as the root: a template's elements are parts of one instance.
pub fn build(template: &Template, context: BuildContext<'_>) -> (SurfaceNode, Vec<BuildIssue>) {
    let mut issues = Vec::new();
    let children = build_children(&template.children, context.root_id, &context, &mut issues);
    let root = SurfaceNode {
        id: context.root_id.to_string(),
        session: context.session_id.to_string(),
        style: context.root_style.clone(),
        focus: context.focus.clone(),
        // The host attaches the instance's accessibility projection, which
        // arrives with the snapshot rather than with the template.
        a11y: None,
        children,
    };
    (root, issues)
}

fn build_children(
    nodes: &[TemplateNode],
    parent: &str,
    context: &BuildContext<'_>,
    issues: &mut Vec<BuildIssue>,
) -> Vec<SurfaceChild> {
    let mut built = Vec::new();
    for (index, node) in nodes.iter().enumerate() {
        let id = format!("{parent}/{index}");
        match node {
            TemplateNode::Element {
                tokens, children, ..
            } => {
                let style = style_for_tokens(
                    tokens.iter().map(String::as_str),
                    context.theme,
                    LengthContext::default(),
                );
                issues.extend(style.issues.into_iter().map(|issue| BuildIssue::Style {
                    surface: id.clone(),
                    issue,
                }));
                built.push(SurfaceChild::from(SurfaceNode {
                    id: id.clone(),
                    session: context.session_id.to_string(),
                    style: style.refinement,
                    focus: None,
                    a11y: None,
                    children: build_children(children, &id, context, issues),
                }));
            }
            TemplateNode::Text(text) => {
                built.push(SurfaceChild::Text(SharedString::from(text.clone())));
            }
            TemplateNode::Slot(reference) => {
                // An unfilled slot is empty, as a Web slot with no assigned
                // nodes is. That is a valid projection, not an issue.
                if let Some(content) = context.slots.get(reference) {
                    built.extend(content.iter().cloned());
                }
            }
            TemplateNode::Svg { tag } => issues.push(BuildIssue::SvgNotRendered {
                surface: id,
                tag: tag.clone(),
            }),
        }
    }
    built
}
