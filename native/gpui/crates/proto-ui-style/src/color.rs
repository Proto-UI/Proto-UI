//! Parses the colour forms the recorded vocabulary and themes actually use.
//!
//! The fixtures were surveyed rather than guessed: across every token
//! declaration and every theme variable the only colour syntaxes present are
//! hex, `rgb()`/`rgba()` in both comma and slash form, CSS `lab()`, and
//! `color-mix(in oklab, <colour> <percent>, transparent)`. Anything else is
//! reported rather than approximated, and `parses_every_colour_in_the_fixtures`
//! fails if a new form appears.
//!
//! Conversion follows CSS Color 4: `lab()` is D50-referred, so coordinates
//! pass through XYZ and Bradford adaptation to D65, then the selected CSS
//! local-MINDE gamut mapper targets sRGB. Parsed RGB/alpha and Lab-lightness
//! values are clamped; Lab `a`/`b` percentages use their CSS reference range.
//! These are ordinary colour-science rules, not Proto UI semantics, so they
//! live here rather than in the fixture generator.

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

/// Parses an RGB channel or alpha and clamps CSS-valid out-of-range values.
fn channel(raw: &str, scale: f32, original: &str) -> Result<f32, ColorError> {
    let text = raw.trim();
    let malformed = || ColorError::Malformed(original.to_string());
    let value = if let Some(percent) = text.strip_suffix('%') {
        percent.trim().parse::<f32>().map_err(|_| malformed())? / 100.0
    } else {
        text.parse::<f32>().map_err(|_| malformed())? / scale
    };
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
        (Some(value), _) => channel(value, 1.0, original)?,
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
    // CSS Color 4 maps L's percentage to [0, 100] and clamps out-of-range
    // values at parse time. Percent a/b values use -100%= -125 and 100%=125.
    let lightness = parts[0]
        .trim()
        .trim_end_matches('%')
        .parse::<f32>()
        .map_err(|_| malformed())?
        .clamp(0.0, 100.0);
    let a = parse_lab_axis(parts[1], original)?;
    let b = parse_lab_axis(parts[2], original)?;
    let mut color = lab_to_srgb(lightness, a, b);
    if let Some(alpha) = alpha {
        color.a = channel(alpha, 1.0, original)?;
    }
    Ok(color)
}

fn parse_lab_axis(raw: &str, original: &str) -> Result<f32, ColorError> {
    let text = raw.trim();
    let malformed = || ColorError::Malformed(original.to_string());
    if let Some(percent) = text.strip_suffix('%') {
        return Ok(percent.trim().parse::<f32>().map_err(|_| malformed())? * 1.25);
    }
    text.parse::<f32>().map_err(|_| malformed())
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

fn lab_to_srgb(lightness: f32, a: f32, b: f32) -> Rgba {
    // CSS Color 4 maps Lab lightness endpoints to destination black/white
    // regardless of the remaining chromatic coordinates.
    if lightness <= 0.0 {
        return Rgba::new(0.0, 0.0, 0.0, 1.0);
    }
    if lightness >= 100.0 {
        return Rgba::new(1.0, 1.0, 1.0, 1.0);
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
    let mapped = gamut_map_srgb(linear);
    let encode = |c: f32| {
        if c <= 0.003_130_8 {
            12.92 * c
        } else {
            1.055 * c.powf(1.0 / 2.4) - 0.055
        }
    };
    Rgba::new(encode(mapped[0]), encode(mapped[1]), encode(mapped[2]), 1.0)
}

/// Converts linear-light sRGB to Oklab, including extended RGB coordinates.
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

/// Converts Oklab to linear-light sRGB before destination gamut mapping.
fn oklab_to_linear_srgb(lab: [f32; 3]) -> [f32; 3] {
    let l = lab[0] + 0.396_337_78 * lab[1] + 0.215_803_76 * lab[2];
    let m = lab[0] - 0.105_561_35 * lab[1] - 0.063_854_17 * lab[2];
    let s = lab[0] - 0.089_484_18 * lab[1] - 1.291_485_5 * lab[2];
    let l = l * l * l;
    let m = m * m * m;
    let s = s * s * s;
    [
        4.076_741_7 * l - 3.307_711_6 * m + 0.230_969_93 * s,
        -1.268_438 * l + 2.609_757_4 * m - 0.341_319_4 * s,
        -0.004_196_086_3 * l - 0.703_418_6 * m + 1.707_614_7 * s,
    ]
}

fn oklch_to_oklab(lch: [f32; 3]) -> [f32; 3] {
    [lch[0], lch[1] * lch[2].cos(), lch[1] * lch[2].sin()]
}

fn in_srgb_gamut(rgb: [f32; 3]) -> bool {
    rgb.iter().all(|channel| (0.0..=1.0).contains(channel))
}

fn clip_srgb(rgb: [f32; 3]) -> [f32; 3] {
    [
        rgb[0].clamp(0.0, 1.0),
        rgb[1].clamp(0.0, 1.0),
        rgb[2].clamp(0.0, 1.0),
    ]
}

fn delta_e_ok(left: [f32; 3], right: [f32; 3]) -> f32 {
    let dl = left[0] - right[0];
    let da = left[1] - right[1];
    let db = left[2] - right[2];
    (dl * dl + da * da + db * db).sqrt()
}

/// CSS Color 4 §14.2.1 binary-search gamut mapping with local MINDE.
///
/// Clip-only conversion creates hue shifts for out-of-gamut Lab colors. This
/// maps along a constant-lightness, constant-hue Oklch path and permits local
/// clipping only below the specified one-JND threshold.
fn gamut_map_srgb(origin_rgb: [f32; 3]) -> [f32; 3] {
    const JND: f32 = 0.02;
    const EPSILON: f32 = 0.0001;

    if in_srgb_gamut(origin_rgb) {
        return origin_rgb;
    }

    let origin_oklab = linear_srgb_to_oklab(origin_rgb);
    let lightness = origin_oklab[0];
    if lightness >= 1.0 {
        return [1.0; 3];
    }
    if lightness <= 0.0 {
        return [0.0; 3];
    }

    let a = origin_oklab[1];
    let b = origin_oklab[2];
    let origin_lch = [lightness, a.hypot(b), b.atan2(a)];
    let mut clipped = clip_srgb(oklab_to_linear_srgb(oklch_to_oklab(origin_lch)));
    let clipped_oklab = linear_srgb_to_oklab(clipped);
    let mut delta = delta_e_ok(origin_oklab, clipped_oklab);
    if delta < JND {
        return clipped;
    }

    let mut min = 0.0;
    let mut max = origin_lch[1];
    let mut min_in_gamut = true;
    while max - min > EPSILON {
        let chroma = (min + max) / 2.0;
        let candidate_lch = [origin_lch[0], chroma, origin_lch[2]];
        let candidate_oklab = oklch_to_oklab(candidate_lch);
        let candidate_rgb = oklab_to_linear_srgb(candidate_oklab);

        if min_in_gamut && in_srgb_gamut(candidate_rgb) {
            min = chroma;
            continue;
        }

        clipped = clip_srgb(candidate_rgb);
        delta = delta_e_ok(candidate_oklab, linear_srgb_to_oklab(clipped));
        if delta < JND {
            if JND - delta < EPSILON {
                return clipped;
            }
            min_in_gamut = false;
            min = chroma;
        } else {
            max = chroma;
        }
    }

    clipped
}
