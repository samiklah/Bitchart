/**
 * Canvas renderer for the Depth of Market (DOM) component.
 * Handles all drawing operations for the DOM ladder.
 */

import { DOMLevel, DOMData, DOMTheme, DOMOptions, DOMColumn } from './dom-types';

/**
 * Default theme for the DOM.
 */
export const DEFAULT_THEME: Required<DOMTheme> = {
    background: '#181a1f',
    rowBackgroundEven: '#1a1c21',
    rowBackgroundOdd: '#1e2025',
    headerBackground: '#111113',
    textColor: '#e0e0e0',
    headerTextColor: '#aaaaaa',
    bidColor: '#26a69a',
    askColor: '#ef5350',
    deltaPositive: '#26a69a',
    deltaNegative: '#ef5350',
    midPriceColor: '#4caf50',
    midPriceBackground: '#b8860b',  // Dark golden/yellow for mid-price row
    atBidColor: '#2196f3',
    atAskColor: '#ef5350',
    gridColor: '#333333',
    priceColumnBackground: '#252830',
};

/**
 * DOMRenderer handles all canvas drawing for the DOM component.
 */
export class DOMRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private theme: Required<DOMTheme>;
    private dpr: number;

    constructor(canvas: HTMLCanvasElement, theme: Partial<DOMTheme> = {}) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get 2D context from canvas');
        }
        this.ctx = ctx;
        this.theme = { ...DEFAULT_THEME, ...theme };
        this.dpr = window.devicePixelRatio || 1;
    }

    /**
     * Update the theme.
     */
    setTheme(theme: Partial<DOMTheme>): void {
        this.theme = { ...DEFAULT_THEME, ...theme };
    }

    /**
     * Render the complete DOM view.
     */
    render(
        data: DOMData | null,
        options: Required<DOMOptions>,
        scrollOffset: number,
        columns: DOMColumn[]
    ): void {
        const { width, height, rowHeight, fontSize, fontFamily, showHeaders } = options;
        const ctx = this.ctx;
        const theme = this.theme;

        // Clear canvas
        ctx.fillStyle = theme.background;
        ctx.fillRect(0, 0, width * this.dpr, height * this.dpr);

        if (!data || data.levels.length === 0) {
            this.renderNoData(width, height, fontSize, fontFamily);
            return;
        }

        // Calculate layout
        const headerHeight = showHeaders ? rowHeight + 4 : 0;
        const contentHeight = height - headerHeight;
        const visibleRows = Math.floor(contentHeight / rowHeight);

        // Find mid-price index to center the view
        const midPriceIndex = this.findMidPriceIndex(data.levels, data.midPrice);

        // Calculate start index - center on mid-price (no bounds clamping - handled in render loop)
        let startIndex = midPriceIndex - Math.floor(visibleRows / 2) + scrollOffset;

        // Calculate max values for bar scaling based on VISIBLE levels only (±20 ticks around mid-price)
        const visibleLevels = data.levels.filter((_, idx) => {
            return idx >= startIndex && idx < startIndex + visibleRows;
        });
        const maxBid = Math.max(...visibleLevels.map(l => l.bid), 1);
        const maxAsk = Math.max(...visibleLevels.map(l => l.ask), 1);
        const maxBidandAsk = Math.max(maxBid, maxAsk);
        const maxSold = Math.max(...visibleLevels.map(l => l.sold), 1);
        const maxBought = Math.max(...visibleLevels.map(l => l.bought), 1);
        const maxBidandAskandSoldandBought = Math.max(maxBidandAsk, maxSold, maxBought);
        const maxDelta = Math.max(...visibleLevels.map(l => Math.abs(l.delta)), 1);
        const maxVolume = Math.max(...visibleLevels.map(l => l.volume), 1);
        const maxValues = { maxBidandAskandSoldandBought, maxBidandAsk, maxDelta, maxVolume };

        // Render headers
        if (showHeaders) {
            this.renderHeaders(columns, rowHeight, fontSize, fontFamily);
        }

        // Render rows
        for (let i = 0; i < visibleRows; i++) {
            const levelIndex = startIndex + i;
            // Skip if level index is out of bounds
            if (levelIndex < 0 || levelIndex >= data.levels.length) continue;

            const level = data.levels[levelIndex];
            const y = headerHeight + i * rowHeight;
            // Use index comparison for more reliable mid-price detection
            const isMidPrice = levelIndex === midPriceIndex;

            this.renderRow(
                level,
                y,
                rowHeight,
                columns,
                maxValues,
                fontSize,
                fontFamily,
                i % 2 === 0,
                isMidPrice
            );
        }

        // Render grid lines
        this.renderGridLines(columns, headerHeight, height);
    }

    /**
     * Find the index of the price level closest to mid-price.
     */
    private findMidPriceIndex(levels: DOMLevel[], midPrice: number): number {
        let closestIndex = 0;
        let closestDiff = Infinity;

        for (let i = 0; i < levels.length; i++) {
            const diff = Math.abs(levels[i].price - midPrice);
            if (diff < closestDiff) {
                closestDiff = diff;
                closestIndex = i;
            }
        }

        return closestIndex;
    }

    /**
     * Render "No Data" message.
     */
    private renderNoData(
        width: number,
        height: number,
        fontSize: number,
        fontFamily: string
    ): void {
        const ctx = this.ctx;
        ctx.fillStyle = this.theme.textColor;
        ctx.font = `${fontSize * this.dpr}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No DOM Data', (width * this.dpr) / 2, (height * this.dpr) / 2);
    }

    /**
     * Render column headers.
     */
    private renderHeaders(
        columns: DOMColumn[],
        rowHeight: number,
        fontSize: number,
        fontFamily: string
    ): void {
        const ctx = this.ctx;
        const theme = this.theme;

        // Header background
        ctx.fillStyle = theme.headerBackground;
        let totalWidth = 0;
        columns.forEach(col => totalWidth += col.width);
        ctx.fillRect(0, 0, totalWidth * this.dpr, (rowHeight + 4) * this.dpr);

        // Header text
        ctx.fillStyle = theme.headerTextColor;
        ctx.font = `bold ${(fontSize - 1) * this.dpr}px ${fontFamily}`;

        let x = 0;
        for (const col of columns) {
            const textX = this.getTextX(x, col.width, col.align);
            ctx.textAlign = col.align;
            ctx.textBaseline = 'middle';
            ctx.fillText(col.label, textX * this.dpr, ((rowHeight + 4) / 2) * this.dpr);
            x += col.width;
        }

        // Header bottom border
        ctx.strokeStyle = theme.gridColor;
        ctx.lineWidth = this.dpr;
        ctx.beginPath();
        ctx.moveTo(0, (rowHeight + 4) * this.dpr);
        ctx.lineTo(totalWidth * this.dpr, (rowHeight + 4) * this.dpr);
        ctx.stroke();
    }

    /**
     * Render a single row.
     */
    private renderRow(
        level: DOMLevel,
        y: number,
        rowHeight: number,
        columns: DOMColumn[],
        maxValues: { maxBidandAskandSoldandBought: number; maxBidandAsk: number; maxDelta: number; maxVolume: number },
        fontSize: number,
        fontFamily: string,
        isEven: boolean,
        isMidPrice: boolean
    ): void {
        const ctx = this.ctx;
        const theme = this.theme;

        let x = 0;
        for (const col of columns) {
            // Row background
            let bgColor = isEven ? theme.rowBackgroundEven : theme.rowBackgroundOdd;
            if (col.id === 'price') {
                bgColor = theme.priceColumnBackground;
            }

            ctx.fillStyle = bgColor;
            ctx.fillRect(x * this.dpr, y * this.dpr, col.width * this.dpr, rowHeight * this.dpr);

            // Render bar if applicable
            if (col.getBarValue && col.barColor) {
                const maxValue = this.getMaxValueForColumn(col.id, maxValues);
                const barValue = col.getBarValue(level, maxValue);
                const barWidth = (col.width - 4) * Math.min(barValue, 1);

                if (barWidth > 0) {
                    // Resolve bar color (can be string or function)
                    const resolvedColor = typeof col.barColor === 'function'
                        ? col.barColor(level)
                        : col.barColor;
                    ctx.fillStyle = resolvedColor + 'cc';  // Add opacity
                    if (col.barSide === 'right') {
                        ctx.fillRect(
                            (x + 2) * this.dpr,
                            (y + 2) * this.dpr,
                            barWidth * this.dpr,
                            (rowHeight - 4) * this.dpr
                        );
                    } else {
                        ctx.fillRect(
                            (x + col.width - 2 - barWidth) * this.dpr,
                            (y + 2) * this.dpr,
                            barWidth * this.dpr,
                            (rowHeight - 4) * this.dpr
                        );
                    }
                }
            }

            // Render text
            const value = col.getValue(level);
            if (value !== 0 && value !== '0') {
                ctx.fillStyle = this.getTextColor(col.id, level, theme);
                ctx.font = `${fontSize * this.dpr}px ${fontFamily}`;
                ctx.textAlign = col.align;
                ctx.textBaseline = 'middle';

                const textX = this.getTextX(x, col.width, col.align);
                const textY = y + rowHeight / 2;
                ctx.fillText(String(value), textX * this.dpr, textY * this.dpr);
            }

            x += col.width;
        }

        // Draw yellow line at bottom of mid-price row
        if (isMidPrice) {
            let totalWidth = 0;
            columns.forEach(col => totalWidth += col.width);
            ctx.strokeStyle = theme.midPriceBackground;
            ctx.lineWidth = 2 * this.dpr;
            ctx.beginPath();
            ctx.moveTo(0, (y + rowHeight) * this.dpr);
            ctx.lineTo(totalWidth * this.dpr, (y + rowHeight) * this.dpr);
            ctx.stroke();
        }
    }

    /**
     * Get max value for a column for bar scaling.
     */
    private getMaxValueForColumn(
        colId: string,
        maxValues: { maxBidandAskandSoldandBought: number; maxBidandAsk: number; maxDelta: number; maxVolume: number }
    ): number {
        switch (colId) {
            case 'sold':
                return maxValues.maxBidandAskandSoldandBought;
            case 'bought':
                return maxValues.maxBidandAskandSoldandBought;
            case 'bid':
                return maxValues.maxBidandAsk;
            case 'ask':
                return maxValues.maxBidandAsk;
            case 'deltaVol':
                return maxValues.maxDelta;
            case 'volume':
                return maxValues.maxVolume;
            default:
                return 1;
        }
    }

    /**
     * Get text color for a column.
     */
    private getTextColor(colId: string, level: DOMLevel, theme: Required<DOMTheme>): string {
        switch (colId) {
            case 'sold':
                return theme.textColor;    // Red for Sold volume
            case 'bought':
                return theme.textColor;    // Green for Bought volume
            case 'bid':
            case 'ask':
            case 'deltaVol':
            case 'volume':
            case 'price':
            default:
                return theme.textColor;  // Default text color for other columns
        }
    }

    /**
     * Get X position for text based on alignment.
     */
    private getTextX(columnX: number, columnWidth: number, align: 'left' | 'center' | 'right'): number {
        switch (align) {
            case 'left':
                return columnX + 4;
            case 'right':
                return columnX + columnWidth - 4;
            case 'center':
            default:
                return columnX + columnWidth / 2;
        }
    }

    /**
     * Render vertical grid lines between columns.
     */
    private renderGridLines(columns: DOMColumn[], headerHeight: number, height: number): void {
        const ctx = this.ctx;
        ctx.strokeStyle = this.theme.gridColor;
        ctx.lineWidth = this.dpr;

        let x = 0;
        for (let i = 0; i < columns.length - 1; i++) {
            x += columns[i].width;
            ctx.beginPath();
            ctx.moveTo(x * this.dpr, 0);
            ctx.lineTo(x * this.dpr, height * this.dpr);
            ctx.stroke();
        }
    }

    /**
     * Resize the canvas.
     */
    resize(width: number, height: number): void {
        this.canvas.width = width * this.dpr;
        this.canvas.height = height * this.dpr;
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
    }
}
