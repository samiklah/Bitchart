/**
 * DOM (Depth of Market) Component
 * 
 * Displays a ladder-style view of bid/ask prices with volume visualization.
 * Usage: const dom = new DOM(container, options); dom.setData(data);
 */

import { DOMLevel, DOMData, DOMOptions, DOMTheme, DOMColumn } from './dom-types';
import { DOMRenderer, DEFAULT_THEME } from './dom-renderer';

/**
 * Default options for the DOM component.
 */
const DEFAULT_OPTIONS: Required<DOMOptions> = {
    width: 380,
    height: 400,
    rowHeight: 20,
    visibleLevels: 20,
    fontSize: 11,
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    showHeaders: true,
    theme: DEFAULT_THEME,
    pricePrecision: 2,
    columns: {
        bid: true,
        sold: true,
        price: true,
        bought: true,
        ask: true,
        deltaVol: true,
        volume: true,
    },
};

/**
 * Column definitions for the DOM.
 */
function createColumns(theme: Required<DOMTheme>, columnVisibility: Required<DOMOptions>['columns'], pricePrecision: number): DOMColumn[] {
    const formatPrice = (price: number): string => {
        if (price >= 1000) {
            return price.toLocaleString('en-US', { minimumFractionDigits: pricePrecision, maximumFractionDigits: pricePrecision });
        }
        return price.toFixed(pricePrecision);
    };

    const columns: DOMColumn[] = [];

    // Bid column (left side)
    if (columnVisibility.bid) {
        columns.push({
            id: 'bid',
            label: 'Bid',
            width: 50,
            align: 'right',
            getValue: (level) => level.bid > 0 ? formatVolume(level.bid) : '',
            getBarValue: (level, max) => level.bid / max,
            barColor: theme.bidColor,
            barSide: 'left',
        });
    }

    // Sold volume (next to Bid)
    if (columnVisibility.sold) {
        columns.push({
            id: 'sold',
            label: 'Sold',
            width: 50,
            align: 'right',
            getValue: (level) => level.sold > 0 ? formatVolume(level.sold) : '',
            getBarValue: (level, max) => level.sold / max,
            barColor: theme.askColor,
            barSide: 'left',
        });
    }

    // Price column in the middle
    if (columnVisibility.price) {
        columns.push({
            id: 'price',
            label: 'Price',
            width: 70,
            align: 'center',
            getValue: (level) => formatPrice(level.price),
        });
    }

    // Bought volume (next to Ask)
    if (columnVisibility.bought) {
        columns.push({
            id: 'bought',
            label: 'Bought',
            width: 50,
            align: 'left',
            getValue: (level) => level.bought > 0 ? formatVolume(level.bought) : '',
            getBarValue: (level, max) => level.bought / max,
            barColor: theme.bidColor,
            barSide: 'right',
        });
    }

    // Ask column (right side)
    if (columnVisibility.ask) {
        columns.push({
            id: 'ask',
            label: 'Ask',
            width: 50,
            align: 'left',
            getValue: (level) => level.ask > 0 ? formatVolume(level.ask) : '',
            getBarValue: (level, max) => level.ask / max,
            barColor: theme.askColor,
            barSide: 'right',
        });
    }

    if (columnVisibility.deltaVol) {
        columns.push({
            id: 'deltaVol',
            label: 'Delta',
            width: 55,
            align: 'right',
            getValue: (level) => {
                if (level.delta === 0) return '';
                const prefix = level.delta > 0 ? '+' : '';
                return prefix + formatVolume(level.delta);
            },
            getBarValue: (level, max) => Math.abs(level.delta) / max,
            barColor: level => level.delta >= 0 ? theme.deltaPositive : theme.deltaNegative,
            barSide: 'left',
        });
    }

    if (columnVisibility.volume) {
        columns.push({
            id: 'volume',
            label: 'Volume',
            width: 55,
            align: 'right',
            getValue: (level) => level.volume > 0 ? formatVolume(level.volume) : '',
            getBarValue: (level, max) => level.volume / max,
            barColor: '#555555',  // Dark gray bars
            barSide: 'left',
        });
    }

    return columns;
}

