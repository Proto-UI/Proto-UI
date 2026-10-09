/** Finite producer/consumer fixture inputs, not a material or contrast policy.
 * Keep the original bright dark scene as an explicit native rejection control.
 * The seed-continuity positive case uses a darker owned source; admission still
 * depends on the real renderer's unchanged per-pixel contrast check.
 */
export function initialPaintSceneColors(theme: 'light' | 'dark', unsafeDarkControl = false) {
  if (theme === 'light')
    return {
      bands: ['#d1e6fa', '#82c5c7', '#b6ace3', '#f1b5bf'],
      centre: '#e8e3ac',
    };
  if (unsafeDarkControl)
    return {
      bands: ['#132138', '#235968', '#4b3b73', '#ae626b'],
      centre: '#7bafae',
    };
  return {
    bands: ['#132138', '#235968', '#4b3b73', '#70464c'],
    centre: '#486464',
  };
}
