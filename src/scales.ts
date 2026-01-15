/**
 * Provides coordinate transformation and scaling utilities for the chart.
 * Converts between screen pixels, data indices, and price values with zoom and pan support.
 */

import { CandleData } from './types';
import { formatNumber } from './helpers/utils';

/**
 * Handles coordinate transformations and scaling calculations for the chart.
 * Provides methods to convert between screen coordinates, data indices, and price levels.
 */
export class Scales {
  private data: CandleData[] = [];
  private margin: { top: number; bottom: number; left: number; right: number };
  private view: { zoomY: number; zoomX: number; offsetRows: number; offsetX: number };
  private canvasWidth: number;
  private canvasHeight: number;
  private showVolumeFootprint: boolean;
  private TICK: number;
  private baseRowPx: number;
  private TEXT_VIS: { minZoomX: number; minRowPx: number; minBoxPx: number };
  private showCVD: boolean;
  private cvdHeightRatio: number;
  private deltaTableHeight: number;
  private footprintStyle: 'bid_ask' | 'delta';
  private showOI: boolean;
  private oiHeightRatio: number;
  private showFundingRate: boolean;
  private fundingRateHeightRatio: number;

  // Cached ladderTop to prevent recalculation on every access
  private cachedLadderTop: number = 10000;
  private ladderTopDirty: boolean = true;

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
  constructor(
    data: CandleData[],
    margin: { top: number; bottom: number; left: number; right: number },
    view: { zoomY: number; zoomX: number; offsetRows: number; offsetX: number },
    canvasWidth: number,
    canvasHeight: number,
    showVolumeFootprint: boolean,
    TICK: number,
    baseRowPx: number,
    TEXT_VIS: { minZoomX: number; minRowPx: number; minBoxPx: number },
    showCVD: boolean = false,
    cvdHeightRatio: number = 0.2,
    deltaTableHeight: number = 0,
    footprintStyle: 'bid_ask' | 'delta' = 'bid_ask',
    showOI: boolean = false,
    oiHeightRatio: number = 0.15,
    showFundingRate: boolean = false,
    fundingRateHeightRatio: number = 0.1
  ) {
    this.data = data;
    this.margin = margin;
    this.view = view;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.showVolumeFootprint = showVolumeFootprint;
    this.TICK = TICK;
    this.baseRowPx = baseRowPx;
    this.TEXT_VIS = TEXT_VIS;
    this.showCVD = showCVD;
    this.cvdHeightRatio = cvdHeightRatio;
    this.deltaTableHeight = deltaTableHeight;
    this.footprintStyle = footprintStyle;
    this.showOI = showOI;
    this.oiHeightRatio = oiHeightRatio;
    this.showFundingRate = showFundingRate;
    this.fundingRateHeightRatio = fundingRateHeightRatio;
  }

  /** Returns the height of the main price chart area in pixels (excluding margins and indicators). */
  chartHeight(): number {
    const totalHeight = this.canvasHeight - this.margin.top - this.margin.bottom - this.deltaTableHeight;
    const indicatorsRatio = this.indicatorsPaneHeight();
    if (indicatorsRatio === 0) {
      return totalHeight;
    }
    // Reserve ratio for all indicators, plus gaps
    const numIndicators = (this.showCVD ? 1 : 0) + (this.showOI ? 1 : 0) + (this.showFundingRate ? 1 : 0);
    return totalHeight * (1 - indicatorsRatio) - numIndicators * 2; // 2px gap per indicator
  }

  /** Returns the height of the CVD pane. */
  cvdHeight(): number {
    if (!this.showCVD) return 0;
    const totalHeight = this.canvasHeight - this.margin.top - this.margin.bottom - this.deltaTableHeight;
    return totalHeight * this.cvdHeightRatio;
  }

  /** Returns the height of the delta table. */
  getDeltaTableHeight(): number {
    return this.deltaTableHeight;
  }

  /** Returns the Y coordinate where the CVD pane starts. */
  cvdOriginY(): number {
    return this.margin.top + this.chartHeight() + 2; // + 2px gap
  }

  /** Returns the height of the OI pane. */
  oiHeight(): number {
    if (!this.showOI) return 0;
    const totalHeight = this.canvasHeight - this.margin.top - this.margin.bottom - this.deltaTableHeight;
    return totalHeight * this.oiHeightRatio;
  }

