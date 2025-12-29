/**
 * Main chart implementation for the Volume Footprint Chart.
 * Provides the primary API for creating and managing chart instances with modular components.
 */

import { CandleData, VFCOptions, VFCEvents } from './types';
import { Scales } from './scales';
import { Interactions } from './interactions';
import { Drawing } from './drawing';
import { Aggregator, Timeframe } from './aggregator';

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
  private cvdType: 'ticker' | 'footprint' = 'ticker';

  // Toolbar button references
  private resetZoomBtn: HTMLButtonElement | null = null;
  private toggleGridBtn: HTMLButtonElement | null = null;
  private toggleVolumeFootprintBtn: HTMLButtonElement | null = null;
  private volumeHeatmapBtn: HTMLButtonElement | null = null;
  private volumeHeatmapDropdown: HTMLDivElement | null = null;
  private measureBtn: HTMLButtonElement | null = null;
  private cvdBtn: HTMLButtonElement | null = null;
  private cvdDropdown: HTMLDivElement | null = null;

  // Timeframe aggregation state
  private aggregator: Aggregator = new Aggregator();
  private currentTimeframe: Timeframe = '1m';
  private timeframeButtons: Map<Timeframe, HTMLButtonElement> = new Map();
  private isAggregatedData: boolean = false; // Flag to track if current data is aggregated

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

    // Create CVD dropdown container
    const cvdContainer = document.createElement('div');
    cvdContainer.className = 'dropdown-container';
    cvdContainer.style.position = 'relative';
    cvdContainer.style.display = 'inline-block';

    const cvdBtn = document.createElement('button');
    cvdBtn.id = 'cvdToggle';
    cvdBtn.className = 'tool-btn dropdown-btn';
    cvdBtn.textContent = 'CVD';
    cvdBtn.title = 'Cumulative Volume Delta options';
    cvdContainer.appendChild(cvdBtn);

    // Create CVD dropdown menu
    const cvdDropdown = document.createElement('div');
    cvdDropdown.className = 'dropdown-menu cvd-dropdown';
    cvdDropdown.style.position = 'absolute';
    cvdDropdown.style.top = '100%';
    cvdDropdown.style.left = '0';
    cvdDropdown.style.backgroundColor = '#1a1a1a';
    cvdDropdown.style.border = '1px solid #444';
    cvdDropdown.style.borderRadius = '4px';
    cvdDropdown.style.minWidth = '140px';
    cvdDropdown.style.zIndex = '1000';
    cvdDropdown.style.display = 'none';
    cvdDropdown.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';

    // Ticker option
    const tickerOption = document.createElement('div');
    tickerOption.className = 'dropdown-item';
    tickerOption.textContent = 'Ticker (Vol × Sign)';
    tickerOption.style.padding = '8px 12px';
    tickerOption.style.cursor = 'pointer';
    tickerOption.style.color = '#fff';
    tickerOption.style.fontSize = '12px';
    tickerOption.addEventListener('mouseenter', () => tickerOption.style.backgroundColor = '#333');
    tickerOption.addEventListener('mouseleave', () => tickerOption.style.backgroundColor = 'transparent');
    tickerOption.addEventListener('click', () => {
      this.updateOptions({ showCVD: true, cvdType: 'ticker' });
      this.updateButtonText();
      cvdDropdown.style.display = 'none';
    });
    cvdDropdown.appendChild(tickerOption);

    // Footprint option
    const footprintOption = document.createElement('div');
    footprintOption.className = 'dropdown-item';
    footprintOption.textContent = 'Footprint (Buy − Sell)';
    footprintOption.style.padding = '8px 12px';
    footprintOption.style.cursor = 'pointer';
    footprintOption.style.color = '#fff';
    footprintOption.style.fontSize = '12px';
    footprintOption.addEventListener('mouseenter', () => footprintOption.style.backgroundColor = '#333');
    footprintOption.addEventListener('mouseleave', () => footprintOption.style.backgroundColor = 'transparent');
    footprintOption.addEventListener('click', () => {
      this.updateOptions({ showCVD: true, cvdType: 'footprint' });
      this.updateButtonText();
      cvdDropdown.style.display = 'none';
    });
    cvdDropdown.appendChild(footprintOption);

    // Off option
    const cvdOffOption = document.createElement('div');
    cvdOffOption.className = 'dropdown-item';
    cvdOffOption.textContent = 'Off';
    cvdOffOption.style.padding = '8px 12px';
    cvdOffOption.style.cursor = 'pointer';
    cvdOffOption.style.color = '#fff';
    cvdOffOption.style.fontSize = '12px';
    cvdOffOption.addEventListener('mouseenter', () => cvdOffOption.style.backgroundColor = '#333');
    cvdOffOption.addEventListener('mouseleave', () => cvdOffOption.style.backgroundColor = 'transparent');
    cvdOffOption.addEventListener('click', () => {
      this.updateOptions({ showCVD: false });
      this.updateButtonText();
      cvdDropdown.style.display = 'none';
    });
    cvdDropdown.appendChild(cvdOffOption);

    cvdContainer.appendChild(cvdDropdown);
    topToolbar.appendChild(cvdContainer);

    // Create timeframe button group
    const tfContainer = document.createElement('div');
    tfContainer.className = 'tf-button-group';

    const timeframes: Timeframe[] = ['1m', '5m', '15m', '30m', '1h'];
    for (const tf of timeframes) {
      const btn = document.createElement('button');
      btn.className = 'tool-btn tf-btn' + (tf === '1m' ? ' active' : '');
      btn.textContent = tf.toUpperCase();
      btn.dataset.timeframe = tf;
      tfContainer.appendChild(btn);
    }
    topToolbar.appendChild(tfContainer);

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
    const volumeHeatmapDropdown = container.querySelector('.dropdown-menu:not(.cvd-dropdown)') as HTMLDivElement;
    const measureBtn = container.querySelector('#measure') as HTMLButtonElement;
    const cvdBtn = container.querySelector('#cvdToggle') as HTMLButtonElement;
    const cvdDropdown = container.querySelector('.cvd-dropdown') as HTMLDivElement;

    // Store references for later use
    this.resetZoomBtn = resetZoomBtn;
    this.toggleGridBtn = toggleGridBtn;
    this.toggleVolumeFootprintBtn = toggleVolumeFootprintBtn;
    this.volumeHeatmapBtn = volumeHeatmapBtn;
    this.volumeHeatmapDropdown = volumeHeatmapDropdown;
    this.measureBtn = measureBtn;
    this.cvdBtn = cvdBtn;
    this.cvdDropdown = cvdDropdown;

    // Store timeframe button references
    const tfButtons = container.querySelectorAll('.tf-btn') as NodeListOf<HTMLButtonElement>;
    tfButtons.forEach(btn => {
      const tf = btn.dataset.timeframe as Timeframe;
      if (tf) {
        this.timeframeButtons.set(tf, btn);
      }
    });
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
      showCVD: options.showCVD ?? false,
      cvdHeightRatio: options.cvdHeightRatio || 0.2,
      cvdType: options.cvdType || 'ticker',
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
    this.showVolumeHeatmap = this.options.showVolumeHeatmap;
    this.volumeHeatmapDynamic = this.options.volumeHeatmapDynamic;
    this.showCVD = this.options.showCVD;
    this.cvdType = this.options.cvdType;
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
      this.TEXT_VIS,
      this.showCVD,
      this.options.cvdHeightRatio ?? 0.2
    );

    this.interactions = new Interactions(
      this.canvas,
      this.margin,
      this.view,
      {
        ...this.events,
        onPan: () => {
          if (this.cvdDynamic && this.showCVD) this.calculateCVD();
          this.drawing.drawAll();
        },
        onZoom: () => {
          if (this.cvdDynamic && this.showCVD) this.calculateCVD();
          this.drawing.drawAll();
        },
        onMouseMove: () => this.drawing.drawAll(),
        onCvdResize: (ratio: number) => {
          this.options.cvdHeightRatio = ratio;
          this.updateOptions({ cvdHeightRatio: ratio });
        }
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
      this.interactions,
      this.cvdValues
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

    if (this.cvdBtn && this.cvdDropdown) {
      this.cvdBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Toggle dropdown visibility
        const isVisible = this.cvdDropdown!.style.display !== 'none';
        this.hideAllDropdowns();
        if (!isVisible) {
          this.cvdDropdown!.style.display = 'block';
        }
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!this.cvdBtn?.contains(e.target as Node) &&
          !this.cvdDropdown?.contains(e.target as Node)) {
          this.cvdDropdown!.style.display = 'none';
        }
      });
    }

    // Timeframe button handlers
    this.timeframeButtons.forEach((btn, tf) => {
      btn.addEventListener('click', () => {
        this.setTimeframe(tf);
      });
    });
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
      this.TEXT_VIS,
      this.showCVD,
      this.options.cvdHeightRatio ?? 0.2
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
      this.interactions,
      this.cvdValues
    );

    this.setupCanvas();
    this.drawing.drawAll();
  }

  // Public API
  public setData(data: CandleData[]) {
    this.data = data;

    // Store data in aggregator as base 1m data for aggregation support
    // Only store if this is NOT aggregated data (i.e., it's raw 1m data)
    if (!this.isAggregatedData) {
      this.aggregator.setBase1mData(data);
      this.aggregator.setTimeframe('1m');
      this.currentTimeframe = '1m';
      // Update button states to show 1m as active
      this.timeframeButtons.forEach((btn, tf) => {
        if (tf === '1m') {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    // Detect tick size from data if not explicitly provided
    if (!this.options.tickSize && this.data.length > 0) {
      const detectedTick = this.detectTickSize();
      console.log('Detected tick size:', detectedTick);
      this.TICK = detectedTick;
    } else if (this.options.tickSize) {
      console.log('Using explicit tick size:', this.options.tickSize);
      this.TICK = this.options.tickSize;
    }

    if (data.length > 0) {
      this.lastPrice = data[data.length - 1].close;
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
      this.TEXT_VIS,
      this.showCVD,
      this.options.cvdHeightRatio ?? 0.2
    );

    // Invalidate ladderTop cache when tick size changes
    if (this.TICK !== this.options.tickSize) {
      this.TICK = this.options.tickSize || this.TICK;
      this.scales.invalidateLadderTop();
    }

    // Invalidate ladderTop cache when data changes
    this.scales.invalidateLadderTop();

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

    // Calculate CVD values AFTER scales and view are set
    console.log('setData: calling calculateCVD');
    this.calculateCVD();
    console.log('setData: CVD values calculated, length:', this.cvdValues.length);

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
      this.interactions,
      this.cvdValues
    );

    this.drawing.drawAll();
  }

  public updateOptions(options: Partial<VFCOptions>) {
    const oldShowVolumeFootprint = this.showVolumeFootprint;
    const oldCvdType = this.cvdType;
    Object.assign(this.options, options);
    this.showGrid = this.options.showGrid;
    this.showBounds = this.options.showBounds;
    this.showVolumeFootprint = this.options.showVolumeFootprint;
    this.showVolumeHeatmap = this.options.showVolumeHeatmap;
    this.showVolumeHeatmap = this.options.showVolumeHeatmap;
    this.volumeHeatmapDynamic = this.options.volumeHeatmapDynamic ?? this.volumeHeatmapDynamic;
    this.showCVD = this.options.showCVD ?? this.showCVD;
    this.cvdType = this.options.cvdType ?? 'ticker';
    // const oldCvdDynamic = this.cvdDynamic; // Wait, options doesn't have cvdDynamic directly exposed in interface? 
    // Types interface says: volumeHeatmapDynamic... wait, VFCOptions doesn't have cvdDynamic?
    // Let's check src/types.ts
    // I recall adding showCVD, cvdHeightRatio, cvdType.
    // I did NOT add cvdDynamic to VFCOptions.
    // But chart.ts has private cvdDynamic = true;

    // For now, let's just focus on cvdType.

    if (this.cvdType !== oldCvdType) {
      this.calculateCVD();
    }

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
      this.TEXT_VIS,
      this.showCVD,
      this.options.cvdHeightRatio ?? 0.2
    );

    // Recalculate CVD if needed (e.g. type changed, or just to be safe with new scales)
    if (this.showCVD) {
      this.calculateCVD();
    }

    // Update Interactions with the new Scales instance
    this.interactions.setScales(this.scales);

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
      this.interactions,
      this.cvdValues
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

    console.log('calculateCVD: cvdDynamic =', this.cvdDynamic);
    if (this.cvdDynamic) {
      // Dynamic mode: calculate CVD starting from the visible range
      const vr = this.scales?.getVisibleRange();
      if (vr) {
        const startIndex = vr.startIndex;
        const endIndex = vr.endIndex;
        cumulative = 0;
        for (let i = startIndex; i < endIndex; i++) {
          if (i < this.data.length) {
            const candle = this.data[i];
            let delta = 0;
            if (this.cvdType === 'ticker') {
              const volume = candle.footprint.reduce((sum, level) => sum + level.buy + level.sell, 0);
              const sign = Math.sign(candle.close - candle.open);
              if (candle.close === candle.open) {
                delta = 0;
              } else {
                delta = volume * sign;
              }
            } else {
              delta = candle.footprint.reduce((sum, level) => sum + (level.buy - level.sell), 0);
            }
            cumulative += delta;
            this.cvdValues[i] = cumulative;
          }
        }

        // Apply normalization
        if (this.cvdNormalize) {
          const baselineValue = this.cvdValues[startIndex];
          for (let i = startIndex; i < endIndex; i++) {
            if (i < this.cvdValues.length && this.cvdValues[i] !== undefined) {
              this.cvdValues[i] -= baselineValue;
            }
          }
        }
      }
    } else {
      // Static mode
      for (let i = 0; i < this.data.length; i++) {
        const candle = this.data[i];
        let delta = 0;
        if (this.cvdType === 'ticker') {
          const volume = candle.footprint.reduce((sum, level) => sum + level.buy + level.sell, 0);
          const sign = Math.sign(candle.close - candle.open);
          if (candle.close === candle.open) {
            delta = 0;
          } else {
            delta = volume * sign;
          }
        } else {
          delta = candle.footprint.reduce((sum, level) => sum + (level.buy - level.sell), 0);
        }

        cumulative += delta;
        this.cvdValues[i] = cumulative;
      }

      // Apply normalization
      if (this.cvdNormalize && baselineIndex < this.cvdValues.length && baselineIndex >= 0) {
        const baselineValue = this.cvdValues[baselineIndex];
        for (let i = 0; i < this.cvdValues.length; i++) {
          this.cvdValues[i] -= baselineValue;
        }
      }
    }

    // Ensure Drawing module has the latest data
    if (this.drawing) {
      this.drawing.updateCVD(this.cvdValues);
    }
  }

  // Public method to add new candle data for streaming updates (O(1))
  public addCandle(candle: CandleData) {
    this.data.push(candle);

    // Calculate CVD for new candle (O(1) update)
    const lastCVD = this.cvdValues.length > 0 ? this.cvdValues[this.cvdValues.length - 1] : 0;

    // Calculate new candle delta
    let delta = 0;
    if (this.cvdType === 'ticker') {
      const volume = candle.footprint.reduce((sum, level) => sum + level.buy + level.sell, 0);
      const sign = Math.sign(candle.close - candle.open);
      if (candle.close === candle.open) {
        delta = 0;
      } else {
        delta = volume * sign;
      }
    } else {
      delta = candle.footprint.reduce((sum, level) => sum + (level.buy - level.sell), 0);
    }

    const newCVD = (lastCVD || 0) + delta;

    // Apply normalization if needed
    let normalizedCVD = newCVD;
    if (this.cvdNormalize) {
      let baselineValue = 0;
      if (this.cvdBaseline === 'global') {
        baselineValue = this.cvdValues.length > 0 ? this.cvdValues[0] : 0;
      } else if (this.cvdBaseline === 'visible') {
        const vr = this.scales?.getVisibleRange();
        const baselineIndex = vr ? vr.startIndex : 0;
        baselineValue = baselineIndex < this.cvdValues.length ? this.cvdValues[baselineIndex] : 0;
      }
      normalizedCVD = newCVD - (baselineValue || 0);
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
      this.TEXT_VIS,
      this.showCVD,
      this.options.cvdHeightRatio ?? 0.2
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
      this.interactions,
      this.cvdValues
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
    if (this.cvdBtn) {
      if (this.showCVD) {
        const mode = this.cvdType === 'ticker' ? 'Ticker' : 'Footprint';
        this.cvdBtn.textContent = `CVD (${mode})`;
      } else {
        this.cvdBtn.textContent = 'CVD';
      }
    }
  }

  private hideAllDropdowns() {
    if (this.volumeHeatmapDropdown) {
      this.volumeHeatmapDropdown.style.display = 'none';
    }
    if (this.cvdDropdown) {
      this.cvdDropdown.style.display = 'none';
    }
  }

  /**
   * Set the timeframe for aggregation and update display
   */
  public setTimeframe(tf: Timeframe): void {
    this.currentTimeframe = tf;
    this.aggregator.setTimeframe(tf);

    // Update button active states
    this.timeframeButtons.forEach((btn, buttonTf) => {
      if (buttonTf === tf) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Get aggregated data and redraw
    const aggregatedData = this.aggregator.getData();
    console.log(`setTimeframe(${tf}): aggregated ${aggregatedData.length} candles from ${this.aggregator.getBase1mData().length} 1m candles`);

    if (aggregatedData.length > 0) {
      // Set flag to prevent setData from overwriting aggregator base data
      this.isAggregatedData = (tf !== '1m');
      this.setData(aggregatedData);
      this.isAggregatedData = false;
    }
  }

  /**
   * Get the current timeframe
   */
  public getTimeframe(): Timeframe {
    return this.currentTimeframe;
  }

  /**
   * Set the base 1-minute data and display at current timeframe
   */
  public set1mData(data: CandleData[]): void {
    this.aggregator.setBase1mData(data);
    const aggregatedData = this.aggregator.getData();
    this.setData(aggregatedData);
  }

  /**
   * Update or add a 1-minute candle (for live updates)
   * If the candle has the same timestamp as the last candle, it updates it
   * Otherwise, it adds a new candle
   */
  public update1mCandle(candle: CandleData): void {
    this.aggregator.update1mCandle(candle);

    // Get the aggregated data for current timeframe
    const aggregatedData = this.aggregator.getData();

    if (aggregatedData.length === 0) {
      return;
    }

    // Update the chart data efficiently
    if (this.data.length === 0) {
      this.setData(aggregatedData);
      return;
    }

    const lastAggCandle = aggregatedData[aggregatedData.length - 1];
    const lastDataCandle = this.data[this.data.length - 1];
    const lastAggTime = new Date(lastAggCandle.time).getTime();
    const lastDataTime = new Date(lastDataCandle.time).getTime();

    if (lastAggTime === lastDataTime) {
      // Update the last candle in place
      this.data[this.data.length - 1] = lastAggCandle;
      this.lastPrice = lastAggCandle.close;

      // Update CVD for the last candle
      if (this.cvdValues.length > 0) {
        const prevCVD = this.cvdValues.length > 1 ? this.cvdValues[this.cvdValues.length - 2] : 0;
        let delta = 0;
        if (this.cvdType === 'ticker') {
          const volume = lastAggCandle.footprint.reduce((sum, level) => sum + level.buy + level.sell, 0);
          const sign = Math.sign(lastAggCandle.close - lastAggCandle.open);
          delta = lastAggCandle.close === lastAggCandle.open ? 0 : volume * sign;
        } else {
          delta = lastAggCandle.footprint.reduce((sum, level) => sum + (level.buy - level.sell), 0);
        }
        this.cvdValues[this.cvdValues.length - 1] = prevCVD + delta;
      }
    } else {
      // New candle - append it
      this.addCandle(lastAggCandle);
    }

    this.drawing.drawAll();
  }

  // Getters for API access
  public getOptions() { return this.options; }
  public getShowGrid() { return this.showGrid; }
}