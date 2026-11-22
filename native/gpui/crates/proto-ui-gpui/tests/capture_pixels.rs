#[path = "support/capture_pixels.rs"]
mod capture_pixels;

use capture_pixels::{content_rect, inspect, Rect};

fn image(scale: usize, chrome: usize, color: [u8; 4]) -> (usize, usize, Vec<u8>, Rect) {
    let (width, height) = (300 * scale, (300 + chrome) * scale);
    let pixels = color.repeat(width * height);
    let content = content_rect(width, height, scale as f64, [0.0, 0.0, 300.0, 300.0]).unwrap();
    (width, height, pixels, content)
}

// Synthetic strokes exercise the classifier only. They are never written as
// screenshot evidence and do not stand in for the real ScreenCaptureKit run.
fn strokes(pixels: &mut [u8], width: usize, scale: usize, y: usize) {
    for row in y..y + 12 * scale {
        for x in 20 * scale..180 * scale {
            if x / scale % 8 < 3 {
                pixels[(row * width + x) * 4..(row * width + x) * 4 + 4]
                    .copy_from_slice(&[20, 34, 55, 255]);
            }
        }
    }
}

#[test]
fn counts_two_separate_caption_regions_at_actual_content_offset_and_scale() {
    for (scale, chrome) in [(1, 29), (2, 37), (3, 0)] {
        let (width, height, mut pixels, content) = image(scale, chrome, [244, 247, 250, 255]);
        for row in [0, 64] {
            strokes(&mut pixels, width, scale, content.y + (row + 20) * scale);
        }
        let report = inspect(width, height, &pixels, content, scale as f64).unwrap();
        assert!(report.passed(), "{report:?}");
        assert_eq!(report.content.y, chrome * scale);
    }
}

#[test]
fn rejects_black_white_transparent_and_titlebar_only_images() {
    for color in [[0, 0, 0, 255], [244, 247, 250, 255], [244, 247, 250, 0]] {
        let (width, height, pixels, content) = image(1, 29, color);
        assert!(!inspect(width, height, &pixels, content, 1.0)
            .unwrap()
            .passed());
    }
    let (width, height, mut pixels, content) = image(1, 29, [244, 247, 250, 255]);
    strokes(&mut pixels, width, 1, 8);
    assert!(!inspect(width, height, &pixels, content, 1.0)
        .unwrap()
        .passed());
}

#[test]
fn either_missing_label_fails_even_when_the_other_label_has_ink() {
    for present in [0, 1] {
        let (width, height, mut pixels, content) = image(1, 29, [244, 247, 250, 255]);
        strokes(&mut pixels, width, 1, content.y + present * 64 + 20);
        let report = inspect(width, height, &pixels, content, 1.0).unwrap();
        assert!(report.labels[present].passed);
        assert!(!report.labels[1 - present].passed);
        assert!(!report.passed());
    }
}

#[test]
fn row_borders_do_not_count_as_caption_ink() {
    let (width, height, mut pixels, content) = image(1, 29, [244, 247, 250, 255]);
    for row in [0, 64] {
        for y in 0..64 {
            for x in 0..300 {
                if x < 2 || x >= 298 || y < 2 || y >= 62 {
                    let offset = ((content.y + row + y) * width + x) * 4;
                    pixels[offset..offset + 4].copy_from_slice(&[20, 34, 55, 255]);
                }
            }
        }
    }
    let report = inspect(width, height, &pixels, content, 1.0).unwrap();
    assert!(report.labels.iter().all(|label| label.ink == 0));
    assert!(!report.passed());
}

#[test]
fn a_solid_block_in_each_row_is_not_caption_evidence() {
    let (width, height, mut pixels, content) = image(1, 29, [244, 247, 250, 255]);
    for row in [0, 64] {
        for y in content.y + row + 20..content.y + row + 32 {
            for x in 20..140 {
                let offset = (y * width + x) * 4;
                pixels[offset..offset + 4].copy_from_slice(&[20, 34, 55, 255]);
            }
        }
    }
    let report = inspect(width, height, &pixels, content, 1.0).unwrap();
    assert!(report
        .labels
        .iter()
        .all(|label| label.ink >= 32 && label.ink_columns >= 50));
    assert!(report.labels.iter().all(|label| label.segmented_rows == 0));
    assert!(!report.passed());
}

#[test]
fn content_mapping_retains_nonzero_origins_and_fractional_display_scale() {
    assert_eq!(
        content_rect(472, 540, 1.5, [8.0, 10.0, 300.0, 300.0]).unwrap(),
        Rect {
            x: 12,
            y: 75,
            width: 450,
            height: 450
        },
    );
    assert!(content_rect(472, 540, 1.5, [8.0, 61.0, 300.0, 300.0]).is_err());
}

#[test]
fn rejects_invalid_dimensions_scale_and_out_of_bounds_content() {
    let (width, height, pixels, content) = image(1, 29, [244, 247, 250, 255]);
    assert!(inspect(width, height, &pixels[..pixels.len() - 1], content, 1.0).is_err());
    assert!(inspect(width + 1, height, &pixels, content, 1.0).is_err());
    assert!(inspect(width, height, &pixels, content, f64::NAN).is_err());
    assert!(inspect(width, height, &pixels, Rect { y: 40, ..content }, 1.0).is_err());
    assert!(content_rect(width, height, 1.0, [0.0, 0.0, 301.0, 300.0]).is_err());
    assert!(content_rect(width, height, 1.0, [0.0, 0.0, 300.0, 340.0]).is_err());
    assert!(content_rect(width, height, 0.0, [0.0, 0.0, 300.0, 300.0]).is_err());
}
