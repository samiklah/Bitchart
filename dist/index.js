(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.bitchart = {}));
})(this, (function (exports) { 'use strict';

    /**
     * Utility functions and helpers for the Volume Footprint Chart library.
     * Contains reusable calculations for volume analysis, color mapping, and number formatting.
     */
    /**
     * Creates color mapping functions for buy and sell volumes based on opacity scaling.
     * @param sideMax Maximum volume on either buy or sell side
     * @param buyBase Base opacity for buy volumes
     * @param sellBase Base opacity for sell volumes
     * @returns Object with buyRGBA and sellRGBA functions
     */
    function createVolumeColorMappers(sideMax, buyBase = 0.15, sellBase = 0.15) {
        const buyRGBA = (v) => `rgba(0,255,0,${buyBase + 0.55 * (v / sideMax)})`;
        const sellRGBA = (v) => `rgba(255,0,0,${sellBase + 0.55 * (v / sideMax)})`;
        return { buyRGBA, sellRGBA };
    }
    /**
     * Formats a number with K/M/T suffixes for large values.
     * @param v The number to format
     * @returns Formatted string
     */
    function formatNumber(v) {
        const a = Math.abs(v);
        if (a >= 1e12)
            return (v / 1e12).toFixed(2) + "T";
        if (a >= 1e6)
            return (v / 1e6).toFixed(2) + "M";
        if (a >= 1e3)
            return (v / 1e3).toFixed(2) + "K";
        // For small numbers, show up to 2 decimal places if needed
        if (Number.isInteger(v)) {
            return v.toString();
        }
        return v.toFixed(2);
    }
    /**
     * Calculates the Point of Control (POC) and Value Area (VAH/VAL) for volume profile analysis.
     * @param rows Sorted footprint levels (high to low price)
     * @returns Object containing POC index, VAH/VAL indices and prices, and total volume
     */
    function computeVolumeArea(rows) {
        var _a, _b;
        const levelVols = rows.map(r => r.buy + r.sell);
        const totalVol = levelVols.reduce((a, b) => a + b, 0);
        let pocIdx = 0;
        for (let i = 1; i < levelVols.length; i++) {
            if (levelVols[i] > levelVols[pocIdx])
                pocIdx = i;
        }
        let included = new Set([pocIdx]);
        const enableProfile = rows.length > 3;
        if (enableProfile) {
            let acc = levelVols[pocIdx];
            let up = pocIdx - 1, down = pocIdx + 1;
            while (acc < 0.7 * totalVol && (up >= 0 || down < rows.length)) {
                const upVol = up >= 0 ? levelVols[up] : -1;
                const downVol = down < rows.length ? levelVols[down] : -1;
                if (upVol >= downVol) {
                    if (up >= 0) {
                        included.add(up);
                        acc += levelVols[up];
                        up--;
                    }
                    else {
                        included.add(down);
                        acc += levelVols[down];
                        down++;
                    }
                }
                else {
                    if (down < rows.length) {
                        included.add(down);
                        acc += levelVols[down];
                        down++;
                    }
                    else {
                        included.add(up);
                        acc += levelVols[up];
                        up--;
                    }
                }
            }
        }
        const vahIdx = Math.min(...included);
        const valIdx = Math.max(...included);
        const VAH = (_a = rows[vahIdx]) === null || _a === void 0 ? void 0 : _a.price;
        const VAL = (_b = rows[valIdx]) === null || _b === void 0 ? void 0 : _b.price;
        return { pocIdx, vahIdx, valIdx, VAH, VAL, totalVol };
    }

    /**
     * Provides coordinate transformation and scaling utilities for the chart.
     * Converts between screen pixels, data indices, and price values with zoom and pan support.
     */
    /**
     * Handles coordinate transformations and scaling calculations for the chart.
     * Provides methods to convert between screen coordinates, data indices, and price levels.
     */
    class Scales {
        /**
         * Creates a Scales instance for coordinate transformations.
         * @param data Array of candlestick data
         * @param margin Chart margin configuration
         * @param view Current view state
         * @param canvasWidth Canvas width in pixels
         * @param canvasHeight Canvas height in pixels
         * @param showVolumeFootprint Whether volume footprint is displayed
         * @param TICK Price tick size
         * @param baseRowPx Base row height in pixels
         * @param TEXT_VIS Text visibility thresholds
         * @param showCVD Whether CVD indicator is shown
         * @param cvdHeightRatio Ratio of total height used for CVD
         * @param showOI Whether OI indicator is shown
         * @param oiHeightRatio Ratio of total height used for OI
         * @param showFundingRate Whether funding rate indicator is shown
         * @param fundingRateHeightRatio Ratio of total height used for funding rate
         */
        constructor(data, margin, view, canvasWidth, canvasHeight, showVolumeFootprint, TICK, baseRowPx, TEXT_VIS, showCVD = false, cvdHeightRatio = 0.2, deltaTableHeight = 0, footprintStyle = 'bid_ask', showOI = false, oiHeightRatio = 0.15, showFundingRate = false, fundingRateHeightRatio = 0.1) {
            this.data = [];
            // Cached ladderTop to prevent recalculation on every access
            this.cachedLadderTop = 10000;
            this.ladderTopDirty = true;
            this.data = data;
            this.margin = margin;
            this.view = view;
            this.canvasWidth = canvasWidth;
            this.canvasHeight = canvasHeight;
            this.showVolumeFootprint = showVolumeFootprint;
            this.TICK = TICK;
            this.baseRowPx = baseRowPx;
            this.TEXT_VIS = TEXT_VIS;
            this.showCVD = showCVD;
            this.cvdHeightRatio = cvdHeightRatio;
            this.deltaTableHeight = deltaTableHeight;
            this.footprintStyle = footprintStyle;
            this.showOI = showOI;
            this.oiHeightRatio = oiHeightRatio;
            this.showFundingRate = showFundingRate;
            this.fundingRateHeightRatio = fundingRateHeightRatio;
        }
        /** Returns the height of the main price chart area in pixels (excluding margins and indicators). */
        chartHeight() {
            const totalHeight = this.canvasHeight - this.margin.top - this.margin.bottom - this.deltaTableHeight;
            const indicatorsRatio = this.indicatorsPaneHeight();
            if (indicatorsRatio === 0) {
                return totalHeight;
            }
            // Reserve ratio for all indicators, plus gaps
            const numIndicators = (this.showCVD ? 1 : 0) + (this.showOI ? 1 : 0) + (this.showFundingRate ? 1 : 0);
            return totalHeight * (1 - indicatorsRatio) - numIndicators * 2; // 2px gap per indicator
        }
        /** Returns the height of the CVD pane. */
        cvdHeight() {
            if (!this.showCVD)
                return 0;
            const totalHeight = this.canvasHeight - this.margin.top - this.margin.bottom - this.deltaTableHeight;
            return totalHeight * this.cvdHeightRatio;
        }
        /** Returns the height of the delta table. */
        getDeltaTableHeight() {
            return this.deltaTableHeight;
        }
        /** Returns the Y coordinate where the CVD pane starts. */
        cvdOriginY() {
            return this.margin.top + this.chartHeight() + 2; // + 2px gap
        }
        /** Returns the height of the OI pane. */
        oiHeight() {
            if (!this.showOI)
                return 0;
            const totalHeight = this.canvasHeight - this.margin.top - this.margin.bottom - this.deltaTableHeight;
            return totalHeight * this.oiHeightRatio;
        }
        /** Returns the Y coordinate where the OI pane starts. */
        oiOriginY() {
            return this.cvdOriginY() + this.cvdHeight() + (this.showCVD ? 2 : 0);
        }
        /** Returns the height of the Funding Rate pane. */
        fundingRateHeight() {
            if (!this.showFundingRate)
                return 0;
            const totalHeight = this.canvasHeight - this.margin.top - this.margin.bottom - this.deltaTableHeight;
            return totalHeight * this.fundingRateHeightRatio;
        }
        /** Returns the Y coordinate where the Funding Rate pane starts. */
        fundingRateOriginY() {
            return this.oiOriginY() + this.oiHeight() + (this.showOI ? 2 : 0);
        }
        /** Returns the total height reserved for all indicator panes. */
        indicatorsPaneHeight() {
            let total = 0;
            if (this.showCVD)
                total += this.cvdHeightRatio;
            if (this.showOI)
                total += this.oiHeightRatio;
            if (this.showFundingRate)
                total += this.fundingRateHeightRatio;
            return total;
        }
        /** Maps a CVD value to a Y coordinate within the CVD pane. */
        cvdToY(value, min, max) {
            if (min === max)
                return this.cvdOriginY() + this.cvdHeight() / 2;
            const h = this.cvdHeight();
            const range = max - min;
            const ratio = (value - min) / range;
            // Invert Y because canvas Y increases downwards
            return this.cvdOriginY() + h - ratio * h;
        }
        /** Returns the margin configuration. */
        getMargin() {
            return this.margin;
        }
        /** Returns the current row height in pixels, adjusted for zoom. */
        rowHeightPx() {
            return this.baseRowPx * this.view.zoomY;
        }
        /** Returns the scaled spacing between candles, depending on volume footprint mode. */
        scaledSpacing() {
            if (!this.showVolumeFootprint) {
                return (6 + 1) * this.view.zoomX; // Candle width + 1px gap when volume footprint is off
            }
            if (this.footprintStyle === 'delta') {
                // Reduced spacing for delta mode (only right-side bars)
                // BASE_CANDLE (15) + BASE_BOX (55) + GAP (~5-10)
                return 75 * this.view.zoomX;
            }
            return 128 * this.view.zoomX; // Standard spacing (Candle + 2 * Box + gaps)
        }
        scaledCandle() {
            return 6 * this.view.zoomX; // BASE_CANDLE * zoomX
        }
        scaledBox() {
            return 55 * this.view.zoomX; // BASE_BOX * zoomX
        }
        scaledImb() {
            return 3 * this.view.zoomX; // Thinner imbalance boxes
        }
        shouldShowCellText() {
            return (this.view.zoomX >= this.TEXT_VIS.minZoomX &&
                this.rowHeightPx() >= this.TEXT_VIS.minRowPx &&
                this.scaledBox() >= this.TEXT_VIS.minBoxPx);
        }
        priceToRowIndex(price) {
            // Round the grid portion to nearest integer to eliminate floating-point drift.
            // This ensures prices quantized at TICK intervals map to consecutive integer rows.
            // The scroll offset (offsetRows) is added as-is to preserve smooth scrolling.
            const gridRow = Math.round((this.ladderTop - price) / this.TICK);
            return gridRow + this.view.offsetRows;
        }
        rowIndexToPrice(row) {
            return this.ladderTop - (row - this.view.offsetRows) * this.TICK;
        }
        rowToY(row) {
            return this.margin.top + row * this.rowHeightPx();
        }
        priceToY(price) {
            return this.rowToY(this.priceToRowIndex(price));
        }
        /** Returns the offset of the candle wick (center) from the start of the candle's slot. */
        wickOffset() {
            if (this.footprintStyle === 'delta') {
                // Shift left: half candle width + small gap
                return this.scaledCandle() / 2 + 2;
            }
            // Centered in slot
            return this.scaledSpacing() / 2;
        }
        indexToX(i, startIndex) {
            const s = this.scaledSpacing();
            return this.margin.left + (i - startIndex) * s + this.wickOffset() - this.xShift;
        }
        /** Returns the geometric center of the column/slot. ideal for text alignment. */
        getSlotCenter(i, startIndex) {
            const s = this.scaledSpacing();
            return this.margin.left + (i - startIndex) * s + s / 2 - this.xShift;
        }
        getVisibleRange() {
            const s = this.scaledSpacing();
            const pixelOffset = this.view.offsetX;
            const startFloat = pixelOffset / s;
            const startIndex = Math.max(0, Math.floor(startFloat));
            const contentW = this.canvasWidth - this.margin.left - this.margin.right;
            const visibleCount = Math.ceil(contentW / s) + 2;
            const endIndex = Math.min(this.data.length, startIndex + visibleCount);
            return { startIndex, endIndex };
        }
        computePriceBarLabels() {
            const pixelSpacing = 28;
            const chartHeightPx = this.chartHeight();
            const maxLabels = 7;
            const numLabels = Math.min(maxLabels, Math.floor(chartHeightPx / pixelSpacing));
            const pTop = this.rowIndexToPrice(0);
            const pBot = this.rowIndexToPrice(Math.floor(chartHeightPx / this.rowHeightPx()));
            const pMin = Math.min(pTop, pBot);
            const pMax = Math.max(pTop, pBot);
            const priceRange = pMax - pMin;
            const stepPrice = Math.max(this.TICK, priceRange / Math.max(1, numLabels - 1));
            let start = Math.ceil(pMin / stepPrice) * stepPrice;
            const out = [];
            for (let price = start; price <= pMax + 1e-6; price += stepPrice) {
                // Calculate decimal precision based on tick size
                // For tick size 0.01 -> precision 2, for 0.001 -> precision 3, etc.
                const precision = this.TICK < 1 ? Math.ceil(-Math.log10(this.TICK)) : 0;
                const roundingFactor = Math.pow(10, precision);
                // Round to appropriate precision based on tick size
                const roundedPrice = Math.round(price * roundingFactor) / roundingFactor;
                out.push({ price: roundedPrice, y: this.priceToY(price) });
            }
            return out;
        }
        formatK(v) {
            return formatNumber(v);
        }
        /**
         * Returns the number of decimal places to use for price formatting based on TICK size.
         * E.g., TICK=0.01 -> 2, TICK=0.0001 -> 4, TICK=10 -> 0
         */
        getPricePrecision() {
            if (this.TICK >= 1)
                return 0;
            return Math.max(0, Math.ceil(-Math.log10(this.TICK)));
        }
        get xShift() {
            const s = this.scaledSpacing();
            const pixelOffset = this.view.offsetX;
            const startFloat = pixelOffset / s;
            const startIndex = Math.max(0, Math.floor(startFloat));
            const shift = pixelOffset - startIndex * s;
            return shift < 0 ? shift + s : shift;
        }
        screenXToDataIndex(screenX) {
            const vr = this.getVisibleRange();
            const s = this.scaledSpacing();
            // Reverse the calculation: x = margin + relative_i * s + wickOffset - xShift
            // relative_i * s = x - margin - wickOffset + xShift
            const relativeX = screenX - this.margin.left + this.xShift - this.wickOffset();
            return vr.startIndex + Math.floor(relativeX / s);
        }
        // Exact fractional data index for precise drawing coordinates
        screenXToExactDataIndex(screenX) {
            const vr = this.getVisibleRange();
            const s = this.scaledSpacing();
            const relativeX = screenX - this.margin.left + this.xShift - this.wickOffset();
            return vr.startIndex + relativeX / s;
        }
        screenYToPrice(screenY) {
            // Calculate raw row from screen position (without offsetRows - that's handled in rowIndexToPrice)
            const rawRow = (screenY - this.margin.top) / this.rowHeightPx();
            return this.rowIndexToPrice(rawRow);
        }
        get ladderTop() {
            if (this.ladderTopDirty) {
                this.cachedLadderTop = this.calculateLadderTop();
                this.ladderTopDirty = false;
            }
            return this.cachedLadderTop;
        }
        calculateLadderTop() {
            if (this.data.length === 0)
                return 10000;
            // Collect all footprint prices
            const allPrices = new Set();
            for (const candle of this.data) {
                for (const level of candle.footprint) {
                    allPrices.add(level.price);
                }
                // Include OHLC
                allPrices.add(candle.open);
                allPrices.add(candle.high);
                allPrices.add(candle.low);
                allPrices.add(candle.close);
            }
            if (allPrices.size === 0) {
                return Math.ceil(Math.max(...this.data.map(c => c.high)) / this.TICK) * this.TICK + 10 * this.TICK;
            }
            const prices = Array.from(allPrices).sort((a, b) => b - a);
            const maxPrice = prices[0];
            const minPrice = prices[prices.length - 1];
            const range = maxPrice - minPrice;
            // Add padding: minimum 2 ticks or 10% of range
            const padding = Math.max(this.TICK * 2, range * 0.1);
            return maxPrice + padding;
        }
        invalidateLadderTop() {
            this.ladderTopDirty = true;
        }
    }

    /**
     * Manages user interactions and input handling for the Volume Footprint Chart.
     * Processes mouse/touch events, wheel zooming, panning, and measurement tools.
     */
    /**
     * Handles user interactions with the chart, including mouse/touch events, zooming, panning, and measuring.
     * Manages crosshair positioning, momentum scrolling, and measurement tools.
     */
    class Interactions {
        /**
         * Creates an Interactions instance to handle user input for the chart.
         * @param canvas The HTML canvas element
         * @param margin Chart margin configuration
         * @param view Current view state (zoom and offset)
         * @param events Event callbacks
         * @param crosshair Crosshair position state
         * @param scales Scales instance for coordinate conversions
         */
        constructor(canvas, margin, view, events, crosshair, scales, zoomLimits = { min: 1e-6, max: 100 }) {
            this.momentum = { raf: 0, vx: 0, lastTs: 0, active: false };
            this.PAN_INVERT = { x: true, y: false };
            // CVD resize state
            this.isDraggingCvdDivider = false;
            this.cvdDividerHitZone = 6; // pixels around the divider that are draggable
            // Table resize state
            this.isDraggingTableDivider = false;
            // Measure state
            this.isMeasureMode = false;
            this.measureRectangle = null;
            this.canvas = canvas;
            this.margin = margin;
            this.view = view;
            this.events = events;
            this.crosshair = crosshair;
            this.scales = scales;
            this.zoomLimits = zoomLimits;
            this.setupMouseTracking();
        }
        /**
         * Handles mouse wheel events for zooming different chart areas.
         * Zooms price axis when over price bar, time axis when over timeline, both when over chart body.
         * @param e The wheel event
         */
        handleWheel(e) {
            var _a, _b, _c, _d, _e, _f;
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const chartRight = this.canvas.clientWidth - this.margin.right;
            const canvasHeight = this.canvas.height / window.devicePixelRatio;
            const yBottom = canvasHeight - this.margin.bottom;
            const overPriceBar = mx > chartRight;
            const overTimeline = my > yBottom;
            const overChartBody = !overPriceBar && !overTimeline;
            if (overPriceBar) {
                this.view.zoomY *= (e.deltaY < 0 ? 1.1 : 0.9);
                this.view.zoomY = Math.max(this.zoomLimits.min, Math.min(this.zoomLimits.max, this.view.zoomY));
                (_b = (_a = this.events).onZoom) === null || _b === void 0 ? void 0 : _b.call(_a, this.view.zoomX, this.view.zoomY);
                this.clearMeasureRectangle();
            }
            else if (overChartBody) {
                const prev = this.view.zoomX;
                const factor = (e.deltaY < 0 ? 1.1 : 0.9);
                const next = Math.max(this.zoomLimits.min, Math.min(this.zoomLimits.max, prev * factor));
                this.view.zoomX = next;
                // Reduce price axis zoom sensitivity for smoother transitions
                this.view.zoomY *= Math.pow(factor, 0.7);
                this.view.zoomY = Math.max(this.zoomLimits.min, Math.min(this.zoomLimits.max, this.view.zoomY));
                // Adjust offsetX to keep the same startIndex (prevent scrolling)
                this.view.offsetX *= (next / prev);
                (_d = (_c = this.events).onZoom) === null || _d === void 0 ? void 0 : _d.call(_c, this.view.zoomX, this.view.zoomY);
                this.clearMeasureRectangle();
            }
            else if (overTimeline) {
                // Timeline zoom: same mechanism as chart but only affects X axis
                const prev = this.view.zoomX;
                const factor = (e.deltaY < 0 ? 1.1 : 0.9);
                const next = Math.max(this.zoomLimits.min, Math.min(this.zoomLimits.max, prev * factor));
                this.view.zoomX = next;
                this.view.offsetX *= (next / prev);
                (_f = (_e = this.events).onZoom) === null || _f === void 0 ? void 0 : _f.call(_e, this.view.zoomX, this.view.zoomY);
                this.clearMeasureRectangle();
            }
        }
        handlePointerDown(e) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            // Check if clicking on CVD divider (the border between main chart and CVD pane)
            const cvdHeight = this.scales.cvdHeight();
            const cvdOriginY = this.scales.cvdOriginY();
            if (cvdHeight > 0 && Math.abs(y - cvdOriginY) <= this.cvdDividerHitZone) {
                this.handleCvdDividerDrag(e, rect);
                return;
            }
            // Check if clicking on Table divider (top edge of delta table)
            const tableHeight = this.scales.getDeltaTableHeight();
            const canvasHeight = this.canvas.height / window.devicePixelRatio;
            const tableY = canvasHeight - this.margin.bottom - tableHeight;
            if (tableHeight > 0 && Math.abs(y - tableY) <= this.cvdDividerHitZone) {
                this.handleTableDividerDrag(e, rect);
                return;
            }
            // Check if we're in measure mode
            if (this.isMeasureMode) {
                this.handleMeasurePointerDown(e, x, y);
                return;
            }
            // Normal pan mode
            this.canvas.setPointerCapture(e.pointerId);
            let lastX = e.clientX;
            let lastY = e.clientY;
            let lastT = performance.now();
            const onMove = (ev) => {
                var _a, _b;
                const now = performance.now();
                const dt = Math.max(1, now - lastT);
                const dx = ev.clientX - lastX;
                const dy = ev.clientY - lastY;
                lastX = ev.clientX;
                lastY = ev.clientY;
                lastT = now;
                // Use proper rowHeightPx() method instead of hardcoded 22
                this.view.offsetX += (this.PAN_INVERT.x ? -dx : dx);
                this.view.offsetRows += (this.PAN_INVERT.y ? -dy : dy) / this.scales.rowHeightPx();
                (this.PAN_INVERT.x ? -dx : dx) / dt;
                (_b = (_a = this.events).onPan) === null || _b === void 0 ? void 0 : _b.call(_a, this.view.offsetX, this.view.offsetRows);
                this.clearMeasureRectangle();
            };
            const onUp = () => {
                this.canvas.releasePointerCapture(e.pointerId);
                this.canvas.removeEventListener('pointermove', onMove);
                this.canvas.removeEventListener('pointerup', onUp);
                this.canvas.removeEventListener('pointercancel', onUp);
                // Removed momentum to stop chart from continuing to move after mouse release
            };
            this.canvas.addEventListener('pointermove', onMove);
            this.canvas.addEventListener('pointerup', onUp);
            this.canvas.addEventListener('pointercancel', onUp);
        }
        handleMeasurePointerDown(e, x, y) {
            // Check if we're over the chart area
            const chartRight = this.canvas.clientWidth - this.margin.right;
            const canvasHeight = this.canvas.height / window.devicePixelRatio;
            const yBottom = canvasHeight - this.margin.bottom;
            const overChartBody = x >= this.margin.left && x <= chartRight &&
                y >= this.margin.top && y <= yBottom;
            if (!overChartBody)
                return;
            this.canvas.setPointerCapture(e.pointerId);
            // Start measuring from this point - store screen coordinates directly
            this.measureRectangle = {
                startX: x,
                startY: y,
                endX: x,
                endY: y
            };
            const onMove = (ev) => {
                var _a, _b;
                const rect = this.canvas.getBoundingClientRect();
                const currentX = ev.clientX - rect.left;
                const currentY = ev.clientY - rect.top;
                // Update the end point of the measure rectangle
                if (this.measureRectangle) {
                    this.measureRectangle.endX = currentX;
                    this.measureRectangle.endY = currentY;
                }
                // Trigger redraw
                (_b = (_a = this.events).onMouseMove) === null || _b === void 0 ? void 0 : _b.call(_a, currentX, currentY, true);
            };
            const onUp = () => {
                this.canvas.releasePointerCapture(e.pointerId);
                this.canvas.removeEventListener('pointermove', onMove);
                this.canvas.removeEventListener('pointerup', onUp);
                this.canvas.removeEventListener('pointercancel', onUp);
            };
            this.canvas.addEventListener('pointermove', onMove);
            this.canvas.addEventListener('pointerup', onUp);
            this.canvas.addEventListener('pointercancel', onUp);
        }
        // Public methods for controlling measure mode
        setMeasureMode(enabled) {
            this.isMeasureMode = enabled;
            if (!enabled) {
                this.measureRectangle = null;
            }
        }
        getMeasureMode() {
            return this.isMeasureMode;
        }
        getMeasureRectangle() {
            return this.measureRectangle;
        }
        clearMeasureRectangle() {
            this.measureRectangle = null;
        }
        /** Updates the scales reference when options change */
        setScales(scales) {
            this.scales = scales;
        }
        handleCvdDividerDrag(e, rect) {
            this.isDraggingCvdDivider = true;
            this.canvas.setPointerCapture(e.pointerId);
            this.canvas.style.cursor = 'ns-resize';
            const canvasHeight = this.canvas.height / window.devicePixelRatio;
            const availableHeight = canvasHeight - this.margin.top - this.margin.bottom;
            const onMove = (ev) => {
                var _a, _b;
                const y = ev.clientY - rect.top;
                // Calculate new ratio based on where the divider is dragged
                // CVD is at the bottom, so we calculate how much space is below the drag point
                const cvdHeight = canvasHeight - this.margin.bottom - y;
                let newRatio = cvdHeight / availableHeight;
                // Clamp the ratio between 0.1 and 0.6
                newRatio = Math.max(0.1, Math.min(0.6, newRatio));
                (_b = (_a = this.events).onCvdResize) === null || _b === void 0 ? void 0 : _b.call(_a, newRatio);
            };
            const onUp = () => {
                this.isDraggingCvdDivider = false;
                this.canvas.releasePointerCapture(e.pointerId);
                this.canvas.style.cursor = '';
                this.canvas.removeEventListener('pointermove', onMove);
                this.canvas.removeEventListener('pointerup', onUp);
                this.canvas.removeEventListener('pointercancel', onUp);
            };
            this.canvas.addEventListener('pointermove', onMove);
            this.canvas.addEventListener('pointerup', onUp);
            this.canvas.addEventListener('pointercancel', onUp);
        }
        handleTableDividerDrag(e, rect) {
            this.isDraggingTableDivider = true;
            this.canvas.setPointerCapture(e.pointerId);
            this.canvas.style.cursor = 'ns-resize';
            const canvasHeight = this.canvas.height / window.devicePixelRatio;
            const onMove = (ev) => {
                var _a, _b;
                const y = ev.clientY - rect.top;
                // Calculate new table height
                // Table bottom is fixed at canvasHeight - margin.bottom
                // Table top is dragging point y
                const tableBottom = canvasHeight - this.margin.bottom;
                let newHeight = tableBottom - y;
                // Enforce minimum height (e.g. 10px) and max height
                newHeight = Math.max(10, Math.min(canvasHeight * 0.8, newHeight));
                (_b = (_a = this.events).onTableResize) === null || _b === void 0 ? void 0 : _b.call(_a, newHeight);
            };
            const onUp = () => {
                this.isDraggingTableDivider = false;
                this.canvas.releasePointerCapture(e.pointerId);
                this.canvas.style.cursor = '';
                this.canvas.removeEventListener('pointermove', onMove);
                this.canvas.removeEventListener('pointerup', onUp);
                this.canvas.removeEventListener('pointercancel', onUp);
            };
            this.canvas.addEventListener('pointermove', onMove);
            this.canvas.addEventListener('pointerup', onUp);
            this.canvas.addEventListener('pointercancel', onUp);
        }
        cancelMomentum() {
            if (this.momentum.raf) {
                cancelAnimationFrame(this.momentum.raf);
                this.momentum.raf = 0;
            }
            this.momentum.active = false;
        }
        startMomentum(vx) {
            this.momentum.vx = vx;
            this.momentum.lastTs = 0;
            this.momentum.active = true;
            if (!this.momentum.raf) {
                this.momentum.raf = requestAnimationFrame(this.stepMomentum.bind(this));
            }
        }
        stepMomentum(ts) {
            if (!this.momentum.active) {
                this.momentum.raf = 0;
                return;
            }
            if (!this.momentum.lastTs)
                this.momentum.lastTs = ts;
            const dt = ts - this.momentum.lastTs;
            this.momentum.lastTs = ts;
            this.view.offsetX += this.momentum.vx * dt;
            this.momentum.vx *= 0.98;
            if (Math.abs(this.momentum.vx) < 0.001) {
                this.cancelMomentum();
            }
        }
        setupMouseTracking() {
            this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
            this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
        }
        handleMouseMove(e) {
            var _a, _b;
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            // Check if mouse is over CVD divider
            const cvdHeight = this.scales.cvdHeight();
            const cvdOriginY = this.scales.cvdOriginY();
            // Check if mouse is over Table divider
            const tableHeight = this.scales.getDeltaTableHeight();
            const canvasHeight = this.canvas.height / window.devicePixelRatio;
            const tableY = canvasHeight - this.margin.bottom - tableHeight;
            if (cvdHeight > 0 && Math.abs(y - cvdOriginY) <= this.cvdDividerHitZone) {
                this.canvas.style.cursor = 'ns-resize';
            }
            else if (tableHeight > 0 && Math.abs(y - tableY) <= this.cvdDividerHitZone) {
                this.canvas.style.cursor = 'ns-resize';
            }
            else if (!this.isDraggingCvdDivider && !this.isDraggingTableDivider) {
                this.canvas.style.cursor = '';
            }
            // Check if mouse is over the chart area
            const chartRight = this.canvas.clientWidth - this.margin.right;
            const yBottom = canvasHeight - this.margin.bottom;
            const overChartBody = x >= this.margin.left && x <= chartRight &&
                y >= this.margin.top && y <= yBottom;
            const wasVisible = this.crosshair.visible;
            if (overChartBody) {
                this.crosshair.x = x;
                this.crosshair.y = y;
                this.crosshair.visible = true;
            }
            else {
                this.crosshair.visible = false;
            }
            // Only trigger redraw when crosshair state changes to avoid excessive redraws
            if (this.crosshair.visible !== wasVisible || this.crosshair.visible) {
                (_b = (_a = this.events).onMouseMove) === null || _b === void 0 ? void 0 : _b.call(_a, x, y, this.crosshair.visible);
            }
        }
        handleMouseLeave() {
            var _a, _b;
            this.crosshair.visible = false;
            (_b = (_a = this.events).onMouseMove) === null || _b === void 0 ? void 0 : _b.call(_a, -1, -1, false);
        }
    }

    /**
     * Footprint-specific drawing functions for the Volume Footprint Chart.
     * Handles rendering of volume profiles, imbalance markers, and related visualizations.
     */
    /**
     * Draws the footprint volume boxes for buy and sell volumes at each price level.
     */
    function drawFootprintBoxes(ctx, rows, pocIdx, enableProfile, leftX, rightX, scales, theme) {
        var _a, _b;
        const sideMax = Math.max(...rows.map(f => Math.max(f.buy, f.sell)), 1);
        const buyBase = (_a = theme.volumeBuyBase) !== null && _a !== void 0 ? _a : 0.15;
        const sellBase = (_b = theme.volumeSellBase) !== null && _b !== void 0 ? _b : 0.15;
        const { buyRGBA, sellRGBA } = createVolumeColorMappers(sideMax, buyBase, sellBase);
        let minRow = Infinity, maxRow = -Infinity;
        let totBuy = 0, totSell = 0;
        for (let r = 0; r < rows.length; r++) {
            const f = rows[r];
            // Snap to nearest integer row index to prevent sub-pixel gaps
            const row = scales.priceToRowIndex(f.price);
            const yTop = scales.rowToY(row - 0.5);
            const yBot = scales.rowToY(row + 0.5);
            // Ensure height is at least 1px and perfectly fills the gap
            // Use slightly larger height (ceil) or exact calculation to overlap safely
            const h = scales.rowToY(row + 0.5) - scales.rowToY(row - 0.5);
            minRow = Math.min(minRow, row - 0.5);
            maxRow = Math.max(maxRow, row + 0.5);
            totBuy += f.buy;
            totSell += f.sell;
            const isPOC = enableProfile && (r === pocIdx);
            // Only draw if the row is visible (within chart bounds)
            const margin = scales.getMargin();
            const chartBottom = margin.top + scales.chartHeight();
            // Draw with slight overlap to prevent cracks
            if (yTop >= margin.top && yBot <= chartBottom) {
                ctx.fillStyle = isPOC ? (theme.pocColor || '#808080') : sellRGBA(f.sell);
                ctx.fillRect(leftX, yTop - 0.5, scales.scaledBox(), h + 1); // Add 1px overlap
                ctx.fillStyle = isPOC ? (theme.pocColor || '#808080') : buyRGBA(f.buy);
                ctx.fillRect(rightX, yTop - 0.5, scales.scaledBox(), h + 1); // Add 1px overlap
            }
        }
        return { minRow, maxRow, totBuy, totSell };
    }
    /**
     * Draws the footprint with delta bars (Delta Volume mode).
     */
    function drawDeltaFootprintBoxes(ctx, rows, leftX, rightX, scales, theme, zoomX) {
        const maxTotalVol = Math.max(...rows.map(f => f.buy + f.sell), 1);
        // Calculate max abs delta for color intensity
        const maxAbsDelta = Math.max(...rows.map(f => Math.abs(f.buy - f.sell)), 1);
        // Available width for the bar (right side of candle)
        const barMaxWidth = scales.scaledBox(); // Use the standard box width as max width
        let minRow = Infinity, maxRow = -Infinity;
        let totBuy = 0, totSell = 0;
        // Helper to convert hex to rgb for opacity handling
        const hexToRgb = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        };
        const getRgba = (color, opacity) => {
            // Basic hex support
            if (color.startsWith('#')) {
                const rgb = hexToRgb(color);
                if (rgb)
                    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
            }
            // Fallback if not hex or conversion failed
            return color;
        };
        for (let r = 0; r < rows.length; r++) {
            const f = rows[r];
            // Snap to nearest integer row index
            const row = scales.priceToRowIndex(f.price);
            const yTop = scales.rowToY(row - 0.5);
            const yBot = scales.rowToY(row + 0.5);
            const h = scales.rowToY(row + 0.5) - scales.rowToY(row - 0.5);
            minRow = Math.min(minRow, row - 0.5);
            maxRow = Math.max(maxRow, row + 0.5);
            totBuy += f.buy;
            totSell += f.sell;
            const total = f.buy + f.sell;
            const delta = f.buy - f.sell;
            // Only draw if visible
            const margin = scales.getMargin();
            const chartBottom = margin.top + scales.chartHeight();
            if (yTop >= margin.top && yBot <= chartBottom) {
                // Bar WIDTH represents TOTAL VOLUME relative to max volume in candle
                const width = (total / maxTotalVol) * barMaxWidth;
                // Color intensity represents DELTA magnitude
                const deltaRatio = Math.abs(delta) / maxAbsDelta;
                const opacity = 0.2 + (0.8 * deltaRatio); // 0.2 to 1.0 opacity
                const baseColor = delta >= 0 ?
                    (theme.upColor || '#22c55e') :
                    (theme.downColor || '#ef4444');
                ctx.fillStyle = getRgba(baseColor, opacity);
                // Draw bar extending from center (rightX) towards right
                ctx.fillRect(rightX, yTop - 0.5, Math.max(1, width), h + 1); // Add 1px overlap
                // Optional: Draw text overlay if height is sufficient
                if (scales.rowHeightPx() > 10) {
                    ctx.fillStyle = '#fff'; // Keep text white for readability
                    ctx.font = '10px sans-serif';
                    ctx.textAlign = 'left';
                    ctx.fillText(scales.formatK(delta), rightX + 4, scales.rowToY(row));
                }
            }
        }
        return { minRow, maxRow, totBuy, totSell };
    }
    /**
     * Draws imbalance markers for levels where buy or sell volume significantly exceeds adjacent levels.
     */
    function drawImbalanceMarkers(ctx, rows, leftX, rightX, scales, theme) {
        for (let r = 0; r < rows.length; r++) {
            const f = rows[r];
            const prev = rows[r - 1];
            const next = rows[r + 1];
            const row = scales.priceToRowIndex(f.price);
            const yTop = scales.rowToY(row - 0.5);
            const yBot = scales.rowToY(row + 0.5);
            const h = Math.max(1, yBot - yTop);
            if (prev && f.sell >= 3 * Math.max(1, prev.buy)) {
                ctx.fillStyle = theme.imbalanceSell || '#dc2626';
                ctx.fillRect(leftX - scales.scaledImb() - 1, yTop, scales.scaledImb(), h);
            }
            if (next && f.buy >= 3 * Math.max(1, next.sell)) {
                ctx.fillStyle = theme.imbalanceBuy || '#16a34a';
                ctx.fillRect(rightX + scales.scaledBox() + 1, yTop, scales.scaledImb(), h);
            }
        }
    }
    /**
     * Draws volume numbers inside the footprint boxes.
     */
    function drawVolumeNumbers(ctx, rows, pocIdx, enableProfile, leftX, rightX, scales, theme, zoomX) {
        const fontSize = Math.max(8, Math.min(16, 11 * zoomX));
        ctx.font = `${fontSize}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let r = 0; r < rows.length; r++) {
            const f = rows[r];
            const row = scales.priceToRowIndex(f.price);
            const y = scales.rowToY(row);
            const isPOC = enableProfile && (r === pocIdx);
            ctx.fillStyle = isPOC ? (theme.pocTextColor || theme.textColorBright || '#ffffff') : (theme.textColorBright || '#ddd');
            ctx.fillText(scales.formatK(f.sell), leftX + scales.scaledBox() / 2, y);
            ctx.fillText(scales.formatK(f.buy), rightX + scales.scaledBox() / 2, y);
        }
    }
    /**
     * Draws the Value Area High (VAH) and Value Area Low (VAL) boundary lines and labels.
     */
    function drawValueAreaBoundaries(ctx, cx, half, VAH, VAL, leftX, rightX, scales, theme, zoomX) {
        const rVah = scales.priceToRowIndex(VAH), rVal = scales.priceToRowIndex(VAL);
        const yVah = scales.rowToY(rVah - 0.5);
        const yVal = scales.rowToY(rVal + 0.5);
        const rightEdge = rightX + scales.scaledBox();
        ctx.save();
        ctx.setLineDash([4, 2]);
        ctx.strokeStyle = theme.vahValColor || '#9ca3af';
        ctx.lineWidth = 3; // Make VAH/VAL lines thicker
        ctx.beginPath();
        ctx.moveTo(leftX, yVah);
        ctx.lineTo(rightEdge, yVah);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(leftX, yVal);
        ctx.lineTo(rightEdge, yVal);
        ctx.stroke();
        ctx.setLineDash([]);
        // ctx.lineWidth = 1; // Reset line width
        const vahFontSize = Math.max(6, Math.min(12, 8 * zoomX));
        ctx.fillStyle = theme.vahValLabelColor || '#cfd3d6';
        ctx.font = `${vahFontSize}px monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const labelX = cx - half - scales.scaledBox() + 3;
        ctx.fillText('VAH', labelX, yVah);
        ctx.fillText('VAL', labelX, yVal);
        ctx.restore();
    }
    /**
     * Draws the delta (buy - sell) and total volume labels below the footprint.
     */
    function drawDeltaTotalLabels(ctx, cx, maxRow, totBuy, totSell, totalVol, scales, theme, zoomX, slotCenter) {
        const yLowFootprint = scales.rowToY(maxRow) + 2;
        const delta = totBuy - totSell;
        const deltaPercent = totalVol > 0 ? (delta / totalVol) * 100 : 0;
        const deltaFontSize = Math.max(8, Math.min(18, 12 * zoomX));
        const xPos = slotCenter !== undefined ? slotCenter : cx;
        ctx.textAlign = 'center';
        ctx.font = `${deltaFontSize}px system-ui`;
        ctx.fillStyle = delta >= 0 ? (theme.deltaPositive || '#16a34a') : (theme.deltaNegative || '#dc2626');
        ctx.fillText(`Delta ${scales.formatK(delta)}`, xPos, yLowFootprint + 14);
        ctx.fillText(`${deltaPercent >= 0 ? '+' : ''}${deltaPercent.toFixed(1)}%`, xPos, yLowFootprint + 28);
        ctx.fillStyle = theme.totalColor || '#fff';
        ctx.fillText(`Total ${scales.formatK(totalVol)}`, xPos, yLowFootprint + 46);
    }
    /**
     * Draws the traditional candlestick wick (high/low line) and body (open/close rectangle).
     */
    function drawCandleWickAndBody(ctx, cx, half, candle, scales, theme) {
        const yHigh = scales.priceToY(candle.high);
        const yLow = scales.priceToY(candle.low);
        const yOpen = scales.priceToY(candle.open);
        const yClose = scales.priceToY(candle.close);
        const bull = candle.close >= candle.open;
        const color = bull ? (theme.candleBull || '#26a69a') : (theme.candleBear || '#ef5350');
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(cx, yHigh);
        ctx.lineTo(cx, yLow);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.fillRect(cx - half, Math.min(yOpen, yClose), scales.scaledCandle(), Math.abs(yClose - yOpen));
    }
    /**
     * Main footprint drawing function that orchestrates all footprint-related rendering.
     */
    function drawFootprint(ctx, candle, i, startIndex, scales, theme, view, showVolumeFootprint, showDeltaTable = false, footprintStyle = 'bid_ask') {
        const cx = scales.indexToX(i, startIndex);
        const half = scales.scaledCandle() / 2;
        if (showVolumeFootprint) {
            const rows = candle.footprint.slice().sort((a, b) => b.price - a.price);
            // For delta style, we don't necessarily need profile logic (VAH/VAL/POC) explicitly for coloring,
            // but we might want POC calculation if we were to highlight it. 
            // The request didn't specify POC highlighting for Delta style, but let's keep it consistent if needed.
            // For now, let's stick to the specific request for Delta style.
            const { pocIdx, vahIdx, valIdx, VAH, VAL, totalVol } = computeVolumeArea(rows);
            const leftX = cx - half - scales.scaledBox();
            const rightX = cx + half;
            let stats;
            if (footprintStyle === 'delta') {
                // Delta Style Rendering
                // We only use the right side for bars. 
                // leftX is usually where Sell volume is. available space is scales.scaledBox().
                // We can use the space from rightX onwards.
                // Note: Standard footprint allocates space on LEFT and RIGHT of candle.
                // If we only draw on RIGHT, we might want to respect the grid columns.
                // The 'scaledBox' is the width of one side (Bid or Ask). 
                // So total width allocated per candle is candle + 2 * box.
                stats = drawDeltaFootprintBoxes(ctx, rows, leftX, rightX, scales, theme, view.zoomX);
            }
            else {
                // Standard Bid/Ask Style
                const enableProfile = rows.length > 3;
                // Draw footprint boxes and calculate totals
                stats = drawFootprintBoxes(ctx, rows, pocIdx, enableProfile, leftX, rightX, scales, theme);
                // Draw imbalance markers
                drawImbalanceMarkers(ctx, rows, leftX, rightX, scales, theme);
                // Draw volume numbers
                if (scales.shouldShowCellText()) {
                    drawVolumeNumbers(ctx, rows, pocIdx, enableProfile, leftX, rightX, scales, theme, view.zoomX);
                }
                // Draw VAH/VAL boundaries and labels
                if (enableProfile && scales.shouldShowCellText()) {
                    drawValueAreaBoundaries(ctx, cx, half, VAH, VAL, leftX, rightX, scales, theme, view.zoomX);
                }
            }
            const { minRow, maxRow, totBuy, totSell } = stats;
            // Draw delta and total volume labels (skip if showing in table instead)
            if (scales.shouldShowCellText() && !showDeltaTable) {
                const slotCenter = scales.getSlotCenter(i, startIndex);
                drawDeltaTotalLabels(ctx, cx, maxRow, totBuy, totSell, totalVol, scales, theme, view.zoomX, slotCenter);
            }
        }
        // Draw candle wick and body
        drawCandleWickAndBody(ctx, cx, half, candle, scales, theme);
    }

    /**
     * Grid and bounds drawing functions for the Volume Footprint Chart.
     * Handles background grid lines and chart boundary visualization.
     */
    /**
     * Draws the background grid lines.
     */
    function drawGrid(ctx, width, margin, scales, theme) {
        const chartRight = width - margin.right;
        ctx.strokeStyle = theme.gridColor || '#333';
        ctx.lineWidth = 1;
        const gridSpacing = 28;
        const numLines = Math.floor(scales.chartHeight() / gridSpacing);
        ctx.beginPath();
        for (let i = 0; i <= numLines; i++) {
            const y = margin.top + i * gridSpacing;
            ctx.moveTo(margin.left, y);
            ctx.lineTo(chartRight, y);
        }
        ctx.stroke();
        const vr = scales.getVisibleRange();
        ctx.beginPath();
        for (let i = vr.startIndex; i < vr.endIndex; i++) {
            const x = scales.indexToX(i, vr.startIndex) + scales.scaledSpacing() / 2;
            ctx.moveTo(x, margin.top);
            ctx.lineTo(x, margin.top + scales.chartHeight());
        }
        ctx.strokeStyle = theme.gridLightColor || '#252525';
        ctx.stroke();
    }
    /**
     * Draws chart boundary outlines and gutters.
     */
    function drawBounds(ctx, width, height, margin, scales) {
        const chartW = width - margin.left - margin.right;
        const chartH = scales.chartHeight();
        const rightX = width - margin.right;
        const bottomY = margin.top + chartH;
        ctx.save();
        // shade outside chart area slightly so user sees gutters
        ctx.fillStyle = 'rgba(255, 255, 0, 0.05)';
        // top gutter
        ctx.fillRect(0, 0, width, margin.top);
        // left gutter
        ctx.fillRect(0, margin.top, margin.left, chartH);
        // right price bar area (already visible)
        // bottom timeline area (already visible)
        // outline chart rect
        ctx.setLineDash([6, 3]);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(margin.left + 0.5, margin.top + 0.5, chartW, chartH);
        // outline price bar and timeline for clarity
        ctx.strokeStyle = '#22d3ee'; // cyan for scales
        // price bar
        ctx.strokeRect(rightX + 0.5, 0.5, margin.right - 1, height - 1);
        // timeline
        ctx.strokeRect(margin.left + 0.5, bottomY + 0.5, chartW, margin.bottom - 1);
        ctx.setLineDash([]);
        ctx.restore();
    }

    /**
     * Crosshair and price label drawing functions for the Volume Footprint Chart.
     * Handles cursor tracking and current price display.
     */
    /**
     * Draws the crosshair lines and labels at the current mouse position.
     */
    function drawCrosshair(ctx, width, height, margin, crosshair, scales, data, theme, indicatorData) {
        if (!crosshair.visible)
            return;
        const chartRight = width - margin.right;
        const chartHeight = scales.chartHeight();
        const chartBottom = margin.top + chartHeight;
        // Calculate indicator pane boundaries
        const cvdHeight = scales.cvdHeight();
        const oiHeight = scales.oiHeight();
        const frHeight = scales.fundingRateHeight();
        const cvdTop = scales.cvdOriginY();
        const cvdBottom = cvdTop + cvdHeight;
        const oiTop = scales.oiOriginY();
        const oiBottom = oiTop + oiHeight;
        const frTop = scales.fundingRateOriginY();
        const frBottom = frTop + frHeight;
        ctx.save();
        // Determine which pane the cursor is in
        const inMainChart = crosshair.y >= margin.top && crosshair.y <= chartBottom;
        const inCVD = cvdHeight > 0 && crosshair.y >= cvdTop && crosshair.y <= cvdBottom;
        const inOI = oiHeight > 0 && crosshair.y >= oiTop && crosshair.y <= oiBottom;
        const inFR = frHeight > 0 && crosshair.y >= frTop && crosshair.y <= frBottom;
        // Draw vertical line (through all panes)
        ctx.strokeStyle = theme.textColor || '#aaa';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        // Draw vertical line through all active panes
        let vLineBottom = chartBottom;
        if (cvdHeight > 0)
            vLineBottom = cvdBottom;
        if (oiHeight > 0)
            vLineBottom = oiBottom;
        if (frHeight > 0)
            vLineBottom = frBottom;
        ctx.moveTo(crosshair.x, margin.top);
        ctx.lineTo(crosshair.x, vLineBottom);
        ctx.stroke();
        // Draw horizontal line (only in the current pane)
        ctx.beginPath();
        if (inMainChart) {
            ctx.moveTo(margin.left, crosshair.y);
            ctx.lineTo(chartRight, crosshair.y);
        }
        else if (inCVD) {
            ctx.moveTo(margin.left, crosshair.y);
            ctx.lineTo(chartRight, crosshair.y);
        }
        else if (inOI) {
            ctx.moveTo(margin.left, crosshair.y);
            ctx.lineTo(chartRight, crosshair.y);
        }
        else if (inFR) {
            ctx.moveTo(margin.left, crosshair.y);
            ctx.lineTo(chartRight, crosshair.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        // Draw value label on right side based on which pane cursor is in
        let labelText = '';
        let labelColor = theme.scaleBackground || '#111';
        let textColor = theme.textColor || '#aaa';
        if (inMainChart) {
            // Show price with commas and dynamic decimal places based on tick size
            const price = scales.rowIndexToPrice((crosshair.y - margin.top) / scales.rowHeightPx());
            const precision = scales.getPricePrecision();
            labelText = price.toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision });
        }
        else if (inOI && indicatorData && indicatorData.oiData.length > 0) {
            // Show OI value - calculate based on Y position in OI pane
            const oiMin = Math.min(...indicatorData.oiData.map(p => p.value));
            const oiMax = Math.max(...indicatorData.oiData.map(p => p.value));
            const range = oiMax - oiMin || 1;
            const ratio = 1 - (crosshair.y - oiTop) / oiHeight;
            const oiValue = oiMin + ratio * range;
            labelText = scales.formatK(oiValue);
            labelColor = '#ff9500'; // Orange for OI
            textColor = '#fff';
        }
        else if (inFR && indicatorData && indicatorData.fundingRateData.length > 0) {
            // Show Funding Rate value - calculate based on Y position in FR pane
            const frMin = Math.min(...indicatorData.fundingRateData.map(p => p.value));
            const frMax = Math.max(...indicatorData.fundingRateData.map(p => p.value));
            const range = frMax - frMin || 0.0001;
            const ratio = 1 - (crosshair.y - frTop) / frHeight;
            const frValue = frMin + ratio * range;
            labelText = (frValue * 100).toFixed(4) + '%';
            labelColor = frValue >= 0 ? '#22c55e' : '#ef4444'; // Green/Red for FR
            textColor = '#fff';
        }
        else if (inCVD && indicatorData && indicatorData.cvdValues.length > 0) {
            // Show CVD value - calculate based on Y position in CVD pane
            const vr = scales.getVisibleRange();
            const visibleCVD = indicatorData.cvdValues.slice(vr.startIndex, vr.endIndex);
            if (visibleCVD.length > 0) {
                const cvdMin = Math.min(...visibleCVD);
                const cvdMax = Math.max(...visibleCVD);
                const range = cvdMax - cvdMin || 1;
                const ratio = 1 - (crosshair.y - cvdTop) / cvdHeight;
                const cvdValue = cvdMin + ratio * range;
                labelText = scales.formatK(cvdValue);
                labelColor = '#00ffff'; // Cyan for CVD
                textColor = '#000';
            }
        }
        if (labelText) {
            ctx.font = 'bold 12px system-ui';
            const textWidth = ctx.measureText(labelText).width;
            const boxWidth = Math.max(textWidth + 8, margin.right);
            ctx.fillStyle = labelColor;
            ctx.fillRect(chartRight, crosshair.y - 8, boxWidth, 16);
            ctx.strokeStyle = theme.scaleBorder || '#444';
            ctx.strokeRect(chartRight, crosshair.y - 8, boxWidth, 16);
            ctx.fillStyle = textColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(labelText, chartRight + boxWidth / 2, crosshair.y);
        }
        // Draw time label on bottom
        const yBottom = margin.top + (height - margin.top - margin.bottom);
        const index = scales.screenXToDataIndex(crosshair.x);
        let timeStr = '--:--';
        if (index >= 0 && index < data.length && data[index]) {
            const date = new Date(data[index].time);
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            timeStr = `${day}/${month} ${hours}:${minutes}`;
        }
        ctx.fillStyle = theme.scaleBackground || '#111';
        ctx.font = '11px system-ui';
        const textWidth = ctx.measureText(timeStr).width;
        const boxWidth = textWidth + 12; // Add padding
        const halfBox = boxWidth / 2;
        ctx.fillRect(crosshair.x - halfBox, yBottom, boxWidth, margin.bottom);
        ctx.strokeStyle = theme.scaleBorder || '#444';
        ctx.strokeRect(crosshair.x - halfBox, yBottom, boxWidth, margin.bottom);
        ctx.fillStyle = theme.textColor || '#aaa';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(timeStr, crosshair.x, yBottom + margin.bottom / 2);
        ctx.restore();
    }
    /**
     * Draws the current price label with a dashed line across the chart.
     */
    function drawCurrentPriceLabel(ctx, width, lastPrice, margin, scales, theme) {
        if (!lastPrice)
            return;
        const right = width - margin.right;
        const y = scales.priceToY(lastPrice);
        // Get the chart area bounds (main chart only, excluding indicator panes)
        const chartTop = margin.top;
        const chartBottom = margin.top + scales.chartHeight();
        const isInChartArea = y >= chartTop && y <= chartBottom;
        ctx.save();
        // Draw dashed line across the chart at the last price level (only within chart area)
        if (isInChartArea) {
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = theme.textColor || '#aaa';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(margin.left, y);
            ctx.lineTo(right, y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        // Draw price label on the price bar (right side scale area)
        // Always show the label, but clamp it to the chart area bounds
        const precision = scales.getPricePrecision();
        const labelText = lastPrice.toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision });
        ctx.font = 'bold 12px system-ui';
        const textWidth = ctx.measureText(labelText).width;
        const boxWidth = textWidth + 8;
        const boxHeight = 18;
        // Position the label in the price bar area, clamped to chart bounds
        const boxX = right + 2;
        const labelY = Math.max(chartTop + boxHeight / 2, Math.min(chartBottom - boxHeight / 2, y));
        const boxY = labelY - boxHeight / 2;
        // Draw background
        ctx.fillStyle = '#26a69a'; // Green background like in the image
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
        // Draw border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
        // Draw price text
        ctx.fillStyle = '#ffffff'; // White text
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, boxX + boxWidth / 2, labelY);
        ctx.restore();
    }

    /**
     * Measurement tool drawing functions for the Volume Footprint Chart.
     * Handles drawing of measurement rectangles and associated data labels.
     */
    /**
     * Helper to format duration in human readable format
     */
    function formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 0)
            return `${days}d ${hours % 24}h`;
        if (hours > 0)
            return `${hours}h ${minutes % 60}m`;
        if (minutes > 0)
            return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }
    /**
     * Draws the measurement rectangle and associated data labels.
     */
    function drawMeasureRectangle(ctx, measureRectangle, scales, theme, data) {
        if (!measureRectangle)
            return;
        ctx.save();
        // Use screen coordinates directly
        const startX = measureRectangle.startX;
        const startY = measureRectangle.startY;
        const endX = measureRectangle.endX;
        const endY = measureRectangle.endY;
        // Calculate rectangle bounds
        const rectX = Math.min(startX, endX);
        const rectY = Math.min(startY, endY);
        const rectWidth = Math.abs(endX - startX);
        const rectHeight = Math.abs(endY - startY);
        // Calculate price and time differences using current screen positions
        const startPrice = scales.screenYToPrice(startY);
        const endPrice = scales.screenYToPrice(endY);
        // Use exact indices for data lookup
        const startIndex = Math.max(0, Math.min(data.length - 1, scales.screenXToDataIndex(startX)));
        const endIndex = Math.max(0, Math.min(data.length - 1, scales.screenXToDataIndex(endX)));
        const priceDiff = endPrice - startPrice;
        const barsDiff = endIndex - startIndex; // Use derived variable for clarity
        const isPositive = priceDiff >= 0;
        // Calculate Time Duration
        let timeDurationStr = '';
        if (data.length > 0) {
            const startTime = new Date(data[startIndex].time).getTime();
            const endTime = new Date(data[endIndex].time).getTime();
            const durationMs = Math.abs(endTime - startTime);
            timeDurationStr = formatDuration(durationMs);
        }
        // Draw light green/red rectangle
        const rectColor = isPositive ? 'rgba(22, 163, 74, 0.2)' : 'rgba(220, 38, 38, 0.2)'; // Light green/red
        ctx.fillStyle = rectColor;
        ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
        // Draw rectangle border
        const borderColor = isPositive ? 'rgba(22, 163, 74, 0.8)' : 'rgba(220, 38, 38, 0.8)';
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
        // Draw measure data box below the rectangle with all details
        const centerX = rectX + rectWidth / 2;
        // Calculate percentage change
        const percentChange = startPrice !== 0 ? (priceDiff / startPrice) * 100 : 0;
        // Prepare all text lines
        const priceSign = priceDiff >= 0 ? '+' : '';
        const priceText = `${priceSign}${priceDiff.toFixed(2)} (${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(2)}%)`;
        const startPriceText = `Start: ${startPrice.toFixed(2)}`;
        const endPriceText = `End: ${endPrice.toFixed(2)}`;
        const barsText = `${Math.abs(barsDiff)} bars (${timeDurationStr})`;
        const lines = [priceText, barsText, startPriceText, endPriceText];
        // Bigger font
        ctx.font = '14px system-ui';
        const lineHeight = 18;
        const padding = 8;
        const maxWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
        const boxWidth = maxWidth + padding * 2;
        const boxHeight = lines.length * lineHeight + padding * 2;
        const boxX = centerX - boxWidth / 2;
        const boxY = rectY + rectHeight + 8;
        // Box colors
        const boxColor = isPositive ? '#16a34a' : '#dc2626'; // Green for positive, red for negative
        const textColor = '#ffffff';
        // Draw box background
        ctx.fillStyle = boxColor;
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
        // Draw box border
        ctx.strokeStyle = textColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
        // Draw text lines
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        lines.forEach((line, index) => {
            const y = boxY + padding + index * lineHeight;
            ctx.fillText(line, centerX, y);
        });
        ctx.restore();
    }

    /**
     * Handles all rendering operations for the Volume Footprint Chart.
     * Responsible for drawing grid, chart elements, scales, crosshair, and measurements.
     */
    class Drawing {
        updateCVD(values) {
            this.cvdValues = values;
        }
        constructor(ctx, data, margin, view, showGrid, showBounds, showVolumeFootprint, showVolumeHeatmap, volumeHeatmapDynamic, scales, theme, crosshair, lastPrice, interactions, cvdValues = [], showDeltaTable = false, tableRowVisibility = {}, tableRowHeight = 16, footprintStyle = 'bid_ask', showOI = false, oiHeightRatio = 0.15, showFundingRate = false, fundingRateHeightRatio = 0.1) {
            this.cvdValues = [];
            this.showDeltaTable = false;
            this.tableRowVisibility = {};
            this.tableRowHeight = 16;
            this.footprintStyle = 'bid_ask';
            // OI and Funding Rate indicator data
            this.oiData = [];
            this.fundingRateData = [];
            this.showOI = false;
            this.showFundingRate = false;
            this.ctx = ctx;
            this.data = data;
            this.margin = margin;
            this.view = view;
            this.showGrid = showGrid;
            this.showBounds = showBounds;
            this.showVolumeFootprint = showVolumeFootprint;
            this.showVolumeHeatmap = showVolumeHeatmap;
            this.volumeHeatmapDynamic = volumeHeatmapDynamic;
            this.scales = scales;
            this.theme = theme;
            this.crosshair = crosshair;
            this.lastPrice = lastPrice;
            this.interactions = interactions;
            this.cvdValues = cvdValues;
            this.showDeltaTable = showDeltaTable;
            this.tableRowVisibility = tableRowVisibility;
            this.tableRowHeight = tableRowHeight;
            this.footprintStyle = footprintStyle;
            this.showOI = showOI;
            this.showFundingRate = showFundingRate;
        }
        setShowDeltaTable(show) {
            this.showDeltaTable = show;
        }
        getShowDeltaTable() {
            return this.showDeltaTable;
        }
        updateLastPrice(price) {
            this.lastPrice = price;
        }
        updateOIData(data) {
            this.oiData = data;
        }
        updateFundingRateData(data) {
            this.fundingRateData = data;
        }
        setShowOI(show) {
            this.showOI = show;
        }
        setShowFundingRate(show) {
            this.showFundingRate = show;
        }
        drawAll() {
            const width = this.ctx.canvas.width / window.devicePixelRatio;
            const height = this.ctx.canvas.height / window.devicePixelRatio;
            this.ctx.clearRect(0, 0, width, height);
            if (this.showGrid)
                drawGrid(this.ctx, width, this.margin, this.scales, this.theme);
            if (this.showVolumeHeatmap)
                this.drawVolumeHeatmap();
            this.drawChart();
            if (this.scales.cvdHeight() > 0)
                this.drawCVD();
            if (this.scales.oiHeight() > 0)
                this.drawOI();
            if (this.scales.fundingRateHeight() > 0)
                this.drawFundingRate();
            if (this.showDeltaTable)
                this.drawDeltaTable();
            drawMeasureRectangle(this.ctx, this.interactions.getMeasureRectangle(), this.scales, this.theme, this.data);
            this.drawScales(width, height);
            drawCurrentPriceLabel(this.ctx, width, this.lastPrice, this.margin, this.scales, this.theme);
            if (this.crosshair.visible)
                drawCrosshair(this.ctx, width, height, this.margin, this.crosshair, this.scales, this.data, this.theme, {
                    oiData: this.oiData,
                    fundingRateData: this.fundingRateData,
                    cvdValues: this.cvdValues
                });
            if (this.showBounds)
                drawBounds(this.ctx, width, height, this.margin, this.scales);
        }
        drawDeltaTable() {
            const vr = this.scales.getVisibleRange();
            if (vr.endIndex <= vr.startIndex)
                return;
            const ctx = this.ctx;
            const width = ctx.canvas.width / window.devicePixelRatio;
            const height = ctx.canvas.height / window.devicePixelRatio;
            // Define row configurations with visibility keys
            const rowHeight = this.tableRowHeight;
            const allRows = [
                { key: 'volume', label: 'Volume' },
                { key: 'volChange', label: 'Vol Change %' },
                { key: 'buyVol', label: 'Buy Volume' },
                { key: 'buyVolPercent', label: 'Buy Vol %' },
                { key: 'sellVol', label: 'Sell Volume' },
                { key: 'sellVolPercent', label: 'Sell Vol %' },
                { key: 'delta', label: 'Delta' },
                { key: 'deltaPercent', label: 'Delta %' },
                { key: 'minDelta', label: 'Min Delta' },
                { key: 'maxDelta', label: 'Max Delta' },
                { key: 'poc', label: 'POC' },
                { key: 'hlRange', label: 'HL Range' }
            ];
            // Filter to only visible rows
            const visibleRows = allRows.filter(row => this.tableRowVisibility[row.key] !== false);
            const numRows = visibleRows.length;
            if (numRows === 0)
                return;
            const tableHeight = rowHeight * numRows;
            // Position table at the very bottom, just above the timeline
            const tableY = height - this.margin.bottom - tableHeight;
            // Draw table background with dark color to match chart theme
            ctx.save();
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, tableY, width, tableHeight);
            // Draw horizontal grid lines
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 0.5;
            for (let r = 0; r <= numRows; r++) {
                ctx.beginPath();
                ctx.moveTo(0, tableY + r * rowHeight);
                ctx.lineTo(width, tableY + r * rowHeight);
                ctx.stroke();
            }
            // First pass: Calculate max values for each row type in visible range
            const maxValues = {
                volume: 0,
                buyVol: 0,
                sellVol: 0,
                delta: 0,
                minDelta: 0,
                maxDelta: 0,
                volChange: 0,
                buyVolPercent: 0,
                sellVolPercent: 0,
                deltaPercent: 0,
                poc: 0,
                hlRange: 0
            };
            let prevVolForMax = 0;
            for (let i = vr.startIndex; i < vr.endIndex && i < this.data.length; i++) {
                const candle = this.data[i];
                let totBuy = 0, totSell = 0;
                let candleMinDelta = 0, candleMaxDelta = 0;
                let poc = 0, pocVol = 0;
                for (const level of candle.footprint) {
                    totBuy += level.buy;
                    totSell += level.sell;
                    const levelDelta = level.buy - level.sell;
                    if (levelDelta < candleMinDelta)
                        candleMinDelta = levelDelta;
                    if (levelDelta > candleMaxDelta)
                        candleMaxDelta = levelDelta;
                    const levelVol = level.buy + level.sell;
                    if (levelVol > pocVol) {
                        pocVol = levelVol;
                        poc = level.price;
                    }
                }
                const totalVol = totBuy + totSell;
                const delta = totBuy - totSell;
                const deltaPercent = totalVol > 0 ? Math.abs((delta / totalVol) * 100) : 0;
                const buyPercent = totalVol > 0 ? (totBuy / totalVol) * 100 : 0;
                const sellPercent = totalVol > 0 ? (totSell / totalVol) * 100 : 0;
                const volChange = prevVolForMax > 0 ? Math.abs(((totalVol - prevVolForMax) / prevVolForMax) * 100) : 0;
                const hlRange = candle.high - candle.low;
                maxValues.volume = Math.max(maxValues.volume, totalVol);
                maxValues.buyVol = Math.max(maxValues.buyVol, totBuy);
                maxValues.sellVol = Math.max(maxValues.sellVol, totSell);
                maxValues.delta = Math.max(maxValues.delta, Math.abs(delta));
                maxValues.minDelta = Math.max(maxValues.minDelta, Math.abs(candleMinDelta));
                maxValues.maxDelta = Math.max(maxValues.maxDelta, Math.abs(candleMaxDelta));
                maxValues.volChange = Math.max(maxValues.volChange, volChange);
                maxValues.buyVolPercent = Math.max(maxValues.buyVolPercent, buyPercent);
                maxValues.sellVolPercent = Math.max(maxValues.sellVolPercent, sellPercent);
                maxValues.deltaPercent = Math.max(maxValues.deltaPercent, deltaPercent);
                maxValues.poc = Math.max(maxValues.poc, poc);
                maxValues.hlRange = Math.max(maxValues.hlRange, hlRange);
                prevVolForMax = totalVol;
            }
            // Calculate previous candle volume for volume change %
            let prevVol = 0;
            // Helper to calculate dynamic opacity (0.2 to 0.8 range based on value relative to max)
            const getDynamicOpacity = (value, maxValue) => {
                if (maxValue === 0)
                    return 0.2;
                return 0.2 + 0.6 * (Math.abs(value) / maxValue);
            };
            // Draw values for each visible candle
            for (let i = vr.startIndex; i < vr.endIndex && i < this.data.length; i++) {
                const candle = this.data[i];
                const cx = this.scales.indexToX(i, vr.startIndex);
                // Calculate totals and min/max delta
                let totBuy = 0, totSell = 0;
                let minDelta = Number.MAX_SAFE_INTEGER;
                let maxDelta = Number.MIN_SAFE_INTEGER;
                let poc = 0, pocVol = 0;
                const hasFootprint = candle.footprint.length > 0;
                if (!hasFootprint) {
                    minDelta = 0;
                    maxDelta = 0;
                }
                for (const level of candle.footprint) {
                    totBuy += level.buy;
                    totSell += level.sell;
                    const levelDelta = level.buy - level.sell;
                    minDelta = Math.min(minDelta, levelDelta);
                    maxDelta = Math.max(maxDelta, levelDelta);
                    const levelVol = level.buy + level.sell;
                    if (levelVol > pocVol) {
                        pocVol = levelVol;
                        poc = level.price;
                    }
                }
                const totalVol = totBuy + totSell;
                const delta = totBuy - totSell;
                const deltaPercent = totalVol > 0 ? (delta / totalVol) * 100 : 0;
                const buyPercent = totalVol > 0 ? (totBuy / totalVol) * 100 : 0;
                const sellPercent = totalVol > 0 ? (totSell / totalVol) * 100 : 0;
                const volChange = prevVol > 0 ? ((totalVol - prevVol) / prevVol) * 100 : 0;
                const hlRange = candle.high - candle.low;
                // Calculate cell width - full spacing with no gaps
                const cellWidth = this.scales.scaledSpacing();
                const cellX = cx - cellWidth / 2;
                // Only show text if cell is wide enough (at least 30px)
                const showText = cellWidth >= 30;
                ctx.textAlign = 'center';
                // Dynamic font size based on row height, min 9px, max 14px
                const fontSize = Math.min(14, Math.max(9, Math.floor(rowHeight * 0.7)));
                ctx.font = `${fontSize}px system-ui`;
                // Draw each visible row dynamically
                for (let r = 0; r < visibleRows.length; r++) {
                    const row = visibleRows[r];
                    const rowY = tableY + r * rowHeight;
                    let bgColor = '#2a2a2a'; // default neutral
                    let textValue = '';
                    switch (row.key) {
                        case 'volume': {
                            // Volume uses blue (#2196f3) with dynamic opacity
                            const opacity = getDynamicOpacity(totalVol, maxValues.volume);
                            bgColor = `rgba(33, 150, 243, ${opacity})`;
                            textValue = this.scales.formatK(totalVol);
                            break;
                        }
                        case 'volChange': {
                            if (i === vr.startIndex) {
                                bgColor = '#2a2a2a';
                                textValue = '-';
                            }
                            else {
                                const opacity = getDynamicOpacity(volChange, maxValues.volChange);
                                bgColor = volChange >= 0 ? `rgba(22, 163, 74, ${opacity})` : `rgba(220, 38, 38, ${opacity})`;
                                textValue = `${volChange.toFixed(1)}%`;
                            }
                            break;
                        }
                        case 'buyVol': {
                            const opacity = getDynamicOpacity(totBuy, maxValues.buyVol);
                            bgColor = `rgba(22, 163, 74, ${opacity})`;
                            textValue = this.scales.formatK(totBuy);
                            break;
                        }
                        case 'buyVolPercent': {
                            const opacity = getDynamicOpacity(buyPercent, maxValues.buyVolPercent);
                            bgColor = `rgba(22, 163, 74, ${opacity})`;
                            textValue = `${buyPercent.toFixed(1)}%`;
                            break;
                        }
                        case 'sellVol': {
                            const opacity = getDynamicOpacity(totSell, maxValues.sellVol);
                            bgColor = `rgba(220, 38, 38, ${opacity})`;
                            textValue = this.scales.formatK(totSell);
                            break;
                        }
                        case 'sellVolPercent': {
                            const opacity = getDynamicOpacity(sellPercent, maxValues.sellVolPercent);
                            bgColor = `rgba(220, 38, 38, ${opacity})`;
                            textValue = `${sellPercent.toFixed(1)}%`;
                            break;
                        }
                        case 'delta': {
                            const opacity = getDynamicOpacity(delta, maxValues.delta);
                            bgColor = delta >= 0 ? `rgba(22, 163, 74, ${opacity})` : `rgba(220, 38, 38, ${opacity})`;
                            textValue = this.scales.formatK(delta);
                            break;
                        }
                        case 'deltaPercent': {
                            const opacity = getDynamicOpacity(deltaPercent, maxValues.deltaPercent);
                            bgColor = deltaPercent >= 0 ? `rgba(22, 163, 74, ${opacity})` : `rgba(220, 38, 38, ${opacity})`;
                            textValue = `${deltaPercent.toFixed(1)}%`;
                            break;
                        }
                        case 'minDelta': {
                            const opacity = getDynamicOpacity(minDelta, maxValues.minDelta);
                            bgColor = minDelta >= 0 ? `rgba(22, 163, 74, ${opacity})` : `rgba(220, 38, 38, ${opacity})`;
                            textValue = this.scales.formatK(minDelta);
                            break;
                        }
                        case 'maxDelta': {
                            const opacity = getDynamicOpacity(maxDelta, maxValues.maxDelta);
                            bgColor = maxDelta >= 0 ? `rgba(22, 163, 74, ${opacity})` : `rgba(220, 38, 38, ${opacity})`;
                            textValue = this.scales.formatK(maxDelta);
                            break;
                        }
                        case 'poc':
                            bgColor = '#2a2a2a';
                            textValue = poc.toFixed(2);
                            break;
                        case 'hlRange':
                            bgColor = '#2a2a2a';
                            textValue = hlRange.toFixed(4);
                            break;
                    }
                    // Draw background
                    ctx.fillStyle = bgColor;
                    ctx.fillRect(cellX, rowY, cellWidth, rowHeight - 1);
                    // Draw text if wide enough
                    if (showText) {
                        ctx.fillStyle = '#fff';
                        ctx.fillText(textValue, cx, rowY + rowHeight / 2);
                    }
                }
                prevVol = totalVol;
            }
            // Draw label column background (over cells on the left)
            const labelWidth = 75;
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, tableY, labelWidth, tableHeight);
            // Draw row labels on the left (after cells so they're on top)
            ctx.fillStyle = '#888';
            // Dynamic font size for labels, max 14px
            const labelFontSize = Math.min(14, Math.max(9, Math.floor(rowHeight * 0.6)));
            ctx.font = `${labelFontSize}px system-ui`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            for (let r = 0; r < numRows; r++) {
                ctx.fillText(visibleRows[r].label, 5, tableY + r * rowHeight + rowHeight / 2);
            }
            ctx.restore();
        }
        drawChart() {
            this.ctx.save();
            const width = this.ctx.canvas.width / window.devicePixelRatio;
            this.ctx.beginPath();
            this.ctx.rect(this.margin.left, this.margin.top, width - this.margin.left - this.margin.right, this.scales.chartHeight());
            this.ctx.clip();
            const vr = this.scales.getVisibleRange();
            for (let i = vr.startIndex; i < vr.endIndex; i++) {
                drawFootprint(this.ctx, this.data[i], i, vr.startIndex, this.scales, this.theme, this.view, this.showVolumeFootprint, this.showDeltaTable, this.footprintStyle);
            }
            this.ctx.restore();
        }
        drawVolumeHeatmap() {
            const vr = this.scales.getVisibleRange();
            if (vr.endIndex <= vr.startIndex)
                return;
            // Choose data range based on dynamic flag
            const startIndex = this.volumeHeatmapDynamic ? vr.startIndex : 0;
            const endIndex = this.volumeHeatmapDynamic ? vr.endIndex : this.data.length;
            // Aggregate volumes per price level across selected candles
            const volumeMap = new Map();
            for (let i = startIndex; i < endIndex; i++) {
                const candle = this.data[i];
                for (const level of candle.footprint) {
                    const totalVol = level.buy + level.sell;
                    volumeMap.set(level.price, (volumeMap.get(level.price) || 0) + totalVol);
                }
            }
            if (volumeMap.size === 0)
                return;
            // Find max volume
            const maxVolume = Math.max(...volumeMap.values());
            // Draw heatmap
            this.ctx.save();
            const width = this.ctx.canvas.width / window.devicePixelRatio;
            this.ctx.beginPath();
            this.ctx.rect(this.margin.left, this.margin.top, width - this.margin.left - this.margin.right, this.scales.chartHeight());
            this.ctx.clip();
            for (const [price, volume] of volumeMap) {
                const row = this.scales.priceToRowIndex(price);
                const yTop = this.scales.rowToY(row - 0.5);
                const yBot = this.scales.rowToY(row + 0.5);
                const h = Math.max(1, yBot - yTop);
                const alpha = maxVolume > 0 ? (volume / maxVolume) * 0.6 : 0; // Reduced brightness to 60% max
                this.ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
                this.ctx.fillRect(this.margin.left, yTop, width - this.margin.left - this.margin.right, h);
            }
            this.ctx.restore();
        }
        drawCVD() {
            const h = this.scales.cvdHeight();
            if (h <= 0)
                return;
            const vr = this.scales.getVisibleRange();
            if (vr.startIndex >= this.cvdValues.length)
                return;
            // Determine min/max for CURRENT VIEW
            let min = Infinity;
            let max = -Infinity;
            for (let i = vr.startIndex; i < Math.min(vr.endIndex, this.cvdValues.length); i++) {
                const v = this.cvdValues[i];
                if (v < min)
                    min = v;
                if (v > max)
                    max = v;
            }
            if (min === Infinity)
                return;
            const range = max - min;
            if (range === 0) {
                min -= 1;
                max += 1;
            }
            else {
                const pad = range * 0.1;
                min -= pad;
                max += pad;
            }
            const ctx = this.ctx;
            const originY = this.scales.cvdOriginY();
            const width = this.ctx.canvas.width / window.devicePixelRatio;
            // Draw divider line (draggable border between chart and CVD)
            ctx.save();
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.margin.left, originY);
            ctx.lineTo(width - this.margin.right, originY);
            ctx.stroke();
            ctx.restore();
            // Draw background
            ctx.save();
            ctx.fillStyle = this.theme.background || '#000';
            ctx.fillRect(this.margin.left, originY, width - this.margin.left - this.margin.right, h);
            // Clip
            ctx.beginPath();
            ctx.rect(this.margin.left, originY, width - this.margin.left - this.margin.right, h);
            ctx.clip();
            // Draw Zero line
            if (min < 0 && max > 0) {
                const yZero = this.scales.cvdToY(0, min, max);
                ctx.strokeStyle = '#333';
                ctx.setLineDash([2, 2]);
                ctx.beginPath();
                ctx.moveTo(this.margin.left, yZero);
                ctx.lineTo(width - this.margin.right, yZero);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            // Draw CVD Line
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            let first = true;
            for (let i = vr.startIndex; i < Math.min(vr.endIndex, this.cvdValues.length); i++) {
                const x = this.scales.indexToX(i, vr.startIndex);
                const y = this.scales.cvdToY(this.cvdValues[i], min, max);
                if (first) {
                    ctx.moveTo(x, y);
                    first = false;
                }
                else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
            ctx.restore();
            // Draw CVD Y-Axis Labels Area
            const right = width - this.margin.right;
            ctx.save();
            ctx.fillStyle = this.theme.scaleBackground || '#111';
            ctx.fillRect(right, originY, this.margin.right, h);
            ctx.strokeStyle = this.theme.scaleBorder || '#444';
            ctx.strokeRect(right + 0.5, originY, 0.5, h);
            // Labels
            ctx.fillStyle = this.theme.textColor || '#aaa';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.font = '10px system-ui';
            // Draw evenly spaced labels (5 labels total)
            const numLabels = 5;
            for (let i = 0; i < numLabels; i++) {
                const value = max - (i * (max - min) / (numLabels - 1));
                const yPos = this.scales.cvdToY(value, min, max);
                if (yPos >= originY + 8 && yPos <= originY + h - 8) {
                    ctx.fillText(this.scales.formatK(value), right + 5, yPos);
                }
            }
            ctx.restore();
        }
        drawOI() {
            const h = this.scales.oiHeight();
            if (h <= 0 || this.oiData.length === 0)
                return;
            const ctx = this.ctx;
            const originY = this.scales.oiOriginY();
            const width = this.ctx.canvas.width / window.devicePixelRatio;
            const vr = this.scales.getVisibleRange();
            // Calculate candle interval from data (for matching tolerance)
            let candleIntervalMs = 60000; // Default 1 minute
            if (this.data.length >= 2) {
                const t1 = new Date(this.data[0].time).getTime();
                const t2 = new Date(this.data[1].time).getTime();
                candleIntervalMs = Math.abs(t2 - t1);
            }
            // Use the candle interval as matching tolerance (with some padding)
            const matchingTolerance = candleIntervalMs + 60000;
            // Match OI data to visible candle timestamps
            const matchedData = [];
            for (let i = vr.startIndex; i < Math.min(vr.endIndex, this.data.length); i++) {
                const candleTime = new Date(this.data[i].time).getTime();
                // Find closest OI timestamp within matching tolerance
                let closestValue;
                let closestDiff = Infinity;
                for (const point of this.oiData) {
                    const diff = Math.abs(point.timestamp - candleTime);
                    if (diff < closestDiff && diff < matchingTolerance) {
                        closestDiff = diff;
                        closestValue = point.value;
                    }
                }
                // Fallback: if no match within tolerance, use closest available point
                if (closestValue === undefined && this.oiData.length > 0) {
                    let bestDiff = Infinity;
                    for (const point of this.oiData) {
                        const diff = Math.abs(point.timestamp - candleTime);
                        if (diff < bestDiff) {
                            bestDiff = diff;
                            closestValue = point.value;
                        }
                    }
                }
                if (closestValue !== undefined) {
                    matchedData.push({ index: i, value: closestValue });
                }
            }
            if (matchedData.length === 0)
                return;
            // Determine min/max for visible data
            let min = Infinity;
            let max = -Infinity;
            for (const point of matchedData) {
                if (point.value < min)
                    min = point.value;
                if (point.value > max)
                    max = point.value;
            }
            if (min === Infinity)
                return;
            const range = max - min;
            if (range === 0) {
                min -= 1;
                max += 1;
            }
            else {
                const pad = range * 0.1;
                min -= pad;
                max += pad;
            }
            // Helper to map value to Y within the OI pane
            const valueToY = (value) => {
                const ratio = (value - min) / (max - min);
                return originY + h - ratio * h;
            };
            // Draw divider line
            ctx.save();
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.margin.left, originY);
            ctx.lineTo(width - this.margin.right, originY);
            ctx.stroke();
            ctx.restore();
            // Draw background
            ctx.save();
            ctx.fillStyle = this.theme.background || '#000';
            ctx.fillRect(this.margin.left, originY, width - this.margin.left - this.margin.right, h);
            // Clip
            ctx.beginPath();
            ctx.rect(this.margin.left, originY, width - this.margin.left - this.margin.right, h);
            ctx.clip();
            // Draw OI Line (orange color) - aligned to candle positions
            ctx.strokeStyle = '#ff9500';
            ctx.lineWidth = 2;
            ctx.beginPath();
            let first = true;
            for (const point of matchedData) {
                const x = this.scales.indexToX(point.index, vr.startIndex);
                const y = valueToY(point.value);
                if (first) {
                    ctx.moveTo(x, y);
                    first = false;
                }
                else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
            ctx.restore();
            // Draw OI Y-Axis Labels Area
            const right = width - this.margin.right;
            ctx.save();
            ctx.fillStyle = this.theme.scaleBackground || '#111';
            ctx.fillRect(right, originY, this.margin.right, h);
            ctx.strokeStyle = this.theme.scaleBorder || '#444';
            ctx.strokeRect(right + 0.5, originY, 0.5, h);
            // Labels
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.font = '10px system-ui';
            // 1. Draw Max Label (Top)
            ctx.fillStyle = this.theme.textColor || '#aaa';
            ctx.fillText(this.scales.formatK(max), right + 5, originY + 10);
            // 2. Draw Min Label (Bottom)
            ctx.fillStyle = this.theme.textColor || '#aaa';
            ctx.fillText(this.scales.formatK(min), right + 5, originY + h - 10);
            // 3. Draw Current Value Label (if we have data)
            if (matchedData.length > 0) {
                const lastPoint = matchedData[matchedData.length - 1];
                const yPos = valueToY(lastPoint.value);
                // Draw background for current value
                ctx.fillStyle = '#ff9500';
                ctx.fillRect(right, yPos - 9, this.margin.right, 18);
                // Draw text
                ctx.fillStyle = '#fff'; // White text on orange background
                ctx.font = 'bold 10px system-ui';
                ctx.fillText(this.scales.formatK(lastPoint.value), right + 5, yPos);
            }
            ctx.restore();
        }
        drawFundingRate() {
            const h = this.scales.fundingRateHeight();
            if (h <= 0 || this.fundingRateData.length === 0)
                return;
            const ctx = this.ctx;
            const originY = this.scales.fundingRateOriginY();
            const width = this.ctx.canvas.width / window.devicePixelRatio;
            const vr = this.scales.getVisibleRange();
            // Calculate candle interval from data (for matching tolerance)
            let candleIntervalMs = 60000; // Default 1 minute
            if (this.data.length >= 2) {
                const t1 = new Date(this.data[0].time).getTime();
                const t2 = new Date(this.data[1].time).getTime();
                candleIntervalMs = Math.abs(t2 - t1);
            }
            // Use the candle interval as matching tolerance (with some padding)
            const matchingTolerance = candleIntervalMs + 60000;
            // Match Funding Rate data to visible candle timestamps
            const matchedData = [];
            for (let i = vr.startIndex; i < Math.min(vr.endIndex, this.data.length); i++) {
                const candleTime = new Date(this.data[i].time).getTime();
                // Find closest FR timestamp within matching tolerance
                let closestValue;
                let closestDiff = Infinity;
                for (const point of this.fundingRateData) {
                    const diff = Math.abs(point.timestamp - candleTime);
                    if (diff < closestDiff && diff < matchingTolerance) {
                        closestDiff = diff;
                        closestValue = point.value;
                    }
                }
                // Fallback: if no match within tolerance, use closest available point
                if (closestValue === undefined && this.fundingRateData.length > 0) {
                    let bestDiff = Infinity;
                    for (const point of this.fundingRateData) {
                        const diff = Math.abs(point.timestamp - candleTime);
                        if (diff < bestDiff) {
                            bestDiff = diff;
                            closestValue = point.value;
                        }
                    }
                }
                if (closestValue !== undefined) {
                    matchedData.push({ index: i, value: closestValue });
                }
            }
            if (matchedData.length === 0)
                return;
            // Determine min/max for visible data
            let min = Infinity;
            let max = -Infinity;
            for (const point of matchedData) {
                if (point.value < min)
                    min = point.value;
                if (point.value > max)
                    max = point.value;
            }
            if (min === Infinity)
                return;
            const range = max - min;
            if (range === 0) {
                min -= 0.0001;
                max += 0.0001;
            }
            else {
                const pad = range * 0.1;
                min -= pad;
                max += pad;
            }
            // Helper to map value to Y within the Funding Rate pane
            const valueToY = (value) => {
                const ratio = (value - min) / (max - min);
                return originY + h - ratio * h;
            };
            // Draw divider line
            ctx.save();
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.margin.left, originY);
            ctx.lineTo(width - this.margin.right, originY);
            ctx.stroke();
            ctx.restore();
            // Draw background
            ctx.save();
            ctx.fillStyle = this.theme.background || '#000';
            ctx.fillRect(this.margin.left, originY, width - this.margin.left - this.margin.right, h);
            // Clip
            ctx.beginPath();
            ctx.rect(this.margin.left, originY, width - this.margin.left - this.margin.right, h);
            ctx.clip();
            // Draw zero line if in range
            if (min < 0 && max > 0) {
                const yZero = valueToY(0);
                ctx.strokeStyle = '#444';
                ctx.setLineDash([2, 2]);
                ctx.beginPath();
                ctx.moveTo(this.margin.left, yZero);
                ctx.lineTo(width - this.margin.right, yZero);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            // Draw Funding Rate as bars (green positive, red negative) - aligned to candle positions
            const spacing = this.scales.scaledSpacing();
            const barWidth = Math.max(2, spacing * 0.6);
            const yZero = valueToY(0);
            for (const point of matchedData) {
                const x = this.scales.indexToX(point.index, vr.startIndex) - barWidth / 2;
                const y = valueToY(point.value);
                const barHeight = Math.abs(yZero - y);
                ctx.fillStyle = point.value >= 0 ? '#22c55e' : '#ef4444';
                if (point.value >= 0) {
                    ctx.fillRect(x, y, barWidth, barHeight);
                }
                else {
                    ctx.fillRect(x, yZero, barWidth, barHeight);
                }
            }
            ctx.restore();
            // Draw Funding Rate Y-Axis Labels Area
            const right = width - this.margin.right;
            ctx.save();
            ctx.fillStyle = this.theme.scaleBackground || '#111';
            ctx.fillRect(right, originY, this.margin.right, h);
            ctx.strokeStyle = this.theme.scaleBorder || '#444';
            ctx.strokeRect(right + 0.5, originY, 0.5, h);
            // Labels header
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.font = '10px system-ui';
            // Helper to format percentage
            const formatPct = (v) => (v * 100).toFixed(4) + '%';
            // 1. Draw Max Label (Top)
            ctx.fillStyle = this.theme.textColor || '#aaa';
            ctx.fillText(formatPct(max), right + 3, originY + 10);
            // 2. Draw Min Label (Bottom)
            ctx.fillStyle = this.theme.textColor || '#aaa';
            ctx.fillText(formatPct(min), right + 3, originY + h - 10);
            // 3. Draw Current Value Label (if we have data)
            if (matchedData.length > 0) {
                const lastPoint = matchedData[matchedData.length - 1];
                const yPos = valueToY(lastPoint.value);
                // Draw background for current value (color based on sign)
                ctx.fillStyle = lastPoint.value >= 0 ? '#22c55e' : '#ef4444';
                ctx.fillRect(right, yPos - 9, this.margin.right, 18);
                // Draw text
                ctx.fillStyle = '#fff'; // White text
                ctx.font = 'bold 10px system-ui';
                ctx.fillText(formatPct(lastPoint.value), right + 3, yPos);
            }
            ctx.restore();
        }
        drawScales(width, height) {
            // Timeline position (fixed at bottom, CVD is drawn separately above it)
            const timelineY = height - this.margin.bottom;
            // Draw price bar (unchanged)
            const right = width - this.margin.right;
            this.ctx.fillStyle = this.theme.scaleBackground || '#111';
            this.ctx.fillRect(right, 0, this.margin.right, this.scales.chartHeight()); // Only fill price chart height
            this.ctx.strokeStyle = this.theme.scaleBorder || '#444';
            this.ctx.strokeRect(right + 0.5, this.margin.top, 0.5, this.scales.chartHeight());
            // Price labels
            this.ctx.fillStyle = this.theme.textColor || '#aaa';
            this.ctx.font = '12px system-ui';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            const labels = this.scales.computePriceBarLabels();
            const precision = this.scales.getPricePrecision();
            for (const { price, y } of labels) {
                const formattedPrice = price.toLocaleString('en-US', {
                    minimumFractionDigits: precision,
                    maximumFractionDigits: precision
                });
                this.ctx.fillText(formattedPrice, right + this.margin.right / 2, y);
            }
            // Draw timeline at bottom
            const chartW = width - this.margin.left - this.margin.right;
            this.ctx.fillStyle = this.theme.scaleBackground || '#111';
            this.ctx.fillRect(this.margin.left, timelineY, chartW, this.margin.bottom);
            this.ctx.strokeStyle = this.theme.scaleBorder || '#444';
            this.ctx.beginPath();
            this.ctx.moveTo(this.margin.left, timelineY + 0.5);
            this.ctx.lineTo(this.margin.left + chartW, timelineY + 0.5);
            this.ctx.stroke();
            // Timeline labels
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.rect(this.margin.left, timelineY, chartW, this.margin.bottom);
            this.ctx.clip();
            this.ctx.fillStyle = this.theme.textColor || '#aaa';
            this.ctx.font = '12px system-ui';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            const step = Math.max(1, Math.floor(120 / this.scales.scaledSpacing()));
            const vr = this.scales.getVisibleRange();
            for (let i = vr.startIndex; i < vr.endIndex; i += step) {
                const x = this.scales.indexToX(i, vr.startIndex);
                const date = new Date(this.data[i].time);
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                const t = `${hours}:${minutes}`;
                this.ctx.fillText(t, x, timelineY + this.margin.bottom / 2);
            }
            this.ctx.restore();
        }
    }

    /**
     * Aggregator module for combining 1-minute candles into higher timeframes.
     * Supports 5m, 15m, 30m, and 1h aggregations with live update capabilities.
     */
    /**
     * Aggregates 1-minute candle data into higher timeframes.
     * Maintains base 1m data and efficiently updates aggregated candles.
     */
    class Aggregator {
        constructor() {
            this.base1mData = [];
            this.currentTimeframe = '1m';
            this.aggregatedCache = new Map();
        }
        /**
         * Get the multiplier for a given timeframe (how many 1m candles per aggregated candle)
         */
        static getTimeframeMultiple(tf) {
            switch (tf) {
                case '1m': return 1;
                case '5m': return 5;
                case '15m': return 15;
                case '30m': return 30;
                case '1h': return 60;
                default: return 1;
            }
        }
        /**
         * Get the timeframe period start for a given timestamp
         */
        getTimeframeBucket(time, tf) {
            const multiple = Aggregator.getTimeframeMultiple(tf);
            const minutes = time.getUTCMinutes();
            const bucketMinutes = Math.floor(minutes / multiple) * multiple;
            const bucket = new Date(time);
            bucket.setUTCMinutes(bucketMinutes);
            bucket.setUTCSeconds(0);
            bucket.setUTCMilliseconds(0);
            return bucket.getTime();
        }
        /**
         * Merge footprint levels from multiple candles, summing volumes at matching prices
         */
        mergeFootprints(footprints) {
            const merged = new Map();
            for (const levels of footprints) {
                for (const level of levels) {
                    const existing = merged.get(level.price);
                    if (existing) {
                        existing.buy += level.buy;
                        existing.sell += level.sell;
                    }
                    else {
                        merged.set(level.price, { price: level.price, buy: level.buy, sell: level.sell });
                    }
                }
            }
            // Sort by price descending (highest first)
            return Array.from(merged.values()).sort((a, b) => b.price - a.price);
        }
        /**
         * Aggregate a group of 1m candles into a single candle
         */
        aggregateCandles(candles) {
            if (candles.length === 0) {
                throw new Error('Cannot aggregate empty candle array');
            }
            if (candles.length === 1) {
                return { ...candles[0] };
            }
            const first = candles[0];
            const last = candles[candles.length - 1];
            return {
                time: first.time, // Use first candle's timestamp
                open: first.open,
                high: Math.max(...candles.map(c => c.high)),
                low: Math.min(...candles.map(c => c.low)),
                close: last.close,
                footprint: this.mergeFootprints(candles.map(c => c.footprint))
            };
        }
        /**
         * Set the base 1-minute data and clear cache
         */
        setBase1mData(data) {
            this.base1mData = [...data];
            this.aggregatedCache.clear();
        }
        /**
         * Get the base 1m data
         */
        getBase1mData() {
            return this.base1mData;
        }
        /**
         * Add a new 1m candle (when timeframe closes and new candle starts)
         */
        add1mCandle(candle) {
            this.base1mData.push(candle);
            this.aggregatedCache.clear(); // Invalidate cache
        }
        /**
         * Update the last 1m candle with new trade data
         * This is called when trades are added to the current candle
         */
        update1mCandle(candle) {
            if (this.base1mData.length === 0) {
                this.base1mData.push(candle);
            }
            else {
                const lastCandle = this.base1mData[this.base1mData.length - 1];
                const lastTime = new Date(lastCandle.time).getTime();
                const candleTime = new Date(candle.time).getTime();
                if (lastTime === candleTime) {
                    // Same timestamp - update the last candle
                    this.base1mData[this.base1mData.length - 1] = candle;
                }
                else {
                    // Different timestamp - this is a new candle
                    this.base1mData.push(candle);
                }
            }
            this.aggregatedCache.clear(); // Invalidate cache
        }
        /**
         * Get current timeframe
         */
        getTimeframe() {
            return this.currentTimeframe;
        }
        /**
         * Set current timeframe
         */
        setTimeframe(tf) {
            this.currentTimeframe = tf;
        }
        /**
         * Get aggregated candle data for a specific timeframe
         */
        getAggregatedData(timeframe = this.currentTimeframe) {
            if (timeframe === '1m') {
                return this.base1mData;
            }
            // Check cache
            const cached = this.aggregatedCache.get(timeframe);
            if (cached) {
                return cached;
            }
            // Aggregate the data
            const aggregated = this.aggregate(timeframe);
            this.aggregatedCache.set(timeframe, aggregated);
            return aggregated;
        }
        /**
         * Perform the actual aggregation
         */
        aggregate(timeframe) {
            if (this.base1mData.length === 0) {
                return [];
            }
            const result = [];
            const buckets = new Map();
            // Group candles by timeframe bucket
            for (const candle of this.base1mData) {
                const time = new Date(candle.time);
                const bucket = this.getTimeframeBucket(time, timeframe);
                if (!buckets.has(bucket)) {
                    buckets.set(bucket, []);
                }
                buckets.get(bucket).push(candle);
            }
            // Sort buckets by time and aggregate each
            const sortedBuckets = Array.from(buckets.entries())
                .sort((a, b) => a[0] - b[0]);
            for (const [, candles] of sortedBuckets) {
                result.push(this.aggregateCandles(candles));
            }
            return result;
        }
        /**
         * Get the data to display for the current timeframe
         */
        getData() {
            return this.getAggregatedData(this.currentTimeframe);
        }
    }

    /**
     * Main chart implementation for the Volume Footprint Chart.
     * Provides the primary API for creating and managing chart instances with modular components.
     */
    class Chart {
        // Tick size detection
        detectTickSize() {
            if (this.data.length === 0)
                return 10;
            // Collect all unique price differences from footprint data
            const priceDifferences = new Set();
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
            if (priceDifferences.size === 0)
                return 10;
            const diffCounts = new Map();
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
                }
                else if (count === maxCount && diff < bestDiff) {
                    bestDiff = diff;
                }
            }
            return bestDiff;
        }
        createChartStructure(container) {
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
            const timeframes = ['1m', '5m', '15m', '30m', '1h'];
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
        setupToolbarEventHandlers(container) {
            const resetZoomBtn = container.querySelector('#resetZoom');
            const toggleGridBtn = container.querySelector('#toggleGrid');
            const viewModeSelect = container.querySelector('#viewModeSelect');
            const volumeHeatmapBtn = container.querySelector('#volumeHeatmap');
            const volumeHeatmapDropdown = container.querySelector('.dropdown-menu:not(.cvd-dropdown)');
            const measureBtn = container.querySelector('#measure');
            const cvdBtn = container.querySelector('#cvdToggle');
            const cvdDropdown = container.querySelector('.cvd-dropdown');
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
            const tfButtons = container.querySelectorAll('.tf-btn');
            tfButtons.forEach(btn => {
                const tf = btn.dataset.timeframe;
                if (tf) {
                    this.timeframeButtons.set(tf, btn);
                }
            });
            // Store Delta Table button reference
            this.deltaTableBtn = container.querySelector('#deltaTableToggle');
            // Store Edit Settings button and popup references
            this.editBtn = container.querySelector('#editSettings');
            this.editPopup = container.querySelector('#editSettingsPopup');
        }
        /**
         * Initializes the canvas element and context.
         * @param container The container element
         * @param chartContainer The chart container element
         */
        initializeCanvas(container, chartContainer) {
            // Use existing canvas if available, otherwise create one
            this.canvas = container.querySelector('canvas');
            if (!this.canvas) {
                this.canvas = document.createElement('canvas');
                if (chartContainer) {
                    chartContainer.appendChild(this.canvas);
                }
                else {
                    // Fallback: append directly to container if chart container not found
                    container.appendChild(this.canvas);
                }
            }
            const ctx = this.canvas.getContext('2d');
            if (!ctx)
                throw new Error('Canvas 2D context not available');
            this.ctx = ctx;
        }
        /**
         * Initializes chart options with defaults and user-provided values.
         * @param options User-provided options
         * @param container The container element
         * @param chartContainer The chart container element
         */
        initializeOptions(options, container, chartContainer) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
            this.options = {
                width: options.width || container.clientWidth || 800,
                height: options.height || (chartContainer ? chartContainer.clientHeight : container.clientHeight) || 600,
                showGrid: (_a = options.showGrid) !== null && _a !== void 0 ? _a : true,
                showBounds: (_b = options.showBounds) !== null && _b !== void 0 ? _b : false,
                showVolumeFootprint: (_c = options.showVolumeFootprint) !== null && _c !== void 0 ? _c : true,
                showVolumeHeatmap: (_d = options.showVolumeHeatmap) !== null && _d !== void 0 ? _d : false,
                volumeHeatmapDynamic: (_e = options.volumeHeatmapDynamic) !== null && _e !== void 0 ? _e : true,
                showCVD: (_f = options.showCVD) !== null && _f !== void 0 ? _f : false,
                cvdHeightRatio: options.cvdHeightRatio || 0.2,
                cvdType: options.cvdType || 'ticker',
                showDeltaTable: (_g = options.showDeltaTable) !== null && _g !== void 0 ? _g : false,
                tickSize: options.tickSize || 10,
                initialZoomX: options.initialZoomX || 0.55,
                initialZoomY: options.initialZoomY || 0.55,
                minZoom: options.minZoom || 1e-6,
                maxZoom: options.maxZoom || 100,
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
                showOI: (_h = options.showOI) !== null && _h !== void 0 ? _h : false,
                oiHeightRatio: options.oiHeightRatio || 0.15,
                showFundingRate: (_j = options.showFundingRate) !== null && _j !== void 0 ? _j : false,
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
            this.showOI = (_k = this.options.showOI) !== null && _k !== void 0 ? _k : false;
            this.showFundingRate = (_l = this.options.showFundingRate) !== null && _l !== void 0 ? _l : false;
            this.view.zoomX = this.options.initialZoomX;
            this.view.zoomY = this.options.initialZoomY;
        }
        /**
         * Initializes the chart modules (Scales, Interactions, Drawing).
         */
        initializeModules() {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            this.scales = new Scales(this.data, this.margin, this.view, this.options.width, this.options.height, this.showVolumeFootprint, this.TICK, this.baseRowPx, this.TEXT_VIS, this.showCVD, (_a = this.options.cvdHeightRatio) !== null && _a !== void 0 ? _a : 0.2, this.getDeltaTableHeight(), this.options.footprintStyle, this.showOI, (_b = this.options.oiHeightRatio) !== null && _b !== void 0 ? _b : 0.15, this.showFundingRate, (_c = this.options.fundingRateHeightRatio) !== null && _c !== void 0 ? _c : 0.1);
            this.interactions = new Interactions(this.canvas, this.margin, this.view, {
                ...this.events,
                onPan: () => {
                    if (this.cvdDynamic && this.showCVD)
                        this.calculateCVD();
                    this.drawing.drawAll();
                },
                onZoom: () => {
                    if (this.cvdDynamic && this.showCVD)
                        this.calculateCVD();
                    this.drawing.drawAll();
                },
                onMouseMove: () => this.drawing.drawAll(),
                onCvdResize: (ratio) => {
                    this.options.cvdHeightRatio = ratio;
                    this.updateOptions({ cvdHeightRatio: ratio });
                },
                onTableResize: (height) => {
                    const allRows = ['volume', 'volChange', 'buyVol', 'buyVolPercent', 'sellVol', 'sellVolPercent', 'delta', 'deltaPercent', 'minDelta', 'maxDelta', 'poc', 'hlRange'];
                    const visibility = this.options.tableRowVisibility || {};
                    const visibleRows = allRows.filter(key => visibility[key] !== false).length;
                    if (visibleRows > 0) {
                        const tableRowHeight = Math.max(10, height / visibleRows);
                        this.options.tableRowHeight = tableRowHeight;
                        this.updateOptions({ tableRowHeight });
                    }
                }
            }, this.crosshair, this.scales, { min: (_d = this.options.minZoom) !== null && _d !== void 0 ? _d : 1e-6, max: (_e = this.options.maxZoom) !== null && _e !== void 0 ? _e : 100 });
            this.drawing = new Drawing(this.ctx, this.data, this.margin, this.view, this.showGrid, this.showBounds, this.showVolumeFootprint, this.showVolumeHeatmap, this.volumeHeatmapDynamic, this.scales, this.options.theme, this.crosshair, this.lastPrice, this.interactions, this.cvdValues, this.showDeltaTable, this.options.tableRowVisibility, (_f = this.options.tableRowHeight) !== null && _f !== void 0 ? _f : 16, this.options.footprintStyle, this.showOI, (_g = this.options.oiHeightRatio) !== null && _g !== void 0 ? _g : 0.15, this.showFundingRate, (_h = this.options.fundingRateHeightRatio) !== null && _h !== void 0 ? _h : 0.1);
        }
        constructor(container, options = {}, events = {}) {
            this.data = [];
            this.events = {};
            // Chart state
            this.margin = { top: 0, bottom: 40, left: 0, right: 70 };
            this.view = { zoomY: 1, zoomX: 1, offsetRows: 0, offsetX: 0, offsetY: 0 };
            this.showGrid = true;
            this.showBounds = false;
            this.showVolumeFootprint = true;
            this.showVolumeHeatmap = false;
            this.volumeHeatmapDynamic = true;
            this.crosshair = { x: -1, y: -1, visible: false };
            this.lastPrice = null;
            this.cvdType = 'ticker';
            // Toolbar button references
            this.resetZoomBtn = null;
            this.toggleGridBtn = null;
            this.viewModeSelect = null;
            this.volumeHeatmapBtn = null;
            this.volumeHeatmapDropdown = null;
            this.measureBtn = null;
            this.cvdBtn = null;
            this.cvdDropdown = null;
            // Timeframe aggregation state
            this.aggregator = new Aggregator();
            this.currentTimeframe = '1m';
            this.timeframeButtons = new Map();
            this.isAggregatedData = false; // Flag to track if current data is aggregated
            // CVD state
            this.showCVD = false;
            this.cvdDynamic = true;
            this.cvdValues = [];
            this.cvdBaseline = 'global';
            this.cvdNormalize = true;
            // Delta table state
            this.showDeltaTable = false;
            this.deltaTableBtn = null;
            // Edit settings popup state
            this.editBtn = null;
            this.editPopup = null;
            // Open Interest indicator state
            this.showOI = false;
            this.oiData = [];
            // Funding Rate indicator state
            this.showFundingRate = false;
            this.fundingRateData = [];
            // Constants
            this.TICK = 10;
            this.BASE_CANDLE = 15;
            this.BASE_BOX = 55;
            this.BASE_IMBALANCE = 2;
            this.BASE_SPACING = this.BASE_CANDLE + 2 * this.BASE_BOX + 2 * this.BASE_IMBALANCE;
            this.FIXED_GAP = 4;
            this.baseRowPx = 22;
            this.TEXT_VIS = { minZoomX: 0.5, minRowPx: 10, minBoxPx: 20 };
            // Create the complete chart structure with toolbars
            this.createChartStructure(container);
            // Get the chart container for accurate dimensions
            const chartContainer = container.querySelector('.vfc-chart-container');
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
        setupCanvas() {
            const DPR = Math.max(1, Math.round(window.devicePixelRatio || 1));
            this.canvas.style.width = this.options.width + 'px';
            this.canvas.style.height = this.options.height + 'px';
            this.canvas.width = Math.max(1, Math.floor(this.options.width * DPR));
            this.canvas.height = Math.max(1, Math.floor(this.options.height * DPR));
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.scale(DPR, DPR);
        }
        bindEvents() {
            this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
            this.canvas.addEventListener('pointerdown', this.handlePointerDown.bind(this));
            window.addEventListener('resize', this.layout.bind(this));
        }
        bindToolbarEvents() {
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
                        const lastPrice = this.lastPrice;
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
                    const mode = this.viewModeSelect.value;
                    if (mode === 'candles') {
                        this.updateOptions({ showVolumeFootprint: false });
                    }
                    else {
                        this.updateOptions({
                            showVolumeFootprint: true,
                            footprintStyle: mode
                        });
                    }
                    // Auto-reset view to show latest data
                    if (this.data.length > 0) {
                        const s = this.scales.scaledSpacing();
                        const contentW = this.options.width - this.margin.left - this.margin.right;
                        const visibleCount = Math.ceil(contentW / s);
                        const startIndex = Math.max(0, this.data.length - visibleCount);
                        this.view.offsetX = startIndex * s;
                        // Center the last candle's close price vertically
                        if (this.lastPrice) {
                            const centerRow = (this.scales.chartHeight() / 2) / this.scales.rowHeightPx();
                            const currentPriceRow = this.scales.priceToRowIndex(this.lastPrice);
                            this.view.offsetRows = centerRow - (currentPriceRow - this.view.offsetRows);
                        }
                        this.drawing.drawAll();
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
                    var _a, _b;
                    const isActive = this.interactions.getMeasureMode();
                    if (isActive) {
                        // Deactivate measure mode
                        this.interactions.setMeasureMode(false);
                        (_a = this.measureBtn) === null || _a === void 0 ? void 0 : _a.classList.remove('active');
                    }
                    else {
                        // Activate measure mode
                        this.interactions.setMeasureMode(true);
                        (_b = this.measureBtn) === null || _b === void 0 ? void 0 : _b.classList.add('active');
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
                        this.deltaTableBtn.classList.add('active');
                    }
                    else {
                        this.deltaTableBtn.classList.remove('active');
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
                    const isVisible = this.editPopup.style.display === 'block';
                    this.hideAllDropdowns();
                    if (!isVisible) {
                        this.editPopup.style.display = 'block';
                    }
                });
                // Table row checkbox handlers
                this.editPopup.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    const checkbox = cb;
                    checkbox.addEventListener('change', () => {
                        const rowKey = checkbox.dataset.row;
                        if (rowKey && this.options.tableRowVisibility) {
                            this.options.tableRowVisibility[rowKey] = checkbox.checked;
                            this.updateOptions({ tableRowVisibility: this.options.tableRowVisibility });
                        }
                    });
                });
                // Heatmap type radio handlers
                this.editPopup.querySelectorAll('input[name="heatmapType"]').forEach(radio => {
                    const r = radio;
                    r.addEventListener('change', () => {
                        const isDynamic = r.value === 'dynamic';
                        this.volumeHeatmapDynamic = isDynamic;
                        this.updateOptions({ volumeHeatmapDynamic: isDynamic });
                        this.updateButtonText();
                    });
                });
                // CVD type radio handlers
                this.editPopup.querySelectorAll('input[name="cvdType"]').forEach(radio => {
                    const r = radio;
                    r.addEventListener('change', () => {
                        const cvdType = r.value;
                        this.options.cvdType = cvdType;
                        this.updateOptions({ cvdType });
                        this.calculateCVD();
                        this.updateButtonText();
                    });
                });
                // Footprint Style radio handlers
                this.editPopup.querySelectorAll('input[name="footprintStyle"]').forEach(radio => {
                    const r = radio;
                    r.addEventListener('change', () => {
                        const footprintStyle = r.value;
                        this.options.footprintStyle = footprintStyle;
                        this.updateOptions({ footprintStyle });
                    });
                });
                // OI indicator checkbox handler
                const oiCheckbox = this.editPopup.querySelector('#showOI');
                if (oiCheckbox) {
                    oiCheckbox.checked = this.showOI;
                    oiCheckbox.addEventListener('change', () => {
                        this.showOI = oiCheckbox.checked;
                        this.drawing.setShowOI(this.showOI);
                        this.updateOptions({ showOI: this.showOI });
                    });
                }
                // Funding Rate indicator checkbox handler
                const frCheckbox = this.editPopup.querySelector('#showFundingRate');
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
                    var _a, _b;
                    if (!((_a = this.editBtn) === null || _a === void 0 ? void 0 : _a.contains(e.target)) &&
                        !((_b = this.editPopup) === null || _b === void 0 ? void 0 : _b.contains(e.target))) {
                        this.editPopup.style.display = 'none';
                    }
                });
            }
        }
        handleWheel(e) {
            this.interactions.handleWheel(e);
            this.drawing.drawAll();
        }
        handlePointerDown(e) {
            this.interactions.handlePointerDown(e);
        }
        layout() {
            var _a, _b, _c, _d, _e, _f;
            const container = this.canvas.parentElement;
            if (container) {
                this.options.width = container.clientWidth || this.options.width;
                this.options.height = container.clientHeight || this.options.height;
            }
            // Recreate scales and drawing with new dimensions
            this.scales = new Scales(this.data, this.margin, this.view, this.options.width, this.options.height, this.showVolumeFootprint, this.TICK, this.baseRowPx, this.TEXT_VIS, this.showCVD, (_a = this.options.cvdHeightRatio) !== null && _a !== void 0 ? _a : 0.2, this.getDeltaTableHeight(), this.options.footprintStyle, this.showOI, (_b = this.options.oiHeightRatio) !== null && _b !== void 0 ? _b : 0.15, this.showFundingRate, (_c = this.options.fundingRateHeightRatio) !== null && _c !== void 0 ? _c : 0.1);
            this.drawing = new Drawing(this.ctx, this.data, this.margin, this.view, this.showGrid, this.showBounds, this.showVolumeFootprint, this.showVolumeHeatmap, this.volumeHeatmapDynamic, this.scales, this.options.theme, this.crosshair, this.lastPrice, this.interactions, this.cvdValues, this.showDeltaTable, this.options.tableRowVisibility, (_d = this.options.tableRowHeight) !== null && _d !== void 0 ? _d : 16, this.options.footprintStyle, this.showOI, (_e = this.options.oiHeightRatio) !== null && _e !== void 0 ? _e : 0.15, this.showFundingRate, (_f = this.options.fundingRateHeightRatio) !== null && _f !== void 0 ? _f : 0.1);
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
        setData(data) {
            var _a, _b, _c, _d, _e, _f;
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
                    }
                    else {
                        btn.classList.remove('active');
                    }
                });
            }
            // Detect tick size from data if not explicitly provided
            if (!this.options.tickSize && this.data.length > 0) {
                const detectedTick = this.detectTickSize();
                console.log('Detected tick size:', detectedTick);
                this.TICK = detectedTick;
            }
            else if (this.options.tickSize) {
                console.log('Using explicit tick size:', this.options.tickSize);
                this.TICK = this.options.tickSize;
            }
            if (data.length > 0) {
                this.lastPrice = data[data.length - 1].close;
            }
            // Update scales with new data
            this.scales = new Scales(this.data, this.margin, this.view, this.options.width, this.options.height, this.showVolumeFootprint, this.TICK, this.baseRowPx, this.TEXT_VIS, this.showCVD, (_a = this.options.cvdHeightRatio) !== null && _a !== void 0 ? _a : 0.2, this.getDeltaTableHeight(), this.options.footprintStyle, this.showOI, (_b = this.options.oiHeightRatio) !== null && _b !== void 0 ? _b : 0.15, this.showFundingRate, (_c = this.options.fundingRateHeightRatio) !== null && _c !== void 0 ? _c : 0.1);
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
                const lastPrice = this.lastPrice;
                const centerRow = (this.scales.chartHeight() / 2) / this.scales.rowHeightPx();
                const currentPriceRow = this.scales.priceToRowIndex(lastPrice);
                this.view.offsetRows = centerRow - (currentPriceRow - this.view.offsetRows);
            }
            // Calculate CVD values AFTER scales and view are set
            console.log('setData: calling calculateCVD');
            this.calculateCVD();
            console.log('setData: CVD values calculated, length:', this.cvdValues.length);
            this.drawing = new Drawing(this.ctx, this.data, this.margin, this.view, this.showGrid, this.showBounds, this.showVolumeFootprint, this.showVolumeHeatmap, this.volumeHeatmapDynamic, this.scales, this.options.theme, this.crosshair, this.lastPrice, this.interactions, this.cvdValues, this.showDeltaTable, this.options.tableRowVisibility, (_d = this.options.tableRowHeight) !== null && _d !== void 0 ? _d : 16, this.options.footprintStyle, this.showOI, (_e = this.options.oiHeightRatio) !== null && _e !== void 0 ? _e : 0.15, this.showFundingRate, (_f = this.options.fundingRateHeightRatio) !== null && _f !== void 0 ? _f : 0.1);
            // Pass stored indicator data to the new Drawing instance
            if (this.oiData.length > 0) {
                this.drawing.updateOIData(this.oiData);
            }
            if (this.fundingRateData.length > 0) {
                this.drawing.updateFundingRateData(this.fundingRateData);
            }
            this.drawing.drawAll();
        }
        updateOptions(options) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
            const oldShowVolumeFootprint = this.showVolumeFootprint;
            const oldCvdType = this.cvdType;
            Object.assign(this.options, options);
            this.showGrid = this.options.showGrid;
            this.showBounds = this.options.showBounds;
            this.showVolumeFootprint = this.options.showVolumeFootprint;
            this.showVolumeHeatmap = this.options.showVolumeHeatmap;
            this.showVolumeHeatmap = this.options.showVolumeHeatmap;
            this.volumeHeatmapDynamic = (_a = this.options.volumeHeatmapDynamic) !== null && _a !== void 0 ? _a : this.volumeHeatmapDynamic;
            this.showCVD = (_b = this.options.showCVD) !== null && _b !== void 0 ? _b : this.showCVD;
            this.cvdType = (_c = this.options.cvdType) !== null && _c !== void 0 ? _c : 'ticker';
            this.showOI = (_d = this.options.showOI) !== null && _d !== void 0 ? _d : this.showOI;
            this.showFundingRate = (_e = this.options.showFundingRate) !== null && _e !== void 0 ? _e : this.showFundingRate;
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
            this.scales = new Scales(this.data, this.margin, this.view, this.options.width, this.options.height, this.showVolumeFootprint, this.TICK, this.baseRowPx, this.TEXT_VIS, this.showCVD, (_f = this.options.cvdHeightRatio) !== null && _f !== void 0 ? _f : 0.2, this.getDeltaTableHeight(), this.options.footprintStyle, this.showOI, (_g = this.options.oiHeightRatio) !== null && _g !== void 0 ? _g : 0.15, this.showFundingRate, (_h = this.options.fundingRateHeightRatio) !== null && _h !== void 0 ? _h : 0.1);
            // Recalculate CVD if needed (e.g. type changed, or just to be safe with new scales)
            if (this.showCVD) {
                this.calculateCVD();
            }
            // Update Interactions with the new Scales instance
            this.interactions.setScales(this.scales);
            this.drawing = new Drawing(this.ctx, this.data, this.margin, this.view, this.showGrid, this.showBounds, this.showVolumeFootprint, this.showVolumeHeatmap, this.volumeHeatmapDynamic, this.scales, this.options.theme, this.crosshair, this.lastPrice, this.interactions, this.cvdValues, this.showDeltaTable, this.options.tableRowVisibility, (_j = this.options.tableRowHeight) !== null && _j !== void 0 ? _j : 16, this.options.footprintStyle, this.showOI, (_k = this.options.oiHeightRatio) !== null && _k !== void 0 ? _k : 0.15, this.showFundingRate, (_l = this.options.fundingRateHeightRatio) !== null && _l !== void 0 ? _l : 0.1);
            // Pass stored indicator data to the new Drawing instance
            if (this.oiData.length > 0) {
                this.drawing.updateOIData(this.oiData);
            }
            if (this.fundingRateData.length > 0) {
                this.drawing.updateFundingRateData(this.fundingRateData);
            }
            this.layout();
        }
        resize(width, height) {
            this.options.width = width;
            this.options.height = height;
            this.layout();
        }
        destroy() {
            if (this.canvas.parentElement) {
                this.canvas.parentElement.removeChild(this.canvas);
            }
        }
        calculateCVD() {
            var _a, _b;
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
            }
            else if (this.cvdBaseline === 'visible') {
                // For visible mode, use first visible candle
                const vr = (_a = this.scales) === null || _a === void 0 ? void 0 : _a.getVisibleRange();
                baselineIndex = vr ? vr.startIndex : 0;
            }
            console.log('calculateCVD: cvdDynamic =', this.cvdDynamic);
            if (this.cvdDynamic) {
                // Dynamic mode: calculate CVD starting from the visible range
                const vr = (_b = this.scales) === null || _b === void 0 ? void 0 : _b.getVisibleRange();
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
                                }
                                else {
                                    delta = volume * sign;
                                }
                            }
                            else {
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
            }
            else {
                // Static mode
                for (let i = 0; i < this.data.length; i++) {
                    const candle = this.data[i];
                    let delta = 0;
                    if (this.cvdType === 'ticker') {
                        const volume = candle.footprint.reduce((sum, level) => sum + level.buy + level.sell, 0);
                        const sign = Math.sign(candle.close - candle.open);
                        if (candle.close === candle.open) {
                            delta = 0;
                        }
                        else {
                            delta = volume * sign;
                        }
                    }
                    else {
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
        addCandle(candle) {
            var _a, _b, _c, _d, _e, _f, _g;
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
                }
                else {
                    delta = volume * sign;
                }
            }
            else {
                delta = candle.footprint.reduce((sum, level) => sum + (level.buy - level.sell), 0);
            }
            const newCVD = (lastCVD || 0) + delta;
            // Apply normalization if needed
            let normalizedCVD = newCVD;
            if (this.cvdNormalize) {
                let baselineValue = 0;
                if (this.cvdBaseline === 'global') {
                    baselineValue = this.cvdValues.length > 0 ? this.cvdValues[0] : 0;
                }
                else if (this.cvdBaseline === 'visible') {
                    const vr = (_a = this.scales) === null || _a === void 0 ? void 0 : _a.getVisibleRange();
                    const baselineIndex = vr ? vr.startIndex : 0;
                    baselineValue = baselineIndex < this.cvdValues.length ? this.cvdValues[baselineIndex] : 0;
                }
                normalizedCVD = newCVD - (baselineValue || 0);
            }
            this.cvdValues.push(normalizedCVD);
            // Update scales and redraw
            this.scales = new Scales(this.data, this.margin, this.view, this.options.width, this.options.height, this.showVolumeFootprint, this.TICK, this.baseRowPx, this.TEXT_VIS, this.showCVD, (_b = this.options.cvdHeightRatio) !== null && _b !== void 0 ? _b : 0.2, this.getDeltaTableHeight(), this.options.footprintStyle, this.showOI, (_c = this.options.oiHeightRatio) !== null && _c !== void 0 ? _c : 0.15, this.showFundingRate, (_d = this.options.fundingRateHeightRatio) !== null && _d !== void 0 ? _d : 0.1);
            this.drawing = new Drawing(this.ctx, this.data, this.margin, this.view, this.showGrid, this.showBounds, this.showVolumeFootprint, this.showVolumeHeatmap, this.volumeHeatmapDynamic, this.scales, this.options.theme, this.crosshair, this.lastPrice, this.interactions, this.cvdValues, this.showDeltaTable, this.options.tableRowVisibility, (_e = this.options.tableRowHeight) !== null && _e !== void 0 ? _e : 16, this.options.footprintStyle, this.showOI, (_f = this.options.oiHeightRatio) !== null && _f !== void 0 ? _f : 0.15, this.showFundingRate, (_g = this.options.fundingRateHeightRatio) !== null && _g !== void 0 ? _g : 0.1);
            // Pass stored indicator data to the new Drawing instance
            if (this.oiData.length > 0) {
                this.drawing.updateOIData(this.oiData);
            }
            if (this.fundingRateData.length > 0) {
                this.drawing.updateFundingRateData(this.fundingRateData);
            }
            this.drawing.drawAll();
        }
        updateButtonText() {
            if (this.viewModeSelect) {
                if (!this.options.showVolumeFootprint) {
                    this.viewModeSelect.value = 'candles';
                }
                else {
                    this.viewModeSelect.value = this.options.footprintStyle || 'bid_ask';
                }
            }
            if (this.volumeHeatmapBtn) {
                if (this.options.showVolumeHeatmap) {
                    const mode = this.options.volumeHeatmapDynamic ? 'Dynamic' : 'Static';
                    this.volumeHeatmapBtn.textContent = `Volume Heatmap (${mode})`;
                }
                else {
                    this.volumeHeatmapBtn.textContent = 'Volume Heatmap';
                }
            }
            if (this.cvdBtn) {
                if (this.showCVD) {
                    const mode = this.cvdType === 'ticker' ? 'Ticker' : 'Footprint';
                    this.cvdBtn.textContent = `CVD (${mode})`;
                }
                else {
                    this.cvdBtn.textContent = 'CVD';
                }
            }
        }
        /** Calculate the height of the delta table based on visible rows */
        getDeltaTableHeight() {
            if (!this.showDeltaTable)
                return 0;
            const rowHeight = this.options.tableRowHeight || 16;
            const allRows = ['volume', 'volChange', 'buyVol', 'buyVolPercent', 'sellVol', 'sellVolPercent', 'delta', 'deltaPercent', 'minDelta', 'maxDelta', 'poc', 'hlRange'];
            const visibility = this.options.tableRowVisibility || {};
            const visibleRows = allRows.filter(key => visibility[key] !== false);
            return rowHeight * visibleRows.length;
        }
        hideAllDropdowns() {
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
        setTimeframe(tf) {
            this.currentTimeframe = tf;
            this.aggregator.setTimeframe(tf);
            // Update button active states
            this.timeframeButtons.forEach((btn, buttonTf) => {
                if (buttonTf === tf) {
                    btn.classList.add('active');
                }
                else {
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
        getTimeframe() {
            return this.currentTimeframe;
        }
        /**
         * Set the base 1-minute data and display at current timeframe
         */
        set1mData(data) {
            this.aggregator.setBase1mData(data);
            const aggregatedData = this.aggregator.getData();
            this.setData(aggregatedData);
        }
        /**
         * Update or add a 1-minute candle (for live updates)
         * If the candle has the same timestamp as the last candle, it updates it
         * Otherwise, it adds a new candle
         */
        update1mCandle(candle) {
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
                    }
                    else {
                        delta = lastAggCandle.footprint.reduce((sum, level) => sum + (level.buy - level.sell), 0);
                    }
                    this.cvdValues[this.cvdValues.length - 1] = prevCVD + delta;
                }
            }
            else {
                // New candle - append it
                this.addCandle(lastAggCandle);
            }
            // Update the drawing's lastPrice before redrawing so price line updates in real-time
            this.drawing.updateLastPrice(this.lastPrice);
            this.drawing.drawAll();
        }
        // Getters for API access
        getOptions() { return this.options; }
        getShowGrid() { return this.showGrid; }
        /**
         * Set Open Interest data for the indicator
         * @param data Array of { timestamp: number, value: number }
         * @param replace If true, replaces existing data. If false (default), merges with existing data.
         */
        setOIData(data, replace = false) {
            if (replace) {
                this.oiData = data;
            }
            else {
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
        setFundingRateData(data, replace = false) {
            if (replace) {
                this.fundingRateData = data;
            }
            else {
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
        getOIData() { return this.oiData; }
        /** Get current funding rate data */
        getFundingRateData() { return this.fundingRateData; }
        // Helper to merge time-series data
        mergeData(current, incoming) {
            if (!current || current.length === 0)
                return incoming;
            if (!incoming || incoming.length === 0)
                return current;
            const map = new Map();
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

    class VolumeFootprintSeriesApi {
        constructor(chart, options) {
            this.chart = chart;
            this.seriesOptions = options || {};
        }
        setData(data) {
            // Convert data format and set on chart
            const convertedData = data.map(d => ({
                time: typeof d.time === 'number' ? new Date(d.time).toISOString() : d.time,
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close,
                footprint: d.footprint || []
            }));
            this.chart.setData(convertedData);
        }
        update(data) {
            // Update latest data point
            this.setData([data]);
        }
        data() {
            // Return current data (would need to store this)
            return [];
        }
        applyOptions(options) {
            this.seriesOptions = { ...this.seriesOptions, ...options };
        }
        options() {
            return this.seriesOptions;
        }
        priceScale() {
            return {
                applyOptions: () => { },
                options: () => ({}),
                width: () => 40,
                height: () => 0,
                isEmpty: () => false,
                priceToCoordinate: () => null,
                coordinateToPrice: () => null
            };
        }
        visible() {
            return true;
        }
        setVisible(visible) {
            // Implement visibility toggle
        }
    }

    class TimeScaleApi {
        constructor(chart) {
            this.chart = chart;
        }
        applyOptions(options) {
            // Apply time scale options
        }
        options() {
            return {
                visible: true,
                timeVisible: true,
                barSpacing: 30
            };
        }
        scrollToPosition(position, animated) {
            // Scroll to position
        }
        scrollToRealTime() {
            // Scroll to real time
        }
        getVisibleRange() {
            return null;
        }
        setVisibleRange(range) {
            // Set visible range
        }
        resetTimeScale() {
            // Reset time scale
        }
        fitContent() {
            // Fit content
        }
        timeToCoordinate(time) {
            return null;
        }
        coordinateToTime(coordinate) {
            return null;
        }
    }

    class PriceScaleApi {
        constructor(chart) {
            this.chart = chart;
        }
        applyOptions(options) {
            // Apply price scale options
        }
        options() {
            return {
                visible: true,
                autoScale: true
            };
        }
        width() {
            return 40;
        }
        height() {
            return 0; // Would need to calculate actual height
        }
        isEmpty() {
            return false;
        }
        priceToCoordinate(price) {
            return null; // Would need to implement coordinate conversion
        }
        coordinateToPrice(coordinate) {
            return null; // Would need to implement coordinate conversion
        }
    }

    class ChartApi {
        constructor(container, options) {
            var _a, _b, _c;
            this.series = [];
            // Convert options to VFC format
            const vfcOptions = {
                width: options.width,
                height: options.height,
                showGrid: (_c = (_b = (_a = options.grid) === null || _a === void 0 ? void 0 : _a.horzLines) === null || _b === void 0 ? void 0 : _b.visible) !== null && _c !== void 0 ? _c : true,
                showBounds: false,
                tickSize: 10,
                initialZoomX: 2, // Higher zoom to show footprints
                initialZoomY: 1,
                margin: { top: 0, bottom: 40, left: 0, right: 60 }
            };
            this.chart = new Chart(container, vfcOptions);
            this.timeScaleApi = new TimeScaleApi(this.chart);
            this.priceScaleApi = new PriceScaleApi(this.chart);
        }
        addVolumeFootprintSeries(options) {
            const seriesApi = new VolumeFootprintSeriesApi(this.chart, options);
            this.series.push(seriesApi);
            return seriesApi;
        }
        removeSeries(seriesApi) {
            const index = this.series.indexOf(seriesApi);
            if (index > -1) {
                this.series.splice(index, 1);
            }
        }
        timeScale() {
            return this.timeScaleApi;
        }
        priceScale() {
            return this.priceScaleApi;
        }
        applyOptions(options) {
            var _a, _b, _c;
            // Convert and apply options
            const vfcOptions = {
                width: options.width,
                height: options.height,
                showGrid: (_c = (_b = (_a = options.grid) === null || _a === void 0 ? void 0 : _a.horzLines) === null || _b === void 0 ? void 0 : _b.visible) !== null && _c !== void 0 ? _c : true
            };
            this.chart.updateOptions(vfcOptions);
        }
        options() {
            const opts = this.chart.getOptions();
            return {
                width: opts.width,
                height: opts.height,
                grid: {
                    horzLines: { visible: this.chart.getShowGrid() }
                }
            };
        }
        resize(width, height) {
            this.chart.resize(width, height);
        }
        remove() {
            this.chart.destroy();
        }
    }

    function createChart(container, options) {
        return new ChartApi(container, options);
    }

    /**
     * Canvas renderer for the Depth of Market (DOM) component.
     * Handles all drawing operations for the DOM ladder.
     */
    /**
     * Default theme for the DOM.
     */
    const DEFAULT_THEME = {
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
        midPriceBackground: '#b8860b', // Dark golden/yellow for mid-price row
        atBidColor: '#2196f3',
        atAskColor: '#ef5350',
        gridColor: '#333333',
        priceColumnBackground: '#252830',
    };
    /**
     * DOMRenderer handles all canvas drawing for the DOM component.
     */
    class DOMRenderer {
        constructor(canvas, theme = {}) {
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
        setTheme(theme) {
            this.theme = { ...DEFAULT_THEME, ...theme };
        }
        /**
         * Render the complete DOM view.
         */
        render(data, options, scrollOffset, columns) {
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
                if (levelIndex < 0 || levelIndex >= data.levels.length)
                    continue;
                const level = data.levels[levelIndex];
                const y = headerHeight + i * rowHeight;
                // Use index comparison for more reliable mid-price detection
                const isMidPrice = levelIndex === midPriceIndex;
                this.renderRow(level, y, rowHeight, columns, maxValues, fontSize, fontFamily, i % 2 === 0, isMidPrice);
            }
            // Render grid lines
            this.renderGridLines(columns, headerHeight, height);
        }
        /**
         * Find the index of the price level closest to mid-price.
         */
        findMidPriceIndex(levels, midPrice) {
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
        renderNoData(width, height, fontSize, fontFamily) {
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
        renderHeaders(columns, rowHeight, fontSize, fontFamily) {
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
        renderRow(level, y, rowHeight, columns, maxValues, fontSize, fontFamily, isEven, isMidPrice) {
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
                        ctx.fillStyle = resolvedColor + 'cc'; // Add opacity
                        if (col.barSide === 'right') {
                            ctx.fillRect((x + 2) * this.dpr, (y + 2) * this.dpr, barWidth * this.dpr, (rowHeight - 4) * this.dpr);
                        }
                        else {
                            ctx.fillRect((x + col.width - 2 - barWidth) * this.dpr, (y + 2) * this.dpr, barWidth * this.dpr, (rowHeight - 4) * this.dpr);
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
        getMaxValueForColumn(colId, maxValues) {
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
        getTextColor(colId, level, theme) {
            switch (colId) {
                case 'sold':
                    return theme.textColor; // Red for Sold volume
                case 'bought':
                    return theme.textColor; // Green for Bought volume
                case 'bid':
                case 'ask':
                case 'deltaVol':
                case 'volume':
                case 'price':
                default:
                    return theme.textColor; // Default text color for other columns
            }
        }
        /**
         * Get X position for text based on alignment.
         */
        getTextX(columnX, columnWidth, align) {
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
        renderGridLines(columns, headerHeight, height) {
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
        resize(width, height) {
            this.canvas.width = width * this.dpr;
            this.canvas.height = height * this.dpr;
            this.canvas.style.width = `${width}px`;
            this.canvas.style.height = `${height}px`;
        }
    }

    /**
     * DOM (Depth of Market) Component
     *
     * Displays a ladder-style view of bid/ask prices with volume visualization.
     * Usage: const dom = new DOM(container, options); dom.setData(data);
     */
    /**
     * Default options for the DOM component.
     */
    const DEFAULT_OPTIONS = {
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
    function createColumns(theme, columnVisibility, pricePrecision) {
        const formatPrice = (price) => {
            if (price >= 1000) {
                return price.toLocaleString('en-US', { minimumFractionDigits: pricePrecision, maximumFractionDigits: pricePrecision });
            }
            return price.toFixed(pricePrecision);
        };
        const columns = [];
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
                    if (level.delta === 0)
                        return '';
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
                barColor: '#555555', // Dark gray bars
                barSide: 'left',
            });
        }
        return columns;
    }
    /**
     * Format volume numbers for display.
     */
    function formatVolume(value) {
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
    class DOM {
        constructor(container, options = {}) {
            this.data = null;
            this.scrollOffset = 0;
            this.animationFrameId = null;
            this.isDragging = false;
            this.lastY = 0;
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
            this.columns = createColumns(this.options.theme, this.options.columns, this.options.pricePrecision);
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
        bindEvents() {
            // Scrolling disabled - mid-price always stays centered
        }
        /**
         * Render the DOM.
         */
        render() {
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
        setData(data) {
            this.data = data;
            this.render();
        }
        /**
         * Update options.
         */
        updateOptions(options) {
            this.options = {
                ...this.options,
                ...options,
                theme: { ...this.options.theme, ...(options.theme || {}) },
                columns: { ...this.options.columns, ...(options.columns || {}) },
            };
            // Recreate columns if visibility or precision changed
            if (options.columns || options.pricePrecision !== undefined) {
                this.columns = createColumns(this.options.theme, this.options.columns, this.options.pricePrecision);
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
        resize(width, height) {
            this.options.width = width;
            this.options.height = height;
            this.renderer.resize(width, height);
            this.render();
        }
        /**
         * Center the view on the mid-price.
         */
        centerOnMidPrice() {
            this.scrollOffset = 0;
            this.render();
        }
        /**
         * Get current data.
         */
        getData() {
            return this.data;
        }
        /**
         * Get current options.
         */
        getOptions() {
            return this.options;
        }
        /**
         * Destroy the DOM component and clean up.
         */
        destroy() {
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
            }
            // Remove canvas from container
            if (this.canvas.parentNode) {
                this.canvas.parentNode.removeChild(this.canvas);
            }
        }
    }

    exports.Aggregator = Aggregator;
    exports.Chart = Chart;
    exports.DOM = DOM;
    exports.Drawing = Drawing;
    exports.Interactions = Interactions;
    exports.Scales = Scales;
    exports.VFC = Chart;
    exports.createChart = createChart;

}));
//# sourceMappingURL=index.js.map
