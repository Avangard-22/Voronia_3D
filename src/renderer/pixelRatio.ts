/** Ограничение плотности пикселей для снижения нагрузки на GPU. */
export function renderPixelRatio(devicePixelRatio: number, viewportWidth: number): number {
  const nativeRatio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(nativeRatio, viewportWidth < 700 ? 1.5 : 2);
}
