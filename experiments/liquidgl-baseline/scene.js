// This fixture observes the original vendor; it is not a production Adapter.
(() => {
  const query = new URLSearchParams(location.search);
  const requested = query.get('engine') === 'webgl' ? 'webgl' : 'auto';
  const control = query.get('control') === 'zero' ? 'zero' : 'normal';
  const status = document.getElementById('status');
  const originalStyles = [...document.querySelectorAll('.lens')].map((el) => ({
    id: el.id,
    style: el.getAttribute('style'),
  }));
  const startedAt = performance.now();
  const frames = [];
  let frame = 0;
  const track = (now) => {
    frames.push(now);
    if (frames.length < 600) frame = requestAnimationFrame(track);
  };
  frame = requestAnimationFrame(track);
  const result = window.liquidGL({
    target: '.lens',
    snapshot: '#scene',
    engine: requested,
    resolution: 1,
    interaction: 'fluid',
    refraction: control === 'zero' ? 0 : 0.01,
    bevelDepth: control === 'zero' ? 0 : 0.08,
    bevelWidth: 0.15,
    aberration: 0,
    frost: 0,
    magnify: 1,
    tint: null,
    shadow: true,
    specular: true,
    reveal: 'none',
    draggable: false,
  });
  const lenses = Array.isArray(result) ? result : result ? [result] : [];
  const observe = () => {
    const renderer = lenses.find((lens) => lens.renderer)?.renderer;
    const backend = renderer?.backend;
    return {
      elapsedMs: performance.now() - startedAt,
      requestedEngine: requested,
      control,
      sourceKind: 'reconstructed-scene',
      backend:
        backend?.constructor.name ?? (renderer ? 'preparing-or-unavailable' : 'css-or-disposed'),
      gpuReady: Boolean(backend && renderer.hasTexture),
      texture: renderer ? { width: renderer.textureWidth, height: renderer.textureHeight } : null,
      lenses: lenses.map((lens) => ({
        id: lens.el.id,
        destroyed: lens._destroyed,
        activated: lens._activated,
        pointerEvents: getComputedStyle(lens.el).pointerEvents,
        inlineStyle: lens.el.getAttribute('style'),
        fluid: lens._fluid?.value?.slice() ?? null,
      })),
      canvasCount: document.querySelectorAll('canvas').length,
      dynamicStyleCount: document.querySelectorAll('#liquid-gl-dynamic-styles').length,
      sharedRenderer: lenses.length === 2 && lenses[0].renderer === lenses[1].renderer,
      originalStyles,
    };
  };
  window.upstreamBaseline = {
    observe,
    moveSource() {
      const text = document.getElementById('live-text');
      text.textContent = 'SCENE 02';
      text.style.transform = 'translateX(17px)';
      window.liquidGL.registerDynamic(text);
      return observe();
    },
    destroyOne(index) {
      lenses[index]?.destroy();
      return observe();
    },
    dispose() {
      lenses.forEach((lens) => lens.destroy());
      cancelAnimationFrame(frame);
      return observe();
    },
    frameTimes() {
      return frames.slice(1).map((time, i) => time - frames[i]);
    },
  };
  const report = () => {
    const state = observe();
    status.textContent = `${state.backend} · reconstructed scene · ${control} optics`;
    if (!state.gpuReady && state.elapsedMs < 15000) setTimeout(report, 100);
    else document.body.dataset.ready = state.gpuReady ? 'gpu' : 'fallback';
  };
  report();
})();
