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
         */
        constructor(data, margin, view, canvasWidth, canvasHeight, showVolumeFootprint, TICK, baseRowPx, TEXT_VIS, showCVD = false, cvdHeightRatio = 0.2, deltaTableHeight = 0, footprintStyle = 'bid_ask') {
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
        }
        /** Returns the height of the main price chart area in pixels (excluding margins and CVD). */
        chartHeight() {
            const totalHeight = this.canvasHeight - this.margin.top - this.margin.bottom - this.deltaTableHeight;
            if (!this.showCVD) {
                return totalHeight;
            }
            // Reserve specific ratio for CVD, plus some gap
            return totalHeight * (1 - this.cvdHeightRatio) - 2; // 2px gap
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
                return (15 + 1) * this.view.zoomX; // Candle width + 1px gap when volume footprint is off
            }
            if (this.footprintStyle === 'delta') {
                // Reduced spacing for delta mode (only right-side bars)
                // BASE_CANDLE (15) + BASE_BOX (55) + GAP (~5-10)
                return 75 * this.view.zoomX;
            }
            return 132 * this.view.zoomX; // Standard spacing (Candle + 2 * Box + gaps)
        }
        scaledCandle() {
            return 15 * this.view.zoomX; // BASE_CANDLE * zoomX
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
            return (this.ladderTop - price) / this.TICK + this.view.offsetRows;
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
                out.push({ price: Math.round(price), y: this.priceToY(price) });
            }
            return out;
        }
        formatK(v) {
            return formatNumber(v);
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
            // Use the exact same calculation as the crosshair
            return this.rowIndexToPrice((screenY - this.margin.top) / this.rowHeightPx() + this.view.offsetRows);
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
        constructor(canvas, margin, view, events, crosshair, scales) {
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
                this.view.zoomY = Math.max(0.1, Math.min(8, this.view.zoomY));
                (_b = (_a = this.events).onZoom) === null || _b === void 0 ? void 0 : _b.call(_a, this.view.zoomX, this.view.zoomY);
                this.clearMeasureRectangle();
            }
            else if (overChartBody) {
                const prev = this.view.zoomX;
                const factor = (e.deltaY < 0 ? 1.1 : 0.9);
                const next = Math.max(0.1, Math.min(8, prev * factor));
                this.view.zoomX = next;
                // Reduce price axis zoom sensitivity for smoother transitions
                this.view.zoomY *= Math.pow(factor, 0.7);
                this.view.zoomY = Math.max(0.1, Math.min(8, this.view.zoomY));
                // Adjust offsetX to keep the same startIndex (prevent scrolling)
                this.view.offsetX *= (next / prev);
                (_d = (_c = this.events).onZoom) === null || _d === void 0 ? void 0 : _d.call(_c, this.view.zoomX, this.view.zoomY);
                this.clearMeasureRectangle();
            }
            else if (overTimeline) {
                // Timeline zoom: same mechanism as chart but only affects X axis
                const prev = this.view.zoomX;
                const factor = (e.deltaY < 0 ? 1.1 : 0.9);
                const next = Math.max(0.1, Math.min(8, prev * factor));
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
            const row = scales.priceToRowIndex(f.price);
            const yTop = scales.rowToY(row - 0.5);
            const yBot = scales.rowToY(row + 0.5);
            const h = Math.max(1, yBot - yTop);
            minRow = Math.min(minRow, row - 0.5);
            maxRow = Math.max(maxRow, row + 0.5);
            totBuy += f.buy;
            totSell += f.sell;
            const isPOC = enableProfile && (r === pocIdx);
            // Only draw if the row is visible (within chart bounds)
            const margin = scales.getMargin();
            const chartBottom = margin.top + scales.chartHeight();
            if (yTop >= margin.top && yBot <= chartBottom) {
                ctx.fillStyle = isPOC ? (theme.pocColor || '#808080') : sellRGBA(f.sell);
                ctx.fillRect(leftX, yTop, scales.scaledBox(), h);
                ctx.fillStyle = isPOC ? (theme.pocColor || '#808080') : buyRGBA(f.buy);
                ctx.fillRect(rightX, yTop, scales.scaledBox(), h);
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
        for (let r = 0; r < rows.length; r++) {
            const f = rows[r];
            const row = scales.priceToRowIndex(f.price);
            const yTop = scales.rowToY(row - 0.5);
            const yBot = scales.rowToY(row + 0.5);
            const h = Math.max(1, yBot - yTop);
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
                // Calculate bar width based on Total Volume relative to max in this candle
                // Available width is effectively the whole slot minus margin/wick
                // But scaledBox() returns the width of ONE SIDE (approx 55px).
                // We want to use the full available width on the right of the wick.
                // Wick is at leftX + scaledCandle()/2.
                // Space extends to leftX + scaledCandle()/2 + scaledBox().
                const barWidth = (total / maxTotalVol) * barMaxWidth;
                // Color based on Delta
                const isPos = delta >= 0;
                const color = isPos ? (theme.deltaPositive || '#16a34a') : (theme.deltaNegative || '#dc2626');
                // Opacity based on Delta magnitude relative to max delta
                // Base opacity 0.3, max 1.0
                const opacity = 0.3 + 0.7 * (Math.abs(delta) / maxAbsDelta);
                ctx.fillStyle = color;
                ctx.globalAlpha = opacity;
                // Draw main bar on the right side
                // rightX is the right edge of the candle body
                ctx.fillRect(rightX, yTop, barWidth, h);
                ctx.globalAlpha = 1.0; // Reset alpha
                // Draw Delta Value Text
                if (scales.shouldShowCellText()) {
                    const fontSize = Math.max(8, Math.min(16, 11 * zoomX));
                    ctx.font = `${fontSize}px system-ui`;
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = theme.textColorBright || '#ddd';
                    // Draw text slightly inside or outside depending on width? 
                    // Request said: "show only the delta on the right side of each candle, with bars"
                    // Let's put text just to the right of the bar start, or centered in bar if wide enough?
                    // Standard approach: Text overlaying the bar
                    if (barWidth > 20) {
                        ctx.fillText(scales.formatK(delta), rightX + 2, yTop + h / 2);
                    }
                    else {
                        // If bar is too small, maybe draw outside? Or just draw anyway?
                        // Let's draw it anyway, usually fine.
                        ctx.fillText(scales.formatK(delta), rightX + 2, yTop + h / 2);
                    }
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
    function drawCrosshair(ctx, width, height, margin, crosshair, scales, data, theme) {
        if (!crosshair.visible)
            return;
        const chartRight = width - margin.right;
        const yBottom = margin.top + (height - margin.top - margin.bottom);
        ctx.save();
        // Draw vertical line
        ctx.strokeStyle = theme.textColor || '#aaa';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(crosshair.x, margin.top);
        ctx.lineTo(crosshair.x, yBottom);
        ctx.stroke();
        // Draw horizontal line
        ctx.beginPath();
        ctx.moveTo(margin.left, crosshair.y);
        ctx.lineTo(chartRight, crosshair.y);
        ctx.stroke();
        // Draw price label on right side
        const price = scales.rowIndexToPrice((crosshair.y - margin.top) / scales.rowHeightPx());
        ctx.setLineDash([]);
        ctx.fillStyle = theme.scaleBackground || '#111';
        ctx.fillRect(chartRight, crosshair.y - 8, margin.right, 16);
        ctx.strokeStyle = theme.scaleBorder || '#444';
        ctx.strokeRect(chartRight, crosshair.y - 8, margin.right, 16);
        ctx.fillStyle = theme.textColor || '#aaa';
        ctx.font = 'bold 12px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(scales.formatK(price), chartRight + margin.right / 2, crosshair.y);
        // Draw time label on bottom
        const index = scales.screenXToDataIndex(crosshair.x);
        let timeStr = '--:--';
        if (index >= 0 && index < data.length && data[index]) {
            const date = new Date(data[index].time);
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            timeStr = `${hours}:${minutes}`;
        }
        ctx.fillStyle = theme.scaleBackground || '#111';
        ctx.fillRect(crosshair.x - 20, yBottom, 40, margin.bottom);
        ctx.strokeStyle = theme.scaleBorder || '#444';
        ctx.strokeRect(crosshair.x - 20, yBottom, 40, margin.bottom);
        ctx.fillStyle = theme.textColor || '#aaa';
        ctx.font = '11px system-ui';
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
        ctx.save();
        // Draw dashed line across the chart at the last price level
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = theme.textColor || '#aaa';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(margin.left, y);
        ctx.lineTo(right, y);
        ctx.stroke();
        ctx.setLineDash([]);
        // Draw price label on the price bar (right side scale area)
        const labelText = scales.formatK(lastPrice);
        ctx.font = 'bold 12px system-ui';
        const textWidth = ctx.measureText(labelText).width;
        const boxWidth = textWidth + 8;
        const boxHeight = 18;
        // Position the label in the price bar area
        const boxX = right + 2;
        const boxY = y - boxHeight / 2;
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
        ctx.fillText(labelText, boxX + boxWidth / 2, boxY + boxHeight / 2);
        ctx.restore();
    }

    /**
     * Measurement tool drawing functions for the Volume Footprint Chart.
     * Handles drawing of measurement rectangles and associated data labels.
     */
    /**
     * Draws the measurement rectangle and associated data labels.
     */
    function drawMeasureRectangle(ctx, measureRectangle, scales, theme) {
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
        const startIndex = scales.screenXToDataIndex(startX);
        const endIndex = scales.screenXToDataIndex(endX);
        const priceDiff = endPrice - startPrice;
        const timeDiff = endIndex - startIndex;
        const isPositive = priceDiff >= 0;
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
        const timeSign = timeDiff >= 0 ? '+' : '';
        const timeText = `ΔT: ${timeSign}${timeDiff} bars`;
        const lines = [priceText, startPriceText, endPriceText, timeText];
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
        constructor(ctx, data, margin, view, showGrid, showBounds, showVolumeFootprint, showVolumeHeatmap, volumeHeatmapDynamic, scales, theme, crosshair, lastPrice, interactions, cvdValues = [], showDeltaTable = false, tableRowVisibility = {}, tableRowHeight = 16, footprintStyle = 'bid_ask') {
            this.cvdValues = [];
            this.showDeltaTable = false;
            this.tableRowVisibility = {};
            this.tableRowHeight = 16;
            this.footprintStyle = 'bid_ask';
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
        }
        setShowDeltaTable(show) {
            this.showDeltaTable = show;
        }
        getShowDeltaTable() {
            return this.showDeltaTable;
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
            if (this.showDeltaTable)
                this.drawDeltaTable();
            drawMeasureRectangle(this.ctx, this.interactions.getMeasureRectangle(), this.scales, this.theme);
            this.drawScales(width, height);
            drawCurrentPriceLabel(this.ctx, width, this.lastPrice, this.margin, this.scales, this.theme);
            if (this.crosshair.visible)
                drawCrosshair(this.ctx, width, height, this.margin, this.crosshair, this.scales, this.data, this.theme);
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
            // Calculate previous candle volume for volume change %
            let prevVol = 0;
            // Draw values for each visible candle
            for (let i = vr.startIndex; i < vr.endIndex && i < this.data.length; i++) {
                const candle = this.data[i];
                const cx = this.scales.indexToX(i, vr.startIndex);
                // Calculate totals
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
                        case 'volume':
                            bgColor = '#2a2a2a';
                            textValue = this.scales.formatK(totalVol);
                            break;
                        case 'volChange':
                            bgColor = i === vr.startIndex ? '#2a2a2a' : (volChange >= 0 ? 'rgba(22, 163, 74, 0.5)' : 'rgba(220, 38, 38, 0.5)');
                            textValue = i === vr.startIndex ? '-' : `${volChange.toFixed(1)}%`;
                            break;
                        case 'buyVol':
                            bgColor = 'rgba(22, 163, 74, 0.5)';
                            textValue = this.scales.formatK(totBuy);
                            break;
                        case 'buyVolPercent':
                            bgColor = 'rgba(22, 163, 74, 0.5)';
                            textValue = `${buyPercent.toFixed(1)}%`;
                            break;
                        case 'sellVol':
                            bgColor = 'rgba(220, 38, 38, 0.5)';
                            textValue = this.scales.formatK(totSell);
                            break;
                        case 'sellVolPercent':
                            bgColor = 'rgba(220, 38, 38, 0.5)';
                            textValue = `${sellPercent.toFixed(1)}%`;
                            break;
                        case 'delta':
                            bgColor = delta >= 0 ? 'rgba(22, 163, 74, 0.5)' : 'rgba(220, 38, 38, 0.5)';
                            textValue = this.scales.formatK(delta);
                            break;
                        case 'deltaPercent':
                            bgColor = deltaPercent >= 0 ? 'rgba(22, 163, 74, 0.5)' : 'rgba(220, 38, 38, 0.5)';
                            textValue = `${deltaPercent.toFixed(1)}%`;
                            break;
                        case 'minDelta':
                            bgColor = minDelta >= 0 ? 'rgba(22, 163, 74, 0.5)' : 'rgba(220, 38, 38, 0.5)';
                            textValue = this.scales.formatK(minDelta);
                            break;
                        case 'maxDelta':
                            bgColor = maxDelta >= 0 ? 'rgba(22, 163, 74, 0.5)' : 'rgba(220, 38, 38, 0.5)';
                            textValue = this.scales.formatK(maxDelta);
                            break;
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
            for (const { price, y } of labels) {
                this.ctx.fillText(this.scales.formatK(price), right + this.margin.right / 2, y);
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
            // Find the most common smallest difference
            if (priceDifferences.size === 0)
                return 10;
            const sortedDiffs = Array.from(priceDifferences).sort((a, b) => a - b);
            const smallestDiff = sortedDiffs[0];
            // For crypto data, ensure tick size is reasonable (at least 0.1 for most pairs)
            // If detected tick is too small, round up to a reasonable value
            if (smallestDiff < 0.1) {
                // Round to nearest 0.1, 0.5, or 1.0
                if (smallestDiff < 0.25)
                    return 0.1;
                if (smallestDiff < 0.75)
                    return 0.5;
                return 1.0;
            }
            return smallestDiff; // Return the smallest detected tick size
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
            tableRows.forEach(row => {
                const label = document.createElement('label');
                label.style.cssText = 'display:block;margin:4px 0;cursor:pointer;';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = true;
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
            var _a, _b, _c, _d, _e, _f, _g;
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
                    minDelta: true,
                    maxDelta: true,
                    poc: true,
                    hlRange: true
                },
                tableRowHeight: options.tableRowHeight || 16,
                footprintStyle: options.footprintStyle || 'bid_ask'
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
        initializeModules() {
            var _a, _b;
            this.scales = new Scales(this.data, this.margin, this.view, this.options.width, this.options.height, this.showVolumeFootprint, this.TICK, this.baseRowPx, this.TEXT_VIS, this.showCVD, (_a = this.options.cvdHeightRatio) !== null && _a !== void 0 ? _a : 0.2, this.getDeltaTableHeight(), this.options.footprintStyle);
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
            }, this.crosshair, this.scales);
            this.drawing = new Drawing(this.ctx, this.data, this.margin, this.view, this.showGrid, this.showBounds, this.showVolumeFootprint, this.showVolumeHeatmap, this.volumeHeatmapDynamic, this.scales, this.options.theme, this.crosshair, this.lastPrice, this.interactions, this.cvdValues, this.showDeltaTable, this.options.tableRowVisibility, (_b = this.options.tableRowHeight) !== null && _b !== void 0 ? _b : 16, this.options.footprintStyle);
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
            var _a, _b;
            const container = this.canvas.parentElement;
            if (container) {
                this.options.width = container.clientWidth || this.options.width;
                this.options.height = container.clientHeight || this.options.height;
            }
            // Recreate scales and drawing with new dimensions
            this.scales = new Scales(this.data, this.margin, this.view, this.options.width, this.options.height, this.showVolumeFootprint, this.TICK, this.baseRowPx, this.TEXT_VIS, this.showCVD, (_a = this.options.cvdHeightRatio) !== null && _a !== void 0 ? _a : 0.2, this.getDeltaTableHeight(), this.options.footprintStyle);
            this.drawing = new Drawing(this.ctx, this.data, this.margin, this.view, this.showGrid, this.showBounds, this.showVolumeFootprint, this.showVolumeHeatmap, this.volumeHeatmapDynamic, this.scales, this.options.theme, this.crosshair, this.lastPrice, this.interactions, this.cvdValues, this.showDeltaTable, this.options.tableRowVisibility, (_b = this.options.tableRowHeight) !== null && _b !== void 0 ? _b : 16, this.options.footprintStyle);
            this.setupCanvas();
            this.drawing.drawAll();
        }
        // Public API
        setData(data) {
            var _a, _b;
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
            this.scales = new Scales(this.data, this.margin, this.view, this.options.width, this.options.height, this.showVolumeFootprint, this.TICK, this.baseRowPx, this.TEXT_VIS, this.showCVD, (_a = this.options.cvdHeightRatio) !== null && _a !== void 0 ? _a : 0.2, this.getDeltaTableHeight(), this.options.footprintStyle);
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
                const centerRow = (this.options.height / 2) / this.scales.rowHeightPx();
                const priceRow = this.scales.priceToRowIndex(lastPrice); // with current offsetRows=0
                this.view.offsetRows = centerRow - priceRow;
            }
            // Calculate CVD values AFTER scales and view are set
            console.log('setData: calling calculateCVD');
            this.calculateCVD();
            console.log('setData: CVD values calculated, length:', this.cvdValues.length);
            this.drawing = new Drawing(this.ctx, this.data, this.margin, this.view, this.showGrid, this.showBounds, this.showVolumeFootprint, this.showVolumeHeatmap, this.volumeHeatmapDynamic, this.scales, this.options.theme, this.crosshair, this.lastPrice, this.interactions, this.cvdValues, this.showDeltaTable, this.options.tableRowVisibility, (_b = this.options.tableRowHeight) !== null && _b !== void 0 ? _b : 16, this.options.footprintStyle);
            this.drawing.drawAll();
        }
        updateOptions(options) {
            var _a, _b, _c, _d, _e;
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
            this.scales = new Scales(this.data, this.margin, this.view, this.options.width, this.options.height, this.showVolumeFootprint, this.TICK, this.baseRowPx, this.TEXT_VIS, this.showCVD, (_d = this.options.cvdHeightRatio) !== null && _d !== void 0 ? _d : 0.2, this.getDeltaTableHeight(), this.options.footprintStyle);
            // Recalculate CVD if needed (e.g. type changed, or just to be safe with new scales)
            if (this.showCVD) {
                this.calculateCVD();
            }
            // Update Interactions with the new Scales instance
            this.interactions.setScales(this.scales);
            this.drawing = new Drawing(this.ctx, this.data, this.margin, this.view, this.showGrid, this.showBounds, this.showVolumeFootprint, this.showVolumeHeatmap, this.volumeHeatmapDynamic, this.scales, this.options.theme, this.crosshair, this.lastPrice, this.interactions, this.cvdValues, this.showDeltaTable, this.options.tableRowVisibility, (_e = this.options.tableRowHeight) !== null && _e !== void 0 ? _e : 16, this.options.footprintStyle);
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
            var _a, _b, _c;
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
            this.scales = new Scales(this.data, this.margin, this.view, this.options.width, this.options.height, this.showVolumeFootprint, this.TICK, this.baseRowPx, this.TEXT_VIS, this.showCVD, (_b = this.options.cvdHeightRatio) !== null && _b !== void 0 ? _b : 0.2, this.getDeltaTableHeight(), this.options.footprintStyle);
            this.drawing = new Drawing(this.ctx, this.data, this.margin, this.view, this.showGrid, this.showBounds, this.showVolumeFootprint, this.showVolumeHeatmap, this.volumeHeatmapDynamic, this.scales, this.options.theme, this.crosshair, this.lastPrice, this.interactions, this.cvdValues, this.showDeltaTable, this.options.tableRowVisibility, (_c = this.options.tableRowHeight) !== null && _c !== void 0 ? _c : 16);
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
            this.drawing.drawAll();
        }
        // Getters for API access
        getOptions() { return this.options; }
        getShowGrid() { return this.showGrid; }
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

    exports.Aggregator = Aggregator;
    exports.Chart = Chart;
    exports.Drawing = Drawing;
    exports.Interactions = Interactions;
    exports.Scales = Scales;
    exports.VFC = Chart;
    exports.createChart = createChart;

}));
//# sourceMappingURL=index.js.map
