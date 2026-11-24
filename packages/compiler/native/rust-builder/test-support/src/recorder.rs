// Test-only helper for cyjin-yl/z3rm e5f2f9d GPUI.
// Requires gpui's test-support feature and a direct anyhow dependency.
// This observes real Render -> text layout requests. It does not claim pixel output.
use gpui::{
    Bounds, Context, DevicePixels, Font, FontId, FontMetrics, FontRun, GlyphId, LineLayout,
    NoopTextSystem, Pixels, PlatformTextSystem, Render, RenderGlyphParams, Size, TestApp,
    TestAppWindow, TextRenderingMode, Window,
};
use std::{
    borrow::Cow,
    sync::{Arc, Mutex},
};

#[derive(Default)]
pub struct RecordingTextSystem {
    lines: Mutex<Vec<String>>,
}

impl RecordingTextSystem {
    pub fn lines(&self) -> Vec<String> {
        self.lines.lock().unwrap().clone()
    }

    pub fn assert_saw(&self, expected: &str) {
        let lines = self.lines();
        assert!(
            lines.iter().any(|text| text == expected),
            "missing {expected:?}; layout requests: {lines:?}"
        );
    }
}

impl PlatformTextSystem for RecordingTextSystem {
    fn add_fonts(&self, fonts: Vec<Cow<'static, [u8]>>) -> anyhow::Result<()> {
        NoopTextSystem.add_fonts(fonts)
    }
    fn all_font_names(&self) -> Vec<String> {
        NoopTextSystem.all_font_names()
    }
    fn font_id(&self, descriptor: &Font) -> anyhow::Result<FontId> {
        NoopTextSystem.font_id(descriptor)
    }
    fn font_metrics(&self, font_id: FontId) -> FontMetrics {
        NoopTextSystem.font_metrics(font_id)
    }
    fn typographic_bounds(
        &self,
        font_id: FontId,
        glyph_id: GlyphId,
    ) -> anyhow::Result<Bounds<f32>> {
        NoopTextSystem.typographic_bounds(font_id, glyph_id)
    }
    fn advance(&self, font_id: FontId, glyph_id: GlyphId) -> anyhow::Result<Size<f32>> {
        NoopTextSystem.advance(font_id, glyph_id)
    }
    fn glyph_for_char(&self, font_id: FontId, ch: char) -> Option<GlyphId> {
        NoopTextSystem.glyph_for_char(font_id, ch)
    }
    fn glyph_raster_bounds(
        &self,
        params: &RenderGlyphParams,
    ) -> anyhow::Result<Bounds<DevicePixels>> {
        NoopTextSystem.glyph_raster_bounds(params)
    }
    fn rasterize_glyph(
        &self,
        params: &RenderGlyphParams,
        bounds: Bounds<DevicePixels>,
    ) -> anyhow::Result<(Size<DevicePixels>, Vec<u8>)> {
        NoopTextSystem.rasterize_glyph(params, bounds)
    }
    fn layout_line(&self, text: &str, font_size: Pixels, runs: &[FontRun]) -> LineLayout {
        self.lines.lock().unwrap().push(text.to_owned());
        NoopTextSystem.layout_line(text, font_size, runs)
    }
    fn recommended_rendering_mode(&self, font_id: FontId, font_size: Pixels) -> TextRenderingMode {
        NoopTextSystem.recommended_rendering_mode(font_id, font_size)
    }
}

pub fn recording_window<V: Render + 'static>(
    build: impl FnOnce(&mut Window, &mut Context<V>) -> V,
) -> (Arc<RecordingTextSystem>, TestApp, TestAppWindow<V>) {
    let recorder = Arc::new(RecordingTextSystem::default());
    let mut app = TestApp::with_text_system(recorder.clone());
    let window = app.open_window(build);
    (recorder, app, window)
}
