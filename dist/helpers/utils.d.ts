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
export declare function createVolumeColorMappers(sideMax: number, buyBase?: number, sellBase?: number): {
    buyRGBA: (v: number) => string;
    sellRGBA: (v: number) => string;
};
/**
 * Formats a number with K/M/T suffixes for large values.
 * @param v The number to format
 * @returns Formatted string
 */
export declare function formatNumber(v: number): string;
/**
 * Calculates the Point of Control (POC) and Value Area (VAH/VAL) for volume profile analysis.
 * @param rows Sorted footprint levels (high to low price)
 * @returns Object containing POC index, VAH/VAL indices and prices, and total volume
 */
export declare function computeVolumeArea(rows: any[]): {
    pocIdx: number;
    vahIdx: number;
    valIdx: number;
    VAH: number;
    VAL: number;
    totalVol: number;
};
