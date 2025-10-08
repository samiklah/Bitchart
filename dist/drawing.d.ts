import { CandleData, VFCTheme } from './types';
import { Scales } from './scales';
/**
 * Handles all rendering operations for the Volume Footprint Chart.
 * Responsible for drawing grid, chart elements, scales, crosshair, and measurements.
 */
export declare class Drawing {
    private ctx;
    private data;
    private margin;
    private view;
    private showGrid;
    private showBounds;
    private showVolumeFootprint;
    private showVolumeHeatmap;
    private scales;
    private theme;
    private crosshair;
    private lastPrice;
    private interactions;
    constructor(ctx: CanvasRenderingContext2D, data: CandleData[], margin: {
        top: number;
        bottom: number;
        left: number;
        right: number;
    }, view: {
        zoomY: number;
        zoomX: number;
        offsetRows: number;
        offsetX: number;
    }, showGrid: boolean, showBounds: boolean, showVolumeFootprint: boolean, showVolumeHeatmap: boolean, scales: Scales, theme: VFCTheme, crosshair: {
        x: number;
        y: number;
        visible: boolean;
    }, lastPrice: number | null, interactions: any);
    drawAll(): void;
    private drawChart;
    private drawVolumeHeatmap;
}
