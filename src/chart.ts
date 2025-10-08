/**
 * Main chart implementation for the Volume Footprint Chart.
 * Provides the primary API for creating and managing chart instances with modular components.
 */

import { CandleData, VFCOptions, VFCEvents } from './types';
import { Scales } from './scales';
import { Interactions } from './interactions';
import { Drawing } from './drawing';

export class Chart {
    private canvas!: HTMLCanvasElement;
    private ctx!: CanvasRenderingContext2D;
    private data: CandleData[] = [];
    private options!: Required<VFCOptions>;
   private events: VFCEvents = {};

   // Chart state
   private margin = { top: 0, bottom: 40, left: 0, right: 70 };
   private view = { zoomY: 1, zoomX: 1, offsetRows: 0, offsetX: 0, offsetY: 0 };
   private showGrid = true;
   private showBounds = false;
   private showVolumeFootprint = true;
   private showVolumeHeatmap = false;
   private crosshair = { x: -1, y: -1, visible: false };
   private lastPrice: number | null = null;

   // Toolbar button references
   private resetZoomBtn: HTMLButtonElement | null = null;
   private toggleGridBtn: HTMLButtonElement | null = null;
   private toggleVolumeFootprintBtn: HTMLButtonElement | null = null;
   private volumeHeatmapBtn: HTMLButtonElement | null = null;
   private measureBtn: HTMLButtonElement | null = null;

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
   private scales!: Scales;
   private interactions!: Interactions;
   private drawing!: Drawing;

  private createChartStructure(container: HTMLElement): void {
    // Check if toolbars already exist
    if (container.querySelector('.vfc-toolbar')) {
      return; // Toolbars already exist, don't recreate
    }

    // Create the complete chart structure
    container.classList.add('vfc-container');

    // Create top toolbar
    const topToolbar = document.createElement('div');
    topToolbar.className = 'vfc-toolbar';

    const resetZoomBtn = document.createElement('button');
    resetZoomBtn.id = 'resetZoom';
    resetZoomBtn.className = 'tool-btn';
    resetZoomBtn.textContent = 'Reset';
    topToolbar.appendChild(resetZoomBtn);

    const toggleGridBtn = document.createElement('button');
    toggleGridBtn.id = 'toggleGrid';
    toggleGridBtn.className = 'tool-btn';
    toggleGridBtn.textContent = 'Grid On/Off';
    topToolbar.appendChild(toggleGridBtn);


    const toggleVolumeFootprintBtn = document.createElement('button');
    toggleVolumeFootprintBtn.id = 'toggleVolumeFootprint';
    toggleVolumeFootprintBtn.className = 'tool-btn';
    toggleVolumeFootprintBtn.textContent = 'Volume On/Off';
    topToolbar.appendChild(toggleVolumeFootprintBtn);

    const volumeHeatmapBtn = document.createElement('button');
    volumeHeatmapBtn.id = 'volumeHeatmap';
    volumeHeatmapBtn.className = 'tool-btn';
    volumeHeatmapBtn.textContent = 'Volume Heatmap';
    topToolbar.appendChild(volumeHeatmapBtn);

    const measureBtn = document.createElement('button');
    measureBtn.id = 'measure';
    measureBtn.className = 'tool-btn';
    measureBtn.title = 'Measure Tool';
    measureBtn.textContent = '📐 Measure';
    topToolbar.appendChild(measureBtn);

    const hint = document.createElement('span');
    hint.className = 'hint';
    hint.textContent = 'Volume Footprint Chart';
    topToolbar.appendChild(hint);

    container.appendChild(topToolbar);

    // Create chart container
    const chartContainer = document.createElement('div');
    chartContainer.className = 'vfc-chart-container';
    container.appendChild(chartContainer);

    // Set up event handlers
    this.setupToolbarEventHandlers(container);
  }

