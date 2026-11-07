// Pixel comparison used by the fidelity checks. Both images are flattened on white; alpha is compared separately.
import {sharp} from './common.mjs';

export async function raw(input, size) {
  let img = sharp(input).ensureAlpha();
  if (size) img = img.resize(size.w, size.h, {fit: 'fill', kernel: 'lanczos3'});
  const {data, info} = await img.raw().toBuffer({resolveWithObject: true});
  return {data, w: info.width, h: info.height};
}
// mean: mean absolute RGB difference (0-255) after flattening; pct24 / pct60: % of pixels whose worst channel (RGB flattened, or alpha) differs by more than 24 / 60.
export function diffStats(a, b) {
  if (a.w !== b.w || a.h !== b.h) throw new Error(`size mismatch ${a.w}x${a.h} vs ${b.w}x${b.h}`);
  const N = a.w * a.h; let sum = 0, n24 = 0, n60 = 0, amax = 0;
  const A = a.data, B = b.data;
  for (let i = 0; i < A.length; i += 4) {
    const aa = A[i + 3] / 255, ba = B[i + 3] / 255;
    const dr = Math.abs(A[i] * aa + 255 * (1 - aa) - (B[i] * ba + 255 * (1 - ba)));
    const dg = Math.abs(A[i + 1] * aa + 255 * (1 - aa) - (B[i + 1] * ba + 255 * (1 - ba)));
    const db = Math.abs(A[i + 2] * aa + 255 * (1 - aa) - (B[i + 2] * ba + 255 * (1 - ba)));
    const da = Math.abs(A[i + 3] - B[i + 3]); if (da > amax) amax = da;
    const m = Math.max(dr, dg, db, da); sum += (dr + dg + db) / 3;
    if (m > 24) n24++; if (m > 60) n60++;
  }
  return {mean: +(sum / N).toFixed(3), pct24: +(100 * n24 / N).toFixed(3), pct60: +(100 * n60 / N).toFixed(3), alphaMax: amax};
}
