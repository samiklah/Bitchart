/**
 * Grid and bounds drawing functions for the Volume Footprint Chart.
 * Handles background grid lines and chart boundary visualization.
 */
import { Scales } from '../scales';
/**
 * Draws the background grid lines.
 */
export declare function drawGrid(ctx: CanvasRenderingContext2D, width: number, margin: any, scales: Scales, theme: any): void;
/**
 * Draws chart boundary outlines and gutters.
 */
export declare function drawBounds(ctx: CanvasRenderingContext2D, width: number, height: number, margin: any, scales: Scales): void;
