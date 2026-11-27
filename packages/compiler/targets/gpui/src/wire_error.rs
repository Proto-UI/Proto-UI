use crate::ir::Source;
use serde::Deserialize;
use serde_json::value::RawValue;
use std::collections::HashMap;

#[derive(Deserialize)]
struct BoundLocation {
    source: Source,
}

#[derive(Deserialize)]
struct Location {
    source: Option<Source>,
    binding: Option<BoundLocation>,
}

fn original_source(input: &[u8], error: &serde_json::Error) -> Option<Source> {
    let mut node: &RawValue = serde_json::from_slice(input).ok()?;
    let line_start: usize = input.split_inclusive(|&byte| byte == b'\n')
        .take(error.line().saturating_sub(1)).map(<[u8]>::len).sum();
    let byte = input.get(line_start + error.column().saturating_sub(1)).map(std::ptr::from_ref);
    let contains_error = |value: &&RawValue| {
        byte.is_some_and(|at| value.get().as_bytes().as_ptr_range().contains(&at))
    };

    // The primary map-only decode has already rejected these bytes. Borrowed
    // RawValues retain their exact byte ranges in the original input. Walk only
    // enclosing values so a neighboring instruction cannot supply its source.
    let mut location = None;
    loop {
        let text = node.get();
        let child = match text.as_bytes().first() {
            Some(b'{') => {
                if let Ok(site) = serde_json::from_str::<Location>(text) {
                    if let Some(source) = site.source.or_else(|| site.binding.map(|b| b.source)) {
                        if !source.file.is_empty() && source.start <= source.end {
                            location = Some(source);
                        }
                    }
                }
                let members: HashMap<String, &RawValue> = serde_json::from_str(text).ok()?;
                members.into_values().find(contains_error)
            }
            Some(b'[') => {
                let members: Vec<&RawValue> = serde_json::from_str(text).ok()?;
                members.into_iter().find(contains_error)
            }
            _ => None,
        };
        match child {
            Some(child) => node = child,
            None => return location,
        }
    }
}

pub fn diagnostic(input: &[u8], error: serde_json::Error) -> String {
    let location = original_source(input, &error).map(|at| format!("{at}: ")).unwrap_or_default();
    format!("{location}invalid-ir: GPUI wire format: {error}")
}
