import { CandleData, VFCOptions, VFCEvents } from './types';
import { Scales } from './scales';
import { Interactions } from './interactions';
import { Drawing } from './drawing';

export class Chart {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private data: CandleData[] = [];
  private options: Required<VFCOptions>;
  private events: VFCEvents = {};

  // Chart state
  private margin = { top: 0, bottom: 40, left: 0, right: 40 };
  private view = { zoomY: 1, zoomX: 1, offsetRows: 0, offsetX: 0, offsetY: 0 };
  private showGrid = true;
  private showBounds = false;
  private crosshair = { x: -1, y: -1, visible: false };
  private lastPrice: number | null = null;

  // Constants
  private readonly TICK = 10;
  private readonly BASE_CANDLE = 15;
  private readonly BASE_BOX = 55;
  private readonly BASE_IMBALANCE = 2;
  private readonly BASE_SPACING = this.BASE_CANDLE + 2 * this.BASE_BOX + 2 * this.BASE_IMBALANCE;
  private readonly FIXED_GAP = 4;
  private readonly baseRowPx = 22;
  private readonly TEXT_VIS = { minZoomX: 0.5, minRowPx: 10, minBoxPx: 20 };

  // Modules
  private scales: Scales;
  private interactions: Interactions;
  private drawing: Drawing;

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
      tickSize: options.tickSize || 10,
      initialZoomX: options.initialZoomX || 1,
      initialZoomY: options.initialZoomY || 1,
      margin: options.margin || this.margin,
      theme: options.theme || {}
    };

    this.events = events;
    this.margin = this.options.margin;
    this.showGrid = this.options.showGrid;
    this.showBounds = this.options.showBounds;
    this.view.zoomX = this.options.initialZoomX;
    this.view.zoomY = this.options.initialZoomY;

    // Initialize modules
    this.scales = new Scales(
      this.data,
      this.margin,
      this.view,
      this.options.width,
      this.options.height,
      this.TICK,
      this.baseRowPx,
      this.TEXT_VIS
    );

    this.interactions = new Interactions(
      this.canvas,
      this.margin,
      this.view,
      {
        ...this.events,
        onPan: () => this.drawing.drawAll(),
        onZoom: () => this.drawing.drawAll(),
        onMouseMove: () => this.drawing.drawAll()
      },
      this.crosshair
    );

    this.drawing = new Drawing(
      this.ctx,
      this.data,
      this.margin,
      this.view,
      this.showGrid,
      this.showBounds,
      this.scales,
      this.options.theme,
      this.crosshair,
      this.lastPrice
    );

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

  private handleWheel(e: WheelEvent) {
    this.interactions.handleWheel(e);
    this.drawing.drawAll();
  }

  private handlePointerDown(e: PointerEvent) {
    this.interactions.handlePointerDown(e);
  }

  private layout() {
    const container = this.canvas.parentElement;
    if (container) {
      this.options.width = container.clientWidth || this.options.width;
      this.options.height = container.clientHeight || this.options.height;
    }
    this.setupCanvas();
    this.drawing.drawAll();
  }

  // Public API
  public setData(data: CandleData[]) {
    this.data = data;
    
    // Calculate lastPrice first, before creating Drawing instance
    if (data.length > 0) {
        const lastPrice = data[data.length - 1].close;
        this.lastPrice = lastPrice;
    }
    
    // Update scales with new data
    this.scales = new Scales(
      this.data,
      this.margin,
      this.view,
      this.options.width,
      this.options.height,
      this.TICK,
      this.baseRowPx,
      this.TEXT_VIS
    );
    
    this.drawing = new Drawing(
      this.ctx,
      this.data,
      this.margin,
      this.view,
      this.showGrid,
      this.showBounds,
      this.scales,
      this.options.theme,
      this.crosshair,
      this.lastPrice  // Now has the correct value
    );

    // Set initial view to show the end of the chart (latest data) and center the last price vertically
    if (data.length > 0) {
        const s = this.scales.scaledSpacing();
        const contentW = this.options.width - this.margin.left - this.margin.right;
        const visibleCount = Math.ceil(contentW / s);
        const startIndex = Math.max(0, data.length - visibleCount);
        this.view.offsetX = startIndex * s;
        // Center the last candle's close price vertically
        const lastPrice = this.lastPrice!; // We know it's not null at this point
        const totalRows = Math.floor(this.scales.chartHeight() / this.scales.rowHeightPx());
        const centerRow = totalRows / 2;
        this.view.offsetRows = centerRow - (this.scales.priceToRowIndex(lastPrice) - centerRow);
    }
    this.drawing.drawAll();
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