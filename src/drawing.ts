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
  private showDeltaTable: boolean = false;
  private tableRowVisibility: {
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
  } = {};
  private tableRowHeight: number = 16;
  private footprintStyle: 'bid_ask' | 'delta' = 'bid_ask';

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
    cvdValues: number[] = [],
    showDeltaTable: boolean = false,
    tableRowVisibility: typeof Drawing.prototype.tableRowVisibility = {},
    tableRowHeight: number = 16,
    footprintStyle: 'bid_ask' | 'delta' = 'bid_ask'
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
    this.showDeltaTable = showDeltaTable;
    this.tableRowVisibility = tableRowVisibility;
    this.tableRowHeight = tableRowHeight;
    this.footprintStyle = footprintStyle;
  }

  public setShowDeltaTable(show: boolean) {
    this.showDeltaTable = show;
  }

  public getShowDeltaTable(): boolean {
    return this.showDeltaTable;
  }

  drawAll(): void {
    const width = this.ctx.canvas.width / window.devicePixelRatio;
    const height = this.ctx.canvas.height / window.devicePixelRatio;
    this.ctx.clearRect(0, 0, width, height);
    if (this.showGrid) drawGrid(this.ctx, width, this.margin, this.scales, this.theme);
    if (this.showVolumeHeatmap) this.drawVolumeHeatmap();
    this.drawChart();
    if (this.scales.cvdHeight() > 0) this.drawCVD();
    if (this.showDeltaTable) this.drawDeltaTable();
    drawMeasureRectangle(this.ctx, this.interactions.getMeasureRectangle(), this.scales, this.theme);
    this.drawScales(width, height);
    drawCurrentPriceLabel(this.ctx, width, this.lastPrice, this.margin, this.scales, this.theme);
    if (this.crosshair.visible) drawCrosshair(this.ctx, width, height, this.margin, this.crosshair, this.scales, this.data, this.theme);
    if (this.showBounds) drawBounds(this.ctx, width, height, this.margin, this.scales);
  }

  private drawDeltaTable(): void {
    const vr = this.scales.getVisibleRange();
    if (vr.endIndex <= vr.startIndex) return;

    const ctx = this.ctx;
    const width = ctx.canvas.width / window.devicePixelRatio;
    const height = ctx.canvas.height / window.devicePixelRatio;

    // Define row configurations with visibility keys
    const rowHeight = this.tableRowHeight;
    const allRows = [
      { key: 'volume' as const, label: 'Volume' },
      { key: 'volChange' as const, label: 'Vol Change %' },
      { key: 'buyVol' as const, label: 'Buy Volume' },
      { key: 'buyVolPercent' as const, label: 'Buy Vol %' },
      { key: 'sellVol' as const, label: 'Sell Volume' },
      { key: 'sellVolPercent' as const, label: 'Sell Vol %' },
      { key: 'delta' as const, label: 'Delta' },
      { key: 'deltaPercent' as const, label: 'Delta %' },
      { key: 'minDelta' as const, label: 'Min Delta' },
      { key: 'maxDelta' as const, label: 'Max Delta' },
      { key: 'poc' as const, label: 'POC' },
      { key: 'hlRange' as const, label: 'HL Range' }
    ];

    // Filter to only visible rows
    const visibleRows = allRows.filter(row => this.tableRowVisibility[row.key] !== false);
    const numRows = visibleRows.length;
    if (numRows === 0) return;

    const tableHeight = rowHeight * numRows;
    // Position table at the very bottom, just above the timeline
    const tableY = height - this.margin.bottom - tableHeight;

    // Draw table background with dark color to match chart theme
    ctx.save();
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, tableY, width, tableHeight);

    // Draw horizontal grid lines
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= numRows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, tableY + r * rowHeight);
      ctx.lineTo(width, tableY + r * rowHeight);
      ctx.stroke();
    }

    // Calculate previous candle volume for volume change %
    let prevVol = 0;

    // Draw values for each visible candle
    for (let i = vr.startIndex; i < vr.endIndex && i < this.data.length; i++) {
      const candle = this.data[i];
      const cx = this.scales.indexToX(i, vr.startIndex);

      // Calculate totals
      // Calculate totals and min/max delta
      let totBuy = 0, totSell = 0;
      let minDelta = Number.MAX_SAFE_INTEGER;
      let maxDelta = Number.MIN_SAFE_INTEGER;
      let poc = 0, pocVol = 0;
      const hasFootprint = candle.footprint.length > 0;

      if (!hasFootprint) {
        minDelta = 0;
        maxDelta = 0;
      }

      for (const level of candle.footprint) {
        totBuy += level.buy;
        totSell += level.sell;
        const levelDelta = level.buy - level.sell;
        minDelta = Math.min(minDelta, levelDelta);
        maxDelta = Math.max(maxDelta, levelDelta);
        const levelVol = level.buy + level.sell;
        if (levelVol > pocVol) {
          pocVol = levelVol;
          poc = level.price;
        }
      }

      const totalVol = totBuy + totSell;
      const delta = totBuy - totSell;
      const deltaPercent = totalVol > 0 ? (delta / totalVol) * 100 : 0;
      const buyPercent = totalVol > 0 ? (totBuy / totalVol) * 100 : 0;
      const sellPercent = totalVol > 0 ? (totSell / totalVol) * 100 : 0;
      const volChange = prevVol > 0 ? ((totalVol - prevVol) / prevVol) * 100 : 0;
      const hlRange = candle.high - candle.low;

      // Calculate cell width - full spacing with no gaps
      const cellWidth = this.scales.scaledSpacing();
      const cellX = cx - cellWidth / 2;

      // Only show text if cell is wide enough (at least 30px)
      const showText = cellWidth >= 30;

      ctx.textAlign = 'center';
      // Dynamic font size based on row height, min 9px, max 14px
      const fontSize = Math.min(14, Math.max(9, Math.floor(rowHeight * 0.7)));
      ctx.font = `${fontSize}px system-ui`;

      // Draw each visible row dynamically
      for (let r = 0; r < visibleRows.length; r++) {
        const row = visibleRows[r];
        const rowY = tableY + r * rowHeight;

        let bgColor = '#2a2a2a'; // default neutral
        let textValue = '';

        switch (row.key) {
          case 'volume':
            bgColor = '#2a2a2a';
            textValue = this.scales.formatK(totalVol);
            break;
          case 'volChange':
            bgColor = i === vr.startIndex ? '#2a2a2a' : (volChange >= 0 ? 'rgba(22, 163, 74, 0.5)' : 'rgba(220, 38, 38, 0.5)');
            textValue = i === vr.startIndex ? '-' : `${volChange.toFixed(1)}%`;
            break;
          case 'buyVol':
            bgColor = 'rgba(22, 163, 74, 0.5)';
            textValue = this.scales.formatK(totBuy);
            break;
          case 'buyVolPercent':
            bgColor = 'rgba(22, 163, 74, 0.5)';
            textValue = `${buyPercent.toFixed(1)}%`;
            break;
          case 'sellVol':
            bgColor = 'rgba(220, 38, 38, 0.5)';
            textValue = this.scales.formatK(totSell);
            break;
          case 'sellVolPercent':
            bgColor = 'rgba(220, 38, 38, 0.5)';
            textValue = `${sellPercent.toFixed(1)}%`;
            break;
          case 'delta':
            bgColor = delta >= 0 ? 'rgba(22, 163, 74, 0.5)' : 'rgba(220, 38, 38, 0.5)';
            textValue = this.scales.formatK(delta);
            break;
          case 'deltaPercent':
            bgColor = deltaPercent >= 0 ? 'rgba(22, 163, 74, 0.5)' : 'rgba(220, 38, 38, 0.5)';
            textValue = `${deltaPercent.toFixed(1)}%`;
            break;
          case 'minDelta':
            bgColor = minDelta >= 0 ? 'rgba(22, 163, 74, 0.5)' : 'rgba(220, 38, 38, 0.5)';
            textValue = this.scales.formatK(minDelta);
            break;
          case 'maxDelta':
            bgColor = maxDelta >= 0 ? 'rgba(22, 163, 74, 0.5)' : 'rgba(220, 38, 38, 0.5)';
            textValue = this.scales.formatK(maxDelta);
            break;
          case 'poc':
            bgColor = '#2a2a2a';
            textValue = poc.toFixed(2);
            break;
          case 'hlRange':
            bgColor = '#2a2a2a';
            textValue = hlRange.toFixed(4);
            break;
        }

        // Draw background
        ctx.fillStyle = bgColor;
        ctx.fillRect(cellX, rowY, cellWidth, rowHeight - 1);

        // Draw text if wide enough
        if (showText) {
          ctx.fillStyle = '#fff';
          ctx.fillText(textValue, cx, rowY + rowHeight / 2);
        }
      }

      prevVol = totalVol;
    }

    // Draw label column background (over cells on the left)
    const labelWidth = 75;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, tableY, labelWidth, tableHeight);

    // Draw row labels on the left (after cells so they're on top)
    ctx.fillStyle = '#888';
    // Dynamic font size for labels, max 14px
    const labelFontSize = Math.min(14, Math.max(9, Math.floor(rowHeight * 0.6)));
    ctx.font = `${labelFontSize}px system-ui`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let r = 0; r < numRows; r++) {
      ctx.fillText(visibleRows[r].label, 5, tableY + r * rowHeight + rowHeight / 2);
    }

    ctx.restore();
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
      drawFootprint(this.ctx, this.data[i], i, vr.startIndex, this.scales, this.theme, this.view, this.showVolumeFootprint, this.showDeltaTable, this.footprintStyle);
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