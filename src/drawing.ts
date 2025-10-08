import { CandleData, VFCTheme, MeasureRectangle } from './types';
import { Scales } from './scales';
import { drawFootprint } from './drawing/footprint';
import { drawScales } from './drawing/scales';
import { drawGrid, drawBounds } from './drawing/grid';
import { drawCrosshair, drawCurrentPriceLabel } from './drawing/crosshair';
import { drawMeasureRectangle } from './drawing/measure';

/**
 * Handles all rendering operations for the Volume Footprint Chart.
 * Responsible for drawing grid, chart elements, scales, crosshair, and measurements.
 */

export class Drawing {
  private ctx: CanvasRenderingContext2D;
  private data: CandleData[];
  private margin: { top: number; bottom: number; left: number; right: number };
  private view: { zoomY: number; zoomX: number; offsetRows: number; offsetX: number };
  private showGrid: boolean;
  private showBounds: boolean;
  private showVolumeFootprint: boolean;
  private showVolumeHeatmap: boolean;
  private scales: Scales;
  private theme: VFCTheme;
  private crosshair: { x: number; y: number; visible: boolean };
  private lastPrice: number | null;
  private interactions: any; // Reference to Interactions class to get dynamic measure rectangle

  constructor(
    ctx: CanvasRenderingContext2D,
    data: CandleData[],
    margin: { top: number; bottom: number; left: number; right: number },
    view: { zoomY: number; zoomX: number; offsetRows: number; offsetX: number },
    showGrid: boolean,
    showBounds: boolean,
    showVolumeFootprint: boolean,
    showVolumeHeatmap: boolean,
    scales: Scales,
    theme: VFCTheme,
    crosshair: { x: number; y: number; visible: boolean },
    lastPrice: number | null,
    interactions: any
  ) {
    this.ctx = ctx;
    this.data = data;
    this.margin = margin;
    this.view = view;
    this.showGrid = showGrid;
    this.showBounds = showBounds;
    this.showVolumeFootprint = showVolumeFootprint;
    this.showVolumeHeatmap = showVolumeHeatmap;
    this.scales = scales;
    this.theme = theme;
    this.crosshair = crosshair;
    this.lastPrice = lastPrice;
    this.interactions = interactions;
  }

  drawAll(): void {
    const width = this.ctx.canvas.width / window.devicePixelRatio;
    const height = this.ctx.canvas.height / window.devicePixelRatio;
    this.ctx.clearRect(0, 0, width, height);
    if (this.showGrid) drawGrid(this.ctx, width, this.margin, this.scales, this.theme);
    if (this.showVolumeHeatmap) this.drawVolumeHeatmap();
    this.drawChart();
    drawMeasureRectangle(this.ctx, this.interactions.getMeasureRectangle(), this.scales, this.theme);
    drawScales(this.ctx, width, height, this.margin, this.scales, this.data, this.theme);
    drawCurrentPriceLabel(this.ctx, width, this.lastPrice, this.margin, this.scales, this.theme);
    if (this.crosshair.visible) drawCrosshair(this.ctx, width, height, this.margin, this.crosshair, this.scales, this.data, this.theme);
    if (this.showBounds) drawBounds(this.ctx, width, height, this.margin, this.scales);
  }

  private drawChart(): void {
    this.ctx.save();
    const width = this.ctx.canvas.width / window.devicePixelRatio;
    this.ctx.beginPath();
    this.ctx.rect(
      this.margin.left,
      this.margin.top,
      width - this.margin.left - this.margin.right,
      this.scales.chartHeight()
    );
    this.ctx.clip();

    const vr = this.scales.getVisibleRange();
    for (let i = vr.startIndex; i < vr.endIndex; i++) {
      drawFootprint(this.ctx, this.data[i], i, vr.startIndex, this.scales, this.theme, this.view, this.showVolumeFootprint);
    }
    this.ctx.restore();
  }

  private drawVolumeHeatmap(): void {
    const vr = this.scales.getVisibleRange();
    if (vr.endIndex <= vr.startIndex) return;

    // Aggregate volumes per price level across visible candles
    const volumeMap = new Map<number, number>();
    for (let i = vr.startIndex; i < vr.endIndex; i++) {
      const candle = this.data[i];
      for (const level of candle.footprint) {
        const totalVol = level.buy + level.sell;
        volumeMap.set(level.price, (volumeMap.get(level.price) || 0) + totalVol);
      }
    }

    if (volumeMap.size === 0) return;

    // Find max volume
    const maxVolume = Math.max(...volumeMap.values());

    // Draw heatmap
    this.ctx.save();
    const width = this.ctx.canvas.width / window.devicePixelRatio;
    this.ctx.beginPath();
    this.ctx.rect(
      this.margin.left,
      this.margin.top,
      width - this.margin.left - this.margin.right,
      this.scales.chartHeight()
    );
    this.ctx.clip();

    for (const [price, volume] of volumeMap) {
      const row = this.scales.priceToRowIndex(price);
      const yTop = this.scales.rowToY(row - 0.5);
      const yBot = this.scales.rowToY(row + 0.5);
      const h = Math.max(1, yBot - yTop);
      const alpha = maxVolume > 0 ? volume / maxVolume : 0;
      this.ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
      this.ctx.fillRect(this.margin.left, yTop, width - this.margin.left - this.margin.right, h);
    }
    this.ctx.restore();
  }
}