  private setupToolbarEventHandlers(container: HTMLElement): void {
    const resetZoomBtn = container.querySelector('#resetZoom') as HTMLButtonElement;
    const toggleGridBtn = container.querySelector('#toggleGrid') as HTMLButtonElement;
    const toggleVolumeFootprintBtn = container.querySelector('#toggleVolumeFootprint') as HTMLButtonElement;
    const volumeHeatmapBtn = container.querySelector('#volumeHeatmap') as HTMLButtonElement;
    const measureBtn = container.querySelector('#measure') as HTMLButtonElement;

    // Store references for later use
    this.resetZoomBtn = resetZoomBtn;
    this.toggleGridBtn = toggleGridBtn;
    this.toggleVolumeFootprintBtn = toggleVolumeFootprintBtn;
    this.volumeHeatmapBtn = volumeHeatmapBtn;
    this.measureBtn = measureBtn;
  }

  /**
   * Initializes the canvas element and context.
   * @param container The container element
   * @param chartContainer The chart container element
   */
  private initializeCanvas(container: HTMLElement, chartContainer: HTMLElement): void {
    // Use existing canvas if available, otherwise create one
    this.canvas = container.querySelector('canvas') as HTMLCanvasElement;
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      if (chartContainer) {
        chartContainer.appendChild(this.canvas);
      } else {
        // Fallback: append directly to container if chart container not found
        container.appendChild(this.canvas);
      }
    }

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');
    this.ctx = ctx;
  }

  /**
   * Initializes chart options with defaults and user-provided values.
   * @param options User-provided options
   * @param container The container element
   * @param chartContainer The chart container element
   */
  private initializeOptions(options: VFCOptions, container: HTMLElement, chartContainer: HTMLElement): void {
    this.options = {
      width: options.width || container.clientWidth || 800,
      height: options.height || (chartContainer ? chartContainer.clientHeight : container.clientHeight) || 600,
      showGrid: options.showGrid ?? true,
      showBounds: options.showBounds ?? false,
      showVolumeFootprint: options.showVolumeFootprint ?? true,
      showVolumeHeatmap: options.showVolumeHeatmap ?? false,
      tickSize: options.tickSize || 10,
      initialZoomX: options.initialZoomX || 0.55,
      initialZoomY: options.initialZoomY || 0.55,
      margin: options.margin || this.margin,
      theme: options.theme || {}
    };

    this.margin = this.options.margin;
    this.showGrid = this.options.showGrid;
    this.showBounds = this.options.showBounds;
    this.showVolumeFootprint = this.options.showVolumeFootprint;
    this.showVolumeHeatmap = this.options.showVolumeHeatmap;
    this.view.zoomX = this.options.initialZoomX;
    this.view.zoomY = this.options.initialZoomY;
  }

  /**
   * Initializes the chart modules (Scales, Interactions, Drawing).
   */
  private initializeModules(): void {
    this.scales = new Scales(
      this.data,
      this.margin,
      this.view,
      this.options.width,
      this.options.height,
      this.showVolumeFootprint,
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
      this.crosshair,
      this.scales
    );

    this.drawing = new Drawing(
      this.ctx,
      this.data,
      this.margin,
      this.view,
      this.showGrid,
      this.showBounds,
      this.showVolumeFootprint,
      this.showVolumeHeatmap,
      this.scales,
      this.options.theme,
      this.crosshair,
      this.lastPrice,
      this.interactions
    );
  }

  constructor(container: HTMLElement, options: VFCOptions = {}, events: VFCEvents = {}) {
    // Create the complete chart structure with toolbars
    this.createChartStructure(container);

    // Get the chart container for accurate dimensions
    const chartContainer = container.querySelector('.vfc-chart-container') as HTMLElement;

    // Initialize canvas
    this.initializeCanvas(container, chartContainer);

    // Initialize options
    this.initializeOptions(options, container, chartContainer);

    // Set events
    this.events = events;

    // Initialize modules
    this.initializeModules();

    // Set up canvas and event handlers
    this.setupCanvas();
    this.bindEvents();
    this.bindToolbarEvents();
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

  private bindToolbarEvents() {
    if (this.resetZoomBtn) {
      this.resetZoomBtn.addEventListener('click', () => {
        // Reset view to show the end of the data, like initial load
        if (this.data.length > 0) {
          this.updateOptions({
            width: this.options.width,
            height: this.options.height
          });
          // After updating options, set view to show last candles
          const s = this.scales.scaledSpacing();
          const contentW = this.options.width - this.margin.left - this.margin.right;
          const visibleCount = Math.ceil(contentW / s);
          const startIndex = Math.max(0, this.data.length - visibleCount);
          this.view.offsetX = startIndex * s;
          // Center the last candle's close price vertically at canvas center
          const lastPrice = this.lastPrice!;
          const centerRow = (this.options.height / 2) / this.scales.rowHeightPx();
          const priceRow = this.scales.priceToRowIndex(lastPrice); // with current offsetRows=0
          this.view.offsetRows = centerRow - priceRow;
          this.drawing.drawAll();
        }
      });
    }

    if (this.toggleGridBtn) {
      this.toggleGridBtn.addEventListener('click', () => {
        this.updateOptions({
          showGrid: !this.options.showGrid
        });
      });
    }

    if (this.toggleVolumeFootprintBtn) {
      this.toggleVolumeFootprintBtn.addEventListener('click', () => {
        this.updateOptions({
          showVolumeFootprint: !this.options.showVolumeFootprint
        });
      });
    }

    if (this.volumeHeatmapBtn) {
      this.volumeHeatmapBtn.addEventListener('click', () => {
        this.updateOptions({
          showVolumeHeatmap: !this.options.showVolumeHeatmap
        });
      });
    }

    if (this.measureBtn) {
      this.measureBtn.addEventListener('click', () => {
        const isActive = this.interactions.getMeasureRectangle() !== null;
        if (isActive) {
          this.interactions.setMeasureMode(false);
          this.measureBtn?.classList.remove('active');
        } else {
          this.interactions.setMeasureMode(true);
          this.measureBtn?.classList.add('active');
        }
        this.drawing.drawAll();
      });
    }
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

    // Recreate scales and drawing with new dimensions
    this.scales = new Scales(
      this.data,
      this.margin,
      this.view,
      this.options.width,
      this.options.height,
      this.showVolumeFootprint,
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
      this.showVolumeFootprint,
      this.showVolumeHeatmap,
      this.scales,
      this.options.theme,
      this.crosshair,
      this.lastPrice,
      this.interactions
    );

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
      this.showVolumeFootprint,
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
      this.showVolumeFootprint,
      this.showVolumeHeatmap,
      this.scales,
      this.options.theme,
      this.crosshair,
      this.lastPrice,  // Now has the correct value
      this.interactions
    );

    // Set initial view to show the end of the chart (latest data) and center the last price vertically
    if (data.length > 0) {
        const s = this.scales.scaledSpacing();
        const contentW = this.options.width - this.margin.left - this.margin.right;
        const visibleCount = Math.ceil(contentW / s);
        const startIndex = Math.max(0, data.length - visibleCount);
        this.view.offsetX = startIndex * s;
        // Center the last candle's close price vertically at canvas center
        const lastPrice = this.lastPrice!;
        const centerRow = (this.options.height / 2) / this.scales.rowHeightPx();
        const priceRow = this.scales.priceToRowIndex(lastPrice); // with current offsetRows=0
        this.view.offsetRows = centerRow - priceRow;
    }
    this.drawing.drawAll();
  }

  public updateOptions(options: Partial<VFCOptions>) {
    const oldShowVolumeFootprint = this.showVolumeFootprint;
    Object.assign(this.options, options);
    this.showGrid = this.options.showGrid;
    this.showBounds = this.options.showBounds;
    this.showVolumeFootprint = this.options.showVolumeFootprint;
    this.showVolumeHeatmap = this.options.showVolumeHeatmap;

    // If showVolumeFootprint changed, adjust view offsetX to maintain visible range
    if (oldShowVolumeFootprint !== this.showVolumeFootprint && this.data.length > 0) {
      const oldSpacing = oldShowVolumeFootprint ? 132 * this.view.zoomX : 16 * this.view.zoomX;
      const newSpacing = this.showVolumeFootprint ? 132 * this.view.zoomX : 16 * this.view.zoomX;
      const startIndex = Math.floor(this.view.offsetX / oldSpacing);
      this.view.offsetX = startIndex * newSpacing;
    }

    // Recreate Scales first, then Drawing
    this.scales = new Scales(
      this.data,
      this.margin,
      this.view,
      this.options.width,
      this.options.height,
      this.showVolumeFootprint,
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
      this.showVolumeFootprint,
      this.showVolumeHeatmap,
      this.scales,
      this.options.theme,
      this.crosshair,
      this.lastPrice,
      this.interactions
    );

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