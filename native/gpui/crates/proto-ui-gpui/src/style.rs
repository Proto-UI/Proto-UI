//! Maps resolved Proto UI declarations onto a GPUI `StyleRefinement`.
//!
//! The input is what `proto-ui-style` produces: a property/value map with
//! every `var()` substituted. The output is a refinement plus an explicit list
//! of what could not be mapped.
//!
//! Nothing is dropped silently. A property GPUI cannot express, or one this
//! layer has not implemented yet, is reported so the caller can decide whether
//! that matters for the surface being painted. A silently ignored declaration
//! is the failure mode that produces a subtly wrong frame with no diagnostic.

use gpui::{
    px, AbsoluteLength, AlignItems, CursorStyle, DefiniteLength, Display, Fill, FlexDirection,
    FontFallbacks, Hsla, JustifyContent, Length, Overflow, Position, StyleRefinement,
};
use proto_ui_style::color::{parse as parse_color, ColorValue};
use proto_ui_style::length::{evaluate as evaluate_length, Dimension, LengthContext};
use proto_ui_style::ResolvedStyle;

/// Why one declaration did not reach the refinement.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Unmapped {
    /// A property this layer has not implemented.
    UnknownProperty,
    /// A value this layer does not understand for a property it does know.
    UnsupportedValue,
    /// The value is `currentColor`, which resolves against the inherited text
    /// colour. This layer receives one surface's declarations and has no
    /// inherited colour, so the caller substitutes it before mapping.
    NeedsInheritedColor,
    /// A custom property that only exists to feed a composed value such as the
    /// ring or the transform, and is consumed by the property it feeds.
    ComposedInput,
}

#[derive(Debug, Clone, Default)]
pub struct MappedStyle {
    pub refinement: StyleRefinement,
    /// Declarations that did not reach the refinement, in property order.
    pub unmapped: Vec<(String, String, Unmapped)>,
}

impl MappedStyle {
    pub fn is_complete(&self) -> bool {
        self.unmapped.is_empty()
    }

