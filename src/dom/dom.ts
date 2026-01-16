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
    width: 600,
    height: 400,
    rowHeight: 20,
    visibleLevels: 20,
    fontSize: 11,
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    showHeaders: true,
    theme: DEFAULT_THEME,
    columns: {
        bidVol: true,
        askVol: true,
        bid: true,
        atBid: true,
        atAsk: true,
        ask: true,
        price: true,
        deltaVol: true,
        volume: true,
    },
};

/**
 * Column definitions for the DOM.
 */
function createColumns(theme: Required<DOMTheme>, columnVisibility: Required<DOMOptions>['columns']): DOMColumn[] {
    const columns: DOMColumn[] = [];

    if (columnVisibility.bidVol) {
        columns.push({
            id: 'bidVol',
            label: 'Bid Vol',
            width: 60,
            align: 'right',
            getValue: (level) => level.sold > 0 ? formatVolume(level.sold) : '',
            getBarValue: (level, max) => level.sold / max,
            barColor: theme.bidColor,
            barSide: 'left',  // Bar grows from right edge toward left (inward)
        });
    }

    if (columnVisibility.askVol) {
        columns.push({
            id: 'askVol',
            label: 'Ask Vol',
            width: 60,
            align: 'left',
            getValue: (level) => level.bought > 0 ? formatVolume(level.bought) : '',
            getBarValue: (level, max) => level.bought / max,
            barColor: theme.askColor,
            barSide: 'right',  // Bar grows from left edge toward right (inward)
        });
    }

    if (columnVisibility.bid) {
        columns.push({
            id: 'bid',
            label: 'Bid',
            width: 60,
            align: 'right',
            getValue: (level) => level.bid > 0 ? formatVolume(level.bid) : '',
            getBarValue: (level, max) => level.bid / max,
            barColor: theme.bidColor,
            barSide: 'left',
        });
    }

    if (columnVisibility.atBid) {
        columns.push({
            id: 'atBid',
            label: '@Bid',
            width: 50,
            align: 'right',
            getValue: (level) => level.sold > 0 ? formatVolume(level.sold) : '',
        });
    }

    if (columnVisibility.atAsk) {
        columns.push({
            id: 'atAsk',
            label: '@Ask',
            width: 50,
            align: 'right',
            getValue: (level) => level.bought > 0 ? formatVolume(level.bought) : '',
        });
    }

    if (columnVisibility.ask) {
        columns.push({
            id: 'ask',
            label: 'Ask',
            width: 60,
            align: 'left',
            getValue: (level) => level.ask > 0 ? formatVolume(level.ask) : '',
            getBarValue: (level, max) => level.ask / max,
            barColor: theme.askColor,
            barSide: 'right',
        });
    }

    if (columnVisibility.price) {
        columns.push({
            id: 'price',
            label: 'Price',
            width: 80,
            align: 'center',
            getValue: (level) => formatPrice(level.price),
        });
    }

    if (columnVisibility.deltaVol) {
        columns.push({
            id: 'deltaVol',
            label: 'Delta',
            width: 60,
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
            width: 70,
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
    if (Math.abs(value) >= 1000000) {
        return (value / 1000000).toFixed(1) + 'M';
    }
    if (Math.abs(value) >= 1000) {
        return (value / 1000).toFixed(1) + 'K';
    }
    return value.toFixed(value < 10 ? 2 : 0);
}

/**
 * Format price for display.
 */
function formatPrice(price: number): string {
    if (price >= 1000) {
        return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return price.toFixed(2);
}

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
        this.columns = createColumns(this.options.theme as Required<DOMTheme>, this.options.columns);

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
        // Mouse wheel scrolling
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });

        // Mouse drag scrolling
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));

        // Touch scrolling
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
    }

    private handleWheel(e: WheelEvent): void {
        e.preventDefault();
        const delta = Math.sign(e.deltaY);
        this.scrollOffset += delta;
        this.render();
    }

    private handleMouseDown(e: MouseEvent): void {
        this.isDragging = true;
        this.lastY = e.clientY;
    }

    private handleMouseMove(e: MouseEvent): void {
        if (!this.isDragging) return;
        const deltaY = this.lastY - e.clientY;
        this.scrollOffset += Math.round(deltaY / this.options.rowHeight);
        this.lastY = e.clientY;
        this.render();
    }

    private handleMouseUp(): void {
        this.isDragging = false;
    }

    private handleTouchStart(e: TouchEvent): void {
        if (e.touches.length === 1) {
            this.isDragging = true;
            this.lastY = e.touches[0].clientY;
        }
    }

    private handleTouchMove(e: TouchEvent): void {
        if (!this.isDragging || e.touches.length !== 1) return;
        e.preventDefault();
        const deltaY = this.lastY - e.touches[0].clientY;
        this.scrollOffset += Math.round(deltaY / this.options.rowHeight);
        this.lastY = e.touches[0].clientY;
        this.render();
    }

    private handleTouchEnd(): void {
        this.isDragging = false;
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

        // Recreate columns if visibility changed
        if (options.columns) {
            this.columns = createColumns(this.options.theme as Required<DOMTheme>, this.options.columns);
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

        // Remove event listeners
        this.canvas.removeEventListener('wheel', this.handleWheel.bind(this));
        this.canvas.removeEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.removeEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.removeEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.removeEventListener('mouseleave', this.handleMouseUp.bind(this));

        // Remove canvas from container
        if (this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}

// Re-export types for convenience
export type { DOMLevel, DOMData, DOMOptions, DOMTheme } from './dom-types';
