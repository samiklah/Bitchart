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
  private volumeHeatmapDynamic: boolean;
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
    volumeHeatmapDynamic: boolean,
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
    this.volumeHeatmapDynamic = volumeHeatmapDynamic;
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
    this.drawScales(width, height);
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

    // Choose data range based on dynamic flag
    const startIndex = this.volumeHeatmapDynamic ? vr.startIndex : 0;
    const endIndex = this.volumeHeatmapDynamic ? vr.endIndex : this.data.length;

    // Aggregate volumes per price level across selected candles
    const volumeMap = new Map<number, number>();
    for (let i = startIndex; i < endIndex; i++) {
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
      const alpha = maxVolume > 0 ? (volume / maxVolume) * 0.6 : 0; // Reduced brightness to 60% max
      this.ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
      this.ctx.fillRect(this.margin.left, yTop, width - this.margin.left - this.margin.right, h);
    }
    this.ctx.restore();
  }


  private drawScales(width: number, height: number): void {
    // Timeline position (fixed at bottom, CVD is drawn separately above it)
    const timelineY = height - this.margin.bottom;

    // Draw price bar (unchanged)
    const right = width - this.margin.right;
    this.ctx.fillStyle = this.theme.scaleBackground || '#111';
    this.ctx.fillRect(right, 0, this.margin.right, height);
    this.ctx.strokeStyle = this.theme.scaleBorder || '#444';
    this.ctx.strokeRect(right + 0.5, this.margin.top, 0.5, height - this.margin.top - this.margin.bottom);

    // Price labels
    this.ctx.fillStyle = this.theme.textColor || '#aaa';
    this.ctx.font = '12px system-ui';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    const labels = this.scales.computePriceBarLabels();
    for (const { price, y } of labels) {
      this.ctx.fillText(this.scales.formatK(price), right + this.margin.right / 2, y);
    }

    // Draw timeline at bottom
    const chartW = width - this.margin.left - this.margin.right;
    this.ctx.fillStyle = this.theme.scaleBackground || '#111';
    this.ctx.fillRect(this.margin.left, timelineY, chartW, this.margin.bottom);
    this.ctx.strokeStyle = this.theme.scaleBorder || '#444';
    this.ctx.beginPath();
    this.ctx.moveTo(this.margin.left, timelineY + 0.5);
    this.ctx.lineTo(this.margin.left + chartW, timelineY + 0.5);
    this.ctx.stroke();

    // Timeline labels
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(this.margin.left, timelineY, chartW, this.margin.bottom);
    this.ctx.clip();
    this.ctx.fillStyle = this.theme.textColor || '#aaa';
    this.ctx.font = '12px system-ui';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    const step = Math.max(1, Math.floor(120 / this.scales.scaledSpacing()));
    const vr = this.scales.getVisibleRange();
    for (let i = vr.startIndex; i < vr.endIndex; i += step) {
      const x = this.scales.indexToX(i, vr.startIndex);
      const date = new Date(this.data[i].time);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const t = `${hours}:${minutes}`;
      this.ctx.fillText(t, x, timelineY + this.margin.bottom / 2);
    }
    this.ctx.restore();
  }
}