/**
 * Measurement tool drawing functions for the Volume Footprint Chart.
 * Handles drawing of measurement rectangles and associated data labels.
 */
import { MeasureRectangle } from '../types';
import { Scales } from '../scales';
/**
 * Draws the measurement rectangle and associated data labels.
 */
export declare function drawMeasureRectangle(ctx: CanvasRenderingContext2D, measureRectangle: MeasureRectangle | null, scales: Scales, theme: any): void;
