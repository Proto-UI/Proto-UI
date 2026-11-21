export const carouselSlidesPerView = (value?: number) =>
  Number.isFinite(value) ? Math.max(1, value!) : 1;

export const carouselVisibleSlides = (count: number, requested: number, ratio = 0) =>
  Math.min(count, Math.max(1, ratio > 0 && ratio < 1 ? count * ratio : requested));

export const carouselMaxIndex = (count: number, visible: number) =>
  Math.max(0, Math.ceil(count - visible - 1e-7));

export const carouselIndex = (value: number, max: number, loop: boolean) => {
  const index = Number.isFinite(value) ? Math.trunc(value) : 0;
  return loop && max > 0
    ? ((index % (max + 1)) + max + 1) % (max + 1)
    : Math.max(0, Math.min(max, index));
};

/** The last snap may be a partial item: compare it with its actual neighbor. */
export const carouselSnapIndex = (offset: number, travel: number) => {
  const lastFull = Math.floor(travel);
  if (travel > lastFull && offset >= (lastFull + travel) / 2) return lastFull + 1;
  return Math.round(offset);
};

export const carouselPosition = (index: number, count: number, visible: number) => {
  const travel = Math.max(0, count - visible);
  return travel > 0 ? Math.min(index, travel) / travel : 0;
};
