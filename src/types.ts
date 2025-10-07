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
  // Background colors
  background?: string;           // Chart background (#181a1f)
  gridColor?: string;            // Grid lines (#333)
  gridLightColor?: string;       // Light grid lines (#252525)

  // Text colors
  textColor?: string;            // Main text (#aaa)
  textColorBright?: string;      // Bright text (#ddd)
  textColorDim?: string;         // Dim text (#cfd3d6)

  // Candle colors
  candleBull?: string;           // Bullish candle (#26a69a)
  candleBear?: string;           // Bearish candle (#ef5350)

  // Volume colors (opacity values)
  volumeBuyOpacity?: number;     // Buy volume opacity (0.2)
  volumeSellOpacity?: number;    // Sell volume opacity (0.2)
  volumeBuyBase?: number;        // Buy volume base opacity (0.2)
  volumeSellBase?: number;       // Sell volume base opacity (0.2)

  // POC colors
  pocColor?: string;             // Point of Control (#bfc3c7)
  pocTextColor?: string;         // POC text color (#ddd)

  // VAH/VAL colors
  vahValColor?: string;          // VAH/VAL lines (#9ca3af)
  vahValLabelColor?: string;     // VAH/VAL labels (#cfd3d6)

  // Delta/Total colors
  deltaPositive?: string;        // Positive delta (#16a34a)
  deltaNegative?: string;        // Negative delta (#dc2626)
  totalColor?: string;           // Total volume (#fff)

  // Imbalance colors
  imbalanceBuy?: string;         // Buy imbalance (#16a34a)
  imbalanceSell?: string;        // Sell imbalance (#dc2626)

  // Scale colors
  scaleBackground?: string;      // Price bar background (#111)
  scaleBorder?: string;          // Scale borders (#444)
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
  theme?: VFCTheme;  // Custom color theme
}

export interface VFCEvents {
  onZoom?: (zoomX: number, zoomY: number) => void;
  onPan?: (offsetX: number, offsetRows: number) => void;
}

export interface VFCEvents {
  onZoom?: (zoomX: number, zoomY: number) => void;
  onPan?: (offsetX: number, offsetRows: number) => void;
}