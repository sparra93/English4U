export const CHART_W = 640;
export const CHART_H = 220;
export const PAD_LEFT = 40;
export const PAD_RIGHT = 8;
export const PAD_TOP = 18;
export const PAD_BOTTOM = 26;

export function niceMax(value: number): number {
  if (value <= 0) {
    return 4;
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const residual = value / magnitude;
  let niceResidual = 10;
  if (residual <= 1) niceResidual = 1;
  else if (residual <= 2) niceResidual = 2;
  else if (residual <= 5) niceResidual = 5;

  return niceResidual * magnitude;
}

export function shouldShowXLabel(index: number, total: number): boolean {
  if (total <= 8) {
    return true;
  }

  const step = Math.ceil(total / 6);
  return index === 0 || index === total - 1 || index % step === 0;
}

export function roundedTopPath(
  x: number,
  yTop: number,
  width: number,
  height: number,
  radius: number,
): string {
  if (height <= 0) {
    return "";
  }

  const yBottom = yTop + height;
  const r = Math.max(0, Math.min(radius, width / 2, height));

  return [
    `M ${x} ${yBottom}`,
    `L ${x} ${yTop + r}`,
    `Q ${x} ${yTop} ${x + r} ${yTop}`,
    `L ${x + width - r} ${yTop}`,
    `Q ${x + width} ${yTop} ${x + width} ${yTop + r}`,
    `L ${x + width} ${yBottom}`,
    "Z",
  ].join(" ");
}