/**
 * Format volume numbers for display.
 */
function formatVolume(value: number): string {
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
        return (value / 1000000).toFixed(2) + 'M';
    }
    if (absValue >= 1000) {
        return (value / 1000).toFixed(2) + 'K';
    }
    return value.toFixed(2);
}

/**
 * Format price for display.
 */
// Moved into createColumns to use dynamic pricePrecision

/**
 * DOM (Depth of Market) component.
 * Displays a ladder-style view of order book and trade data.
 */
export class DOM {
    private container: HTMLElement;
    private canvas: HTMLCanvasElement;
    private renderer: DOMRenderer;
    private options: Required<DOMOptions>;
    private data: DOMData | null = null;
    private columns: DOMColumn[];
    private scrollOffset: number = 0;
    private animationFrameId: number | null = null;
    private isDragging: boolean = false;
    private lastY: number = 0;

    constructor(container: HTMLElement, options: DOMOptions = {}) {
        this.container = container;

        // Merge options with defaults
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options,
            theme: { ...DEFAULT_THEME, ...(options.theme || {}) },
            columns: { ...DEFAULT_OPTIONS.columns, ...(options.columns || {}) },
        };

        // Auto-detect dimensions from container if not specified
        if (!options.width) {
            this.options.width = container.clientWidth || DEFAULT_OPTIONS.width;
        }
        if (!options.height) {
            this.options.height = container.clientHeight || DEFAULT_OPTIONS.height;
        }

        // Create columns based on theme and visibility
        this.columns = createColumns(this.options.theme as Required<DOMTheme>, this.options.columns, this.options.pricePrecision);

        // Create canvas element
        this.canvas = document.createElement('canvas');
        this.canvas.style.display = 'block';
        this.canvas.style.background = this.options.theme.background || DEFAULT_THEME.background;
        container.appendChild(this.canvas);

        // Create renderer
        this.renderer = new DOMRenderer(this.canvas, this.options.theme);
        this.renderer.resize(this.options.width, this.options.height);

        // Bind events
        this.bindEvents();

        // Initial render
        this.render();
    }

    /**
     * Bind mouse/touch events for scrolling.
     */
    private bindEvents(): void {
        // Scrolling disabled - mid-price always stays centered
    }


    /**
     * Render the DOM.
     */
    private render(): void {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        this.animationFrameId = requestAnimationFrame(() => {
            this.renderer.render(this.data, this.options, this.scrollOffset, this.columns);
            this.animationFrameId = null;
        });
    }

    /**
     * Set or update DOM data.
     */
    setData(data: DOMData): void {
        this.data = data;
        this.render();
    }

    /**
     * Update options.
     */
    updateOptions(options: Partial<DOMOptions>): void {
        this.options = {
            ...this.options,
            ...options,
            theme: { ...this.options.theme, ...(options.theme || {}) },
            columns: { ...this.options.columns, ...(options.columns || {}) },
        };

        // Recreate columns if visibility or precision changed
        if (options.columns || options.pricePrecision !== undefined) {
            this.columns = createColumns(this.options.theme as Required<DOMTheme>, this.options.columns, this.options.pricePrecision);
        }

        // Update renderer theme
        if (options.theme) {
            this.renderer.setTheme(this.options.theme);
        }

        this.render();
    }

    /**
     * Resize the DOM component.
     */
    resize(width: number, height: number): void {
        this.options.width = width;
        this.options.height = height;
        this.renderer.resize(width, height);
        this.render();
    }

    /**
     * Center the view on the mid-price.
     */
    centerOnMidPrice(): void {
        this.scrollOffset = 0;
        this.render();
    }

    /**
     * Get current data.
     */
    getData(): DOMData | null {
        return this.data;
    }

    /**
     * Get current options.
     */
    getOptions(): Required<DOMOptions> {
        return this.options;
    }

    /**
     * Destroy the DOM component and clean up.
     */
    destroy(): void {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        // Remove canvas from container
        if (this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}

// Re-export types for convenience
export type { DOMLevel, DOMData, DOMOptions, DOMTheme } from './dom-types';
