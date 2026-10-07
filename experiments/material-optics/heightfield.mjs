// Independent experimental model. These are not Apple's private optical parameters.
export function roundedBoxDistance(x, y, cx, cy, width, height, radius) {
  const qx = Math.abs(x - cx) - width / 2 + radius;
  const qy = Math.abs(y - cy) - height / 2 + radius;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}
function smoothUnion(a, b, radius) {
  const h = Math.max(radius - Math.abs(a - b), 0) / radius;
  return Math.min(a, b) - h * h * radius * 0.25;
}
export function distanceAt(x, y, state = {}) {
  const { merge = 0, press = 0, morph = 0, mode = 'menu' } = state;
  let d;
  if (mode === 'menu')
    d = roundedBoxDistance(x, y, 300, 132, 146 + 146 * morph, 60 + 126 * morph, 30 - 4 * morph);
  else {
    const offset = 105 - merge * 58;
    d = smoothUnion(
      roundedBoxDistance(x, y, 300 - offset, 132, 146, 60, 30),
      roundedBoxDistance(x, y, 300 + offset, 132, 146, 60, 30),
      34
    );
  }
  const anchorX = state.anchorX ?? 300,
    anchorY = state.anchorY ?? 132;
  const local = Math.exp(-((x - anchorX) ** 2 + (y - anchorY) ** 2) / (2 * 48 ** 2));
  return d - press * 2.5 * local;
}
export function advanceSpring(value, velocity, target, dt, omega = 18, damping = 0.82) {
  if (
    ![value, velocity, target, dt, omega, damping].every(Number.isFinite) ||
    dt < 0 ||
    omega <= 0 ||
    damping <= 0 ||
    damping >= 1
  )
    throw new Error('Invalid bounded spring input');
  const a = damping * omega,
    wd = omega * Math.sqrt(1 - damping * damping),
    decay = Math.exp(-a * dt),
    c = Math.cos(wd * dt),
    s = Math.sin(wd * dt),
    y = value - target;
  return {
    value: target + decay * (y * c + ((velocity + a * y) / wd) * s),
    velocity: decay * (velocity * c - ((a * velocity + omega * omega * y) / wd) * s),
  };
}
export function sampleOptics(x, y, state = {}) {
  const d = distanceAt(x, y, state);
  if (d >= 1)
    return { dx: 0, dy: 0, alpha: 0, highlight: 0, edgeShade: 0, rimWeight: 0, bodyTint: 0, d };
  const alpha = Math.max(0, Math.min(1, 0.5 - d));
  const gx = distanceAt(x + 0.5, y, state) - distanceAt(x - 0.5, y, state);
  const gy = distanceAt(x, y + 0.5, state) - distanceAt(x, y - 0.5, state);
  const local = Math.exp(
    -((x - (state.anchorX ?? 300)) ** 2 + (y - (state.anchorY ?? 132)) ** 2) / (2 * 48 ** 2)
  );
  const opticalPress =
    state.opticalPress === false ? 0 : Math.max(0, Math.min(1, state.press ?? 0));
  const thickness = opticalPress * local;
  const rimWidth = 8 + 6 * (state.morph ?? 0) + 3 * thickness;
  const t = Math.max(0, Math.min(1, -d / rimWidth));
  const bump = Math.sin(Math.PI * t) ** 2;
  // This ordinary-rim profile bounds |d(displacement)/d(distance)| by 0.22*pi < 1.
  const strength = 0.22 * rimWidth * bump * (1 + 0.12 * thickness);
  // Keep the smooth-union gradient magnitude; the height field has a real z normal.
  const slope = (0.55 + 0.25 * thickness) * bump,
    norm = Math.hypot(gx * slope, gy * slope, 1);
  const nx = (gx * slope) / norm,
    ny = (gy * slope) / norm,
    nz = 1 / norm;
  const light = state.light ?? [-0.45, -0.65];
  const lz = 0.75,
    ll = Math.hypot(light[0], light[1], lz);
  const hx = light[0] / ll,
    hy = light[1] / ll,
    hz = lz / ll + 1,
    hl = Math.hypot(hx, hy, hz);
  const spec = Math.pow(Math.max(0, (nx * hx + ny * hy + nz * hz) / hl), 64) * bump * 0.23;
  // Fine opposite light/dark edges are separate from the wide optical sampling rim.
  const edge = Math.exp(-((-d - 0.7) ** 2) / 0.65);
  const facing = -(gx * light[0] + gy * light[1]) / Math.hypot(...light);
  const highlight =
    spec + edge * (0.1 + 0.19 * Math.max(0, facing)) + 0.02 * (state.energy ?? 0) * local;
  const edgeShade = edge * Math.max(0, -facing) * 0.13;
  const transition = Math.max(0, Math.min(1, (t - 0.65) / 0.35));
  const rimWeight = 1 - transition * transition * (3 - 2 * transition);
  return {
    dx: gx * strength,
    dy: gy * strength,
    alpha,
    highlight,
    edgeShade,
    rimWeight,
    rimWidth,
    // Tone integrates continuously over the whole body depth, not the optical branch boundary.
    bodyTint:
      state.bodyIntegration === false
        ? 0
        : (0.04 + 0.15 * (state.morph ?? 0)) *
          (1 - Math.exp(Math.min(0, d) / (0.65 * (30 + 63 * (state.morph ?? 0))))),
    d,
  };
}
export function makeField(state = {}, width = 600, height = 264) {
  const normal = new Uint8ClampedArray(width * height * 4);
  const shine = new Uint8ClampedArray(normal.length);
  const weights = new Uint8ClampedArray(normal.length);
  for (let i = 0; i < normal.length; i += 4) {
    normal[i] = 128;
    normal[i + 1] = 128;
    normal[i + 3] = 255;
    weights[i + 3] = 255;
  }
  const morph = state.morph ?? 0,
    menu = (state.mode ?? 'menu') === 'menu';
  const halfWidth = menu ? (146 + 146 * morph) / 2 : 105 - (state.merge ?? 0) * 58 + 73;
  const halfHeight = menu ? (60 + 126 * morph) / 2 : 30;
  const x0 = Math.max(0, Math.floor(((300 - halfWidth - 14) * width) / 600)),
    x1 = Math.min(width, Math.ceil(((300 + halfWidth + 14) * width) / 600));
  const y0 = Math.max(0, Math.floor(((132 - halfHeight - 14) * height) / 264)),
    y1 = Math.min(height, Math.ceil(((132 + halfHeight + 18) * height) / 264));
  for (let py = y0; py < y1; py++)
    for (let px = x0; px < x1; px++) {
      const value = sampleOptics(((px + 0.5) * 600) / width, ((py + 0.5) * 264) / height, state);
      const i = (py * width + px) * 4;
      normal[i] = 255 * (0.5 + value.dx / 40);
      normal[i + 1] = 255 * (0.5 + value.dy / 40);
      // Opaque vector channels avoid premultiplied-alpha contamination at the rim.
      // Blue carries the independent shape mask, extracted by the filter.
      normal[i + 2] = 255 * value.alpha;
      normal[i + 3] = 255;
      const sharpWeight = state.sharpRim === false ? 0 : value.rimWeight;
      weights[i] = 255 * value.alpha * sharpWeight;
      weights[i + 1] = 255 * value.alpha * (1 - sharpWeight);
      shine[i] = shine[i + 1] = shine[i + 2] = 255;
      const morph = state.morph ?? 0;
      const shadowDistance = distanceAt(
        ((px + 0.5) * 600) / width,
        ((py + 0.5) * 264) / height - 3 - 2 * morph,
        state
      );
      const shadow =
        value.d > 0 ? Math.exp(-(Math.max(0, shadowDistance) ** 2) / (8 + 14 * morph)) * 0.028 : 0;
      if (value.alpha === 0) shine[i] = shine[i + 1] = shine[i + 2] = 0;
      // Body integration is modest and spatially separate from the sharp optical rim.
      const bodyTint = value.bodyTint;
      const white = bodyTint + value.highlight;
      const opacity = value.alpha * (white + value.edgeShade) + shadow;
      if (opacity > 0 && value.alpha > 0)
        shine[i] = shine[i + 1] = shine[i + 2] = (255 * white) / (white + value.edgeShade);
      shine[i + 3] = 255 * opacity;
    }
  return { normal, weights, shine, width, height };
}
