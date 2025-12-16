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
   private volumeHeatmapDynamic = true;
   private crosshair = { x: -1, y: -1, visible: false };
   private lastPrice: number | null = null;

   // Toolbar button references
   private resetZoomBtn: HTMLButtonElement | null = null;
   private toggleGridBtn: HTMLButtonElement | null = null;
   private toggleVolumeFootprintBtn: HTMLButtonElement | null = null;
   private volumeHeatmapBtn: HTMLButtonElement | null = null;
   private volumeHeatmapDropdown: HTMLDivElement | null = null;
   private measureBtn: HTMLButtonElement | null = null;

   // CVD state
   private showCVD = false;
   private cvdDynamic = true;
   private cvdValues: number[] = [];
   private cvdBaseline: 'global' | 'session' | 'visible' = 'global';
   private cvdNormalize = true;

   // Constants
   private TICK: number = 10;

   // Tick size detection
   private detectTickSize(): number {
     if (this.data.length === 0) return 10;

     // Collect all unique price differences from footprint data
     const priceDifferences = new Set<number>();

     for (const candle of this.data) {
       if (candle.footprint && candle.footprint.length > 1) {
         // Sort footprint prices
         const prices = candle.footprint.map(f => f.price).sort((a, b) => a - b);

         // Calculate differences between consecutive prices
         for (let i = 1; i < prices.length; i++) {
           const diff = prices[i] - prices[i - 1];
           if (diff > 0) {
             priceDifferences.add(diff);
           }
         }
       }
     }

     // Find the most common smallest difference
     if (priceDifferences.size === 0) return 10;
 
     const sortedDiffs = Array.from(priceDifferences).sort((a, b) => a - b);
     const smallestDiff = sortedDiffs[0];
 
     // For crypto data, ensure tick size is reasonable (at least 0.1 for most pairs)
     // If detected tick is too small, round up to a reasonable value
     if (smallestDiff < 0.1) {
       // Round to nearest 0.1, 0.5, or 1.0
       if (smallestDiff < 0.25) return 0.1;
       if (smallestDiff < 0.75) return 0.5;
       return 1.0;
     }
 
     return smallestDiff; // Return the smallest detected tick size
   }
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

    // Create volume heatmap dropdown container
    const volumeHeatmapContainer = document.createElement('div');
    volumeHeatmapContainer.className = 'dropdown-container';
    volumeHeatmapContainer.style.position = 'relative';
    volumeHeatmapContainer.style.display = 'inline-block';

    const volumeHeatmapBtn = document.createElement('button');
    volumeHeatmapBtn.id = 'volumeHeatmap';
    volumeHeatmapBtn.className = 'tool-btn dropdown-btn';
    volumeHeatmapBtn.textContent = 'Volume Heatmap';
    volumeHeatmapBtn.title = 'Volume heatmap options';
    volumeHeatmapContainer.appendChild(volumeHeatmapBtn);

    // Create dropdown menu
    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown-menu';
    dropdown.style.position = 'absolute';
    dropdown.style.top = '100%';
    dropdown.style.left = '0';
    dropdown.style.backgroundColor = '#1a1a1a';
    dropdown.style.border = '1px solid #444';
    dropdown.style.borderRadius = '4px';
    dropdown.style.minWidth = '120px';
    dropdown.style.zIndex = '1000';
    dropdown.style.display = 'none';
    dropdown.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';

    // Dynamic option
    const dynamicOption = document.createElement('div');
    dynamicOption.className = 'dropdown-item';
    dynamicOption.textContent = 'Dynamic';
    dynamicOption.style.padding = '8px 12px';
    dynamicOption.style.cursor = 'pointer';
    dynamicOption.style.color = '#fff';
    dynamicOption.style.fontSize = '12px';
    dynamicOption.addEventListener('mouseenter', () => dynamicOption.style.backgroundColor = '#333');
    dynamicOption.addEventListener('mouseleave', () => dynamicOption.style.backgroundColor = 'transparent');
    dynamicOption.addEventListener('click', () => {
      this.updateOptions({ volumeHeatmapDynamic: true, showVolumeHeatmap: true });
      this.updateButtonText();
      dropdown.style.display = 'none';
    });
    dropdown.appendChild(dynamicOption);

    // Static option
    const staticOption = document.createElement('div');
    staticOption.className = 'dropdown-item';
    staticOption.textContent = 'Static';
    staticOption.style.padding = '8px 12px';
    staticOption.style.cursor = 'pointer';
    staticOption.style.color = '#fff';
    staticOption.style.fontSize = '12px';
    staticOption.addEventListener('mouseenter', () => staticOption.style.backgroundColor = '#333');
    staticOption.addEventListener('mouseleave', () => staticOption.style.backgroundColor = 'transparent');
    staticOption.addEventListener('click', () => {
      this.updateOptions({ volumeHeatmapDynamic: false, showVolumeHeatmap: true });
      this.updateButtonText();
      dropdown.style.display = 'none';
    });
    dropdown.appendChild(staticOption);

    // Off option
    const offOption = document.createElement('div');
    offOption.className = 'dropdown-item';
    offOption.textContent = 'Off';
    offOption.style.padding = '8px 12px';
    offOption.style.cursor = 'pointer';
    offOption.style.color = '#fff';
    offOption.style.fontSize = '12px';
    offOption.addEventListener('mouseenter', () => offOption.style.backgroundColor = '#333');
    offOption.addEventListener('mouseleave', () => offOption.style.backgroundColor = 'transparent');
    offOption.addEventListener('click', () => {
      this.updateOptions({ showVolumeHeatmap: false });
      this.updateButtonText();
      dropdown.style.display = 'none';
    });
    dropdown.appendChild(offOption);

    volumeHeatmapContainer.appendChild(dropdown);
    topToolbar.appendChild(volumeHeatmapContainer);


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
    const volumeHeatmapDropdown = container.querySelector('.dropdown-menu') as HTMLDivElement;
    const measureBtn = container.querySelector('#measure') as HTMLButtonElement;

    // Store references for later use
    this.resetZoomBtn = resetZoomBtn;
    this.toggleGridBtn = toggleGridBtn;
    this.toggleVolumeFootprintBtn = toggleVolumeFootprintBtn;
    this.volumeHeatmapBtn = volumeHeatmapBtn;
    this.volumeHeatmapDropdown = volumeHeatmapDropdown;
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
      volumeHeatmapDynamic: options.volumeHeatmapDynamic ?? true,
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
    this.volumeHeatmapDynamic = this.options.volumeHeatmapDynamic;
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
      this.volumeHeatmapDynamic,
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

    // Initialize modules with default tick size (will be updated in setData)
    this.initializeModules();

    // Set up canvas and event handlers
    this.setupCanvas();
    this.bindEvents();
    this.bindToolbarEvents();
    this.updateButtonText();
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

    if (this.volumeHeatmapBtn && this.volumeHeatmapDropdown) {
      this.volumeHeatmapBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Toggle dropdown visibility
        const isVisible = this.volumeHeatmapDropdown!.style.display !== 'none';
        this.hideAllDropdowns();
        if (!isVisible) {
          this.volumeHeatmapDropdown!.style.display = 'block';
        }
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!this.volumeHeatmapBtn?.contains(e.target as Node) &&
            !this.volumeHeatmapDropdown?.contains(e.target as Node)) {
          this.volumeHeatmapDropdown!.style.display = 'none';
        }
      });
    }


    if (this.measureBtn) {
      this.measureBtn.addEventListener('click', () => {
        const isActive = this.interactions.getMeasureMode();
        if (isActive) {
          // Deactivate measure mode
          this.interactions.setMeasureMode(false);
          this.measureBtn?.classList.remove('active');
        } else {
          // Activate measure mode
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
      this.volumeHeatmapDynamic,
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

    // Detect tick size from data if not explicitly provided
    if (!this.options.tickSize && this.data.length > 0) {
      const detectedTick = this.detectTickSize();
      console.log('Detected tick size:', detectedTick);
      this.TICK = detectedTick;
    } else if (this.options.tickSize) {
      console.log('Using explicit tick size:', this.options.tickSize);
      this.TICK = this.options.tickSize;
    }

    // Calculate CVD values
    console.log('setData: calling calculateCVD');
    this.calculateCVD();
    console.log('setData: CVD values calculated, length:', this.cvdValues.length);

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

    // Invalidate ladderTop cache when tick size changes
    if (this.TICK !== this.options.tickSize) {
      this.TICK = this.options.tickSize || this.TICK;
      this.scales.invalidateLadderTop();
    }

    // Invalidate ladderTop cache when data changes
    this.scales.invalidateLadderTop();

    this.drawing = new Drawing(
      this.ctx,
      this.data,
      this.margin,
      this.view,
      this.showGrid,
      this.showBounds,
      this.showVolumeFootprint,
      this.showVolumeHeatmap,
      this.volumeHeatmapDynamic,
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
    this.volumeHeatmapDynamic = this.options.volumeHeatmapDynamic ?? this.volumeHeatmapDynamic;
    console.log('updateOptions: volume heatmap options updated');

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
      this.volumeHeatmapDynamic,
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


  private calculateCVD() {
    console.log('calculateCVD called, data length:', this.data.length);
    if (this.data.length === 0) {
      this.cvdValues = [];
      return;
    }

    this.cvdValues = new Array(this.data.length);
    let cumulative = 0;

    // Calculate baseline index based on mode
    let baselineIndex = 0;
    if (this.cvdBaseline === 'session') {
      // For session mode, find first candle of current session (simplified - using first candle)
      baselineIndex = 0;
    } else if (this.cvdBaseline === 'visible') {
      // For visible mode, use first visible candle
      const vr = this.scales?.getVisibleRange();
      baselineIndex = vr ? vr.startIndex : 0;
    }

    // Calculate cumulative delta based on dynamic mode
    console.log('calculateCVD: cvdDynamic =', this.cvdDynamic);
    if (this.cvdDynamic) {
      // Dynamic mode: calculate CVD starting from the visible range, but ensure continuity
      const vr = this.scales?.getVisibleRange();
      console.log('calculateCVD: visible range =', vr);
      if (vr) {
        const startIndex = vr.startIndex;
        const endIndex = vr.endIndex;
        console.log('calculateCVD: calculating for range', startIndex, 'to', endIndex);

        // Calculate CVD for the entire visible range, starting cumulative from 0 at startIndex
        cumulative = 0; // Reset cumulative for visible range
        for (let i = startIndex; i < endIndex; i++) {
          if (i < this.data.length) {
            const candle = this.data[i];
            const delta = candle.footprint.reduce((sum, level) => sum + (level.buy - level.sell), 0);
            cumulative += delta;
            this.cvdValues[i] = cumulative;
            console.log(`calculateCVD: i=${i}, delta=${delta}, cumulative=${cumulative}`);
          }
        }

        // Apply normalization if enabled (normalize to start at 0)
        if (this.cvdNormalize) {
          const baselineValue = this.cvdValues[startIndex];
          console.log('calculateCVD: normalizing with baseline', baselineValue);
          for (let i = startIndex; i < endIndex; i++) {
            if (i < this.cvdValues.length && this.cvdValues[i] !== undefined) {
              this.cvdValues[i] -= baselineValue;
            }
          }
        }
      }
    } else {
      // Static mode: calculate for all data
      for (let i = 0; i < this.data.length; i++) {
        const candle = this.data[i];
        const delta = candle.footprint.reduce((sum, level) => sum + (level.buy - level.sell), 0);
        cumulative += delta;
        this.cvdValues[i] = cumulative;
      }

      // Apply normalization if enabled
      if (this.cvdNormalize && baselineIndex < this.cvdValues.length) {
        const baselineValue = this.cvdValues[baselineIndex];
        for (let i = 0; i < this.cvdValues.length; i++) {
          this.cvdValues[i] -= baselineValue;
        }
      }
    }
  }

  // Public method to add new candle data for streaming updates (O(1))
  public addCandle(candle: CandleData) {
    this.data.push(candle);

    // Calculate CVD for new candle (O(1) update)
    const lastCVD = this.cvdValues.length > 0 ? this.cvdValues[this.cvdValues.length - 1] : 0;
    const delta = candle.footprint.reduce((sum, level) => sum + (level.buy - level.sell), 0);
    const newCVD = lastCVD + delta;

    // Apply normalization if needed
    let normalizedCVD = newCVD;
    if (this.cvdNormalize) {
      let baselineValue = 0;
      if (this.cvdBaseline === 'global') {
        baselineValue = this.cvdValues.length > 0 ? this.cvdValues[0] : 0;
      } else if (this.cvdBaseline === 'session') {
        baselineValue = this.cvdValues.length > 0 ? this.cvdValues[0] : 0; // Simplified
      } else if (this.cvdBaseline === 'visible') {
        const vr = this.scales?.getVisibleRange();
        const baselineIndex = vr ? vr.startIndex : 0;
        baselineValue = baselineIndex < this.cvdValues.length ? this.cvdValues[baselineIndex] : 0;
      }
      normalizedCVD = newCVD - baselineValue;
    }

    this.cvdValues.push(normalizedCVD);

    // Update scales and redraw
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
      this.volumeHeatmapDynamic,
      this.scales,
      this.options.theme,
      this.crosshair,
      this.lastPrice,
      this.interactions
    );

    this.drawing.drawAll();
  }

  private updateButtonText() {
    if (this.volumeHeatmapBtn) {
      if (this.options.showVolumeHeatmap) {
        const mode = this.options.volumeHeatmapDynamic ? 'Dynamic' : 'Static';
        this.volumeHeatmapBtn.textContent = `Volume Heatmap (${mode})`;
      } else {
        this.volumeHeatmapBtn.textContent = 'Volume Heatmap';
      }
    }
  }

  private hideAllDropdowns() {
    if (this.volumeHeatmapDropdown) {
      this.volumeHeatmapDropdown.style.display = 'none';
    }
  }

  // Getters for API access
  public getOptions() { return this.options; }
  public getShowGrid() { return this.showGrid; }
}