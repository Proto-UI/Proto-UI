use gpui::{
    Bounds, DevicePixels, Font, FontId, FontMetrics, FontRun, GlyphId, LineLayout, NoopTextSystem,
    Pixels, PlatformTextSystem, RenderGlyphParams, Size, TextRenderingMode,
};
use std::{borrow::Cow, sync::Mutex};

/// Records the text that the mounted native elements submit for layout. Every
/// font operation, including shaping, uses GPUI's standard headless text system.
#[derive(Default)]
pub struct ObservedText {
    lines: Mutex<Vec<String>>,
}

impl ObservedText {
    pub fn expect_layout(&self, expected: &str) {
        let lines = std::mem::take(&mut *self.lines.lock().unwrap());
        assert!(
            lines.iter().any(|line| line == expected),
            "expected layout of {expected:?}, got {lines:?}"
        );
    }
}

impl PlatformTextSystem for ObservedText {
    fn add_fonts(&self, fonts: Vec<Cow<'static, [u8]>>) -> gpui::Result<()> {
        NoopTextSystem.add_fonts(fonts)
    }

    fn all_font_names(&self) -> Vec<String> {
        NoopTextSystem.all_font_names()
    }

    fn font_id(&self, descriptor: &Font) -> gpui::Result<FontId> {
        NoopTextSystem.font_id(descriptor)
    }

    fn font_metrics(&self, font: FontId) -> FontMetrics {
        NoopTextSystem.font_metrics(font)
    }

    fn typographic_bounds(&self, font: FontId, glyph: GlyphId) -> gpui::Result<Bounds<f32>> {
        NoopTextSystem.typographic_bounds(font, glyph)
    }

    fn advance(&self, font: FontId, glyph: GlyphId) -> gpui::Result<Size<f32>> {
        NoopTextSystem.advance(font, glyph)
    }

    fn glyph_for_char(&self, font: FontId, ch: char) -> Option<GlyphId> {
        NoopTextSystem.glyph_for_char(font, ch)
    }

    fn glyph_raster_bounds(&self, params: &RenderGlyphParams) -> gpui::Result<Bounds<DevicePixels>> {
        NoopTextSystem.glyph_raster_bounds(params)
    }

    fn rasterize_glyph(
        &self,
        params: &RenderGlyphParams,
        bounds: Bounds<DevicePixels>,
    ) -> gpui::Result<(Size<DevicePixels>, Vec<u8>)> {
        NoopTextSystem.rasterize_glyph(params, bounds)
    }

    fn layout_line(&self, text: &str, size: Pixels, runs: &[FontRun]) -> LineLayout {
        self.lines.lock().unwrap().push(text.to_owned());
        NoopTextSystem.layout_line(text, size, runs)
    }

    fn recommended_rendering_mode(&self, font: FontId, size: Pixels) -> TextRenderingMode {
        NoopTextSystem.recommended_rendering_mode(font, size)
    }
}
