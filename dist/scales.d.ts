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
    private showCVD;
    private cvdHeightRatio;
    private deltaTableHeight;
    private footprintStyle;
    private showOI;
    private oiHeightRatio;
    private showFundingRate;
    private fundingRateHeightRatio;
    private cachedLadderTop;
    private ladderTopDirty;
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
     * @param showCVD Whether CVD indicator is shown
     * @param cvdHeightRatio Ratio of total height used for CVD
     * @param showOI Whether OI indicator is shown
     * @param oiHeightRatio Ratio of total height used for OI
     * @param showFundingRate Whether funding rate indicator is shown
     * @param fundingRateHeightRatio Ratio of total height used for funding rate
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
    }, showCVD?: boolean, cvdHeightRatio?: number, deltaTableHeight?: number, footprintStyle?: 'bid_ask' | 'delta', showOI?: boolean, oiHeightRatio?: number, showFundingRate?: boolean, fundingRateHeightRatio?: number);
    /** Returns the height of the main price chart area in pixels (excluding margins and indicators). */
    chartHeight(): number;
    /** Returns the height of the CVD pane. */
    cvdHeight(): number;
    /** Returns the height of the delta table. */
    getDeltaTableHeight(): number;
    /** Returns the Y coordinate where the CVD pane starts. */
    cvdOriginY(): number;
    /** Returns the height of the OI pane. */
    oiHeight(): number;
    /** Returns the Y coordinate where the OI pane starts. */
    oiOriginY(): number;
    /** Returns the height of the Funding Rate pane. */
    fundingRateHeight(): number;
    /** Returns the Y coordinate where the Funding Rate pane starts. */
    fundingRateOriginY(): number;
    /** Returns the total height reserved for all indicator panes. */
    private indicatorsPaneHeight;
    /** Maps a CVD value to a Y coordinate within the CVD pane. */
    cvdToY(value: number, min: number, max: number): number;
    /** Returns the margin configuration. */
    getMargin(): {
        top: number;
        bottom: number;
        left: number;
        right: number;
    };
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
    /** Returns the offset of the candle wick (center) from the start of the candle's slot. */
    private wickOffset;
    indexToX(i: number, startIndex: number): number;
    /** Returns the geometric center of the column/slot. ideal for text alignment. */
    getSlotCenter(i: number, startIndex: number): number;
    getVisibleRange(): {
        startIndex: number;
        endIndex: number;
    };
    computePriceBarLabels(): Array<{
        price: number;
        y: number;
    }>;
    formatK(v: number): string;
    /**
     * Returns the number of decimal places to use for price formatting based on TICK size.
     * E.g., TICK=0.01 -> 2, TICK=0.0001 -> 4, TICK=10 -> 0
     */
    getPricePrecision(): number;
    private get xShift();
    screenXToDataIndex(screenX: number): number;
    screenXToExactDataIndex(screenX: number): number;
    screenYToPrice(screenY: number): number;
    private get ladderTop();
    private calculateLadderTop;
    invalidateLadderTop(): void;
}