    /// Unmapped entries excluding the custom properties that are inputs to a
    /// composed value, which are expected not to map on their own.
    pub fn unmapped_properties(&self) -> Vec<&str> {
        self.unmapped
            .iter()
            .filter(|(_, _, reason)| *reason != Unmapped::ComposedInput)
            .map(|(property, _, _)| property.as_str())
            .collect()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum InsetMode {
    Inert,
    Positioned,
    Unsupported,
}

/// Maps one resolved declaration set.
pub fn map(resolved: &ResolvedStyle, context: LengthContext) -> MappedStyle {
    let mut mapped = MappedStyle::default();
    let style = &mut mapped.refinement;
    let inset_mode = match resolved.declarations.get("position").map(String::as_str) {
        None | Some("static") => InsetMode::Inert,
        Some("relative" | "absolute") => InsetMode::Positioned,
        Some(_) => InsetMode::Unsupported,
    };
    // CSS defaults to static, but GPUI Style defaults to Relative, which also
    // establishes a containing block for absolute descendants. Do not claim a
    // complete mapping when this host cannot express the CSS default.
    if !resolved.declarations.contains_key("position") {
        mapped.unmapped.push((
            "position".into(),
            "static".into(),
            Unmapped::UnsupportedValue,
        ));
    }

    for (property, value) in &resolved.declarations {
        // Custom properties are inputs to a composed declaration that appears
        // alongside them; they are never painted directly.
        if property.starts_with("--") {
            mapped
                .unmapped
                .push((property.clone(), value.clone(), Unmapped::ComposedInput));
            continue;
        }

        if let Err(reason) = apply(style, property, value, context, inset_mode) {
            mapped
                .unmapped
                .push((property.clone(), value.clone(), reason));
        }
    }

    mapped
}

/// `Err` carries why the declaration did not reach the refinement.
///
/// The result type matters: an earlier version returned `Option<Unmapped>` and
/// used `?` on the parse helpers, so a value that failed to parse returned
/// `None` — which that signature read as success. A declaration could then be
/// silently skipped while reporting that it had been applied.
fn apply(
    style: &mut StyleRefinement,
    property: &str,
    value: &str,
    context: LengthContext,
    inset_mode: InsetMode,
) -> Result<(), Unmapped> {
    let length = |raw: &str| evaluate_length(raw, context).map_err(|_| Unmapped::UnsupportedValue);
    let color = |raw: &str| match parse_color(raw) {
        Ok(ColorValue::Rgba(rgba)) => Ok(to_hsla(rgba)),
        Ok(ColorValue::CurrentColor) => Err(Unmapped::NeedsInheritedColor),
        Err(_) => Err(Unmapped::UnsupportedValue),
    };

    match property {
        "display" => match value {
            "flex" | "inline-flex" => style.display = Some(Display::Flex),
            "block" | "inline-block" => style.display = Some(Display::Block),
            "grid" => style.display = Some(Display::Grid),
            "none" => style.display = Some(Display::None),
            _ => return Err(Unmapped::UnsupportedValue),
        },
        // GPUI borders are always solid, so the declaration is satisfied by
        // the border width alone; any other style would change the paint.
        "border-style"
        | "border-top-style"
        | "border-right-style"
        | "border-bottom-style"
        | "border-left-style" => {
            if value != "solid" {
                return Err(Unmapped::UnsupportedValue);
            }
        }
        "flex" => {
            // Only the `<grow> <shrink> <basis>` long form appears. Stage all
            // conversions before mutating: an unsupported basis rejects the
            // entire shorthand instead of leaking grow/shrink partial state.
            let mut parts = value.split_whitespace();
            let grow: f32 = parse_part(parts.next())?;
            let shrink: f32 = parse_part(parts.next())?;
            let basis = parts.next().ok_or(Unmapped::UnsupportedValue)?;
            if parts.next().is_some() {
                return Err(Unmapped::UnsupportedValue);
            }
            let basis = to_length(length(basis)?)?;
            style.flex_grow = Some(grow);
            style.flex_shrink = Some(shrink);
            style.flex_basis = Some(basis);
        }
        "position" => match value {
            "relative" => style.position = Some(Position::Relative),
            "absolute" => style.position = Some(Position::Absolute),
            // GPUI has no Static or viewport-Fixed variant; claiming either
            // maps to Relative/Absolute changes containing-block behavior.
            "static" | "fixed" => return Err(Unmapped::UnsupportedValue),
            _ => return Err(Unmapped::UnsupportedValue),
        },
        "width" => style.size.width = Some(to_length(length(value)?)?),
        "height" => style.size.height = Some(to_length(length(value)?)?),
        "min-width" => style.min_size.width = Some(to_length(length(value)?)?),
        "min-height" => style.min_size.height = Some(to_length(length(value)?)?),
        "max-width" => style.max_size.width = Some(to_length(length(value)?)?),
        "max-height" => style.max_size.height = Some(to_length(length(value)?)?),
        "top" | "right" | "bottom" | "left" => match inset_mode {
            // CSS insets have no effect under the default/static position.
            InsetMode::Inert => {}
            InsetMode::Unsupported => return Err(Unmapped::UnsupportedValue),
            InsetMode::Positioned => {
                let edge = to_length(length(value)?)?;
                match property {
                    "top" => style.inset.top = Some(edge),
                    "right" => style.inset.right = Some(edge),
                    "bottom" => style.inset.bottom = Some(edge),
                    _ => style.inset.left = Some(edge),
                }
            }
        },
        "inset" => match inset_mode {
            InsetMode::Inert => {}
            InsetMode::Unsupported => return Err(Unmapped::UnsupportedValue),
            InsetMode::Positioned => {
                let edge = to_length(length(value)?)?;
                style.inset.top = Some(edge);
                style.inset.right = Some(edge);
                style.inset.bottom = Some(edge);
                style.inset.left = Some(edge);
            }
        },
        "padding" => {
            let edge = to_definite(length(value)?)?;
            style.padding.top = Some(edge);
            style.padding.right = Some(edge);
            style.padding.bottom = Some(edge);
            style.padding.left = Some(edge);
        }
        "padding-inline" => {
            let edge = to_definite(length(value)?)?;
            style.padding.left = Some(edge);
            style.padding.right = Some(edge);
        }
        "padding-block" => {
            let edge = to_definite(length(value)?)?;
            style.padding.top = Some(edge);
            style.padding.bottom = Some(edge);
        }
        "padding-top" | "padding-right" | "padding-bottom" | "padding-left" => {
            let edge = to_definite(length(value)?)?;
            match property {
                "padding-top" => style.padding.top = Some(edge),
                "padding-right" => style.padding.right = Some(edge),
                "padding-bottom" => style.padding.bottom = Some(edge),
                _ => style.padding.left = Some(edge),
            }
        }
        "gap" => {
            let edge = to_definite(length(value)?)?;
            style.gap.width = Some(edge);
            style.gap.height = Some(edge);
        }
        "border-width" => {
            let edge = to_absolute(length(value)?)?;
            style.border_widths.top = Some(edge);
            style.border_widths.right = Some(edge);
            style.border_widths.bottom = Some(edge);
            style.border_widths.left = Some(edge);
        }
        "border-top-width" | "border-right-width" | "border-bottom-width" | "border-left-width" => {
            let edge = to_absolute(length(value)?)?;
            match property {
                "border-top-width" => style.border_widths.top = Some(edge),
                "border-right-width" => style.border_widths.right = Some(edge),
                "border-bottom-width" => style.border_widths.bottom = Some(edge),
                _ => style.border_widths.left = Some(edge),
            }
        }
        "border-color" => style.border_color = Some(color(value)?),
        "border-radius" => {
            let corner = to_absolute(length(value)?)?;
            style.corner_radii.top_left = Some(corner);
            style.corner_radii.top_right = Some(corner);
            style.corner_radii.bottom_left = Some(corner);
            style.corner_radii.bottom_right = Some(corner);
        }
        "background-color" => style.background = Some(Fill::Color(color(value)?.into())),
        "color" => style.text.color = Some(color(value)?),
        "font-size" => style.text.font_size = Some(to_absolute(length(value)?)?),
        "line-height" => {
            // A unitless line-height multiplies the font size. GPUI resolves
            // `DefiniteLength::Fraction` against the font size in exactly this
            // position (`Style::line_height_in_pixels`), so the two agree.
            style.text.line_height = Some(match value.parse::<f32>() {
                Ok(multiple) => DefiniteLength::Fraction(multiple),
                Err(_) => to_definite(length(value)?)?,
            });
        }
        "font-weight" => {
            let weight: f32 = value.parse().map_err(|_| Unmapped::UnsupportedValue)?;
            style.text.font_weight = Some(gpui::FontWeight(weight));
        }
        "font-family" => {
            let mut families = parse_font_families(value)?;
            let primary = families.remove(0);
            style.text.font_family = Some(primary.into());
            style.text.font_fallbacks = if families.is_empty() {
                None
            } else {
                Some(FontFallbacks::from_fonts(families))
            };
        }
        "opacity" => style.opacity = Some(value.parse().map_err(|_| Unmapped::UnsupportedValue)?),
        "aspect-ratio" => {
            let (width, height) = value.split_once('/').ok_or(Unmapped::UnsupportedValue)?;
            let ratio = width
                .trim()
                .parse::<f32>()
                .map_err(|_| Unmapped::UnsupportedValue)?
                / height
                    .trim()
                    .parse::<f32>()
                    .map_err(|_| Unmapped::UnsupportedValue)?;
            style.aspect_ratio = Some(ratio);
        }
        "flex-direction" => match value {
            "row" => style.flex_direction = Some(FlexDirection::Row),
            "column" => style.flex_direction = Some(FlexDirection::Column),
            "row-reverse" => style.flex_direction = Some(FlexDirection::RowReverse),
            "column-reverse" => style.flex_direction = Some(FlexDirection::ColumnReverse),
            _ => return Err(Unmapped::UnsupportedValue),
        },
        "align-items" => match value {
            "center" => style.align_items = Some(AlignItems::Center),
            "flex-start" => style.align_items = Some(AlignItems::FlexStart),
            "start" => style.align_items = Some(AlignItems::Start),
            "flex-end" => style.align_items = Some(AlignItems::FlexEnd),
            "end" => style.align_items = Some(AlignItems::End),
            "baseline" => style.align_items = Some(AlignItems::Baseline),
            "stretch" => style.align_items = Some(AlignItems::Stretch),
            _ => return Err(Unmapped::UnsupportedValue),
        },
        "justify-content" => match value {
            "center" => style.justify_content = Some(JustifyContent::Center),
            "flex-start" => style.justify_content = Some(JustifyContent::FlexStart),
            "start" => style.justify_content = Some(JustifyContent::Start),
            "flex-end" => style.justify_content = Some(JustifyContent::FlexEnd),
            "end" => style.justify_content = Some(JustifyContent::End),
            "space-between" => style.justify_content = Some(JustifyContent::SpaceBetween),
            "space-around" => style.justify_content = Some(JustifyContent::SpaceAround),
            _ => return Err(Unmapped::UnsupportedValue),
        },
        "flex-shrink" => {
            style.flex_shrink = Some(value.parse().map_err(|_| Unmapped::UnsupportedValue)?)
        }
        "overflow-x" | "overflow-y" | "overflow" => {
            let overflow = match value {
                "visible" => Overflow::Visible,
                "hidden" => Overflow::Hidden,
                "clip" => Overflow::Clip,
                "scroll" => Overflow::Scroll,
                "auto" => return Err(Unmapped::UnsupportedValue),
                _ => return Err(Unmapped::UnsupportedValue),
            };
            if property != "overflow-y" {
                style.overflow.x = Some(overflow);
            }
            if property != "overflow-x" {
                style.overflow.y = Some(overflow);
            }
        }
        "cursor" => {
            let cursor = match value {
                "pointer" => CursorStyle::PointingHand,
                "default" => CursorStyle::Arrow,
                "not-allowed" => CursorStyle::OperationNotAllowed,
                "text" => CursorStyle::IBeam,
                _ => return Err(Unmapped::UnsupportedValue),
            };
            style.mouse_cursor = Some(cursor);
        }
        _ => return Err(Unmapped::UnknownProperty),
    }
    Ok(())
}

fn parse_part(part: Option<&str>) -> Result<f32, Unmapped> {
    part.ok_or(Unmapped::UnsupportedValue)?
        .parse()
        .map_err(|_| Unmapped::UnsupportedValue)
}

fn parse_font_families(value: &str) -> Result<Vec<String>, Unmapped> {
    let mut families = Vec::new();
    let mut current = String::new();
    let mut quote = None;

    for character in value.chars() {
        if let Some(delimiter) = quote {
            if character == delimiter {
                quote = None;
            } else if character == '\\' {
                // CSS escapes are outside the recorded fixture grammar.
                return Err(Unmapped::UnsupportedValue);
            } else {
                current.push(character);
            }
        } else {
            match character {
                '\'' | '"' if current.trim().is_empty() => quote = Some(character),
                '\'' | '"' => return Err(Unmapped::UnsupportedValue),
                ',' => {
                    let family = current.trim();
                    if family.is_empty() {
                        return Err(Unmapped::UnsupportedValue);
                    }
                    families.push(family.to_string());
                    current.clear();
                }
                _ => current.push(character),
            }
        }
    }

    if quote.is_some() {
        return Err(Unmapped::UnsupportedValue);
    }
    let family = current.trim();
    if family.is_empty() {
        return Err(Unmapped::UnsupportedValue);
    }
    families.push(family.to_string());
    Ok(families)
}

fn to_hsla(rgba: proto_ui_style::Rgba) -> Hsla {
    gpui::Rgba {
        r: rgba.r,
        g: rgba.g,
        b: rgba.b,
        a: rgba.a,
    }
    .into()
}

/// A percentage becomes a fraction; GPUI resolves it against the parent, which
/// is the basis this layer deliberately does not assume.
fn to_length(dimension: Dimension) -> Result<Length, Unmapped> {
    to_definite(dimension).map(Length::Definite)
}

/// GPUI's `DefiniteLength` is an absolute length or a fraction of the parent,
/// never the sum of the two. A mixed value such as `calc(100% - 1px)` has no
/// exact GPUI form, so it is reported rather than truncated: dropping either
/// part changes the geometry while the declaration claims to have applied.
fn to_definite(dimension: Dimension) -> Result<DefiniteLength, Unmapped> {
    if dimension.is_absolute() {
        return Ok(DefiniteLength::Absolute(AbsoluteLength::Pixels(px(
            dimension.px,
        ))));
    }
    if dimension.px != 0.0 {
        return Err(Unmapped::UnsupportedValue);
    }
    Ok(DefiniteLength::Fraction(dimension.percent / 100.0))
}

fn to_absolute(dimension: Dimension) -> Result<AbsoluteLength, Unmapped> {
    dimension
        .is_absolute()
        .then(|| AbsoluteLength::Pixels(px(dimension.px)))
        // A percentage has no absolute form; GPUI needs one here.
        .ok_or(Unmapped::UnsupportedValue)
}

/// A reason one token list did not become a complete style.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StyleIssue {
    /// The vocabulary has no such token.
    UnknownToken(String),
    /// A declaration names a design-language variable the theme does not
    /// define, so it cannot be painted.
    UnresolvedVariable { property: String, variable: String },
    /// A declaration's variable chain was too deep to follow, as a cycle
    /// makes it.
    SubstitutionTooDeep { property: String },
    /// A declaration reached the map and did not map.
    Unmapped {
        property: String,
        value: String,
        reason: Unmapped,
    },
}

/// A style built from tokens, with everything that did not make it.
#[derive(Debug, Clone, Default)]
pub struct TokenStyle {
    pub refinement: StyleRefinement,
    pub issues: Vec<StyleIssue>,
}

/// Resolves a token list in cascade order, substitutes the design language's
/// theme, and maps the result onto GPUI.
///
/// `theme` is `None` for a Prototype with no design language, such as the
/// Base family; a declaration that still references a theme variable is then
/// reported rather than painted with a guess.
pub fn style_for_tokens<'a>(
    tokens: impl IntoIterator<Item = &'a str>,
    theme: Option<&proto_ui_style::Theme>,
    context: LengthContext,
) -> TokenStyle {
    let mut resolved = proto_ui_style::vocabulary().resolve_all(tokens);
    let mut issues: Vec<StyleIssue> = resolved
        .unknown
        .iter()
        .map(|token| StyleIssue::UnknownToken(token.clone()))
        .collect();

    let mut unresolved = Vec::new();
    for (property, value) in resolved.declarations.iter_mut() {
        let substitution = match theme {
            Some(theme) => theme.substitute(value),
            None if value.contains("var(") => proto_ui_style::Substitution::Missing {
                variable: value.clone(),
            },
            None => continue,
        };
        match substitution {
            proto_ui_style::Substitution::Resolved(text) => *value = text,
            proto_ui_style::Substitution::Missing { variable } => {
                unresolved.push(property.clone());
                issues.push(StyleIssue::UnresolvedVariable {
                    property: property.clone(),
                    variable,
                });
            }
            proto_ui_style::Substitution::TooDeep => {
                unresolved.push(property.clone());
                issues.push(StyleIssue::SubstitutionTooDeep {
                    property: property.clone(),
                });
            }
        }
    }
    // A declaration whose variable did not resolve is reported above and not
    // handed to the map, which would only report it a second time.
    for property in unresolved {
        resolved.declarations.remove(&property);
    }

    let mapped = map(&resolved, context);
    issues.extend(
        mapped
            .unmapped
            .into_iter()
            .filter(|(_, _, reason)| *reason != Unmapped::ComposedInput)
            .map(|(property, value, reason)| StyleIssue::Unmapped {
                property,
                value,
                reason,
            }),
    );
    TokenStyle {
        refinement: mapped.refinement,
        issues,
    }
}