  /** Returns the Y coordinate where the OI pane starts. */
  oiOriginY(): number {
    return this.cvdOriginY() + this.cvdHeight() + (this.showCVD ? 2 : 0);
  }

  /** Returns the height of the Funding Rate pane. */
  fundingRateHeight(): number {
    if (!this.showFundingRate) return 0;
    const totalHeight = this.canvasHeight - this.margin.top - this.margin.bottom - this.deltaTableHeight;
    return totalHeight * this.fundingRateHeightRatio;
  }

  /** Returns the Y coordinate where the Funding Rate pane starts. */
  fundingRateOriginY(): number {
    return this.oiOriginY() + this.oiHeight() + (this.showOI ? 2 : 0);
  }

  /** Returns the total height reserved for all indicator panes. */
  private indicatorsPaneHeight(): number {
    let total = 0;
    if (this.showCVD) total += this.cvdHeightRatio;
    if (this.showOI) total += this.oiHeightRatio;
    if (this.showFundingRate) total += this.fundingRateHeightRatio;
    return total;
  }

  /** Maps a CVD value to a Y coordinate within the CVD pane. */
  cvdToY(value: number, min: number, max: number): number {
    if (min === max) return this.cvdOriginY() + this.cvdHeight() / 2;
    const h = this.cvdHeight();
    const range = max - min;
    const ratio = (value - min) / range;
    // Invert Y because canvas Y increases downwards
    return this.cvdOriginY() + h - ratio * h;
  }

  /** Returns the margin configuration. */
  getMargin(): { top: number; bottom: number; left: number; right: number } {
    return this.margin;
  }

  /** Returns the current row height in pixels, adjusted for zoom. */
  rowHeightPx(): number {
    return this.baseRowPx * this.view.zoomY;
  }

  /** Returns the scaled spacing between candles, depending on volume footprint mode. */
  scaledSpacing(): number {
    if (!this.showVolumeFootprint) {
      return (10 + 1) * this.view.zoomX; // Candle width + 1px gap when volume footprint is off
    }
    if (this.footprintStyle === 'delta') {
      // Reduced spacing for delta mode (only right-side bars)
      // BASE_CANDLE (15) + BASE_BOX (55) + GAP (~5-10)
      return 75 * this.view.zoomX;
    }
    return 132 * this.view.zoomX; // Standard spacing (Candle + 2 * Box + gaps)
  }

  scaledCandle(): number {
    return 10 * this.view.zoomX; // BASE_CANDLE * zoomX
  }

  scaledBox(): number {
    return 55 * this.view.zoomX; // BASE_BOX * zoomX
  }

  scaledImb(): number {
    return 3 * this.view.zoomX; // Thinner imbalance boxes
  }

  shouldShowCellText(): boolean {
    return (
      this.view.zoomX >= this.TEXT_VIS.minZoomX &&
      this.rowHeightPx() >= this.TEXT_VIS.minRowPx &&
      this.scaledBox() >= this.TEXT_VIS.minBoxPx
    );
  }

  priceToRowIndex(price: number): number {
    return (this.ladderTop - price) / this.TICK + this.view.offsetRows;
  }

  rowIndexToPrice(row: number): number {
    return this.ladderTop - (row - this.view.offsetRows) * this.TICK;
  }

  rowToY(row: number): number {
    return this.margin.top + row * this.rowHeightPx();
  }

  priceToY(price: number): number {
    return this.rowToY(this.priceToRowIndex(price));
  }

  /** Returns the offset of the candle wick (center) from the start of the candle's slot. */
  private wickOffset(): number {
    if (this.footprintStyle === 'delta') {
      // Shift left: half candle width + small gap
      return this.scaledCandle() / 2 + 2;
    }
    // Centered in slot
    return this.scaledSpacing() / 2;
  }

  indexToX(i: number, startIndex: number): number {
    const s = this.scaledSpacing();
    return this.margin.left + (i - startIndex) * s + this.wickOffset() - this.xShift;
  }

  /** Returns the geometric center of the column/slot. ideal for text alignment. */
  getSlotCenter(i: number, startIndex: number): number {
    const s = this.scaledSpacing();
    return this.margin.left + (i - startIndex) * s + s / 2 - this.xShift;
  }

