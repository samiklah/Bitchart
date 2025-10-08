/**
 * Provides coordinate transformation and scaling utilities for the chart.
 * Converts between screen pixels, data indices, and price values with zoom and pan support.
 */
import { CandleData } from './types';
/**
 * Handles coordinate transformations and scaling calculations for the chart.
 * Provides methods to convert between screen coordinates, data indices, and price levels.
 */
export declare class Scales {
    private data;
    private margin;
    private view;
    private canvasWidth;
    private canvasHeight;
    private showVolumeFootprint;
    private TICK;
    private baseRowPx;
    private TEXT_VIS;
    /**
     * Creates a Scales instance for coordinate transformations.
     * @param data Array of candlestick data
     * @param margin Chart margin configuration
     * @param view Current view state
     * @param canvasWidth Canvas width in pixels
     * @param canvasHeight Canvas height in pixels
     * @param showVolumeFootprint Whether volume footprint is displayed
     * @param TICK Price tick size
     * @param baseRowPx Base row height in pixels
     * @param TEXT_VIS Text visibility thresholds
     */
    constructor(data: CandleData[], margin: {
        top: number;
        bottom: number;
        left: number;
        right: number;
    }, view: {
        zoomY: number;
        zoomX: number;
        offsetRows: number;
        offsetX: number;
    }, canvasWidth: number, canvasHeight: number, showVolumeFootprint: boolean, TICK: number, baseRowPx: number, TEXT_VIS: {
        minZoomX: number;
        minRowPx: number;
        minBoxPx: number;
    });
    /** Returns the height of the chart area in pixels (excluding margins). */
    chartHeight(): number;
    /** Returns the current row height in pixels, adjusted for zoom. */
    rowHeightPx(): number;
    /** Returns the scaled spacing between candles, depending on volume footprint mode. */
    scaledSpacing(): number;
    scaledCandle(): number;
    scaledBox(): number;
    scaledImb(): number;
    shouldShowCellText(): boolean;
    priceToRowIndex(price: number): number;
    rowIndexToPrice(row: number): number;
    rowToY(row: number): number;
    priceToY(price: number): number;
    indexToX(i: number, startIndex: number): number;
    getVisibleRange(): {
        startIndex: number;
        endIndex: number;
    };
    computePriceBarLabels(): Array<{
        price: number;
        y: number;
    }>;
    formatK(v: number): string;
    private get xShift();
    screenXToDataIndex(screenX: number): number;
    screenXToExactDataIndex(screenX: number): number;
    screenYToPrice(screenY: number): number;
    private get ladderTop();
}
