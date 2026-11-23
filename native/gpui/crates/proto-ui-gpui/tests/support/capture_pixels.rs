//! Content evidence for the two deliberately high-contrast Label fixtures.
//! This checks the captured pixels, not the accessibility tree or file size.
//! Window chrome and the fixture's outer edges never count as text ink.

pub const LABEL_WIDTH: f64 = 300.0;
pub const LABEL_HEIGHT: f64 = 64.0;
pub const LABEL_PADDING: f64 = 16.0;
pub const LABEL_FONT_SIZE: f64 = 16.0;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Rect {
    pub x: usize,
    pub y: usize,
    pub width: usize,
    pub height: usize,
}

impl Rect {
    fn fits(self, width: usize, height: usize) -> bool {
        self.width > 0
            && self.height > 0
            && self.x.checked_add(self.width).is_some_and(|x| x <= width)
            && self.y.checked_add(self.height).is_some_and(|y| y <= height)
    }
}

/// AppKit window coordinates have a bottom-left origin. Captured image rows
/// have a top-left origin. The actual content-view rect supplies the titlebar
/// offset; no fixed titlebar height or display scale is assumed.
pub fn content_rect(
    width: usize,
    height: usize,
    scale: f64,
    in_window: [f64; 4],
) -> Result<Rect, String> {
    let [x, y, w, h] = in_window;
    if !scale.is_finite()
        || scale <= 0.0
        || in_window.iter().any(|v| !v.is_finite())
        || x < 0.0
        || y < 0.0
        || w <= 0.0
        || h <= 0.0
    {
        return Err("invalid content-view geometry".into());
    }
    let top = height as f64 - (y + h) * scale;
    if top < 0.0 || (x + w) * scale > width as f64 {
        return Err("content view extends outside the captured window".into());
    }
    let rect = Rect {
        x: (x * scale).round() as usize,
        y: top.round() as usize,
        width: (w * scale).round() as usize,
        height: (h * scale).round() as usize,
    };
    if !rect.fits(width, height) {
        return Err("content view extends outside the captured window".into());
    }
    Ok(rect)
}

#[derive(Debug)]
pub struct LabelPixels {
    pub label: &'static str,
    pub roi: Rect,
    pub background: usize,
    pub ink: usize,
    pub ink_columns: usize,
    pub ink_rows: usize,
    pub segmented_rows: usize,
    pub passed: bool,
}

#[derive(Debug)]
pub struct Report {
    pub content: Rect,
    pub labels: Vec<LabelPixels>,
}

impl Report {
    pub fn passed(&self) -> bool {
        self.labels.len() == 2 && self.labels.iter().all(|label| label.passed)
    }
}

/// `rgba` must be tightly packed RGBA8 with premultiplied alpha, normalized
/// by CoreGraphics. Colorful titlebars, row borders, transparent pixels and a
/// solitary glyph cannot satisfy the two independent caption regions.
pub fn inspect(
    width: usize,
    height: usize,
    rgba: &[u8],
    content: Rect,
    scale: f64,
) -> Result<Report, String> {
    let expected = width.checked_mul(height).and_then(|v| v.checked_mul(4));
    if width == 0 || height == 0 || expected != Some(rgba.len()) {
        return Err("RGBA dimensions or byte length are invalid".into());
    }
    if !content.fits(width, height) || !scale.is_finite() || scale <= 0.0 {
        return Err("content ROI or scale is invalid".into());
    }
    if (content.width as f64 - LABEL_WIDTH * scale).abs() > 1.0
        || (content.height as f64) < 2.0 * LABEL_HEIGHT * scale
    {
        return Err("the two fixed Label fixtures do not fit the content view".into());
    }
    let mut labels = Vec::new();
    for (index, label) in ["passive", "actionable"].into_iter().enumerate() {
        // Exclude the padding and any outer-edge antialiasing. The authored
        // caption is the only dark paint inside each fixture's content box.
        let inset = LABEL_PADDING;
        let roi = Rect {
            x: content.x + (inset * scale).round() as usize,
            y: content.y + ((index as f64 * LABEL_HEIGHT + inset) * scale).round() as usize,
            width: ((LABEL_WIDTH - inset * 2.0) * scale).round() as usize,
            height: ((LABEL_HEIGHT - inset * 2.0) * scale).round() as usize,
        };
        if !roi.fits(width, height)
            || roi.x + roi.width > content.x + content.width
            || roi.y + roi.height > content.y + content.height
        {
            return Err(format!(
                "{label} text ROI is outside the actual content view"
            ));
        }
        let mut background = 0;
        let mut ink = 0;
        let mut columns = vec![false; roi.width];
        let mut rows = vec![false; roi.height];
        let mut segmented_rows = 0;
        for (y, row_has_ink) in rows.iter_mut().enumerate() {
            let mut segments = 0;
            let mut in_ink = false;
            for (x, column_has_ink) in columns.iter_mut().enumerate() {
                let offset = ((roi.y + y) * width + roi.x + x) * 4;
                let pixel = &rgba[offset..offset + 4];
                if pixel[3] < 240 {
                    in_ink = false;
                    continue;
                }
                if pixel[..3].iter().all(|channel| *channel >= 220) {
                    background += 1;
                }
                if pixel[..3].iter().all(|channel| *channel <= 100) {
                    if !in_ink {
                        segments += 1;
                    }
                    in_ink = true;
                    ink += 1;
                    *column_has_ink = true;
                    *row_has_ink = true;
                } else {
                    in_ink = false;
                }
            }
            if segments >= 6 {
                segmented_rows += 1;
            }
        }
        let ink_columns = columns.into_iter().filter(|v| *v).count();
        let ink_rows = rows.into_iter().filter(|v| *v).count();
        let area = roi.width * roi.height;
        let passed = background as f64 >= area as f64 * 0.60
            && ink as f64 >= 32.0 * scale * scale
            && ink as f64 <= area as f64 * 0.25
            && ink_columns as f64 >= 50.0 * scale
            && ink_rows as f64 >= LABEL_FONT_SIZE * 0.375 * scale
            && segmented_rows as f64 >= 3.0 * scale;
        labels.push(LabelPixels {
            label,
            roi,
            background,
            ink,
            ink_columns,
            ink_rows,
            segmented_rows,
            passed,
        });
    }
    Ok(Report { content, labels })
}
