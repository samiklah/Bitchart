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
    private volumeHeatmapDynamic;
    private scales;
    private theme;
    private crosshair;
    private lastPrice;
    private interactions;
    private cvdValues;
    private showDeltaTable;
    private tableRowVisibility;
    private tableRowHeight;
    private footprintStyle;
    private oiData;
    private fundingRateData;
    private showOI;
    private showFundingRate;
    updateCVD(values: number[]): void;
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
    }, showGrid: boolean, showBounds: boolean, showVolumeFootprint: boolean, showVolumeHeatmap: boolean, volumeHeatmapDynamic: boolean, scales: Scales, theme: VFCTheme, crosshair: {
        x: number;
        y: number;
        visible: boolean;
    }, lastPrice: number | null, interactions: any, cvdValues?: number[], showDeltaTable?: boolean, tableRowVisibility?: typeof Drawing.prototype.tableRowVisibility, tableRowHeight?: number, footprintStyle?: 'bid_ask' | 'delta', showOI?: boolean, oiHeightRatio?: number, showFundingRate?: boolean, fundingRateHeightRatio?: number);
    setShowDeltaTable(show: boolean): void;
    getShowDeltaTable(): boolean;
    updateLastPrice(price: number | null): void;
    updateOIData(data: {
        timestamp: number;
        value: number;
    }[]): void;
    updateFundingRateData(data: {
        timestamp: number;
        value: number;
    }[]): void;
    setShowOI(show: boolean): void;
    setShowFundingRate(show: boolean): void;
    drawAll(): void;
    private drawDeltaTable;
    private drawChart;
    private drawVolumeHeatmap;
    private drawCVD;
    private drawOI;
    private drawFundingRate;
    private drawScales;
}
