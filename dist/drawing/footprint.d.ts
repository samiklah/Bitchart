/**
 * Footprint-specific drawing functions for the Volume Footprint Chart.
 * Handles rendering of volume profiles, imbalance markers, and related visualizations.
 */
import { CandleData } from '../types';
import { Scales } from '../scales';
/**
 * Draws the footprint volume boxes for buy and sell volumes at each price level.
 */
export declare function drawFootprintBoxes(ctx: CanvasRenderingContext2D, rows: any[], pocIdx: number, enableProfile: boolean, leftX: number, rightX: number, scales: Scales, theme: any): {
    minRow: number;
    maxRow: number;
    totBuy: number;
    totSell: number;
};
/**
 * Draws imbalance markers for levels where buy or sell volume significantly exceeds adjacent levels.
 */
export declare function drawImbalanceMarkers(ctx: CanvasRenderingContext2D, rows: any[], leftX: number, rightX: number, scales: Scales, theme: any): void;
/**
 * Draws volume numbers inside the footprint boxes.
 */
export declare function drawVolumeNumbers(ctx: CanvasRenderingContext2D, rows: any[], pocIdx: number, enableProfile: boolean, leftX: number, rightX: number, scales: Scales, theme: any, zoomX: number): void;
/**
 * Draws the Value Area High (VAH) and Value Area Low (VAL) boundary lines and labels.
 */
export declare function drawValueAreaBoundaries(ctx: CanvasRenderingContext2D, cx: number, half: number, VAH: number, VAL: number, leftX: number, rightX: number, scales: Scales, theme: any, zoomX: number): void;
/**
 * Draws the delta (buy - sell) and total volume labels below the footprint.
 */
export declare function drawDeltaTotalLabels(ctx: CanvasRenderingContext2D, cx: number, maxRow: number, totBuy: number, totSell: number, totalVol: number, scales: Scales, theme: any, zoomX: number): void;
/**
 * Draws the traditional candlestick wick (high/low line) and body (open/close rectangle).
 */
export declare function drawCandleWickAndBody(ctx: CanvasRenderingContext2D, cx: number, half: number, candle: CandleData, scales: Scales, theme: any): void;
/**
 * Main footprint drawing function that orchestrates all footprint-related rendering.
 */
export declare function drawFootprint(ctx: CanvasRenderingContext2D, candle: CandleData, i: number, startIndex: number, scales: Scales, theme: any, view: any, showVolumeFootprint: boolean, showDeltaTable?: boolean): void;