  getVisibleRange(): { startIndex: number; endIndex: number } {
    const s = this.scaledSpacing();
    const pixelOffset = this.view.offsetX;
    const startFloat = pixelOffset / s;
    const startIndex = Math.max(0, Math.floor(startFloat));
    const contentW = this.canvasWidth - this.margin.left - this.margin.right;
    const visibleCount = Math.ceil(contentW / s) + 2;
    const endIndex = Math.min(this.data.length, startIndex + visibleCount);
    return { startIndex, endIndex };
  }

  computePriceBarLabels(): Array<{ price: number; y: number }> {
    const pixelSpacing = 28;
    const chartHeightPx = this.chartHeight();
    const maxLabels = 7;
    const numLabels = Math.min(maxLabels, Math.floor(chartHeightPx / pixelSpacing));

    const pTop = this.rowIndexToPrice(0);
    const pBot = this.rowIndexToPrice(Math.floor(chartHeightPx / this.rowHeightPx()));
    const pMin = Math.min(pTop, pBot);
    const pMax = Math.max(pTop, pBot);
    const priceRange = pMax - pMin;

    const stepPrice = Math.max(this.TICK, priceRange / Math.max(1, numLabels - 1));

    let start = Math.ceil(pMin / stepPrice) * stepPrice;
    const out = [];
    for (let price = start; price <= pMax + 1e-6; price += stepPrice) {
      out.push({ price: Math.round(price), y: this.priceToY(price) });
    }
    return out;
  }

  formatK(v: number): string {
    return formatNumber(v);
  }

  private get xShift(): number {
    const s = this.scaledSpacing();
    const pixelOffset = this.view.offsetX;
    const startFloat = pixelOffset / s;
    const startIndex = Math.max(0, Math.floor(startFloat));
    const shift = pixelOffset - startIndex * s;
    return shift < 0 ? shift + s : shift;
  }

  screenXToDataIndex(screenX: number): number {
    const vr = this.getVisibleRange();
    const s = this.scaledSpacing();
    // Reverse the calculation: x = margin + relative_i * s + wickOffset - xShift
    // relative_i * s = x - margin - wickOffset + xShift
    const relativeX = screenX - this.margin.left + this.xShift - this.wickOffset();
    return vr.startIndex + Math.floor(relativeX / s);
  }

  // Exact fractional data index for precise drawing coordinates
  screenXToExactDataIndex(screenX: number): number {
    const vr = this.getVisibleRange();
    const s = this.scaledSpacing();
    const relativeX = screenX - this.margin.left + this.xShift - this.wickOffset();
    return vr.startIndex + relativeX / s;
  }

  screenYToPrice(screenY: number): number {
    // Use the exact same calculation as the crosshair
    return this.rowIndexToPrice(
      (screenY - this.margin.top) / this.rowHeightPx() + this.view.offsetRows
    );
  }

  private get ladderTop(): number {
    if (this.ladderTopDirty) {
      this.cachedLadderTop = this.calculateLadderTop();
      this.ladderTopDirty = false;
    }
    return this.cachedLadderTop;
  }

  private calculateLadderTop(): number {
    if (this.data.length === 0) return 10000;

    // Collect all footprint prices
    const allPrices = new Set<number>();
    for (const candle of this.data) {
      for (const level of candle.footprint) {
        allPrices.add(level.price);
      }
      // Include OHLC
      allPrices.add(candle.open);
      allPrices.add(candle.high);
      allPrices.add(candle.low);
      allPrices.add(candle.close);
    }

    if (allPrices.size === 0) {
      return Math.ceil(Math.max(...this.data.map(c => c.high)) / this.TICK) * this.TICK + 10 * this.TICK;
    }

    const prices = Array.from(allPrices).sort((a, b) => b - a);
    const maxPrice = prices[0];
    const minPrice = prices[prices.length - 1];
    const range = maxPrice - minPrice;

    // Add padding: minimum 2 ticks or 10% of range
    const padding = Math.max(this.TICK * 2, range * 0.1);
    return maxPrice + padding;
  }

  public invalidateLadderTop(): void {
    this.ladderTopDirty = true;
  }
}