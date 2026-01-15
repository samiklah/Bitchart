/**
 * Crosshair and price label drawing functions for the Volume Footprint Chart.
 * Handles cursor tracking and current price display.
 */
import { Scales } from '../scales';
interface IndicatorData {
    oiData: {
        timestamp: number;
        value: number;
    }[];
    fundingRateData: {
        timestamp: number;
        value: number;
    }[];
    cvdValues: number[];
}
/**
 * Draws the crosshair lines and labels at the current mouse position.
 */
export declare function drawCrosshair(ctx: CanvasRenderingContext2D, width: number, height: number, margin: any, crosshair: {
    x: number;
    y: number;
    visible: boolean;
}, scales: Scales, data: any[], theme: any, indicatorData?: IndicatorData): void;
/**
 * Draws the current price label with a dashed line across the chart.
 */
export declare function drawCurrentPriceLabel(ctx: CanvasRenderingContext2D, width: number, lastPrice: number | null, margin: any, scales: Scales, theme: any): void;
export {};
