/**
 * Scale and axis drawing functions for the Volume Footprint Chart.
 * Handles rendering of price bars, timeline, and related scale elements.
 */
import { Scales } from '../scales';
/**
 * Draws the price bar on the right side and price labels.
 */
export declare function drawPriceBar(ctx: CanvasRenderingContext2D, width: number, height: number, margin: any, scales: Scales, theme: any): void;
/**
 * Draws the timeline at the bottom with time labels.
 */
export declare function drawTimeline(ctx: CanvasRenderingContext2D, width: number, height: number, margin: any, scales: Scales, data: any[], theme: any): void;
/**
 * Draws the complete scales (price bar and timeline).
 */
export declare function drawScales(ctx: CanvasRenderingContext2D, width: number, height: number, margin: any, scales: Scales, data: any[], theme: any): void;
