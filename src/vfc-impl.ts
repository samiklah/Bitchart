import { CandleData, VFCOptions, VFCEvents } from './types';

export class VFC {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private data: CandleData[] = [];
  private options: Required<VFCOptions>;
  private events: VFCEvents = {};

  // Chart state
  private margin = { top: 0, bottom: 40, left: 0, right: 60 };
  private view = { zoomY: 1, zoomX: 1, offsetRows: 0, offsetX: 0, offsetY: 0 };
  private xShift = 0;
  private showGrid = true;
  private showBounds = false;

  // Pan direction preferences (true = invert so content moves opposite the cursor)
  private readonly PAN_INVERT = { x: true, y: false }; // Y follows mouse: drag up → content up, drag down → content down

  // Smooth horizontal pan (momentum) state
  private momentum = { raf: 0, vx: 0, lastTs: 0, active: false };

  // Constants
  private readonly TICK = 10;
  private readonly BASE_CANDLE = 15;
  private readonly BASE_BOX = 55;
  private readonly BASE_IMBALANCE = 6;
  private readonly BASE_SPACING = this.BASE_CANDLE + 2 * this.BASE_BOX + 2 * this.BASE_IMBALANCE;
  private readonly FIXED_GAP = 4;
  private readonly baseRowPx = 22;
  private readonly TEXT_VIS = { minZoomX: 0.5, minRowPx: 10, minBoxPx: 20 };

  constructor(container: HTMLElement, options: VFCOptions = {}, events: VFCEvents = {}) {
    // Use existing canvas if available, otherwise create one
    this.canvas = container.querySelector('canvas') as HTMLCanvasElement;
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      container.appendChild(this.canvas);
    }

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');
    this.ctx = ctx;

    this.options = {
      width: options.width || container.clientWidth || 800,
      height: options.height || container.clientHeight || 600,
      showGrid: options.showGrid ?? true,
      showBounds: options.showBounds ?? false,
      showVolumeFootprint: options.showVolumeFootprint ?? true,
      showVolumeHeatmap: options.showVolumeHeatmap ?? false,
      volumeHeatmapDynamic: options.volumeHeatmapDynamic ?? true,
      tickSize: options.tickSize || 10,
      initialZoomX: options.initialZoomX || 1,
      initialZoomY: options.initialZoomY || 1,
      margin: options.margin || this.margin,
      theme: options.theme || {},
      showCVD: options.showCVD ?? false,
      cvdHeightRatio: options.cvdHeightRatio || 0.2,
      cvdType: options.cvdType || 'ticker',
      showDeltaTable: options.showDeltaTable ?? false,
      tableRowVisibility: options.tableRowVisibility || {
        volume: true,
        volChange: true,
        buyVol: true,
        buyVolPercent: true,
        sellVol: true,
        sellVolPercent: true,
        delta: true,
        deltaPercent: true,
        minDelta: true,
        maxDelta: true,
        poc: true,
        hlRange: true
      },
      tableRowHeight: options.tableRowHeight || 16
    };

    this.events = events;
    this.margin = this.options.margin;
    this.showGrid = this.options.showGrid;
    this.showBounds = this.options.showBounds;
    this.view.zoomX = this.options.initialZoomX;
    this.view.zoomY = this.options.initialZoomY;

