export interface CandleData {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    footprint: FootprintLevel[];
}
export interface FootprintLevel {
    price: number;
    buy: number;
    sell: number;
}
export interface VFCTheme {
    background?: string;
    gridColor?: string;
    gridLightColor?: string;
    textColor?: string;
    textColorBright?: string;
    textColorDim?: string;
    candleBull?: string;
    candleBear?: string;
    volumeBuyOpacity?: number;
    volumeSellOpacity?: number;
    volumeBuyBase?: number;
    volumeSellBase?: number;
    pocColor?: string;
    pocTextColor?: string;
    vahValColor?: string;
    vahValLabelColor?: string;
    deltaPositive?: string;
    deltaNegative?: string;
    totalColor?: string;
    imbalanceBuy?: string;
    imbalanceSell?: string;
    scaleBackground?: string;
    scaleBorder?: string;
}
export interface VFCOptions {
    width?: number;
    height?: number;
    showGrid?: boolean;
    showBounds?: boolean;
    tickSize?: number;
    initialZoomX?: number;
    initialZoomY?: number;
    margin?: {
        top: number;
        bottom: number;
        left: number;
        right: number;
    };
    theme?: VFCTheme;
}
export interface VFCEvents {
    onZoom?: (zoomX: number, zoomY: number) => void;
    onPan?: (offsetX: number, offsetRows: number) => void;
}
export interface VFCEvents {
    onZoom?: (zoomX: number, zoomY: number) => void;
    onPan?: (offsetX: number, offsetRows: number) => void;
}
