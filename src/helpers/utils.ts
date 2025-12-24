/**
 * Utility functions and helpers for the Volume Footprint Chart library.
 * Contains reusable calculations for volume analysis, color mapping, and number formatting.
 */

/**
 * Creates color mapping functions for buy and sell volumes based on opacity scaling.
 * @param sideMax Maximum volume on either buy or sell side
 * @param buyBase Base opacity for buy volumes
 * @param sellBase Base opacity for sell volumes
 * @returns Object with buyRGBA and sellRGBA functions
 */
export function createVolumeColorMappers(sideMax: number, buyBase: number = 0.15, sellBase: number = 0.15) {
  const buyRGBA = (v: number) => `rgba(0,255,0,${buyBase + 0.55 * (v / sideMax)})`;
  const sellRGBA = (v: number) => `rgba(255,0,0,${sellBase + 0.55 * (v / sideMax)})`;
  return { buyRGBA, sellRGBA };
}

/**
 * Formats a number with K/M/T suffixes for large values.
 * @param v The number to format
 * @returns Formatted string
 */
export function formatNumber(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e12) return (v / 1e12).toFixed(2) + "T";
  if (a >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return (v / 1e3).toFixed(2) + "K";
  // For small numbers, show up to 2 decimal places if needed
  if (Number.isInteger(v)) {
    return v.toString();
  }
  return v.toFixed(2);
}

/**
 * Calculates the Point of Control (POC) and Value Area (VAH/VAL) for volume profile analysis.
 * @param rows Sorted footprint levels (high to low price)
 * @returns Object containing POC index, VAH/VAL indices and prices, and total volume
 */
export function computeVolumeArea(rows: any[]): { pocIdx: number, vahIdx: number, valIdx: number, VAH: number, VAL: number, totalVol: number } {
  const levelVols = rows.map(r => r.buy + r.sell);
  const totalVol = levelVols.reduce((a, b) => a + b, 0);
  let pocIdx = 0;
  for (let i = 1; i < levelVols.length; i++) {
    if (levelVols[i] > levelVols[pocIdx]) pocIdx = i;
  }

  let included = new Set([pocIdx]);
  const enableProfile = rows.length > 3;
  if (enableProfile) {
    let acc = levelVols[pocIdx];
    let up = pocIdx - 1, down = pocIdx + 1;
    while (acc < 0.7 * totalVol && (up >= 0 || down < rows.length)) {
      const upVol = up >= 0 ? levelVols[up] : -1;
      const downVol = down < rows.length ? levelVols[down] : -1;
      if (upVol >= downVol) {
        if (up >= 0) { included.add(up); acc += levelVols[up]; up--; }
        else { included.add(down); acc += levelVols[down]; down++; }
      } else {
        if (down < rows.length) { included.add(down); acc += levelVols[down]; down++; }
        else { included.add(up); acc += levelVols[up]; up--; }
      }
    }
  }

  const vahIdx = Math.min(...included);
  const valIdx = Math.max(...included);
  const VAH = rows[vahIdx]?.price;
  const VAL = rows[valIdx]?.price;

  return { pocIdx, vahIdx, valIdx, VAH, VAL, totalVol };
}