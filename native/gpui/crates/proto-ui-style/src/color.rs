//! Parses the colour forms the recorded vocabulary and themes actually use.
//!
//! The fixtures were surveyed rather than guessed: across every token
//! declaration and every theme variable the only colour syntaxes present are
//! hex, `rgb()`/`rgba()` in both comma and slash form, CSS `lab()`, and
//! `color-mix(in oklab, <colour> <percent>, transparent)`. Anything else is
//! reported rather than approximated, and `parses_every_colour_in_the_fixtures`
//! fails if a new form appears.
//!
//! Lab input lightness is clamped to CSS Color 4's 0..100 range. For intermediate
//! Lab lightness that converts outside sRGB, this parser uses CSS Color 4
//! §14.2.1 Binary Search Gamut Mapping with Local MINDE, targeting sRGB.

/// Non-premultiplied sRGB with components in `0.0..=1.0`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Rgba {
    pub r: f32,
    pub g: f32,
    pub b: f32,
    pub a: f32,
}

impl Rgba {
    pub const fn new(r: f32, g: f32, b: f32, a: f32) -> Self {
        Self { r, g, b, a }
    }

    pub const TRANSPARENT: Self = Self::new(0.0, 0.0, 0.0, 0.0);

    /// Rounded 8-bit components, for comparing against authored hex.
    pub fn to_rgba8(self) -> [u8; 4] {
        [
            (self.r.clamp(0.0, 1.0) * 255.0).round() as u8,
            (self.g.clamp(0.0, 1.0) * 255.0).round() as u8,
            (self.b.clamp(0.0, 1.0) * 255.0).round() as u8,
            (self.a.clamp(0.0, 1.0) * 255.0).round() as u8,
        ]
    }
}

/// A colour value, which is not always a colour.
///
/// `currentColor` resolves against the inherited text colour rather than the
/// theme, so it cannot be reduced to `Rgba` here. Every Lucide icon depends on
/// it — the shapes are authored with `stroke: currentColor` — so collapsing it
/// into a fixed colour would paint every icon the wrong shade rather than
/// inheriting one.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ColorValue {
    Rgba(Rgba),
    CurrentColor,
}

