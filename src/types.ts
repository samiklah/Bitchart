/**
 * Type definitions and interfaces for the Volume Footprint Chart library.
 * Contains data structures, configuration options, and event types used throughout the application.
 */

/**
 * Represents a single candlestick data point with volume footprint information.
 */
export interface CandleData {
  /** Timestamp of the candlestick in ISO string format */
  time: string;
  /** Opening price of the candlestick */
  open: number;
  /** Highest price reached during the period */
  high: number;
  /** Lowest price reached during the period */
  low: number;
  /** Closing price of the candlestick */
  close: number;
  /** Array of footprint levels containing buy/sell volumes at different prices */
  footprint: FootprintLevel[];
}

/**
 * Represents a single price level in the volume footprint with buy and sell volumes.
 */
export interface FootprintLevel {
  /** The price level */
  price: number;
  /** Volume bought at this price level */
  buy: number;
  /** Volume sold at this price level */
  sell: number;
}

/**
 * Theme configuration for customizing the visual appearance of the Volume Footprint Chart.
 * All properties are optional and will use default values if not specified.
 */
export interface VFCTheme {
  // Background colors
  /** Main chart background color */
  background?: string;
  /** Primary grid line color */
  gridColor?: string;
  /** Secondary (light) grid line color */
  gridLightColor?: string;

  // Text colors
  /** Primary text color for labels and scales */
  textColor?: string;
  /** Bright text color for emphasis */
  textColorBright?: string;
  /** Dim text color for secondary information */
  textColorDim?: string;

  // Candle colors
  /** Color for bullish (green) candles */
  candleBull?: string;
  /** Color for bearish (red) candles */
  candleBear?: string;

  // Volume colors (opacity values)
  /** Opacity for buy volume visualization */
  volumeBuyOpacity?: number;
  /** Opacity for sell volume visualization */
  volumeSellOpacity?: number;
  /** Base opacity for buy volume areas */
  volumeBuyBase?: number;
  /** Base opacity for sell volume areas */
  volumeSellBase?: number;

  // POC (Point of Control) colors
  /** Background color for Point of Control level */
  pocColor?: string;
  /** Text color for POC labels */
  pocTextColor?: string;

  // VAH/VAL (Value Area High/Low) colors
  /** Color for VAH/VAL boundary lines */
  vahValColor?: string;
  /** Color for VAH/VAL text labels */
  vahValLabelColor?: string;

  // Delta/Total colors
  /** Color for positive delta values */
  deltaPositive?: string;
  /** Color for negative delta values */
  deltaNegative?: string;
  /** Color for total volume display */
  totalColor?: string;

  // Imbalance colors
  /** Color for buy-side imbalance indicators */
  imbalanceBuy?: string;
  /** Color for sell-side imbalance indicators */
  imbalanceSell?: string;

  // Scale colors
  /** Background color for price/time scales */
  scaleBackground?: string;
  /** Border color for scale areas */
  scaleBorder?: string;
}

/**
 * Configuration options for the Volume Footprint Chart.
 * All properties are optional and will use sensible defaults if not provided.
 */
export interface VFCOptions {
  /** Chart width in pixels. Defaults to container width or 800px */
  width?: number;
  /** Chart height in pixels. Defaults to container height or 600px */
  height?: number;
  /** Whether to display grid lines. Default: true */
  showGrid?: boolean;
  /** Whether to show chart boundary outlines. Default: false */
  showBounds?: boolean;
  /** Whether to display volume footprint data. Default: true */
  showVolumeFootprint?: boolean;
  /** Whether to display volume heatmap overlay. Default: false */
  showVolumeHeatmap?: boolean;
  /** Whether volume heatmap updates with visible range. Default: true */
  volumeHeatmapDynamic?: boolean;
  /** Price tick size for footprint levels. Default: 10 */
  tickSize?: number;
  /** Initial horizontal zoom level (time axis). Default: 0.55 */
  initialZoomX?: number;
  /** Initial vertical zoom level (price axis). Default: 0.55 */
  initialZoomY?: number;
  /** Margin configuration for chart layout */
  margin?: {
    /** Top margin in pixels */
    top: number;
    /** Bottom margin in pixels */
    bottom: number;
    /** Left margin in pixels */
    left: number;
    /** Right margin in pixels */
    right: number;
  };
  /** Custom color theme for the chart */
  theme?: VFCTheme;
  /** Style of footprint visualization: 'bid_ask' (default) or 'delta' */
  footprintStyle?: 'bid_ask' | 'delta';
  /** Whether to show the Cumulative Volume Delta (CVD) indicator. Default: false */
  showCVD?: boolean;
  /** Height ratio for the CVD pane (0 to 1). Default: 0.2 */
  cvdHeightRatio?: number;
  /** Method for calculating CVD: 'ticker' (user formula) or 'footprint' (standard). Default: 'ticker' */
  cvdType?: 'ticker' | 'footprint';
  /** Whether to show delta values in a table below the chart instead of under candles. Default: false */
  showDeltaTable?: boolean;
  /** Which table rows to show. Default: all true */
  tableRowVisibility?: {
    volume?: boolean;
    volChange?: boolean;
    buyVol?: boolean;
    buyVolPercent?: boolean;
    sellVol?: boolean;
    sellVolPercent?: boolean;
    delta?: boolean;
    deltaPercent?: boolean;
    minDelta?: boolean;
    maxDelta?: boolean;
    poc?: boolean;
    hlRange?: boolean;
  };
  /** Height of each row in the delta table in pixels. Default: 16 */
  tableRowHeight?: number;
}

/**
 * Event callbacks for chart interactions.
 * All callbacks are optional and provide hooks for custom behavior.
 */
export interface VFCEvents {
  /** Called when zoom levels change. Parameters: zoomX (time axis), zoomY (price axis) */
  onZoom?: (zoomX: number, zoomY: number) => void;
  /** Called when panning occurs. Parameters: offsetX (time offset), offsetRows (price offset) */
  onPan?: (offsetX: number, offsetRows: number) => void;
  /** Called when mouse moves over chart. Parameters: x, y (screen coordinates), visible (cursor visibility) */
  onMouseMove?: (x: number, y: number, visible: boolean) => void;
  /** Called when the delta table is resized. Parameters: height (new table height in pixels) */
  onTableResize?: (height: number) => void;
}

/**
 * Represents a measurement rectangle drawn on the chart for analysis.
 */
export interface MeasureRectangle {
  /** Screen X coordinate for the starting point of the rectangle */
  startX: number;
  /** Screen Y coordinate for the starting point of the rectangle */
  startY: number;
  /** Screen X coordinate for the ending point of the rectangle */
  endX: number;
  /** Screen Y coordinate for the ending point of the rectangle */
  endY: number;
}

/**
 * @deprecated Use the VFCEvents interface above instead. This duplicate will be removed in a future version.
 */