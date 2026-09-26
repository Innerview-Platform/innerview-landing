// Shared, mutable scroll progress (0..1) for the 3D story section.
export const scrollState = { target: 0, current: 0 };

export const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
