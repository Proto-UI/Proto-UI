/** Test-only observation. Self-contained for Playwright serialization. Freeze
 * CSS, provider receipt and owned paint synchronously; decode only that image,
 * then accept it only if the entire snapshot is still current. No input,
 * production state, provider admission or functional assertion is changed. */
export async function observeLiquidToggleSnapshot(element: Element) {
  const luminance = (rgb: number[]) =>
    rgb
      .slice(0, 3)
      .map((n) => n / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
  const read = () => {
    const el = element as HTMLElement;
    const css = getComputedStyle(el),
      rect = el.getBoundingClientRect();
    const ctx = new OffscreenCanvas(1, 1).getContext('2d')!;
    const rgba = (value: string) => {
      if (!CSS.supports('color', value)) throw new Error(`Unresolved observed color ${value}`);
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = value;
      ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data);
    };
    const background = rgba(css.backgroundColor),
      foreground = rgba(css.color);
    const lum = [luminance(background), luminance(foreground)].sort((a, b) => b - a);
    const carrierCss = getComputedStyle(el, '::before');
    const carrierMarker = el.getAttribute('data-pui-material-carrier');
    const materialImage =
      carrierMarker === 'contact-v1' ? carrierCss.backgroundImage : css.backgroundImage;
    const uri =
      materialImage.match(/url\(["']?(data:image\/png;base64,[^"')]+)["']?\)/)?.[1] ?? null;
    const facts = {
      active: el.getAttribute('aria-pressed'),
      disabled: el.getAttribute('aria-disabled'),
      width: rect.width,
      height: rect.height,
      radius: css.borderTopLeftRadius,
      border: [
        css.borderTopWidth,
        css.borderRightWidth,
        css.borderBottomWidth,
        css.borderLeftWidth,
      ],
      borderColor: rgba(css.borderTopColor),
      ringColor: rgba(css.getPropertyValue('--pui-ring').trim()),
      underline: css.textDecorationLine,
      shadow: css.boxShadow,
      opacity: css.opacity,
      pointerEvents: css.pointerEvents,
      background,
      foreground,
      // A transparent host is not the optical surface. Never label its RGB as
      // a measured fallback or optical contrast.
      fallbackContrast:
        background[3] === 255 && foreground[3] === 255 ? (lum[0] + 0.05) / (lum[1] + 0.05) : null,
      palette: {
        primary: rgba(css.getPropertyValue('--pui-primary').trim()),
        primaryForeground: rgba(css.getPropertyValue('--pui-primary-foreground').trim()),
        secondary: rgba(css.getPropertyValue('--pui-secondary').trim()),
        secondaryForeground: rgba(css.getPropertyValue('--pui-secondary-foreground').trim()),
      },
      contentBox: {
        left: parseFloat(css.borderLeftWidth) + parseFloat(css.paddingLeft),
        top: parseFloat(css.borderTopWidth) + parseFloat(css.paddingTop),
        right: rect.width - parseFloat(css.borderRightWidth) - parseFloat(css.paddingRight),
        bottom: rect.height - parseFloat(css.borderBottomWidth) - parseFloat(css.paddingBottom),
      },
      quality: el.dataset.materialQuality,
      reason: el.dataset.materialReason,
      source: el.dataset.materialSource,
      phase: el.dataset.materialPhase,
      motion: el.dataset.materialMotion,
      backdropFilter: css.backdropFilter,
      childCanvases: el.querySelectorAll('canvas').length,
      image: materialImage,
      hostImage: css.backgroundImage,
      carrier: {
        marker: carrierMarker,
        content: carrierCss.content,
        image: carrierCss.backgroundImage,
        pointerEvents: carrierCss.pointerEvents,
        zIndex: carrierCss.zIndex,
        visibility: carrierCss.visibility,
        opacity: carrierCss.opacity,
      },
      uri,
    };
    // These are existing provider commit diagnostics, not an invented render
    // revision. Copy all primitives in the same synchronous observation turn.
    const receipt = {
      frame: el.getAttribute('data-material-frame'),
      sourceRevision: el.getAttribute('data-material-source-revision'),
      contactSession: el.getAttribute('data-material-contact-session'),
      contact: el.getAttribute('data-material-contact'),
      backend: el.getAttribute('data-material-backend'),
      profile: el.getAttribute('data-material-profile'),
      ownedImage: el.style.getPropertyValue('--pui-material-image').trim(),
      styleTokens: el.getAttribute('data-pui-style'),
    };
    // Same committed-carrier criteria as observeOwnedMaterialPaint; unlike a
    // second Locator.evaluate, this receipt cannot come from a later frame.
    // The declared pointer profile retains its full footprint even at rest.
    // Never infer a profile or its bound from the actual carrier size. This same
    // bound registers decoded host-content pixels and prominent-tint crops.
    const pointerProfile =
      carrierMarker === 'contact-v1' &&
      (receipt.profile === 'liquidgl-v2-contact-canvas-1' ||
        receipt.profile === 'pui-regular-style-tint-contact-5');
    const knownContact =
      (receipt.contact === 'rest' || receipt.contact === 'held' || receipt.contact === 'release') &&
      (facts.phase === 'rest' || facts.phase === 'pressed');
    const outset = pointerProfile ? Math.ceil(Math.max(rect.width, rect.height) * 0.08 + 1) : 0;
    const expected = {
      left: -outset - parseFloat(css.borderLeftWidth),
      top: -outset - parseFloat(css.borderTopWidth),
      width: rect.width + 2 * outset,
      height: rect.height + 2 * outset,
    };
    const actual = {
      left: parseFloat(carrierCss.left),
      top: parseFloat(carrierCss.top),
      width: parseFloat(carrierCss.width),
      height: parseFloat(carrierCss.height),
    };
    const geometryMatches =
      pointerProfile &&
      knownContact &&
      Object.keys(expected).every((key) => {
        const name = key as keyof typeof expected;
        return Number.isFinite(actual[name]) && Math.abs(actual[name] - expected[name]) <= 1 / 64;
      });
    const committed =
      carrierMarker === 'contact-v1'
        ? facts.carrier.image === receipt.ownedImage &&
          materialImage.includes('data:image/png;base64,') &&
          geometryMatches &&
          facts.carrier.content === '\"\"' &&
          carrierCss.position === 'absolute' &&
          facts.carrier.pointerEvents === 'none' &&
          facts.carrier.zIndex === '-1' &&
          facts.carrier.visibility === 'visible' &&
          facts.carrier.opacity === '1' &&
          carrierCss.backgroundSize === '100% 100%' &&
          carrierCss.backgroundRepeat === 'no-repeat' &&
          facts.hostImage === 'none'
        : carrierMarker === null && materialImage.includes('data:image/png;base64,');
    const paint = {
      image: materialImage,
      committed,
      carrier: carrierMarker,
      geometryMatches,
      paintOutset: outset,
      hostGeometry: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      carrierGeometry: actual,
      expectedCarrierGeometry: expected,
      quality: facts.quality,
      source: facts.source,
      blur: facts.backdropFilter,
      canvas: facts.childCanvases,
      carrierPosition: carrierCss.position,
      carrierBackgroundSize: carrierCss.backgroundSize,
      carrierBackgroundRepeat: carrierCss.backgroundRepeat,
    };
    return { ...facts, receipt, paint };
  };

  for (let attempt = 1; attempt <= 4; attempt++) {
    const before = read();
    if (!before.uri)
      return {
        ...before,
        pixels: null,
        snapshot: { attempts: attempt, verifiedAfterDecode: false },
      };
    const signature = JSON.stringify(before);
    const image = new Image();
    image.src = before.uri;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failure: unknown;
    let failed = false;
    try {
      await Promise.race([
        image.decode(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Toggle material image decode deadline')),
            1000
          );
        }),
      ]);
    } catch (error) {
      failed = true;
      failure = error;
    } finally {
      clearTimeout(timer);
    }
    // CSSStyleDeclaration is live. Never reuse it after awaiting decoding;
    // compare complete immutable observations, including real commit counters.
    if (JSON.stringify(read()) !== signature) continue;
    if (failed) throw failure;
    const canvas = new OffscreenCanvas(image.width, image.height),
      paint = canvas.getContext('2d')!;
    paint.drawImage(image, 0, 0);
    const data = paint.getImageData(0, 0, image.width, image.height).data;
    const colors = new Set<string>();
    let min = 255,
      max = 0;
    for (let i = 0; i < data.length; i += 4) {
      colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
      min = Math.min(min, data[i], data[i + 1], data[i + 2]);
      max = Math.max(max, data[i], data[i + 1], data[i + 2]);
    }
    // Map pixel centers to the frozen host content box, excluding the border,
    // padding and outer contact shadow. This ROI contains the text's backing
    // surface, not white/transparent shadow pixels around the capsule.
    const outset = before.carrier.marker === 'contact-v1' ? before.paint.paintOutset : 0;
    const paintWidth = before.width + 2 * outset,
      paintHeight = before.height + 2 * outset;
    const fgLuminance = luminance(before.foreground);
    let contentPixels = 0,
      validPixels = 0,
      opaquePixels = 0,
      partialAlphaPixels = 0,
      transparentPixels = 0,
      blueDominantPixels = 0,
      alphaWeight = 0,
      minimumContrast = Infinity;
    const sum = [0, 0, 0],
      contentColors = new Set<string>();
    for (let y = 0; y < image.height; y++)
      for (let x = 0; x < image.width; x++) {
        const hostX = ((x + 0.5) / image.width) * paintWidth - outset,
          hostY = ((y + 0.5) / image.height) * paintHeight - outset;
        if (
          !Object.values(before.contentBox).every(Number.isFinite) ||
          hostX < before.contentBox.left ||
          hostX >= before.contentBox.right ||
          hostY < before.contentBox.top ||
          hostY >= before.contentBox.bottom
        )
          continue;
        contentPixels++;
        const at = (y * image.width + x) * 4,
          rgb = Array.from(data.slice(at, at + 3)),
          alpha = data[at + 3] / 255;
        if (alpha === 0) transparentPixels++;
        else {
          validPixels++;
          if (alpha === 1) opaquePixels++;
          else partialAlphaPixels++;
          alphaWeight += alpha;
          for (let c = 0; c < 3; c++) sum[c] += rgb[c] * alpha;
          if (rgb[2] > rgb[1] && rgb[1] > rgb[0]) blueDominantPixels++;
          contentColors.add(rgb.join(','));
        }
        // The decoded image has straight alpha. We do not invent the unseen
        // backing: alpha-composite in sRGB onto black and white, then take the
        // worst contrast over that complete backing-luminance interval. Fully
        // transparent content gives 1, never vacuous contrast success.
        const low = luminance(rgb.map((channel) => channel * alpha)),
          high = luminance(rgb.map((channel) => channel * alpha + 255 * (1 - alpha)));
        const contrast =
          fgLuminance >= low && fgLuminance <= high
            ? 1
            : fgLuminance > high
              ? (fgLuminance + 0.05) / (high + 0.05)
              : (low + 0.05) / (fgLuminance + 0.05);
        minimumContrast = Math.min(minimumContrast, contrast);
      }
    const meanRgb = alphaWeight > 0 ? sum.map((value) => value / alphaWeight) : null;
    return {
      ...before,
      pixels: {
        width: image.width,
        height: image.height,
        uniqueColors: colors.size,
        min,
        max,
        content: {
          roi: before.contentBox,
          contentPixels,
          validPixels,
          opaquePixels,
          partialAlphaPixels,
          transparentPixels,
          uniqueColors: contentColors.size,
          foreground: before.foreground,
          minForegroundContrast:
            contentPixels > 0 && before.foreground[3] === 255 ? minimumContrast : null,
          alphaCompositing: 'sRGB straight alpha; worst black-to-white backing luminance interval',
        },
        tint: {
          meanRgb,
          primary: before.palette.primary,
          meanAbsoluteDistanceToPrimary:
            meanRgb &&
            meanRgb.reduce(
              (total, channel, i) => total + Math.abs(channel - before.palette.primary[i]),
              0
            ) / 3,
          blueDominantFraction: validPixels > 0 ? blueDominantPixels / validPixels : null,
        },
      },
      snapshot: { attempts: attempt, verifiedAfterDecode: true },
    };
  }
  throw new Error('Toggle material snapshot did not stabilize after 4 decode attempts');
}
