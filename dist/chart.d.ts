/**
 * Main chart implementation for the Volume Footprint Chart.
 * Provides the primary API for creating and managing chart instances with modular components.
 */
import { CandleData, VFCOptions, VFCEvents } from './types';
import { Timeframe } from './aggregator';
export declare class Chart {
    private canvas;
    private ctx;
    private data;
    private options;
    private events;
    private margin;
    private view;
    private showGrid;
    private showBounds;
    private showVolumeFootprint;
    private showVolumeHeatmap;
    private volumeHeatmapDynamic;
    private crosshair;
    private lastPrice;
    private cvdType;
    private resetZoomBtn;
    private toggleGridBtn;
    private viewModeSelect;
    private volumeHeatmapBtn;
    private volumeHeatmapDropdown;
    private measureBtn;
    private cvdBtn;
    private cvdDropdown;
    private aggregator;
    private currentTimeframe;
    private timeframeButtons;
    private isAggregatedData;
    private showCVD;
    private cvdDynamic;
    private cvdValues;
    private cvdBaseline;
    private cvdNormalize;
    private showDeltaTable;
    private deltaTableBtn;
    private editBtn;
    private editPopup;
    private TICK;
    private detectTickSize;
    private readonly BASE_CANDLE;
    private readonly BASE_BOX;
    private readonly BASE_IMBALANCE;
    private readonly BASE_SPACING;
    private readonly FIXED_GAP;
    private readonly baseRowPx;
    private readonly TEXT_VIS;
    private scales;
    private interactions;
    private drawing;
    private createChartStructure;
    private setupToolbarEventHandlers;
    /**
     * Initializes the canvas element and context.
     * @param container The container element
     * @param chartContainer The chart container element
     */
    private initializeCanvas;
    /**
     * Initializes chart options with defaults and user-provided values.
     * @param options User-provided options
     * @param container The container element
     * @param chartContainer The chart container element
     */
    private initializeOptions;
    /**
     * Initializes the chart modules (Scales, Interactions, Drawing).
     */
    private initializeModules;
    constructor(container: HTMLElement, options?: VFCOptions, events?: VFCEvents);
    private setupCanvas;
    private bindEvents;
    private bindToolbarEvents;
    private handleWheel;
    private handlePointerDown;
    private layout;
    setData(data: CandleData[]): void;
    updateOptions(options: Partial<VFCOptions>): void;
    resize(width: number, height: number): void;
    destroy(): void;
    private calculateCVD;
    addCandle(candle: CandleData): void;
    private updateButtonText;
    /** Calculate the height of the delta table based on visible rows */
    private getDeltaTableHeight;
    private hideAllDropdowns;
    /**
     * Set the timeframe for aggregation and update display
     */
    setTimeframe(tf: Timeframe): void;
    /**
     * Get the current timeframe
     */
    getTimeframe(): Timeframe;
    /**
     * Set the base 1-minute data and display at current timeframe
     */
    set1mData(data: CandleData[]): void;
    /**
     * Update or add a 1-minute candle (for live updates)
     * If the candle has the same timestamp as the last candle, it updates it
     * Otherwise, it adds a new candle
     */
    update1mCandle(candle: CandleData): void;
    getOptions(): Required<VFCOptions>;
    getShowGrid(): boolean;
}
