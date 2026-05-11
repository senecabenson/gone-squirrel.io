const DEFAULT_CHUNK_MIN = 15;
const DEFAULT_CHUNK_MAX = 60;

/**
 * Splits a total time estimate into discrete chunks bounded by [chunkMin, chunkMax].
 * - Estimate <= chunkMax: a single chunk of that size.
 * - Estimate cleanly divisible by chunkMax: N full chunks.
 * - Remainder >= chunkMin: append the remainder.
 * - Remainder < chunkMin: redistribute the last full chunk + remainder across two ~equal halves.
 */
export function generateChunks(
  estimateMin: number,
  chunkMin = DEFAULT_CHUNK_MIN,
  chunkMax = DEFAULT_CHUNK_MAX,
): number[] {
  if (estimateMin <= chunkMax) return [estimateMin];

  const fullChunks = Math.floor(estimateMin / chunkMax);
  const remainder = estimateMin - fullChunks * chunkMax;

  if (remainder === 0) return Array(fullChunks).fill(chunkMax);
  if (remainder >= chunkMin) return [...Array(fullChunks).fill(chunkMax), remainder];

  const lastTwoTotal = chunkMax + remainder;
  const a = Math.ceil(lastTwoTotal / 2);
  const b = lastTwoTotal - a;
  return [...Array(fullChunks - 1).fill(chunkMax), a, b];
}

/**
 * True if any chunk duration fits within the user's chosen time.
 * Used by the scorer's strict eligibility filter.
 */
export function anyChunkFits(chunkDurations: number[], chosenMin: number): boolean {
  return chunkDurations.some((d) => d <= chosenMin);
}
