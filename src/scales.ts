import { CandleData } from './types';

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

  constructor(
    data: CandleData[],
    margin: { top: number; bottom: number; left: number; right: number },
    view: { zoomY: number; zoomX: number; offsetRows: number; offsetX: number },
    canvasWidth: number,
    canvasHeight: number,
    showVolumeFootprint: boolean,
    TICK: number,
    baseRowPx: number,
    TEXT_VIS: { minZoomX: number; minRowPx: number; minBoxPx: number }
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
  }

  chartHeight(): number {
    return this.canvasHeight - this.margin.top - this.margin.bottom;
  }

  rowHeightPx(): number {
    return this.baseRowPx * this.view.zoomY;
  }

  scaledSpacing(): number {
    if (!this.showVolumeFootprint) {
      return (15 + 1) * this.view.zoomX; // Candle width + 1px gap when volume footprint is off
    }
    return 132 * this.view.zoomX; // Reduced spacing for closer candle layout
  }

  scaledCandle(): number {
    return 15 * this.view.zoomX; // BASE_CANDLE * zoomX
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

  indexToX(i: number, startIndex: number): number {
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
    const a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toFixed(2) + "M";
    if (a >= 1e3) return (v / 1e3).toFixed(2) + "K";
    return Math.round(v).toString();
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
    const relativeX = screenX - this.margin.left + this.xShift - s / 2;
    return vr.startIndex + Math.floor(relativeX / s);
  }

  // Exact fractional data index for precise drawing coordinates
  screenXToExactDataIndex(screenX: number): number {
    const vr = this.getVisibleRange();
    const s = this.scaledSpacing();
    const relativeX = screenX - this.margin.left + this.xShift - s / 2;
    return vr.startIndex + relativeX / s;
  }

  screenYToPrice(screenY: number): number {
    // Use the exact same calculation as the crosshair
    return this.rowIndexToPrice(
      (screenY - this.margin.top) / this.rowHeightPx() + this.view.offsetRows
    );
  }

  private get ladderTop(): number {
    if (this.data.length === 0) return 10000;
    return Math.ceil(Math.max(...this.data.map(c => c.high)) / this.TICK) * this.TICK + 10 * this.TICK;
  }
}