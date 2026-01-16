/**
 * DOM (Depth of Market) Component
 *
 * Displays a ladder-style view of bid/ask prices with volume visualization.
 * Usage: const dom = new DOM(container, options); dom.setData(data);
 */
import { DOMData, DOMOptions } from './dom-types';
/**
 * DOM (Depth of Market) component.
 * Displays a ladder-style view of order book and trade data.
 */
export declare class DOM {
    private container;
    private canvas;
    private renderer;
    private options;
    private data;
    private columns;
    private scrollOffset;
    private animationFrameId;
    private isDragging;
    private lastY;
    constructor(container: HTMLElement, options?: DOMOptions);
    /**
     * Bind mouse/touch events for scrolling.
     */
    private bindEvents;
    private handleWheel;
    private handleMouseDown;
    private handleMouseMove;
    private handleMouseUp;
    private handleTouchStart;
    private handleTouchMove;
    private handleTouchEnd;
    /**
     * Render the DOM.
     */
    private render;
    /**
     * Set or update DOM data.
     */
    setData(data: DOMData): void;
    /**
     * Update options.
     */
    updateOptions(options: Partial<DOMOptions>): void;
    /**
     * Resize the DOM component.
     */
    resize(width: number, height: number): void;
    /**
     * Center the view on the mid-price.
     */
    centerOnMidPrice(): void;
    /**
     * Get current data.
     */
    getData(): DOMData | null;
    /**
     * Get current options.
     */
    getOptions(): Required<DOMOptions>;
    /**
     * Destroy the DOM component and clean up.
     */
    destroy(): void;
}
export type { DOMLevel, DOMData, DOMOptions, DOMTheme } from './dom-types';
