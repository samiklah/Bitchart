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
  private interactions: any;
  private cvdValues: number[] = [];

  public updateCVD(values: number[]) {
    this.cvdValues = values;
  }

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
    interactions: any,
    cvdValues: number[] = []
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
    this.cvdValues = cvdValues;
  }

  drawAll(): void {
    const width = this.ctx.canvas.width / window.devicePixelRatio;
    const height = this.ctx.canvas.height / window.devicePixelRatio;
    this.ctx.clearRect(0, 0, width, height);
    if (this.showGrid) drawGrid(this.ctx, width, this.margin, this.scales, this.theme);
    if (this.showVolumeHeatmap) this.drawVolumeHeatmap();
    this.drawChart();
    if (this.scales.cvdHeight() > 0) this.drawCVD();
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

  private drawCVD(): void {
    const h = this.scales.cvdHeight();
    if (h <= 0) return;

    const vr = this.scales.getVisibleRange();
    if (vr.startIndex >= this.cvdValues.length) return;

    // Determine min/max for CURRENT VIEW
    let min = Infinity;
    let max = -Infinity;
    for (let i = vr.startIndex; i < Math.min(vr.endIndex, this.cvdValues.length); i++) {
      const v = this.cvdValues[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }

    if (min === Infinity) return;

    const range = max - min;
    if (range === 0) {
      min -= 1;
      max += 1;
    } else {
      const pad = range * 0.1;
      min -= pad;
      max += pad;
    }

    const ctx = this.ctx;
    const originY = this.scales.cvdOriginY();
    const width = this.ctx.canvas.width / window.devicePixelRatio;

    // Draw divider line (draggable border between chart and CVD)
    ctx.save();
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.margin.left, originY);
    ctx.lineTo(width - this.margin.right, originY);
    ctx.stroke();
    ctx.restore();

    // Draw background
    ctx.save();
    ctx.fillStyle = this.theme.background || '#000';
    ctx.fillRect(this.margin.left, originY, width - this.margin.left - this.margin.right, h);

    // Clip
    ctx.beginPath();
    ctx.rect(this.margin.left, originY, width - this.margin.left - this.margin.right, h);
    ctx.clip();

    // Draw Zero line
    if (min < 0 && max > 0) {
      const yZero = this.scales.cvdToY(0, min, max);
      ctx.strokeStyle = '#333';
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(this.margin.left, yZero);
      ctx.lineTo(width - this.margin.right, yZero);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw CVD Line
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.beginPath();

    let first = true;
    for (let i = vr.startIndex; i < Math.min(vr.endIndex, this.cvdValues.length); i++) {
      const x = this.scales.indexToX(i, vr.startIndex);
      const y = this.scales.cvdToY(this.cvdValues[i], min, max);
      if (first) {
        ctx.moveTo(x, y);
        first = false;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.restore();

    // Draw CVD Y-Axis Labels Area
    const right = width - this.margin.right;
    ctx.save();
    ctx.fillStyle = this.theme.scaleBackground || '#111';
    ctx.fillRect(right, originY, this.margin.right, h);
    ctx.strokeStyle = this.theme.scaleBorder || '#444';
    ctx.strokeRect(right + 0.5, originY, 0.5, h);

    // Labels
    ctx.fillStyle = this.theme.textColor || '#aaa';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '10px system-ui';

    // Draw evenly spaced labels (5 labels total)
    const numLabels = 5;
    for (let i = 0; i < numLabels; i++) {
      const value = max - (i * (max - min) / (numLabels - 1));
      const yPos = this.scales.cvdToY(value, min, max);
      if (yPos >= originY + 8 && yPos <= originY + h - 8) {
        ctx.fillText(this.scales.formatK(value), right + 5, yPos);
      }
    }

    ctx.restore();
  }

  private drawScales(width: number, height: number): void {
    // Timeline position (fixed at bottom, CVD is drawn separately above it)
    const timelineY = height - this.margin.bottom;

    // Draw price bar (unchanged)
    const right = width - this.margin.right;
    this.ctx.fillStyle = this.theme.scaleBackground || '#111';
    this.ctx.fillRect(right, 0, this.margin.right, this.scales.chartHeight()); // Only fill price chart height
    this.ctx.strokeStyle = this.theme.scaleBorder || '#444';
    this.ctx.strokeRect(right + 0.5, this.margin.top, 0.5, this.scales.chartHeight());

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