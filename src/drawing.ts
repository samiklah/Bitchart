import { CandleData, VFCTheme } from './types';
import { Scales } from './scales';

export class Drawing {
  private ctx: CanvasRenderingContext2D;
  private data: CandleData[];
  private margin: { top: number; bottom: number; left: number; right: number };
  private view: { zoomY: number; zoomX: number; offsetRows: number; offsetX: number };
  private showGrid: boolean;
  private showBounds: boolean;
  private scales: Scales;
  private theme: VFCTheme;
  private crosshair: { x: number; y: number; visible: boolean };
  private lastPrice: number | null;

  constructor(
    ctx: CanvasRenderingContext2D,
    data: CandleData[],
    margin: { top: number; bottom: number; left: number; right: number },
    view: { zoomY: number; zoomX: number; offsetRows: number; offsetX: number },
    showGrid: boolean,
    showBounds: boolean,
    scales: Scales,
    theme: VFCTheme,
    crosshair: { x: number; y: number; visible: boolean },
    lastPrice: number | null
  ) {
    this.ctx = ctx;
    this.data = data;
    this.margin = margin;
    this.view = view;
    this.showGrid = showGrid;
    this.showBounds = showBounds;
    this.scales = scales;
    this.theme = theme;
    this.crosshair = crosshair;
    this.lastPrice = lastPrice;
  }

  drawAll(): void {
    const width = this.ctx.canvas.width / window.devicePixelRatio;
    const height = this.ctx.canvas.height / window.devicePixelRatio;
    this.ctx.clearRect(0, 0, width, height);
    if (this.showGrid) this.drawGrid();
    this.drawChart();
    this.drawScales();
    this.drawCurrentPriceLabel();
    if (this.crosshair.visible) this.drawCrosshair();
    if (this.showBounds) this.drawBounds();
  }

