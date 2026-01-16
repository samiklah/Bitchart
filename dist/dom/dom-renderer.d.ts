/**
 * Canvas renderer for the Depth of Market (DOM) component.
 * Handles all drawing operations for the DOM ladder.
 */
import { DOMData, DOMTheme, DOMOptions, DOMColumn } from './dom-types';
/**
 * Default theme for the DOM.
 */
export declare const DEFAULT_THEME: Required<DOMTheme>;
/**
 * DOMRenderer handles all canvas drawing for the DOM component.
 */
export declare class DOMRenderer {
    private canvas;
    private ctx;
    private theme;
    private dpr;
    constructor(canvas: HTMLCanvasElement, theme?: Partial<DOMTheme>);
    /**
     * Update the theme.
     */
    setTheme(theme: Partial<DOMTheme>): void;
    /**
     * Render the complete DOM view.
     */
    render(data: DOMData | null, options: Required<DOMOptions>, scrollOffset: number, columns: DOMColumn[]): void;
    /**
     * Find the index of the price level closest to mid-price.
     */
    private findMidPriceIndex;
    /**
     * Render "No Data" message.
     */
    private renderNoData;
    /**
     * Render column headers.
     */
    private renderHeaders;
    /**
     * Render a single row.
     */
    private renderRow;
    /**
     * Get max value for a column for bar scaling.
     */
    private getMaxValueForColumn;
    /**
     * Get text color for a column.
     */
    private getTextColor;
    /**
     * Get X position for text based on alignment.
     */
    private getTextX;
    /**
     * Render vertical grid lines between columns.
     */
    private renderGridLines;
    /**
     * Resize the canvas.
     */
    resize(width: number, height: number): void;
}
