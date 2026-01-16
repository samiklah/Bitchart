/**
 * Type definitions for the Depth of Market (DOM) component.
 */
/**
 * Represents a single price level in the DOM.
 */
export interface DOMLevel {
    /** The price level */
    price: number;
    /** Bid quantity from orderbook (limit orders) */
    bid: number;
    /** Ask quantity from orderbook (limit orders) */
    ask: number;
    /** Volume sold at this price (completed transactions hitting bid) */
    sold: number;
    /** Volume bought at this price (completed transactions hitting ask) */
    bought: number;
    /** Delta: bought - sold */
    delta: number;
    /** Total volume traded at this price */
    volume: number;
}
/**
 * Data structure for DOM updates.
 */
export interface DOMData {
    /** Exchange identifier */
    exchange: string;
    /** Trading symbol (e.g., BTCUSDT) */
    symbol: string;
    /** Current mid-market price */
    midPrice: number;
    /** Timestamp in milliseconds */
    timestamp: number;
    /** Data start time for the session */
    dataStartTime: number;
    /** Session high price */
    sessionHigh: number;
    /** Session low price */
    sessionLow: number;
    /** Array of price levels */
    levels: DOMLevel[];
}
/**
 * Theme configuration for DOM colors and styling.
 */
export interface DOMTheme {
    /** Background color */
    background?: string;
    /** Row background color (even rows) */
    rowBackgroundEven?: string;
    /** Row background color (odd rows) */
    rowBackgroundOdd?: string;
    /** Header background color */
    headerBackground?: string;
    /** Text color */
    textColor?: string;
    /** Header text color */
    headerTextColor?: string;
    /** Bid bar color (green) */
    bidColor?: string;
    /** Ask bar color (red) */
    askColor?: string;
    /** Positive delta color */
    deltaPositive?: string;
    /** Negative delta color */
    deltaNegative?: string;
    /** Mid-price highlight color */
    midPriceColor?: string;
    /** @Bid market order highlight color */
    atBidColor?: string;
    /** @Ask market order highlight color */
    atAskColor?: string;
    /** Grid line color */
    gridColor?: string;
    /** Price column background */
    priceColumnBackground?: string;
}
/**
 * Configuration options for the DOM component.
 */
export interface DOMOptions {
    /** Width in pixels */
    width?: number;
    /** Height in pixels */
    height?: number;
    /** Row height in pixels */
    rowHeight?: number;
    /** Number of price levels to display */
    visibleLevels?: number;
    /** Font size for text */
    fontSize?: number;
    /** Font family */
    fontFamily?: string;
    /** Show headers row */
    showHeaders?: boolean;
    /** Custom theme */
    theme?: DOMTheme;
    /** Column visibility */
    columns?: {
        bidVol?: boolean;
        askVol?: boolean;
        bid?: boolean;
        atBid?: boolean;
        atAsk?: boolean;
        ask?: boolean;
        price?: boolean;
        deltaVol?: boolean;
        volume?: boolean;
    };
}
/**
 * Column configuration for rendering.
 */
export interface DOMColumn {
    id: string;
    label: string;
    width: number;
    align: 'left' | 'center' | 'right';
    getValue: (level: DOMLevel) => string | number;
    getBarValue?: (level: DOMLevel, maxValue: number) => number;
    barColor?: string | ((level: DOMLevel) => string);
    barSide?: 'left' | 'right';
}