    this.setupCanvas();
    this.bindEvents();
    this.layout();
  }

  private setupCanvas() {
    const DPR = Math.max(1, Math.round(window.devicePixelRatio || 1));
    this.canvas.style.width = this.options.width + 'px';
    this.canvas.style.height = this.options.height + 'px';
    this.canvas.width = Math.max(1, Math.floor(this.options.width * DPR));
    this.canvas.height = Math.max(1, Math.floor(this.options.height * DPR));
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(DPR, DPR);
  }

  private bindEvents() {
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
    this.canvas.addEventListener('pointerdown', this.handlePointerDown.bind(this));
    window.addEventListener('resize', this.layout.bind(this));
  }

  private cancelMomentum() {
    if (this.momentum.raf) {
      cancelAnimationFrame(this.momentum.raf);
      this.momentum.raf = 0;
    }
    this.momentum.active = false;
  }

  private startMomentum(vx: number) {
    this.momentum.vx = vx; // pixels per ms
    this.momentum.lastTs = 0;
    this.momentum.active = true;
    if (!this.momentum.raf) {
      this.momentum.raf = requestAnimationFrame(this.stepMomentum.bind(this));
    }
  }

  private stepMomentum(ts: number) {
    if (!this.momentum.active) {
      this.momentum.raf = 0;
      return;
    }
    if (!this.momentum.lastTs) this.momentum.lastTs = ts;
    const dt = ts - this.momentum.lastTs;
    this.momentum.lastTs = ts;
    this.view.offsetX += this.momentum.vx * dt;
    this.momentum.vx *= 0.98; // friction
    if (Math.abs(this.momentum.vx) < 0.001) {
      this.cancelMomentum();
    }
    this.drawAll();
    if (this.momentum.active) {
      this.momentum.raf = requestAnimationFrame(this.stepMomentum.bind(this));
    }
  }

  private handleWheel(e: WheelEvent) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const chartRight = this.canvas.clientWidth - this.margin.right;
    const yBottom = this.margin.top + this.chartHeight();

    const overPriceBar = mx > chartRight;
    const overTimeline = my > yBottom;
    const overChartBody = !overPriceBar && !overTimeline;

    if (overPriceBar) {
      this.cancelMomentum();
      this.view.zoomY *= (e.deltaY < 0 ? 1.1 : 0.9);
      this.view.zoomY = Math.max(0.1, Math.min(8, this.view.zoomY));
      this.events.onZoom?.(this.view.zoomX, this.view.zoomY);
    } else if (overChartBody) {
      const prev = this.view.zoomX;
      const factor = (e.deltaY < 0 ? 1.1 : 0.9);
      const next = Math.max(0.1, Math.min(8, prev * factor));
      this.view.zoomX = next;
      // Zoom price axis less than timeline (slower zoom)
      const yFactor = Math.pow(factor, 0.7); // Reduce the zoom factor for Y axis
      this.view.zoomY *= yFactor;
      this.view.zoomY = Math.max(0.1, Math.min(8, this.view.zoomY));
      this.view.offsetX *= (next / prev);
      this.events.onZoom?.(this.view.zoomX, this.view.zoomY);
    } else if (overTimeline) {
      // Timeline zoom: same mechanism as chart but only affects X axis
      const prev = this.view.zoomX;
      const factor = (e.deltaY < 0 ? 1.1 : 0.9);
      const next = Math.max(0.1, Math.min(8, prev * factor));
      this.view.zoomX = next;
      // Adjust offsetX to keep the same startIndex (prevent scrolling)
      this.view.offsetX *= (next / prev);
      this.events.onZoom?.(this.view.zoomX, this.view.zoomY);
    }

    this.drawAll();
  }

  private handlePointerDown(e: PointerEvent) {
    this.cancelMomentum();
    this.canvas.setPointerCapture(e.pointerId);
    let lastX = e.clientX;
    let lastY = e.clientY;
    let velX = 0;
    let lastT = performance.now();

    const onMove = (ev: PointerEvent) => {
      const now = performance.now();
      const dt = Math.max(1, now - lastT);
      const dx = ev.clientX - lastX;
      const dy = ev.clientY - lastY;
      lastX = ev.clientX;
      lastY = ev.clientY;
      lastT = now;

      this.view.offsetX += (this.PAN_INVERT.x ? -dx : dx);                 // pan time (invert with setting)
      this.view.offsetRows += (this.PAN_INVERT.y ? -dy : dy) / this.rowHeightPx(); // vertical pan (invert with setting)
      velX = (this.PAN_INVERT.x ? -dx : dx) / dt; // momentum sign matches pan setting
      this.events.onPan?.(this.view.offsetX, this.view.offsetRows);
      this.drawAll();
    };

    const onUp = () => {
      this.canvas.releasePointerCapture(e.pointerId);
      this.canvas.removeEventListener('pointermove', onMove);
      this.canvas.removeEventListener('pointerup', onUp);
      this.canvas.removeEventListener('pointercancel', onUp);
      // Removed momentum to stop chart from continuing to move after mouse release
    };

    this.canvas.addEventListener('pointermove', onMove);
    this.canvas.addEventListener('pointerup', onUp);
    this.canvas.addEventListener('pointercancel', onUp);
  }

  private layout() {
    const container = this.canvas.parentElement;
    if (container) {
      this.options.width = container.clientWidth || this.options.width;
      this.options.height = container.clientHeight || this.options.height;
    }
    this.setupCanvas();
    this.drawAll();
  }

  private chartHeight() {
    return this.options.height - this.margin.top - this.margin.bottom;
  }

  private rowHeightPx() {
    return this.baseRowPx * this.view.zoomY;
  }

  private scaledSpacing() {
    return this.BASE_SPACING * this.view.zoomX;
  }

  private scaledCandle() {
    return this.BASE_CANDLE * this.view.zoomX;
  }

  private scaledBox() {
    return this.BASE_BOX * this.view.zoomX;
  }

  private scaledImb() {
    return this.BASE_IMBALANCE * this.view.zoomX;
  }

  private shouldShowCellText() {
    return (
      this.view.zoomX >= this.TEXT_VIS.minZoomX &&
      this.rowHeightPx() >= this.TEXT_VIS.minRowPx &&
      this.scaledBox() >= this.TEXT_VIS.minBoxPx
    );
  }

  private drawAll() {
    this.ctx.clearRect(0, 0, this.options.width, this.options.height);
    if (this.showGrid) this.drawGrid();
    this.drawChart();
    this.drawScales();
    if (this.showBounds) this.drawBounds();
  }

  private drawGrid() {
    if (!this.showGrid) return;
    const chartRight = this.options.width - this.margin.right;
    this.ctx.strokeStyle = '#333';
    this.ctx.lineWidth = 1;
    // horizontal lines at fixed pixel intervals
    const gridSpacing = 28;
    const numLines = Math.floor(this.chartHeight() / gridSpacing);
    this.ctx.beginPath();
    for (let i = 0; i <= numLines; i++) {
      const y = this.margin.top + i * gridSpacing;
      this.ctx.moveTo(this.margin.left, y);
      this.ctx.lineTo(chartRight, y);
    }
    this.ctx.stroke();

    // vertical candle dividers (light)
    const vr = this.getVisibleRange();
    this.ctx.beginPath();
    for (let i = vr.startIndex; i < vr.endIndex; i++) {
      const x = this.indexToX(i, vr.startIndex) + this.scaledSpacing() / 2;
      this.ctx.moveTo(x, this.margin.top);
      this.ctx.lineTo(x, this.margin.top + this.chartHeight());
    }
    this.ctx.strokeStyle = '#252525';
    this.ctx.stroke();
  }

  private drawChart() {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(
      this.margin.left,
      this.margin.top,
      this.options.width - this.margin.left - this.margin.right,
      this.chartHeight()
    );
    this.ctx.clip();

    const vr = this.getVisibleRange();
    for (let i = vr.startIndex; i < vr.endIndex; i++) {
      this.drawFootprint(this.data[i], i, vr.startIndex);
    }
    this.ctx.restore();
  }

  private drawScales() {
    // Right price bar
    const right = this.options.width - this.margin.right;
    this.ctx.fillStyle = '#111';
    this.ctx.fillRect(right, 0, this.margin.right, this.options.height);
    this.ctx.strokeStyle = '#444';
    this.ctx.strokeRect(right + 0.5, this.margin.top, 0.5, this.chartHeight());

    // Stable price labels (constant values while dragging)
    this.ctx.fillStyle = '#aaa';
    this.ctx.font = '12px system-ui';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    const labels = this.computePriceBarLabels();
    for (const { price, y } of labels) {
      this.ctx.fillText(String(price), right + this.margin.right / 2, y);
    }

    // Bottom timeline
    const bottom = this.margin.top + this.chartHeight();
    const chartW = this.options.width - this.margin.left - this.margin.right;
    // background only under the chart area (not under left margin or price bar)
    this.ctx.fillStyle = '#111';
    this.ctx.fillRect(this.margin.left, bottom, chartW, this.margin.bottom);
    // top border of timeline across chart only
    this.ctx.strokeStyle = '#444';
    this.ctx.beginPath();
    this.ctx.moveTo(this.margin.left, bottom + 0.5);
    this.ctx.lineTo(this.margin.left + chartW, bottom + 0.5);
    this.ctx.stroke();

    // clip labels to timeline area so they never render under the price bar
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(this.margin.left, bottom, chartW, this.margin.bottom);
    this.ctx.clip();
    this.ctx.fillStyle = '#aaa';
    this.ctx.font = '12px system-ui';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    const step = Math.max(1, Math.floor(120 / this.scaledSpacing()));
    const vr = this.getVisibleRange();
    for (let i = vr.startIndex; i < vr.endIndex; i += step) {
      const x = this.indexToX(i, vr.startIndex);
      const date = new Date(this.data[i].time);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const t = `${hours}:${minutes}`;
      this.ctx.fillText(t, x, bottom + this.margin.bottom / 2);
    }
    this.ctx.restore();
  }

  private drawBounds() {
    const chartW = this.options.width - this.margin.left - this.margin.right;
    const chartH = this.chartHeight();
    const rightX = this.options.width - this.margin.right;
    const bottomY = this.margin.top + chartH;

    this.ctx.save();
    // shade outside chart area slightly so user sees gutters
    this.ctx.fillStyle = 'rgba(255, 255, 0, 0.05)';
    // top gutter
    this.ctx.fillRect(0, 0, this.options.width, this.margin.top);
    // left gutter
    this.ctx.fillRect(0, this.margin.top, this.margin.left, chartH);
    // right price bar area (already visible)
    // bottom timeline area (already visible)

    // outline chart rect
    this.ctx.setLineDash([6, 3]);
    this.ctx.strokeStyle = '#f59e0b';
    this.ctx.lineWidth = 1.5;
    this.ctx.strokeRect(this.margin.left + 0.5, this.margin.top + 0.5, chartW, chartH);

    // outline price bar and timeline for clarity
    this.ctx.strokeStyle = '#22d3ee'; // cyan for scales
    // price bar
    this.ctx.strokeRect(rightX + 0.5, 0.5, this.margin.right - 1, this.options.height - 1);
    // timeline
    this.ctx.strokeRect(this.margin.left + 0.5, bottomY + 0.5, chartW, this.margin.bottom - 1);
    this.ctx.setLineDash([]);
    this.ctx.restore();
  }

  private drawFootprint(candle: CandleData, i: number, startIndex: number) {
    // Match original footprint rendering exactly (opacity heatmap, full-width boxes, POC band, VAH/VAL on left)
    const cx = this.indexToX(i, startIndex);
    // Sort rows top->bottom by price so diagonals (prev/next) map correctly
    const rows = candle.footprint.slice().sort((a, b) => b.price - a.price);
    const enableProfile = rows.length > 3;

    // --- Compute volumes, POC, and Value Area (70%) EXACTLY like footprint-chart.html
    const levelVols = rows.map(r => r.buy + r.sell);
    const totalVol = levelVols.reduce((a, b) => a + b, 0);
    let pocIdx = 0;
    for (let i = 1; i < levelVols.length; i++) {
      if (levelVols[i] > levelVols[pocIdx]) pocIdx = i;
    }

    // Expand around POC until we cover >=70% of total volume.
    // We pick the next neighbor (up or down) with the larger volume each step.
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
    // rows are sorted high->low: smaller index = higher price
    const vahIdx = Math.min(...included);
    const valIdx = Math.max(...included);
    const VAH = rows[vahIdx]?.price;
    const VAL = rows[valIdx]?.price;

    // --- Geometry
    const half = this.scaledCandle() / 2;
    const leftX = cx - half - this.scaledBox();     // sell stack starts left of candle
    const rightX = cx + half;                    // buy stack starts at candle right edge

    // --- Color mapping (opacity by side max, full width)
    const sideMax = Math.max(...rows.map(f => Math.max(f.buy, f.sell)), 1);
    const buyRGBA = (v: number) => `rgba(0,255,0,${0.2 + 0.8 * (v / sideMax)})`;
    const sellRGBA = (v: number) => `rgba(255,0,0,${0.2 + 0.8 * (v / sideMax)})`;

    let minRow = Infinity, maxRow = -Infinity;
    let totBuy = 0, totSell = 0;

    // Draw footprint background boxes first (so text overlays stay visible)
    for (let r = 0; r < rows.length; r++) {
      const f = rows[r];
      const row = this.priceToRowIndex(f.price);
      const yTop = this.rowToY(row - 0.5);
      const yBot = this.rowToY(row + 0.5);
      const h = Math.max(1, yBot - yTop);
      minRow = Math.min(minRow, row - 0.5);
      maxRow = Math.max(maxRow, row + 0.5);
      totBuy += f.buy;
      totSell += f.sell;

      const isPOC = enableProfile && (r === pocIdx);
      // Left (sell)
      this.ctx.fillStyle = isPOC ? '#bfc3c7' : sellRGBA(f.sell);
      this.ctx.fillRect(leftX, yTop, this.scaledBox(), h);
      // Right (buy)
      this.ctx.fillStyle = isPOC ? '#bfc3c7' : buyRGBA(f.buy);
      this.ctx.fillRect(rightX, yTop, this.scaledBox(), h);
    }

    // Imbalance markers outside (diagonal compare)
    for (let r = 0; r < rows.length; r++) {
      const f = rows[r];
      const prev = rows[r - 1]; // above
      const next = rows[r + 1]; // below
      const row = this.priceToRowIndex(f.price);
      const yTop = this.rowToY(row - 0.5);
      const yBot = this.rowToY(row + 0.5);
      const h = Math.max(1, yBot - yTop);
      if (prev && f.sell >= 3 * Math.max(1, prev.buy)) {
        this.ctx.fillStyle = '#dc2626';
        this.ctx.fillRect(leftX - this.scaledImb() - 1, yTop, this.scaledImb(), h);
      }
      if (next && f.buy >= 3 * Math.max(1, next.sell)) {
        this.ctx.fillStyle = '#16a34a';
        this.ctx.fillRect(rightX + this.scaledBox() + 1, yTop, this.scaledImb(), h);
      }
    }

    // Numbers on cells (sell left, buy right)
    const __showNums = this.shouldShowCellText();

    if (__showNums) {
      const fontSize = Math.max(8, Math.min(16, 11 * this.view.zoomX));
      this.ctx.font = `${fontSize}px system-ui`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = '#ddd';
      for (let r = 0; r < rows.length; r++) {
        const f = rows[r];
        const row = this.priceToRowIndex(f.price);
        const y = this.rowToY(row);
        // sell value centered in left stack
        this.ctx.fillText(this.formatK(f.sell), leftX + this.scaledBox() / 2, y);
        // buy value centered in right stack
        this.ctx.fillText(this.formatK(f.buy), rightX + this.scaledBox() / 2, y);
      }
    }

    // VAH/VAL boundaries: top & bottom of the 70% volume area (may be as small as 1–2 rows)
    if (enableProfile && this.shouldShowCellText()) {
      const rVah = this.priceToRowIndex(VAH), rVal = this.priceToRowIndex(VAL);
      const yVah = this.rowToY(rVah - 0.5); // just above VAH row
      const yVal = this.rowToY(rVal + 0.5); // just below VAL row
      const rightEdge = rightX + this.scaledBox(); // full footprint width

      this.ctx.save();
      this.ctx.setLineDash([4, 2]);
      this.ctx.strokeStyle = '#9ca3af';
      // draw only across the footprint, not the whole chart
      this.ctx.beginPath();
      this.ctx.moveTo(leftX, yVah);
      this.ctx.lineTo(rightEdge, yVah);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(leftX, yVal);
      this.ctx.lineTo(rightEdge, yVal);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      // labels on the left stack
      const vahFontSize = Math.max(6, Math.min(12, 8 * this.view.zoomX));
      this.ctx.fillStyle = '#cfd3d6';
      this.ctx.font = `${vahFontSize}px monospace`;
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'middle';
      const labelX = cx - half - this.scaledBox() + 3;
      this.ctx.fillText('VAH', labelX, yVah);
      this.ctx.fillText('VAL', labelX, yVal);
      this.ctx.restore();
    }

    // Delta / Total labels under footprint
    if (this.shouldShowCellText()) {
      const yLowFootprint = this.rowToY(maxRow) + 2;
      const delta = totBuy - totSell;
      const deltaFontSize = Math.max(8, Math.min(18, 12 * this.view.zoomX));
      this.ctx.textAlign = 'center';
      this.ctx.font = `${deltaFontSize}px system-ui`;
      this.ctx.fillStyle = delta >= 0 ? '#16a34a' : '#dc2626';
      this.ctx.fillText(`Delta ${this.formatK(delta)}`, cx, yLowFootprint + 14);
      this.ctx.fillStyle = '#fff';
      this.ctx.fillText(`Total ${this.formatK(totalVol)}`, cx, yLowFootprint + 28);
    }

    // Wick & body (after stacks so they sit between the columns)
    const yHigh = this.priceToY(candle.high);
    const yLow = this.priceToY(candle.low);
    const yOpen = this.priceToY(candle.open);
    const yClose = this.priceToY(candle.close);
    const bull = candle.close >= candle.open;
    const color = bull ? '#26a69a' : '#ef5350';
    this.ctx.strokeStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(cx, yHigh);
    this.ctx.lineTo(cx, yLow);
    this.ctx.stroke();
    this.ctx.fillStyle = color;
    this.ctx.fillRect(cx - half, Math.min(yOpen, yClose), this.scaledCandle(), Math.abs(yClose - yOpen));
  }

  private getVisibleRange() {
    const s = this.scaledSpacing();
    const pixelOffset = this.view.offsetX;
    const startFloat = pixelOffset / s;
    const startIndex = Math.max(0, Math.floor(startFloat));
    this.xShift = pixelOffset - startIndex * s;
    if (this.xShift < 0) this.xShift += s;
    const contentW = this.options.width - this.margin.left - this.margin.right;
    const visibleCount = Math.ceil(contentW / s) + 2;
    const endIndex = Math.min(this.data.length, startIndex + visibleCount);
    return { startIndex, endIndex };
  }

  private computePriceBarLabels() {
    // Use fixed pixel spacing for consistent number of labels regardless of zoom
    const pixelSpacing = 28; // Same as grid spacing
    const chartHeightPx = this.chartHeight();
    const maxLabels = 7; // Maximum 7 price labels
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

  private priceToRowIndex(price: number) {
    return (this.ladderTop - price) / this.TICK + this.view.offsetRows;
  }

  private rowIndexToPrice(row: number) {
    return this.ladderTop - (row - this.view.offsetRows) * this.TICK;
  }

  private rowToY(row: number) {
    return this.margin.top + row * this.rowHeightPx();
  }

  private priceToY(price: number) {
    return this.rowToY(this.priceToRowIndex(price));
  }

  private indexToX(i: number, startIndex: number) {
    const s = this.scaledSpacing();
    return this.margin.left + (i - startIndex) * s + s / 2 - this.xShift;
  }

  private formatK(v: number) {
    const a = Math.abs(v);
    if (a >= 1e12) return (v / 1e12).toFixed(2) + "T";
    if (a >= 1e6) return (v / 1e6).toFixed(2) + "M";
    if (a >= 1e3) return (v / 1e3).toFixed(2) + "K";
    // For small numbers, show up to 2 decimal places if needed
    if (Number.isInteger(v)) {
      return v.toString();
    }
    return v.toFixed(2);
  }


  private get ladderTop() {
    if (this.data.length === 0) return 10000;
    return Math.ceil(Math.max(...this.data.map(c => c.high)) / this.TICK) * this.TICK + 10 * this.TICK;
  }

  // Public API
  public setData(data: CandleData[]) {
    this.data = data;
    // Set initial view to show the end of the chart (latest data) and center the last price vertically
    if (data.length > 0) {
      const s = this.scaledSpacing();
      const contentW = this.options.width - this.margin.left - this.margin.right;
      const visibleCount = Math.ceil(contentW / s);
      const startIndex = Math.max(0, data.length - visibleCount);
      this.view.offsetX = startIndex * s;
      // Center the last candle's close price vertically
      const lastPrice = data[data.length - 1].close;
      const totalRows = Math.floor(this.chartHeight() / this.rowHeightPx());
      const centerRow = totalRows / 2;
      this.view.offsetRows = centerRow - (this.ladderTop - lastPrice) / this.TICK;
    }
    this.drawAll();
  }

  public updateOptions(options: Partial<VFCOptions>) {
    Object.assign(this.options, options);
    this.layout();
  }

  public resize(width: number, height: number) {
    this.options.width = width;
    this.options.height = height;
    this.layout();
  }

  public destroy() {
    if (this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
  }

  // Getters for API access
  public getOptions() { return this.options; }
  public getShowGrid() { return this.showGrid; }
}