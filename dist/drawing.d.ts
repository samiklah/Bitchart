import { CandleData, VFCTheme } from './types';
import { Scales } from './scales';
export declare class Drawing {
    private ctx;
    private data;
    private margin;
    private view;
    private showGrid;
    private showBounds;
    private scales;
    private theme;
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
    }, showGrid: boolean, showBounds: boolean, scales: Scales, theme: VFCTheme);
    drawAll(): void;
    private drawGrid;
    private drawChart;
    private drawScales;
    private drawBounds;
    private drawFootprint;
}
