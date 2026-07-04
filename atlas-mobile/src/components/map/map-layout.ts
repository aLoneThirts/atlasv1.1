/**
 * Radyal harita düzeni — prototip index.html renderMap() (satır ~1272-1361) birebir port.
 * Sabit 393 genişlikli referans tuval, gerçek cihaza tek bir scale transform ile uyarlanır.
 */
export const MAP_REF_WIDTH = 393;
export const MAP_REF_HEIGHT = 852;
export const MAP_CX = 196.5;
export const MAP_CY = 368;
export const MAP_R = 152;

export type Point = { x: number; y: number };

export function castleAngle(index: number, total: number): number {
  return index * (360 / total);
}

export function castleXY(index: number, total: number): Point {
  const rad = (castleAngle(index, total) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const x = MAP_CX + MAP_R * Math.sin(rad);
  const y = MAP_CY - MAP_R * cos * (cos < 0 ? 1.22 : 1);
  return { x, y };
}

/** Ana kaleden yola çıkış noktası — kale merkezinin biraz dışında */
export function roadStart(index: number, total: number): Point {
  const rad = (castleAngle(index, total) * Math.PI) / 180;
  return { x: MAP_CX + 60 * Math.sin(rad), y: MAP_CY - 60 * Math.cos(rad) };
}