  private drawGrid(): void {
    if (!this.showGrid) return;
    const width = this.ctx.canvas.width / window.devicePixelRatio;
    const chartRight = width - this.margin.right;
    this.ctx.strokeStyle = this.theme.gridColor || '#333';
    this.ctx.lineWidth = 1;
    const gridSpacing = 28;
    const numLines = Math.floor(this.scales.chartHeight() / gridSpacing);
    this.ctx.beginPath();
    for (let i = 0; i <= numLines; i++) {
      const y = this.margin.top + i * gridSpacing;
      this.ctx.moveTo(this.margin.left, y);
      this.ctx.lineTo(chartRight, y);
    }
    this.ctx.stroke();

    const vr = this.scales.getVisibleRange();
    this.ctx.beginPath();
    for (let i = vr.startIndex; i < vr.endIndex; i++) {
      const x = this.scales.indexToX(i, vr.startIndex) + this.scales.scaledSpacing() / 2;
      this.ctx.moveTo(x, this.margin.top);
      this.ctx.lineTo(x, this.margin.top + this.scales.chartHeight());
    }
    this.ctx.strokeStyle = this.theme.gridLightColor || '#252525';
    this.ctx.stroke();
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
      this.drawFootprint(this.data[i], i, vr.startIndex);
    }
    this.ctx.restore();
  }

  private drawScales(): void {
    const width = this.ctx.canvas.width / window.devicePixelRatio;
    const height = this.ctx.canvas.height / window.devicePixelRatio;

    // Right price bar
    const right = width - this.margin.right;
    this.ctx.fillStyle = this.theme.scaleBackground || '#111';
    this.ctx.fillRect(right, 0, this.margin.right, height);
    this.ctx.strokeStyle = this.theme.scaleBorder || '#444';
    this.ctx.strokeRect(right + 0.5, this.margin.top, 0.5, this.scales.chartHeight());

    // Price labels
    this.ctx.fillStyle = this.theme.textColor || '#aaa';
    this.ctx.font = '12px system-ui';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    const labels = this.scales.computePriceBarLabels();
    for (const { price, y } of labels) {
      this.ctx.fillText(String(price), right + this.margin.right / 2, y);
    }

    // Bottom timeline
    const bottomY = this.margin.top + this.scales.chartHeight();
    const chartW = width - this.margin.left - this.margin.right;
    this.ctx.fillStyle = this.theme.scaleBackground || '#111';
    this.ctx.fillRect(this.margin.left, bottomY, chartW, this.margin.bottom);
    this.ctx.strokeStyle = this.theme.scaleBorder || '#444';
    this.ctx.beginPath();
    this.ctx.moveTo(this.margin.left, bottomY + 0.5);
    this.ctx.lineTo(this.margin.left + chartW, bottomY + 0.5);
    this.ctx.stroke();

    // Timeline labels - extended to show future times
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(this.margin.left, bottomY, chartW, this.margin.bottom);
    this.ctx.clip();
    this.ctx.fillStyle = this.theme.textColor || '#aaa';
    this.ctx.font = '12px system-ui';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    const step = Math.max(1, Math.floor(120 / this.scales.scaledSpacing()));
    const vr = this.scales.getVisibleRange();
    // Extend timeline to show future times beyond current data
    const extendedStart = Math.max(0, vr.startIndex - 10);
    const extendedEnd = vr.endIndex + 30; // Show 30 future time slots
    for (let i = extendedStart; i < extendedEnd; i += step) {
      const x = this.scales.indexToX(i, vr.startIndex);
      let date: Date;
      if (i < this.data.length && this.data[i]) {
        date = new Date(this.data[i].time);
      } else {
        // Extrapolate future times based on data intervals
        if (this.data.length > 1) {
          const lastTime = new Date(this.data[this.data.length - 1].time).getTime();
          const prevTime = new Date(this.data[this.data.length - 2].time).getTime();
          const interval = lastTime - prevTime; // Time between last two data points
          date = new Date(lastTime + (i - this.data.length + 1) * interval);
        } else {
          // Fallback: assume 1 minute intervals
          const lastTime = this.data.length > 0 ?
            new Date(this.data[this.data.length - 1].time).getTime() :
            Date.now();
          date = new Date(lastTime + (i - Math.max(0, this.data.length - 1)) * 60000);
        }
      }
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const t = `${hours}:${minutes}`;
      this.ctx.fillText(t, x, bottomY + this.margin.bottom / 2);
    }
    this.ctx.restore();
  }

  private drawBounds(): void {
    const width = this.ctx.canvas.width / window.devicePixelRatio;
    const height = this.ctx.canvas.height / window.devicePixelRatio;
    const chartW = width - this.margin.left - this.margin.right;
    const chartH = this.scales.chartHeight();
    const rightX = width - this.margin.right;
    const bottomY = this.margin.top + chartH;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(255, 255, 0, 0.05)';
    this.ctx.fillRect(0, 0, width, this.margin.top);
    this.ctx.fillRect(0, this.margin.top, this.margin.left, chartH);
    this.ctx.fillRect(this.margin.left, bottomY, chartW, this.margin.bottom);

    this.ctx.setLineDash([6, 3]);
    this.ctx.strokeStyle = '#f59e0b';
    this.ctx.lineWidth = 1.5;
    this.ctx.strokeRect(this.margin.left + 0.5, this.margin.top + 0.5, chartW, chartH);

    this.ctx.strokeStyle = '#22d3ee';
    this.ctx.strokeRect(rightX + 0.5, 0.5, this.margin.right - 1, height - 1);
    this.ctx.strokeRect(this.margin.left + 0.5, bottomY + 0.5, chartW, this.margin.bottom - 1);
    this.ctx.setLineDash([]);
    this.ctx.restore();
  }

  private drawFootprint(candle: CandleData, i: number, startIndex: number): void {
    const cx = this.scales.indexToX(i, startIndex);
    const rows = candle.footprint.slice().sort((a, b) => b.price - a.price);
    const enableProfile = rows.length > 3;

    // Calculate VAH/VAL
    const levelVols = rows.map(r => r.buy + r.sell);
    const totalVol = levelVols.reduce((a, b) => a + b, 0);
    let pocIdx = 0;
    for (let i = 1; i < levelVols.length; i++) {
      if (levelVols[i] > levelVols[pocIdx]) pocIdx = i;
    }

    let included = new Set([pocIdx]);
    if (enableProfile) {
      let acc = levelVols[pocIdx];
      let up = pocIdx - 1, down = pocIdx + 1;
      while (acc < 0.7 * totalVol && (up >= 0 || down < rows.length)) {
        const upVol = up >= 0 ? levelVols[up] : -1;
        const downVol = down < rows.length ? levelVols[down] : -1;
        if (upVol >= downVol) {
          if (up >= 0) { included.add(up); acc += levelVols[up]; up--; }
          else { included.add(down); acc += levelVols[down]; down++; }
        } else {
          if (down < rows.length) { included.add(down); acc += levelVols[down]; down++; }
          else { included.add(up); acc += levelVols[up]; up--; }
        }
      }
    }

    const vahIdx = Math.min(...included);
    const valIdx = Math.max(...included);
    const VAH = rows[vahIdx]?.price;
    const VAL = rows[valIdx]?.price;

    const half = this.scales.scaledCandle() / 2;
    const leftX = cx - half - this.scales.scaledBox();
    const rightX = cx + half;

    const sideMax = Math.max(...rows.map(f => Math.max(f.buy, f.sell)), 1);
    const buyBase = this.theme.volumeBuyBase ?? 0.15;
    const sellBase = this.theme.volumeSellBase ?? 0.15;
    const buyRGBA = (v: number) => `rgba(0,255,0,${buyBase + 0.55 * (v / sideMax)})`;
    const sellRGBA = (v: number) => `rgba(255,0,0,${sellBase + 0.55 * (v / sideMax)})`;

    let minRow = Infinity, maxRow = -Infinity;
    let totBuy = 0, totSell = 0;

    // Draw boxes
    for (let r = 0; r < rows.length; r++) {
      const f = rows[r];
      const row = this.scales.priceToRowIndex(f.price);
      const yTop = this.scales.rowToY(row - 0.5);
      const yBot = this.scales.rowToY(row + 0.5);
      const h = Math.max(1, yBot - yTop);
      minRow = Math.min(minRow, row - 0.5);
      maxRow = Math.max(maxRow, row + 0.5);
      totBuy += f.buy;
      totSell += f.sell;

      const isPOC = enableProfile && (r === pocIdx);
      this.ctx.fillStyle = isPOC ? (this.theme.pocColor || '#808080') : sellRGBA(f.sell);
      this.ctx.fillRect(leftX, yTop, this.scales.scaledBox(), h);
      this.ctx.fillStyle = isPOC ? (this.theme.pocColor || '#808080') : buyRGBA(f.buy);
      this.ctx.fillRect(rightX, yTop, this.scales.scaledBox(), h);
    }

    // Imbalance markers
    for (let r = 0; r < rows.length; r++) {
      const f = rows[r];
      const prev = rows[r - 1];
      const next = rows[r + 1];
      const row = this.scales.priceToRowIndex(f.price);
      const yTop = this.scales.rowToY(row - 0.5);
      const yBot = this.scales.rowToY(row + 0.5);
      const h = Math.max(1, yBot - yTop);
      if (prev && f.sell >= 3 * Math.max(1, prev.buy)) {
        this.ctx.fillStyle = this.theme.imbalanceSell || '#dc2626';
        this.ctx.fillRect(leftX - this.scales.scaledImb() - 1, yTop, this.scales.scaledImb(), h);
      }
      if (next && f.buy >= 3 * Math.max(1, next.sell)) {
        this.ctx.fillStyle = this.theme.imbalanceBuy || '#16a34a';
        this.ctx.fillRect(rightX + this.scales.scaledBox() + 1, yTop, this.scales.scaledImb(), h);
      }
    }

    // Volume numbers
    if (this.scales.shouldShowCellText()) {
      const fontSize = Math.max(8, Math.min(16, 11 * this.view.zoomX));
      this.ctx.font = `${fontSize}px system-ui`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      for (let r = 0; r < rows.length; r++) {
        const f = rows[r];
        const row = this.scales.priceToRowIndex(f.price);
        const y = this.scales.rowToY(row);
        const isPOC = enableProfile && (r === pocIdx);
        this.ctx.fillStyle = isPOC ? (this.theme.pocTextColor || this.theme.textColorBright || '#ffffff') : (this.theme.textColorBright || '#ddd');
        this.ctx.fillText(this.scales.formatK(f.sell), leftX + this.scales.scaledBox() / 2, y);
        this.ctx.fillText(this.scales.formatK(f.buy), rightX + this.scales.scaledBox() / 2, y);
      }
    }

    // VAH/VAL lines and labels
    if (enableProfile && this.scales.shouldShowCellText()) {
      const rVah = this.scales.priceToRowIndex(VAH), rVal = this.scales.priceToRowIndex(VAL);
      const yVah = this.scales.rowToY(rVah - 0.5);
      const yVal = this.scales.rowToY(rVal + 0.5);
      const rightEdge = rightX + this.scales.scaledBox();

      this.ctx.save();
      this.ctx.setLineDash([4, 2]);
      this.ctx.strokeStyle = this.theme.vahValColor || '#9ca3af';
      this.ctx.beginPath();
      this.ctx.moveTo(leftX, yVah);
      this.ctx.lineTo(rightEdge, yVah);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(leftX, yVal);
      this.ctx.lineTo(rightEdge, yVal);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      const vahFontSize = Math.max(6, Math.min(12, 8 * this.view.zoomX));
      this.ctx.fillStyle = this.theme.vahValLabelColor || '#cfd3d6';
      this.ctx.font = `${vahFontSize}px monospace`;
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'middle';
      const labelX = cx - half - this.scales.scaledBox() + 3;
      this.ctx.fillText('VAH', labelX, yVah);
      this.ctx.fillText('VAL', labelX, yVal);
      this.ctx.restore();
    }

    // Delta/Total labels
    if (this.scales.shouldShowCellText()) {
      const yLowFootprint = this.scales.rowToY(maxRow) + 2;
      const delta = totBuy - totSell;
      const deltaFontSize = Math.max(8, Math.min(18, 12 * this.view.zoomX));
      this.ctx.textAlign = 'center';
      this.ctx.font = `${deltaFontSize}px system-ui`;
      this.ctx.fillStyle = delta >= 0 ? (this.theme.deltaPositive || '#16a34a') : (this.theme.deltaNegative || '#dc2626');
      this.ctx.fillText(`Delta ${this.scales.formatK(delta)}`, cx, yLowFootprint + 14);
      this.ctx.fillStyle = this.theme.totalColor || '#fff';
      this.ctx.fillText(`Total ${this.scales.formatK(totalVol)}`, cx, yLowFootprint + 32);
    }

    // Wick & body
    const yHigh = this.scales.priceToY(candle.high);
    const yLow = this.scales.priceToY(candle.low);
    const yOpen = this.scales.priceToY(candle.open);
    const yClose = this.scales.priceToY(candle.close);
    const bull = candle.close >= candle.open;
    const color = bull ? (this.theme.candleBull || '#26a69a') : (this.theme.candleBear || '#ef5350');
    this.ctx.strokeStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(cx, yHigh);
    this.ctx.lineTo(cx, yLow);
    this.ctx.stroke();
    this.ctx.fillStyle = color;
    this.ctx.fillRect(cx - half, Math.min(yOpen, yClose), this.scales.scaledCandle(), Math.abs(yClose - yOpen));
  }


  private drawCrosshair(): void {
    if (!this.crosshair.visible) return;

    const width = this.ctx.canvas.width / window.devicePixelRatio;
    const height = this.ctx.canvas.height / window.devicePixelRatio;
    const chartRight = width - this.margin.right;
    const yBottom = this.margin.top + this.scales.chartHeight();

    this.ctx.save();

    // Draw vertical line
    this.ctx.strokeStyle = this.theme.textColor || '#aaa';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([2, 2]);
    this.ctx.beginPath();
    this.ctx.moveTo(this.crosshair.x, this.margin.top);
    this.ctx.lineTo(this.crosshair.x, yBottom);
    this.ctx.stroke();

    // Draw horizontal line
    this.ctx.beginPath();
    this.ctx.moveTo(this.margin.left, this.crosshair.y);
    this.ctx.lineTo(chartRight, this.crosshair.y);
    this.ctx.stroke();

    // Draw price label on right side
    const price = this.scales.rowIndexToPrice(
      (this.crosshair.y - this.margin.top) / this.scales.rowHeightPx() + this.view.offsetRows
    );
    this.ctx.setLineDash([]);
    this.ctx.fillStyle = this.theme.scaleBackground || '#111';
    this.ctx.fillRect(chartRight, this.crosshair.y - 8, this.margin.right, 16);
    this.ctx.strokeStyle = this.theme.scaleBorder || '#444';
    this.ctx.strokeRect(chartRight, this.crosshair.y - 8, this.margin.right, 16);
    this.ctx.fillStyle = this.theme.textColor || '#aaa';
    this.ctx.font = '11px system-ui';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(price.toFixed(2), chartRight + this.margin.right / 2, this.crosshair.y);

    // Draw time label on bottom
    const index = this.scales.screenXToDataIndex(this.crosshair.x);
    let timeStr = '--:--';
    if (index >= 0 && index < this.data.length && this.data[index]) {
      const date = new Date(this.data[index].time);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      timeStr = `${hours}:${minutes}`;
    }

    this.ctx.fillStyle = this.theme.scaleBackground || '#111';
    this.ctx.fillRect(this.crosshair.x - 20, yBottom, 40, this.margin.bottom);
    this.ctx.strokeStyle = this.theme.scaleBorder || '#444';
    this.ctx.strokeRect(this.crosshair.x - 20, yBottom, 40, this.margin.bottom);
    this.ctx.fillStyle = this.theme.textColor || '#aaa';
    this.ctx.font = '11px system-ui';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(timeStr, this.crosshair.x, yBottom + this.margin.bottom / 2);

    this.ctx.restore();
  }

  private drawCurrentPriceLabel(): void {
    if (!this.lastPrice) return;

    const width = this.ctx.canvas.width / window.devicePixelRatio;
    const height = this.ctx.canvas.height / window.devicePixelRatio;
    const right = width - this.margin.right;
    const y = this.scales.priceToY(this.lastPrice);

    this.ctx.save();

    // Draw dashed line across the chart at the last price level
    this.ctx.setLineDash([5, 5]);
    this.ctx.strokeStyle = this.theme.textColor || '#aaa';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(this.margin.left, y);
    this.ctx.lineTo(right, y);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // Draw price label on the price bar (right side scale area)
    const labelText = this.lastPrice.toFixed(2);
    this.ctx.font = 'bold 12px system-ui';
    const textWidth = this.ctx.measureText(labelText).width;
    const boxWidth = textWidth + 8;
    const boxHeight = 18;

    // Position the label in the price bar area
    const boxX = right + 2;
    const boxY = y - boxHeight / 2;

    // Draw background
    this.ctx.fillStyle = '#26a69a';  // Green background like in the image
    this.ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

    // Draw border
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

    // Draw price text
    this.ctx.fillStyle = '#ffffff';  // White text
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(labelText, boxX + boxWidth / 2, boxY + boxHeight / 2);

    this.ctx.restore();
  }
}