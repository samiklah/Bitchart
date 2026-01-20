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
  private viewModeSelect: HTMLSelectElement | null = null;
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

  // Delta table state
  private showDeltaTable = false;
  private deltaTableBtn: HTMLButtonElement | null = null;

  // Edit settings popup state
  private editBtn: HTMLButtonElement | null = null;
  private editPopup: HTMLDivElement | null = null;

  // Open Interest indicator state
  private showOI = false;
  private oiData: { timestamp: number; value: number }[] = [];

  // Funding Rate indicator state
  private showFundingRate = false;
  private fundingRateData: { timestamp: number; value: number }[] = [];

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

    // Find the most frequent difference (Mode) to avoid selecting noise (e.g. 1e-8)
    if (priceDifferences.size === 0) return 10;

    const diffCounts = new Map<number, number>();
    for (const d of priceDifferences) {
      // Group similar diffs to handle slight float variance
      let found = false;
      for (const [existing, count] of diffCounts) {
        if (Math.abs(existing - d) < 1e-9) {
          diffCounts.set(existing, count + 1);
          found = true;
          break;
        }
      }
      if (!found) {
        diffCounts.set(d, 1);
      }
    }

    let bestDiff = 1;
    let maxCount = 0;

    // Sort by count descending, then by value (prefer smaller common tick for precision)
    for (const [diff, count] of diffCounts) {
      if (count > maxCount) {
        maxCount = count;
        bestDiff = diff;
      } else if (count === maxCount && diff < bestDiff) {
        bestDiff = diff;
      }
    }

    return bestDiff;


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


    const viewModeSelect = document.createElement('select');
    viewModeSelect.id = 'viewModeSelect';
    viewModeSelect.className = 'tool-select';

    // Add options
    const modes = [
      { value: 'candles', label: 'Candles' },
      { value: 'bid_ask', label: 'Bid/Ask Footprint' },
      { value: 'delta', label: 'Delta Footprint' }
    ];

    modes.forEach(mode => {
      const option = document.createElement('option');
      option.value = mode.value;
      option.text = mode.label;
      viewModeSelect.appendChild(option);
    });

    topToolbar.appendChild(viewModeSelect);

    // Create volume heatmap toggle button (simple on/off - type set in edit popup)
    const volumeHeatmapBtn = document.createElement('button');
    volumeHeatmapBtn.id = 'volumeHeatmap';
    volumeHeatmapBtn.className = 'tool-btn';
    volumeHeatmapBtn.textContent = 'Volume Heatmap';
    volumeHeatmapBtn.title = 'Toggle volume heatmap (set type in ⚙️ Settings)';
    topToolbar.appendChild(volumeHeatmapBtn);


    const measureBtn = document.createElement('button');
    measureBtn.id = 'measure';
    measureBtn.className = 'tool-btn';
    measureBtn.title = 'Measure Tool';
    measureBtn.textContent = '📐 Measure';
    topToolbar.appendChild(measureBtn);

    // Create CVD toggle button (simple on/off - type set in edit popup)
    const cvdBtn = document.createElement('button');
    cvdBtn.id = 'cvdToggle';
    cvdBtn.className = 'tool-btn';
    cvdBtn.textContent = 'CVD';
    cvdBtn.title = 'Toggle CVD (set type in ⚙️ Settings)';
    topToolbar.appendChild(cvdBtn);

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

    // Create Delta Table toggle button
    const deltaTableBtn = document.createElement('button');
    deltaTableBtn.id = 'deltaTableToggle';
    deltaTableBtn.className = 'tool-btn';
    deltaTableBtn.textContent = 'Table';
    deltaTableBtn.title = 'Show Delta & Delta% in table below chart';
    topToolbar.appendChild(deltaTableBtn);

    // Create Edit Settings button and popup
    const editContainer = document.createElement('div');
    editContainer.style.position = 'relative';
    editContainer.style.display = 'inline-block';

    const editBtn = document.createElement('button');
    editBtn.id = 'editSettings';
    editBtn.className = 'tool-btn';
    editBtn.textContent = '⚙️';
    editBtn.title = 'Edit Chart Settings';
    editContainer.appendChild(editBtn);

    // Create settings popup
    const editPopup = document.createElement('div');
    editPopup.id = 'editSettingsPopup';
    editPopup.style.cssText = `
      display: none;
      position: absolute;
      top: 100%;
      right: 0;
      background: #222;
      border: 1px solid #444;
      border-radius: 4px;
      padding: 12px;
      z-index: 1000;
      min-width: 220px;
      color: #fff;
      font-size: 12px;
    `;

    // Table Rows Section
    const tableSection = document.createElement('div');
    tableSection.innerHTML = '<div style="font-weight:bold;margin-bottom:8px;color:#888;">Table Rows</div>';
    const tableRows = [
      { key: 'volume', label: 'Volume', defaultOn: true },
      { key: 'volChange', label: 'Vol Change %', defaultOn: true },
      { key: 'buyVol', label: 'Buy Volume', defaultOn: true },
      { key: 'buyVolPercent', label: 'Buy Vol %', defaultOn: true },
      { key: 'sellVol', label: 'Sell Volume', defaultOn: true },
      { key: 'sellVolPercent', label: 'Sell Vol %', defaultOn: true },
      { key: 'delta', label: 'Delta', defaultOn: true },
      { key: 'deltaPercent', label: 'Delta %', defaultOn: true },
      { key: 'minDelta', label: 'Min Delta', defaultOn: false },
      { key: 'maxDelta', label: 'Max Delta', defaultOn: false },
      { key: 'poc', label: 'POC', defaultOn: false },
      { key: 'hlRange', label: 'HL Range', defaultOn: false }
    ];
    tableRows.forEach(row => {
      const label = document.createElement('label');
      label.style.cssText = 'display:block;margin:4px 0;cursor:pointer;';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = row.defaultOn;
      checkbox.dataset.row = row.key;
      checkbox.style.marginRight = '8px';
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(row.label));
      tableSection.appendChild(label);
    });
    editPopup.appendChild(tableSection);

    // Heatmap Type Section
    const heatmapSection = document.createElement('div');
    heatmapSection.style.marginTop = '12px';
    heatmapSection.style.borderTop = '1px solid #444';
    heatmapSection.style.paddingTop = '12px';
    heatmapSection.innerHTML = '<div style="font-weight:bold;margin-bottom:8px;color:#888;">Heatmap Type</div>';
    ['Dynamic', 'Static'].forEach(type => {
      const label = document.createElement('label');
      label.style.cssText = 'display:block;margin:4px 0;cursor:pointer;';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'heatmapType';
      radio.value = type.toLowerCase();
      radio.checked = type === 'Dynamic';
      radio.style.marginRight = '8px';
      label.appendChild(radio);
      label.appendChild(document.createTextNode(type));
      heatmapSection.appendChild(label);
    });
    editPopup.appendChild(heatmapSection);

    // CVD Type Section
    const cvdSection = document.createElement('div');
    cvdSection.style.marginTop = '12px';
    cvdSection.style.borderTop = '1px solid #444';
    cvdSection.style.paddingTop = '12px';
    cvdSection.innerHTML = '<div style="font-weight:bold;margin-bottom:8px;color:#888;">CVD Type</div>';
    [{ value: 'ticker', label: 'Ticker (Vol × Sign)' }, { value: 'footprint', label: 'Footprint (Buy − Sell)' }].forEach(opt => {
      const label = document.createElement('label');
      label.style.cssText = 'display:block;margin:4px 0;cursor:pointer;';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'cvdType';
      radio.value = opt.value;
      radio.checked = opt.value === 'ticker';
      radio.style.marginRight = '8px';
      label.appendChild(radio);
      label.appendChild(document.createTextNode(opt.label));
      cvdSection.appendChild(label);
    });
    editPopup.appendChild(cvdSection);

    // Footprint Style Section
    const fpSection = document.createElement('div');
    fpSection.style.marginTop = '12px';
    fpSection.style.borderTop = '1px solid #444';
    fpSection.style.paddingTop = '12px';
    fpSection.innerHTML = '<div style="font-weight:bold;margin-bottom:8px;color:#888;">Footprint Style</div>';
    [{ value: 'bid_ask', label: 'Bid/Ask' }, { value: 'delta', label: 'Delta Volume' }].forEach(opt => {
      const label = document.createElement('label');
      label.style.cssText = 'display:block;margin:4px 0;cursor:pointer;';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'footprintStyle';
      radio.value = opt.value;
      radio.checked = opt.value === 'bid_ask';
      radio.style.marginRight = '8px';
      label.appendChild(radio);
      label.appendChild(document.createTextNode(opt.label));
      fpSection.appendChild(label);
    });
    editPopup.appendChild(fpSection);

    // Indicators Section
    const indicatorSection = document.createElement('div');
    indicatorSection.style.marginTop = '12px';
    indicatorSection.style.borderTop = '1px solid #444';
    indicatorSection.style.paddingTop = '12px';
    indicatorSection.innerHTML = '<div style="font-weight:bold;margin-bottom:8px;color:#888;">Indicators</div>';
    [
      { id: 'showOI', label: 'Show Open Interest' },
      { id: 'showFundingRate', label: 'Show Funding Rate' }
    ].forEach(opt => {
      const label = document.createElement('label');
      label.style.cssText = 'display:block;margin:4px 0;cursor:pointer;';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = opt.id;
      checkbox.style.marginRight = '8px';
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(opt.label));
      indicatorSection.appendChild(label);
    });
    editPopup.appendChild(indicatorSection);

    editContainer.appendChild(editPopup);
    topToolbar.appendChild(editContainer);

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
    const viewModeSelect = container.querySelector('#viewModeSelect') as HTMLSelectElement;
    const volumeHeatmapBtn = container.querySelector('#volumeHeatmap') as HTMLButtonElement;
    const volumeHeatmapDropdown = container.querySelector('.dropdown-menu:not(.cvd-dropdown)') as HTMLDivElement;
    const measureBtn = container.querySelector('#measure') as HTMLButtonElement;
    const cvdBtn = container.querySelector('#cvdToggle') as HTMLButtonElement;
    const cvdDropdown = container.querySelector('.cvd-dropdown') as HTMLDivElement;

    // Store references for later use
    this.resetZoomBtn = resetZoomBtn;
    this.toggleGridBtn = toggleGridBtn;
    this.viewModeSelect = viewModeSelect;
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

    // Store Delta Table button reference
    this.deltaTableBtn = container.querySelector('#deltaTableToggle') as HTMLButtonElement;

    // Store Edit Settings button and popup references
    this.editBtn = container.querySelector('#editSettings') as HTMLButtonElement;
    this.editPopup = container.querySelector('#editSettingsPopup') as HTMLDivElement;
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
      showDeltaTable: options.showDeltaTable ?? false,
      tickSize: options.tickSize || 10,
      initialZoomX: options.initialZoomX || 0.55,
      initialZoomY: options.initialZoomY || 0.55,
      margin: options.margin || this.margin,
      theme: options.theme || {},
      tableRowVisibility: options.tableRowVisibility || {
        volume: true,
        volChange: true,
        buyVol: true,
        buyVolPercent: true,
        sellVol: true,
        sellVolPercent: true,
        delta: true,
        deltaPercent: true,
        minDelta: false,
        maxDelta: false,
        poc: false,
        hlRange: false
      },
      tableRowHeight: options.tableRowHeight || 16,
      footprintStyle: options.footprintStyle || 'bid_ask',
      showOI: options.showOI ?? false,
      oiHeightRatio: options.oiHeightRatio || 0.15,
      showFundingRate: options.showFundingRate ?? false,
      fundingRateHeightRatio: options.fundingRateHeightRatio || 0.1
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
    this.showOI = this.options.showOI ?? false;
    this.showFundingRate = this.options.showFundingRate ?? false;
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
      this.options.cvdHeightRatio ?? 0.2,
      this.getDeltaTableHeight(),
      this.options.footprintStyle,
      this.showOI,
      this.options.oiHeightRatio ?? 0.15,
      this.showFundingRate,
      this.options.fundingRateHeightRatio ?? 0.1
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
        },
        onTableResize: (height: number) => {
          const allRows = ['volume', 'volChange', 'buyVol', 'buyVolPercent', 'sellVol', 'sellVolPercent', 'delta', 'deltaPercent', 'minDelta', 'maxDelta', 'poc', 'hlRange'];
          const visibility = this.options.tableRowVisibility || {};
          const visibleRows = allRows.filter(key => visibility[key as keyof typeof visibility] !== false).length;
          if (visibleRows > 0) {
            const tableRowHeight = Math.max(10, height / visibleRows);
            this.options.tableRowHeight = tableRowHeight;
            this.updateOptions({ tableRowHeight });
          }
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
      this.cvdValues,
      this.showDeltaTable,
      this.options.tableRowVisibility,
      this.options.tableRowHeight ?? 16,
      this.options.footprintStyle,
      this.showOI,
      this.options.oiHeightRatio ?? 0.15,
      this.showFundingRate,
      this.options.fundingRateHeightRatio ?? 0.1
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
          const centerRow = (this.scales.chartHeight() / 2) / this.scales.rowHeightPx();
          const currentPriceRow = this.scales.priceToRowIndex(lastPrice);
          // Calculate the new offset required to place the price at centerRow
          // priceToRowIndex returns: (ladderTop - price) / TICK + currentOffset
          // We want: (ladderTop - price) / TICK + newOffset = centerRow
          // So: newOffset = centerRow - ((ladderTop - price) / TICK)
          // And: ((ladderTop - price) / TICK) = currentPriceRow - currentOffset
          this.view.offsetRows = centerRow - (currentPriceRow - this.view.offsetRows);
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

    if (this.viewModeSelect) {
      this.viewModeSelect.addEventListener('change', () => {
        const mode = this.viewModeSelect!.value;
        if (mode === 'candles') {
          this.updateOptions({ showVolumeFootprint: false });
        } else {
          this.updateOptions({
            showVolumeFootprint: true,
            footprintStyle: mode as 'bid_ask' | 'delta'
          });
        }
      });
    }

    // Volume Heatmap simple toggle handler
    if (this.volumeHeatmapBtn) {
      this.volumeHeatmapBtn.addEventListener('click', () => {
        this.showVolumeHeatmap = !this.showVolumeHeatmap;
        this.updateOptions({ showVolumeHeatmap: this.showVolumeHeatmap });
        this.updateButtonText();
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

    // CVD simple toggle handler
    if (this.cvdBtn) {
      this.cvdBtn.addEventListener('click', () => {
        this.showCVD = !this.showCVD;
        if (this.showCVD) {
          this.calculateCVD();
        }
        this.updateOptions({ showCVD: this.showCVD });
        this.updateButtonText();
      });
    }

    // Timeframe button handlers
    this.timeframeButtons.forEach((btn, tf) => {
      btn.addEventListener('click', () => {
        this.setTimeframe(tf);
      });
    });

    // Delta Table toggle button handler
    if (this.deltaTableBtn) {
      this.deltaTableBtn.addEventListener('click', () => {
        this.showDeltaTable = !this.showDeltaTable;
        this.options.showDeltaTable = this.showDeltaTable;
        if (this.showDeltaTable) {
          this.deltaTableBtn!.classList.add('active');
        } else {
          this.deltaTableBtn!.classList.remove('active');
        }
        // Rebuild drawing with new option
        this.updateOptions({ showDeltaTable: this.showDeltaTable });
      });
    }

    // Edit Settings button and popup handlers
    if (this.editBtn && this.editPopup) {
      // Toggle popup on button click
      this.editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = this.editPopup!.style.display === 'block';
        this.hideAllDropdowns();
        if (!isVisible) {
          this.editPopup!.style.display = 'block';
        }
      });

      // Table row checkbox handlers
      this.editPopup.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        const checkbox = cb as HTMLInputElement;
        checkbox.addEventListener('change', () => {
          const rowKey = checkbox.dataset.row as keyof typeof this.options.tableRowVisibility;
          if (rowKey && this.options.tableRowVisibility) {
            this.options.tableRowVisibility[rowKey] = checkbox.checked;
            this.updateOptions({ tableRowVisibility: this.options.tableRowVisibility });
          }
        });
      });

      // Heatmap type radio handlers
      this.editPopup.querySelectorAll('input[name="heatmapType"]').forEach(radio => {
        const r = radio as HTMLInputElement;
        r.addEventListener('change', () => {
          const isDynamic = r.value === 'dynamic';
          this.volumeHeatmapDynamic = isDynamic;
          this.updateOptions({ volumeHeatmapDynamic: isDynamic });
          this.updateButtonText();
        });
      });

      // CVD type radio handlers
      this.editPopup.querySelectorAll('input[name="cvdType"]').forEach(radio => {
        const r = radio as HTMLInputElement;
        r.addEventListener('change', () => {
          const cvdType = r.value as 'ticker' | 'footprint';
          this.options.cvdType = cvdType;
          this.updateOptions({ cvdType });
          this.calculateCVD();
          this.updateButtonText();
        });
      });

      // Footprint Style radio handlers
      this.editPopup.querySelectorAll('input[name="footprintStyle"]').forEach(radio => {
        const r = radio as HTMLInputElement;
        r.addEventListener('change', () => {
          const footprintStyle = r.value as 'bid_ask' | 'delta';
          this.options.footprintStyle = footprintStyle;
          this.updateOptions({ footprintStyle });
        });
      });

      // OI indicator checkbox handler
      const oiCheckbox = this.editPopup.querySelector('#showOI') as HTMLInputElement | null;
      if (oiCheckbox) {
        oiCheckbox.checked = this.showOI;
        oiCheckbox.addEventListener('change', () => {
          this.showOI = oiCheckbox.checked;
          this.drawing.setShowOI(this.showOI);
          this.updateOptions({ showOI: this.showOI });
        });
      }

      // Funding Rate indicator checkbox handler
      const frCheckbox = this.editPopup.querySelector('#showFundingRate') as HTMLInputElement | null;
      if (frCheckbox) {
        frCheckbox.checked = this.showFundingRate;
        frCheckbox.addEventListener('change', () => {
          this.showFundingRate = frCheckbox.checked;
          this.drawing.setShowFundingRate(this.showFundingRate);
          this.updateOptions({ showFundingRate: this.showFundingRate });
        });
      }

      // Close popup when clicking outside
      document.addEventListener('click', (e) => {
        if (!this.editBtn?.contains(e.target as Node) &&
          !this.editPopup?.contains(e.target as Node)) {
          this.editPopup!.style.display = 'none';
        }
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
      this.TEXT_VIS,
      this.showCVD,
      this.options.cvdHeightRatio ?? 0.2,
      this.getDeltaTableHeight(),
      this.options.footprintStyle,
      this.showOI,
      this.options.oiHeightRatio ?? 0.15,
      this.showFundingRate,
      this.options.fundingRateHeightRatio ?? 0.1
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
      this.cvdValues,
      this.showDeltaTable,
      this.options.tableRowVisibility,
      this.options.tableRowHeight ?? 16,
      this.options.footprintStyle,
      this.showOI,
      this.options.oiHeightRatio ?? 0.15,
      this.showFundingRate,
      this.options.fundingRateHeightRatio ?? 0.1
    );

    // Pass stored indicator data to the new Drawing instance
    if (this.oiData.length > 0) {
      this.drawing.updateOIData(this.oiData);
    }
    if (this.fundingRateData.length > 0) {
      this.drawing.updateFundingRateData(this.fundingRateData);
    }

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
      this.options.cvdHeightRatio ?? 0.2,
      this.getDeltaTableHeight(),
      this.options.footprintStyle,
      this.showOI,
      this.options.oiHeightRatio ?? 0.15,
      this.showFundingRate,
      this.options.fundingRateHeightRatio ?? 0.1
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
      const centerRow = (this.scales.chartHeight() / 2) / this.scales.rowHeightPx();
      const currentPriceRow = this.scales.priceToRowIndex(lastPrice);
      this.view.offsetRows = centerRow - (currentPriceRow - this.view.offsetRows);
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
      this.cvdValues,
      this.showDeltaTable,
      this.options.tableRowVisibility,
      this.options.tableRowHeight ?? 16,
      this.options.footprintStyle,
      this.showOI,
      this.options.oiHeightRatio ?? 0.15,
      this.showFundingRate,
      this.options.fundingRateHeightRatio ?? 0.1
    );

    // Pass stored indicator data to the new Drawing instance
    if (this.oiData.length > 0) {
      this.drawing.updateOIData(this.oiData);
    }
    if (this.fundingRateData.length > 0) {
      this.drawing.updateFundingRateData(this.fundingRateData);
    }

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
    this.showOI = this.options.showOI ?? this.showOI;
    this.showFundingRate = this.options.showFundingRate ?? this.showFundingRate;
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
      this.options.cvdHeightRatio ?? 0.2,
      this.getDeltaTableHeight(),
      this.options.footprintStyle,
      this.showOI,
      this.options.oiHeightRatio ?? 0.15,
      this.showFundingRate,
      this.options.fundingRateHeightRatio ?? 0.1
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
      this.cvdValues,
      this.showDeltaTable,
      this.options.tableRowVisibility,
      this.options.tableRowHeight ?? 16,
      this.options.footprintStyle,
      this.showOI,
      this.options.oiHeightRatio ?? 0.15,
      this.showFundingRate,
      this.options.fundingRateHeightRatio ?? 0.1
    );

    // Pass stored indicator data to the new Drawing instance
    if (this.oiData.length > 0) {
      this.drawing.updateOIData(this.oiData);
    }
    if (this.fundingRateData.length > 0) {
      this.drawing.updateFundingRateData(this.fundingRateData);
    }

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
      this.options.cvdHeightRatio ?? 0.2,
      this.getDeltaTableHeight(),
      this.options.footprintStyle,
      this.showOI,
      this.options.oiHeightRatio ?? 0.15,
      this.showFundingRate,
      this.options.fundingRateHeightRatio ?? 0.1
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
      this.cvdValues,
      this.showDeltaTable,
      this.options.tableRowVisibility,
      this.options.tableRowHeight ?? 16,
      this.options.footprintStyle,
      this.showOI,
      this.options.oiHeightRatio ?? 0.15,
      this.showFundingRate,
      this.options.fundingRateHeightRatio ?? 0.1
    );

    // Pass stored indicator data to the new Drawing instance
    if (this.oiData.length > 0) {
      this.drawing.updateOIData(this.oiData);
    }
    if (this.fundingRateData.length > 0) {
      this.drawing.updateFundingRateData(this.fundingRateData);
    }

    this.drawing.drawAll();
  }

  private updateButtonText() {
    if (this.viewModeSelect) {
      if (!this.options.showVolumeFootprint) {
        this.viewModeSelect.value = 'candles';
      } else {
        this.viewModeSelect.value = this.options.footprintStyle || 'bid_ask';
      }
    }
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

  /** Calculate the height of the delta table based on visible rows */
  private getDeltaTableHeight(): number {
    if (!this.showDeltaTable) return 0;
    const rowHeight = this.options.tableRowHeight || 16;
    const allRows = ['volume', 'volChange', 'buyVol', 'buyVolPercent', 'sellVol', 'sellVolPercent', 'delta', 'deltaPercent', 'minDelta', 'maxDelta', 'poc', 'hlRange'];
    const visibility = this.options.tableRowVisibility || {};
    const visibleRows = allRows.filter(key => visibility[key as keyof typeof visibility] !== false);
    return rowHeight * visibleRows.length;
  }

  private hideAllDropdowns() {
    if (this.volumeHeatmapDropdown) {
      this.volumeHeatmapDropdown.style.display = 'none';
    }
    if (this.cvdDropdown) {
      this.cvdDropdown.style.display = 'none';
    }
    if (this.editPopup) {
      this.editPopup.style.display = 'none';
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

    // Update the drawing's lastPrice before redrawing so price line updates in real-time
    this.drawing.updateLastPrice(this.lastPrice);
    this.drawing.drawAll();
  }

  // Getters for API access
  public getOptions() { return this.options; }
  public getShowGrid() { return this.showGrid; }

  /**
   * Set Open Interest data for the indicator
   * @param data Array of { timestamp: number, value: number }
   * @param replace If true, replaces existing data. If false (default), merges with existing data.
   */
  public setOIData(data: { timestamp: number; value: number }[], replace: boolean = false): void {
    if (replace) {
      this.oiData = data;
    } else {
      this.oiData = this.mergeData(this.oiData, data);
    }

    // Always update Drawing with data (so it's available when user enables indicator)
    this.drawing.updateOIData(this.oiData);

    // Only redraw if indicator is visible
    if (this.showOI) {
      this.drawing.drawAll();
    }
  }

  /**
   * Set Funding Rate data for the indicator
   * @param data Array of { timestamp: number, value: number }
   * @param replace If true, replaces existing data. If false (default), merges with existing data.
   */
  public setFundingRateData(data: { timestamp: number; value: number }[], replace: boolean = false): void {
    if (replace) {
      this.fundingRateData = data;
    } else {
      this.fundingRateData = this.mergeData(this.fundingRateData, data);
    }

    // Always update Drawing with data (so it's available when user enables indicator)
    this.drawing.updateFundingRateData(this.fundingRateData);

    // Only redraw if indicator is visible
    if (this.showFundingRate) {
      this.drawing.drawAll();
    }
  }

  /** Get current OI data */
  public getOIData() { return this.oiData; }

  /** Get current funding rate data */
  public getFundingRateData() { return this.fundingRateData; }

  // Helper to merge time-series data
  private mergeData(current: { timestamp: number; value: number }[], incoming: { timestamp: number; value: number }[]) {
    if (!current || current.length === 0) return incoming;
    if (!incoming || incoming.length === 0) return current;

    const map = new Map<number, { timestamp: number; value: number }>();

    // Performance optimization: if incoming is strictly after current, just concat
    const lastCurrent = current[current.length - 1];
    const firstIncoming = incoming[0];

    if (firstIncoming.timestamp > lastCurrent.timestamp) {
      return [...current, ...incoming];
    }

    // Otherwise full merge
    for (const item of current) {
      map.set(item.timestamp, item);
    }
    for (const item of incoming) {
      map.set(item.timestamp, item);
    }

    return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
  }
}