impl ColorValue {
    /// The concrete colour, given whatever the host resolved for the current
    /// text colour.
    pub fn resolve(self, current: Rgba) -> Rgba {
        match self {
            Self::Rgba(rgba) => rgba,
            Self::CurrentColor => current,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ColorError {
    /// The value is not one of the recorded colour forms.
    Unsupported(String),
    /// The form was recognised but its contents did not parse.
    Malformed(String),
}

/// Parses one colour value. The input must already have had its `var()`
/// references substituted; an unresolved reference is `Unsupported`.
pub fn parse(value: &str) -> Result<ColorValue, ColorError> {
    let text = value.trim();
    if text.eq_ignore_ascii_case("currentcolor") {
        return Ok(ColorValue::CurrentColor);
    }
    parse_rgba(text).map(ColorValue::Rgba)
}

/// Parses a value that must resolve to a concrete colour.
pub fn parse_rgba(value: &str) -> Result<Rgba, ColorError> {
    let text = value.trim();
    if text.eq_ignore_ascii_case("transparent") {
        return Ok(Rgba::TRANSPARENT);
    }
    if let Some(hex) = text.strip_prefix('#') {
        return parse_hex(hex, text);
    }
    if let Some(rest) = strip_function(text, "color-mix") {
        return parse_color_mix(rest, text);
    }
    if let Some(rest) = strip_function(text, "lab") {
        return parse_lab(rest, text);
    }
    for name in ["rgba", "rgb"] {
        if let Some(rest) = strip_function(text, name) {
            return parse_rgb(rest, text);
        }
    }
    Err(ColorError::Unsupported(text.to_string()))
}

fn strip_function<'a>(text: &'a str, name: &str) -> Option<&'a str> {
    let rest = text.strip_prefix(name)?.strip_prefix('(')?;
    rest.strip_suffix(')')
}

fn parse_hex(hex: &str, original: &str) -> Result<Rgba, ColorError> {
    let malformed = || ColorError::Malformed(original.to_string());
    let digits: Vec<u8> = hex
        .chars()
        .map(|c| c.to_digit(16).map(|d| d as u8))
        .collect::<Option<Vec<u8>>>()
        .ok_or_else(malformed)?;
    let expand = |value: u8| f32::from(value * 17) / 255.0;
    let pair = |high: u8, low: u8| f32::from(high * 16 + low) / 255.0;
    match digits.len() {
        3 => Ok(Rgba::new(
            expand(digits[0]),
            expand(digits[1]),
            expand(digits[2]),
            1.0,
        )),
        4 => Ok(Rgba::new(
            expand(digits[0]),
            expand(digits[1]),
            expand(digits[2]),
            expand(digits[3]),
        )),
        6 => Ok(Rgba::new(
            pair(digits[0], digits[1]),
            pair(digits[2], digits[3]),
            pair(digits[4], digits[5]),
            1.0,
        )),
        8 => Ok(Rgba::new(
            pair(digits[0], digits[1]),
            pair(digits[2], digits[3]),
            pair(digits[4], digits[5]),
            pair(digits[6], digits[7]),
        )),
        _ => Err(malformed()),
    }
}

/// Reads one channel, accepting `0..255`, a percentage, or a bare alpha.
fn channel(raw: &str, scale: f32, original: &str) -> Result<f32, ColorError> {
    let text = raw.trim();
    let malformed = || ColorError::Malformed(original.to_string());
    let value = if let Some(percent) = text.strip_suffix('%') {
        percent.trim().parse::<f32>().map_err(|_| malformed())? / 100.0
    } else {
        text.parse::<f32>().map_err(|_| malformed())? / scale
    };
    if !value.is_finite() {
        return Err(malformed());
    }
    // This API returns concrete sRGB components, so CSS's out-of-range
    // encoded values are clamped to the representable destination range.
    Ok(value.clamp(0.0, 1.0))
}

fn parse_rgb(rest: &str, original: &str) -> Result<Rgba, ColorError> {
    // Both `r, g, b, a` and `r g b / a` occur in the recorded values.
    let (body, alpha) = match rest.split_once('/') {
        Some((body, alpha)) => (body, Some(alpha)),
        None => (rest, None),
    };
    let parts: Vec<&str> = if body.contains(',') {
        body.split(',').collect()
    } else {
        body.split_whitespace().collect()
    };
    let malformed = || ColorError::Malformed(original.to_string());
    if parts.len() < 3 || parts.len() > 4 {
        return Err(malformed());
    }
    let r = channel(parts[0], 255.0, original)?;
    let g = channel(parts[1], 255.0, original)?;
    let b = channel(parts[2], 255.0, original)?;
    let a = match (parts.get(3), alpha) {
        (Some(_), Some(_)) => return Err(malformed()),
        (Some(value), None) => channel(value, 1.0, original)?,
        (None, Some(value)) => channel(value, 1.0, original)?,
        (None, None) => 1.0,
    };
    Ok(Rgba::new(r, g, b, a))
}

fn parse_lab(rest: &str, original: &str) -> Result<Rgba, ColorError> {
    let malformed = || ColorError::Malformed(original.to_string());
    // `lab()` takes the same optional `/ alpha` as `rgb()`; the Shadcn dark
    // theme uses it for translucent borders.
    let (body, alpha) = match rest.split_once('/') {
        Some((body, alpha)) => (body, Some(alpha)),
        None => (rest, None),
    };
    let parts: Vec<&str> = body.split_whitespace().collect();
    if parts.len() != 3 {
        return Err(malformed());
    }
    // In `lab()` the lightness is on a 0..100 scale and the `%` is notation,
    // not a fraction: `lab(100% 0 0)` is L=100, not L=1.
    let lightness = parts[0]
        .trim()
        .trim_end_matches('%')
        .parse::<f32>()
        .map_err(|_| malformed())?;
    let a = parts[1].parse::<f32>().map_err(|_| malformed())?;
    let b = parts[2].parse::<f32>().map_err(|_| malformed())?;
    if !lightness.is_finite() || !a.is_finite() || !b.is_finite() {
        return Err(malformed());
    }
    let mut color = lab_to_srgb(lightness, a, b, original)?;
    if let Some(alpha) = alpha {
        color.a = channel(alpha, 1.0, original)?;
    }
    Ok(color)
}

/// `color-mix(in oklab, <colour> <percent>, transparent)`.
///
/// Every recorded use mixes against `transparent`. Premultiplied mixing with
/// a fully transparent colour keeps the first colour's channels and scales its
/// alpha, so this is alpha attenuation rather than a hue change. A mix against
/// anything else is reported instead of approximated.
fn parse_color_mix(rest: &str, original: &str) -> Result<Rgba, ColorError> {
    let malformed = || ColorError::Malformed(original.to_string());
    let mut parts = rest.splitn(3, ',');
    let space = parts.next().ok_or_else(malformed)?.trim();
    if !space.eq_ignore_ascii_case("in oklab") {
        return Err(ColorError::Unsupported(original.to_string()));
    }
    let first = parts.next().ok_or_else(malformed)?.trim();
    let second = parts.next().ok_or_else(malformed)?.trim();
    if !second.eq_ignore_ascii_case("transparent") {
        return Err(ColorError::Unsupported(original.to_string()));
    }
    let (color_text, percent_text) = first.rsplit_once(' ').ok_or_else(malformed)?;
    let percent = percent_text
        .trim()
        .strip_suffix('%')
        .ok_or_else(malformed)?
        .parse::<f32>()
        .map_err(|_| malformed())?;
    if !percent.is_finite() || !(0.0..=100.0).contains(&percent) {
        return Err(malformed());
    }
    let color = parse_rgba(color_text.trim())?;
    Ok(Rgba::new(
        color.r,
        color.g,
        color.b,
        color.a * (percent / 100.0),
    ))
}

// --- colour science -------------------------------------------------------

const D50_WHITE: [f32; 3] = [0.964_295_7, 1.0, 0.825_104_6];
const EPSILON: f32 = 216.0 / 24389.0;
const KAPPA: f32 = 24389.0 / 27.0;

/// Bradford-adapted D50 to D65, then XYZ(D65) to linear sRGB, per CSS Color 4.
const D50_TO_D65: [[f32; 3]; 3] = [
    [0.955_473_4, -0.023_098_5, 0.063_259_3],
    [-0.028_369_7, 1.009_995_5, 0.021_041_4],
    [0.012_314_0, -0.020_507_7, 1.330_365_9],
];

const XYZ_D65_TO_LINEAR_SRGB: [[f32; 3]; 3] = [
    [3.240_97, -1.537_383_2, -0.498_610_8],
    [-0.969_243_6, 1.875_967_5, 0.041_555_1],
    [0.055_630_1, -0.203_977, 1.056_971_5],
];

fn multiply(matrix: [[f32; 3]; 3], vector: [f32; 3]) -> [f32; 3] {
    let mut out = [0.0f32; 3];
    for (row, coefficients) in matrix.iter().enumerate() {
        out[row] = coefficients
            .iter()
            .zip(vector.iter())
            .map(|(c, v)| c * v)
            .sum();
    }
    out
}

fn lab_to_srgb(lightness: f32, a: f32, b: f32, original: &str) -> Result<Rgba, ColorError> {
    // CSS Color 4 clamps Lab lightness before gamut mapping; its endpoints map
    // to display black/white regardless of the chroma coordinates.
    let lightness = lightness.clamp(0.0, 100.0);
    if lightness == 0.0 {
        return Ok(Rgba::new(0.0, 0.0, 0.0, 1.0));
    }
    if lightness == 100.0 {
        return Ok(Rgba::new(1.0, 1.0, 1.0, 1.0));
    }

    let f1 = (lightness + 16.0) / 116.0;
    let f0 = a / 500.0 + f1;
    let f2 = f1 - b / 200.0;

    let cube = |f: f32| {
        let cubed = f * f * f;
        if cubed > EPSILON {
            cubed
        } else {
            (116.0 * f - 16.0) / KAPPA
        }
    };
    let y = if lightness > KAPPA * EPSILON {
        f1 * f1 * f1
    } else {
        lightness / KAPPA
    };
    let xyz_d50 = [
        cube(f0) * D50_WHITE[0],
        y * D50_WHITE[1],
        cube(f2) * D50_WHITE[2],
    ];
    let linear = multiply(XYZ_D65_TO_LINEAR_SRGB, multiply(D50_TO_D65, xyz_d50));
    if linear.iter().any(|component| !component.is_finite()) {
        return Err(ColorError::Unsupported(original.to_string()));
    }
    if in_srgb_gamut(linear) {
        return Ok(encode_linear_srgb(linear));
    }
    gamut_map_srgb(linear).map_err(|()| ColorError::Unsupported(original.to_string()))
}

/// CSS Color 4 §14.2.1 binary-search gamut mapping with local MINDE.
fn gamut_map_srgb(origin: [f32; 3]) -> Result<Rgba, ()> {
    const JND: f32 = 0.02;
    const EPSILON: f32 = 0.0001;

    let origin_lab = linear_srgb_to_oklab(origin);
    if origin_lab.iter().any(|component| !component.is_finite()) {
        return Err(());
    }
    let chroma = origin_lab[1].hypot(origin_lab[2]);
    let hue = origin_lab[2].atan2(origin_lab[1]);
    let mut clipped = clip_srgb(origin);
    if delta_e_ok(origin_lab, linear_srgb_to_oklab(clipped)) < JND {
        return Ok(encode_linear_srgb(clipped));
    }

    let mut minimum = 0.0;
    let mut maximum = chroma;
    let mut minimum_is_in_gamut = true;
    while maximum - minimum > EPSILON {
        let candidate_chroma = (minimum + maximum) / 2.0;
        let candidate_lab = [
            origin_lab[0],
            candidate_chroma * hue.cos(),
            candidate_chroma * hue.sin(),
        ];
        let candidate_rgb = oklab_to_linear_srgb(candidate_lab);
        if minimum_is_in_gamut && in_srgb_gamut(candidate_rgb) {
            minimum = candidate_chroma;
            continue;
        }

        let candidate_clipped = clip_srgb(candidate_rgb);
        let difference = delta_e_ok(candidate_lab, linear_srgb_to_oklab(candidate_clipped));
        clipped = candidate_clipped;
        if difference < JND {
            if JND - difference < EPSILON {
                return Ok(encode_linear_srgb(candidate_clipped));
            }
            minimum_is_in_gamut = false;
            minimum = candidate_chroma;
        } else {
            maximum = candidate_chroma;
        }
    }

    Ok(encode_linear_srgb(clipped))
}

fn in_srgb_gamut(rgb: [f32; 3]) -> bool {
    rgb.iter()
        .all(|component| component.is_finite() && (0.0..=1.0).contains(component))
}

fn clip_srgb(rgb: [f32; 3]) -> [f32; 3] {
    rgb.map(|component| component.clamp(0.0, 1.0))
}

fn encode_linear_srgb(rgb: [f32; 3]) -> Rgba {
    let encode = |component: f32| {
        if component <= 0.003_130_8 {
            12.92 * component
        } else {
            1.055 * component.powf(1.0 / 2.4) - 0.055
        }
    };
    Rgba::new(encode(rgb[0]), encode(rgb[1]), encode(rgb[2]), 1.0)
}

fn linear_srgb_to_oklab(rgb: [f32; 3]) -> [f32; 3] {
    let l = (0.412_221_46 * rgb[0] + 0.536_332_55 * rgb[1] + 0.051_445_995 * rgb[2]).cbrt();
    let m = (0.211_903_5 * rgb[0] + 0.680_699_5 * rgb[1] + 0.107_396_96 * rgb[2]).cbrt();
    let s = (0.088_302_46 * rgb[0] + 0.281_718_85 * rgb[1] + 0.629_978_7 * rgb[2]).cbrt();
    [
        0.210_454_26 * l + 0.793_617_8 * m - 0.004_072_047 * s,
        1.977_998_5 * l - 2.428_592_2 * m + 0.450_593_7 * s,
        0.025_904_037 * l + 0.782_771_77 * m - 0.808_675_77 * s,
    ]
}

fn oklab_to_linear_srgb(lab: [f32; 3]) -> [f32; 3] {
    let l = lab[0] + 0.396_337_78 * lab[1] + 0.215_803_76 * lab[2];
    let m = lab[0] - 0.105_561_346 * lab[1] - 0.063_854_17 * lab[2];
    let s = lab[0] - 0.089_484_18 * lab[1] - 1.291_485_5 * lab[2];
    let l = l * l * l;
    let m = m * m * m;
    let s = s * s * s;
    [
        4.076_741_7 * l - 3.307_711_6 * m + 0.230_969_94 * s,
        -1.268_438 * l + 2.609_757_4 * m - 0.341_319_38 * s,
        -0.004_196_086_3 * l - 0.703_418_6 * m + 1.707_614_7 * s,
    ]
}

fn delta_e_ok(left: [f32; 3], right: [f32; 3]) -> f32 {
    ((left[0] - right[0]).powi(2) + (left[1] - right[1]).powi(2) + (left[2] - right[2]).powi(2))
        .sqrt()
}
