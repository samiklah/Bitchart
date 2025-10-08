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
        return Math.round(v).toString();
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
         */
        constructor(data, margin, view, canvasWidth, canvasHeight, showVolumeFootprint, TICK, baseRowPx, TEXT_VIS) {
            this.data = [];
            this.data = data;
            this.margin = margin;
            this.view = view;
            this.canvasWidth = canvasWidth;
            this.canvasHeight = canvasHeight;
            this.showVolumeFootprint = showVolumeFootprint;
            this.TICK = TICK;
            this.baseRowPx = baseRowPx;
            this.TEXT_VIS = TEXT_VIS;
        }
        /** Returns the height of the chart area in pixels (excluding margins). */
        chartHeight() {
            return this.canvasHeight - this.margin.top - this.margin.bottom;
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
            return 132 * this.view.zoomX; // Reduced spacing for closer candle layout
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
        indexToX(i, startIndex) {
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
            const relativeX = screenX - this.margin.left + this.xShift - s / 2;
            return vr.startIndex + Math.floor(relativeX / s);
        }
        // Exact fractional data index for precise drawing coordinates
        screenXToExactDataIndex(screenX) {
            const vr = this.getVisibleRange();
            const s = this.scaledSpacing();
            const relativeX = screenX - this.margin.left + this.xShift - s / 2;
            return vr.startIndex + relativeX / s;
        }
        screenYToPrice(screenY) {
            // Use the exact same calculation as the crosshair
            return this.rowIndexToPrice((screenY - this.margin.top) / this.rowHeightPx() + this.view.offsetRows);
        }
        get ladderTop() {
            if (this.data.length === 0)
                return 10000;
            return Math.ceil(Math.max(...this.data.map(c => c.high)) / this.TICK) * this.TICK + 10 * this.TICK;
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
            const yBottom = this.margin.top + 600 - this.margin.top - this.margin.bottom; // chartHeight
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
                this.view.zoomY *= (next / prev); // Also zoom the price axis
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
                // 1:1 mouse movement like the original volume_footprint_chart.html
                this.view.offsetX += (this.PAN_INVERT.x ? -dx : dx);
                this.view.offsetRows += (this.PAN_INVERT.y ? -dy : dy) / (22 * this.view.zoomY); // rowHeightPx()
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
        getMeasureRectangle() {
            return this.measureRectangle;
        }
        clearMeasureRectangle() {
            this.measureRectangle = null;
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
            // Check if mouse is over the chart area
            const chartRight = this.canvas.clientWidth - this.margin.right;
            const canvasHeight = this.canvas.height / window.devicePixelRatio;
            const yBottom = canvasHeight - this.margin.bottom;
            const overChartBody = x >= this.margin.left && x <= chartRight &&
                y >= this.margin.top && y <= yBottom;
            if (overChartBody) {
                this.crosshair.x = x;
                this.crosshair.y = y;
                this.crosshair.visible = true;
            }
            else {
                this.crosshair.visible = false;
            }
            // Trigger redraw
            (_b = (_a = this.events).onMouseMove) === null || _b === void 0 ? void 0 : _b.call(_a, x, y, this.crosshair.visible);
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
            ctx.fillStyle = isPOC ? (theme.pocColor || '#808080') : sellRGBA(f.sell);
            ctx.fillRect(leftX, yTop, scales.scaledBox(), h);
            ctx.fillStyle = isPOC ? (theme.pocColor || '#808080') : buyRGBA(f.buy);
            ctx.fillRect(rightX, yTop, scales.scaledBox(), h);
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
        ctx.beginPath();
        ctx.moveTo(leftX, yVah);
        ctx.lineTo(rightEdge, yVah);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(leftX, yVal);
        ctx.lineTo(rightEdge, yVal);
        ctx.stroke();
        ctx.setLineDash([]);
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
    function drawDeltaTotalLabels(ctx, cx, maxRow, totBuy, totSell, totalVol, scales, theme, zoomX) {
        const yLowFootprint = scales.rowToY(maxRow) + 2;
        const delta = totBuy - totSell;
        const deltaFontSize = Math.max(8, Math.min(18, 12 * zoomX));
        ctx.textAlign = 'center';
        ctx.font = `${deltaFontSize}px system-ui`;
        ctx.fillStyle = delta >= 0 ? (theme.deltaPositive || '#16a34a') : (theme.deltaNegative || '#dc2626');
        ctx.fillText(`Delta ${scales.formatK(delta)}`, cx, yLowFootprint + 14);
        ctx.fillStyle = theme.totalColor || '#fff';
        ctx.fillText(`Total ${scales.formatK(totalVol)}`, cx, yLowFootprint + 32);
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
    function drawFootprint(ctx, candle, i, startIndex, scales, theme, view, showVolumeFootprint) {
        const cx = scales.indexToX(i, startIndex);
        const half = scales.scaledCandle() / 2;
        if (showVolumeFootprint) {
            const rows = candle.footprint.slice().sort((a, b) => b.price - a.price);
            const enableProfile = rows.length > 3;
            const { pocIdx, vahIdx, valIdx, VAH, VAL, totalVol } = computeVolumeArea(rows);
            const leftX = cx - half - scales.scaledBox();
            const rightX = cx + half;
            // Draw footprint boxes and calculate totals
            const { minRow, maxRow, totBuy, totSell } = drawFootprintBoxes(ctx, rows, pocIdx, enableProfile, leftX, rightX, scales, theme);
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
            // Draw delta and total volume labels
            if (scales.shouldShowCellText()) {
                drawDeltaTotalLabels(ctx, cx, maxRow, totBuy, totSell, totalVol, scales, theme, view.zoomX);
            }
        }
        // Draw candle wick and body
        drawCandleWickAndBody(ctx, cx, half, candle, scales, theme);
    }

    /**
     * Scale and axis drawing functions for the Volume Footprint Chart.
     * Handles rendering of price bars, timeline, and related scale elements.
     */
    /**
     * Draws the price bar on the right side and price labels.
     */
    function drawPriceBar(ctx, width, height, margin, scales, theme) {
        const right = width - margin.right;
        ctx.fillStyle = theme.scaleBackground || '#111';
        ctx.fillRect(right, 0, margin.right, height);
        ctx.strokeStyle = theme.scaleBorder || '#444';
        ctx.strokeRect(right + 0.5, margin.top, 0.5, height - margin.top - margin.bottom);
        // Price labels
        ctx.fillStyle = theme.textColor || '#aaa';
        ctx.font = '12px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const labels = scales.computePriceBarLabels();
        for (const { price, y } of labels) {
            ctx.fillText(scales.formatK(price), right + margin.right / 2, y);
        }
    }
    /**
     * Draws the timeline at the bottom with time labels.
     */
    function drawTimeline(ctx, width, height, margin, scales, data, theme) {
        const bottomY = margin.top + (height - margin.top - margin.bottom);
        const chartW = width - margin.left - margin.right;
        ctx.fillStyle = theme.scaleBackground || '#111';
        ctx.fillRect(margin.left, bottomY, chartW, margin.bottom);
        ctx.strokeStyle = theme.scaleBorder || '#444';
        ctx.beginPath();
        ctx.moveTo(margin.left, bottomY + 0.5);
        ctx.lineTo(margin.left + chartW, bottomY + 0.5);
        ctx.stroke();
        // Timeline labels - extended to show future times
        ctx.save();
        ctx.beginPath();
        ctx.rect(margin.left, bottomY, chartW, margin.bottom);
        ctx.clip();
        ctx.fillStyle = theme.textColor || '#aaa';
        ctx.font = '12px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const step = Math.max(1, Math.floor(120 / scales.scaledSpacing()));
        const vr = scales.getVisibleRange();
        // Extend timeline to show future times beyond current data
        const extendedStart = Math.max(0, vr.startIndex - 10);
        const extendedEnd = vr.endIndex + 30; // Show 30 future time slots
        for (let i = extendedStart; i < extendedEnd; i += step) {
            const x = scales.indexToX(i, vr.startIndex);
            let date;
            if (i < data.length && data[i]) {
                date = new Date(data[i].time);
            }
            else {
                // Extrapolate future times based on data intervals
                if (data.length > 1) {
                    const lastTime = new Date(data[data.length - 1].time).getTime();
                    const prevTime = new Date(data[data.length - 2].time).getTime();
                    const interval = lastTime - prevTime; // Time between last two data points
                    date = new Date(lastTime + (i - data.length + 1) * interval);
                }
                else {
                    // Fallback: assume 1 minute intervals
                    const lastTime = data.length > 0 ?
                        new Date(data[data.length - 1].time).getTime() :
                        Date.now();
                    date = new Date(lastTime + (i - Math.max(0, data.length - 1)) * 60000);
                }
            }
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            const t = `${hours}:${minutes}`;
            ctx.fillText(t, x, bottomY + margin.bottom / 2);
        }
        ctx.restore();
    }
    /**
     * Draws the complete scales (price bar and timeline).
     */
    function drawScales(ctx, width, height, margin, scales, data, theme) {
        drawPriceBar(ctx, width, height, margin, scales, theme);
        drawTimeline(ctx, width, height, margin, scales, data, theme);
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
        constructor(ctx, data, margin, view, showGrid, showBounds, showVolumeFootprint, scales, theme, crosshair, lastPrice, interactions) {
            this.ctx = ctx;
            this.data = data;
            this.margin = margin;
            this.view = view;
            this.showGrid = showGrid;
            this.showBounds = showBounds;
            this.showVolumeFootprint = showVolumeFootprint;
            this.scales = scales;
            this.theme = theme;
            this.crosshair = crosshair;
            this.lastPrice = lastPrice;
            this.interactions = interactions;
        }
        drawAll() {
            const width = this.ctx.canvas.width / window.devicePixelRatio;
            const height = this.ctx.canvas.height / window.devicePixelRatio;
            this.ctx.clearRect(0, 0, width, height);
            if (this.showGrid)
                drawGrid(this.ctx, width, this.margin, this.scales, this.theme);
            this.drawChart();
            drawMeasureRectangle(this.ctx, this.interactions.getMeasureRectangle(), this.scales, this.theme);
            drawScales(this.ctx, width, height, this.margin, this.scales, this.data, this.theme);
            drawCurrentPriceLabel(this.ctx, width, this.lastPrice, this.margin, this.scales, this.theme);
            if (this.crosshair.visible)
                drawCrosshair(this.ctx, width, height, this.margin, this.crosshair, this.scales, this.data, this.theme);
            if (this.showBounds)
                drawBounds(this.ctx, width, height, this.margin, this.scales);
        }
        drawChart() {
            this.ctx.save();
            const width = this.ctx.canvas.width / window.devicePixelRatio;
            this.ctx.beginPath();
            this.ctx.rect(this.margin.left, this.margin.top, width - this.margin.left - this.margin.right, this.scales.chartHeight());
            this.ctx.clip();
            const vr = this.scales.getVisibleRange();
            for (let i = vr.startIndex; i < vr.endIndex; i++) {
                drawFootprint(this.ctx, this.data[i], i, vr.startIndex, this.scales, this.theme, this.view, this.showVolumeFootprint);
            }
            this.ctx.restore();
        }
    }

    /**
     * Main chart implementation for the Volume Footprint Chart.
     * Provides the primary API for creating and managing chart instances with modular components.
     */
    class Chart {
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
            const toggleVolumeFootprintBtn = document.createElement('button');
            toggleVolumeFootprintBtn.id = 'toggleVolumeFootprint';
            toggleVolumeFootprintBtn.className = 'tool-btn';
            toggleVolumeFootprintBtn.textContent = 'Volume On/Off';
            topToolbar.appendChild(toggleVolumeFootprintBtn);
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
        setupToolbarEventHandlers(container) {
            const resetZoomBtn = container.querySelector('#resetZoom');
            const toggleGridBtn = container.querySelector('#toggleGrid');
            const toggleVolumeFootprintBtn = container.querySelector('#toggleVolumeFootprint');
            const measureBtn = container.querySelector('#measure');
            // Store references for later use
            this.resetZoomBtn = resetZoomBtn;
            this.toggleGridBtn = toggleGridBtn;
            this.toggleVolumeFootprintBtn = toggleVolumeFootprintBtn;
            this.measureBtn = measureBtn;
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
            var _a, _b, _c;
            this.options = {
                width: options.width || container.clientWidth || 800,
                height: options.height || (chartContainer ? chartContainer.clientHeight : container.clientHeight) || 600,
                showGrid: (_a = options.showGrid) !== null && _a !== void 0 ? _a : true,
                showBounds: (_b = options.showBounds) !== null && _b !== void 0 ? _b : false,
                showVolumeFootprint: (_c = options.showVolumeFootprint) !== null && _c !== void 0 ? _c : true,
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
            this.view.zoomX = this.options.initialZoomX;
            this.view.zoomY = this.options.initialZoomY;
        }
        /**
         * Initializes the chart modules (Scales, Interactions, Drawing).
         */
        initializeModules() {
            this.scales = new Scales(this.data, this.margin, this.view, this.options.width, this.options.height, this.showVolumeFootprint, this.TICK, this.baseRowPx, this.TEXT_VIS);
            this.interactions = new Interactions(this.canvas, this.margin, this.view, {
                ...this.events,
                onPan: () => this.drawing.drawAll(),
                onZoom: () => this.drawing.drawAll(),
                onMouseMove: () => this.drawing.drawAll()
            }, this.crosshair, this.scales);
            this.drawing = new Drawing(this.ctx, this.data, this.margin, this.view, this.showGrid, this.showBounds, this.showVolumeFootprint, this.scales, this.options.theme, this.crosshair, this.lastPrice, this.interactions);
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
            this.crosshair = { x: -1, y: -1, visible: false };
            this.lastPrice = null;
            // Toolbar button references
            this.resetZoomBtn = null;
            this.toggleGridBtn = null;
            this.toggleVolumeFootprintBtn = null;
            this.measureBtn = null;
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
            // Initialize modules
            this.initializeModules();
            // Set up canvas and event handlers
            this.setupCanvas();
            this.bindEvents();
            this.bindToolbarEvents();
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
            if (this.toggleVolumeFootprintBtn) {
                this.toggleVolumeFootprintBtn.addEventListener('click', () => {
                    this.updateOptions({
                        showVolumeFootprint: !this.options.showVolumeFootprint
                    });
                });
            }
            if (this.measureBtn) {
                this.measureBtn.addEventListener('click', () => {
                    var _a, _b;
                    const isActive = this.interactions.getMeasureRectangle() !== null;
                    if (isActive) {
                        this.interactions.setMeasureMode(false);
                        (_a = this.measureBtn) === null || _a === void 0 ? void 0 : _a.classList.remove('active');
                    }
                    else {
                        this.interactions.setMeasureMode(true);
                        (_b = this.measureBtn) === null || _b === void 0 ? void 0 : _b.classList.add('active');
                    }
                    this.drawing.drawAll();
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
            const container = this.canvas.parentElement;
            if (container) {
                this.options.width = container.clientWidth || this.options.width;
                this.options.height = container.clientHeight || this.options.height;
            }
            // Recreate scales and drawing with new dimensions
            this.scales = new Scales(this.data, this.margin, this.view, this.options.width, this.options.height, this.showVolumeFootprint, this.TICK, this.baseRowPx, this.TEXT_VIS);
            this.drawing = new Drawing(this.ctx, this.data, this.margin, this.view, this.showGrid, this.showBounds, this.showVolumeFootprint, this.scales, this.options.theme, this.crosshair, this.lastPrice, this.interactions);
            this.setupCanvas();
            this.drawing.drawAll();
        }
        // Public API
        setData(data) {
            this.data = data;
            // Calculate lastPrice first, before creating Drawing instance
            if (data.length > 0) {
                const lastPrice = data[data.length - 1].close;
                this.lastPrice = lastPrice;
            }
            // Update scales with new data
            this.scales = new Scales(this.data, this.margin, this.view, this.options.width, this.options.height, this.showVolumeFootprint, this.TICK, this.baseRowPx, this.TEXT_VIS);
            this.drawing = new Drawing(this.ctx, this.data, this.margin, this.view, this.showGrid, this.showBounds, this.showVolumeFootprint, this.scales, this.options.theme, this.crosshair, this.lastPrice, // Now has the correct value
            this.interactions);
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
            this.drawing.drawAll();
        }
        updateOptions(options) {
            const oldShowVolumeFootprint = this.showVolumeFootprint;
            Object.assign(this.options, options);
            this.showGrid = this.options.showGrid;
            this.showBounds = this.options.showBounds;
            this.showVolumeFootprint = this.options.showVolumeFootprint;
            // If showVolumeFootprint changed, adjust view offsetX to maintain visible range
            if (oldShowVolumeFootprint !== this.showVolumeFootprint && this.data.length > 0) {
                const oldSpacing = oldShowVolumeFootprint ? 132 * this.view.zoomX : 16 * this.view.zoomX;
                const newSpacing = this.showVolumeFootprint ? 132 * this.view.zoomX : 16 * this.view.zoomX;
                const startIndex = Math.floor(this.view.offsetX / oldSpacing);
                this.view.offsetX = startIndex * newSpacing;
            }
            // Recreate Scales first, then Drawing
            this.scales = new Scales(this.data, this.margin, this.view, this.options.width, this.options.height, this.showVolumeFootprint, this.TICK, this.baseRowPx, this.TEXT_VIS);
            this.drawing = new Drawing(this.ctx, this.data, this.margin, this.view, this.showGrid, this.showBounds, this.showVolumeFootprint, this.scales, this.options.theme, this.crosshair, this.lastPrice, this.interactions);
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

    exports.Chart = Chart;
    exports.Drawing = Drawing;
    exports.Interactions = Interactions;
    exports.Scales = Scales;
    exports.VFC = Chart;
    exports.createChart = createChart;

}));
//# sourceMappingURL=index.js.map
