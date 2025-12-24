/**
 * Manages user interactions and input handling for the Volume Footprint Chart.
 * Processes mouse/touch events, wheel zooming, panning, and measurement tools.
 */

import { VFCEvents, MeasureRectangle } from './types';
import { Scales } from './scales';

/**
 * Handles user interactions with the chart, including mouse/touch events, zooming, panning, and measuring.
 * Manages crosshair positioning, momentum scrolling, and measurement tools.
 */
export class Interactions {
  private canvas: HTMLCanvasElement;
  private margin: { top: number; bottom: number; left: number; right: number };
  private view: { zoomY: number; zoomX: number; offsetRows: number; offsetX: number };
  private events: VFCEvents & { onCvdResize?: (ratio: number) => void };
  private crosshair: { x: number; y: number; visible: boolean };
  private momentum = { raf: 0, vx: 0, lastTs: 0, active: false };
  private readonly PAN_INVERT = { x: true, y: false };
  private scales: Scales;

  // CVD resize state
  private isDraggingCvdDivider = false;
  private cvdDividerHitZone = 6; // pixels around the divider that are draggable

  // Measure state
  private isMeasureMode = false;
  private measureRectangle: MeasureRectangle | null = null;

  /**
   * Creates an Interactions instance to handle user input for the chart.
   * @param canvas The HTML canvas element
   * @param margin Chart margin configuration
   * @param view Current view state (zoom and offset)
   * @param events Event callbacks
   * @param crosshair Crosshair position state
   * @param scales Scales instance for coordinate conversions
   */
  constructor(
    canvas: HTMLCanvasElement,
    margin: { top: number; bottom: number; left: number; right: number },
    view: { zoomY: number; zoomX: number; offsetRows: number; offsetX: number },
    events: VFCEvents & { onCvdResize?: (ratio: number) => void },
    crosshair: { x: number; y: number; visible: boolean },
    scales: Scales
  ) {
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
  handleWheel(e: WheelEvent): void {
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
      this.events.onZoom?.(this.view.zoomX, this.view.zoomY);
      this.clearMeasureRectangle();
    } else if (overChartBody) {
      const prev = this.view.zoomX;
      const factor = (e.deltaY < 0 ? 1.1 : 0.9);
      const next = Math.max(0.1, Math.min(8, prev * factor));
      this.view.zoomX = next;
      // Reduce price axis zoom sensitivity for smoother transitions
      this.view.zoomY *= Math.pow(factor, 0.7);
      this.view.zoomY = Math.max(0.1, Math.min(8, this.view.zoomY));
      // Adjust offsetX to keep the same startIndex (prevent scrolling)
      this.view.offsetX *= (next / prev);
      this.events.onZoom?.(this.view.zoomX, this.view.zoomY);
      this.clearMeasureRectangle();
    } else if (overTimeline) {
      // Timeline zoom: same mechanism as chart but only affects X axis
      const prev = this.view.zoomX;
      const factor = (e.deltaY < 0 ? 1.1 : 0.9);
      const next = Math.max(0.1, Math.min(8, prev * factor));
      this.view.zoomX = next;
      this.view.offsetX *= (next / prev);
      this.events.onZoom?.(this.view.zoomX, this.view.zoomY);
      this.clearMeasureRectangle();
    }
  }

  handlePointerDown(e: PointerEvent): void {
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

    // Check if we're in measure mode
    if (this.isMeasureMode) {
      this.handleMeasurePointerDown(e, x, y);
      return;
    }

    // Normal pan mode
    this.canvas.setPointerCapture(e.pointerId);
    let lastX = e.clientX;
    let lastY = e.clientY;
    let velX = 0;
    let lastT = performance.now();

    const onMove = (ev: PointerEvent) => {
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
      velX = (this.PAN_INVERT.x ? -dx : dx) / dt;
      this.events.onPan?.(this.view.offsetX, this.view.offsetRows);
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


  private handleMeasurePointerDown(e: PointerEvent, x: number, y: number): void {
    // Check if we're over the chart area
    const chartRight = this.canvas.clientWidth - this.margin.right;
    const canvasHeight = this.canvas.height / window.devicePixelRatio;
    const yBottom = canvasHeight - this.margin.bottom;

    const overChartBody = x >= this.margin.left && x <= chartRight &&
      y >= this.margin.top && y <= yBottom;

    if (!overChartBody) return;

    this.canvas.setPointerCapture(e.pointerId);

    // Start measuring from this point - store screen coordinates directly
    this.measureRectangle = {
      startX: x,
      startY: y,
      endX: x,
      endY: y
    };

    const onMove = (ev: PointerEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      const currentX = ev.clientX - rect.left;
      const currentY = ev.clientY - rect.top;

      // Update the end point of the measure rectangle
      if (this.measureRectangle) {
        this.measureRectangle.endX = currentX;
        this.measureRectangle.endY = currentY;
      }

      // Trigger redraw
      this.events.onMouseMove?.(currentX, currentY, true);
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
  setMeasureMode(enabled: boolean): void {
    this.isMeasureMode = enabled;
    if (!enabled) {
      this.measureRectangle = null;
    }
  }

  getMeasureMode(): boolean {
    return this.isMeasureMode;
  }

  getMeasureRectangle(): MeasureRectangle | null {
    return this.measureRectangle;
  }

  clearMeasureRectangle(): void {
    this.measureRectangle = null;
  }

  /** Updates the scales reference when options change */
  setScales(scales: Scales): void {
    this.scales = scales;
  }

  private handleCvdDividerDrag(e: PointerEvent, rect: DOMRect): void {
    this.isDraggingCvdDivider = true;
    this.canvas.setPointerCapture(e.pointerId);
    this.canvas.style.cursor = 'ns-resize';

    const canvasHeight = this.canvas.height / window.devicePixelRatio;
    const availableHeight = canvasHeight - this.margin.top - this.margin.bottom;

    const onMove = (ev: PointerEvent) => {
      const y = ev.clientY - rect.top;
      // Calculate new ratio based on where the divider is dragged
      // CVD is at the bottom, so we calculate how much space is below the drag point
      const cvdHeight = canvasHeight - this.margin.bottom - y;
      let newRatio = cvdHeight / availableHeight;
      // Clamp the ratio between 0.1 and 0.6
      newRatio = Math.max(0.1, Math.min(0.6, newRatio));
      this.events.onCvdResize?.(newRatio);
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

  private cancelMomentum(): void {
    if (this.momentum.raf) {
      cancelAnimationFrame(this.momentum.raf);
      this.momentum.raf = 0;
    }
    this.momentum.active = false;
  }

  private startMomentum(vx: number): void {
    this.momentum.vx = vx;
    this.momentum.lastTs = 0;
    this.momentum.active = true;
    if (!this.momentum.raf) {
      this.momentum.raf = requestAnimationFrame(this.stepMomentum.bind(this));
    }
  }

  private stepMomentum(ts: number): void {
    if (!this.momentum.active) {
      this.momentum.raf = 0;
      return;
    }
    if (!this.momentum.lastTs) this.momentum.lastTs = ts;
    const dt = ts - this.momentum.lastTs;
    this.momentum.lastTs = ts;
    this.view.offsetX += this.momentum.vx * dt;
    this.momentum.vx *= 0.98;
    if (Math.abs(this.momentum.vx) < 0.001) {
      this.cancelMomentum();
    }
  }

  private setupMouseTracking(): void {
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
  }

  private handleMouseMove(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if mouse is over CVD divider
    const cvdHeight = this.scales.cvdHeight();
    const cvdOriginY = this.scales.cvdOriginY();
    if (cvdHeight > 0 && Math.abs(y - cvdOriginY) <= this.cvdDividerHitZone) {
      this.canvas.style.cursor = 'ns-resize';
    } else if (!this.isDraggingCvdDivider) {
      this.canvas.style.cursor = '';
    }

    // Check if mouse is over the chart area
    const chartRight = this.canvas.clientWidth - this.margin.right;
    const canvasHeight = this.canvas.height / window.devicePixelRatio;
    const yBottom = canvasHeight - this.margin.bottom;

    const overChartBody = x >= this.margin.left && x <= chartRight &&
      y >= this.margin.top && y <= yBottom;

    const wasVisible = this.crosshair.visible;
    if (overChartBody) {
      this.crosshair.x = x;
      this.crosshair.y = y;
      this.crosshair.visible = true;
    } else {
      this.crosshair.visible = false;
    }

    // Only trigger redraw when crosshair state changes to avoid excessive redraws
    if (this.crosshair.visible !== wasVisible || this.crosshair.visible) {
      this.events.onMouseMove?.(x, y, this.crosshair.visible);
    }
  }

  private handleMouseLeave(): void {
    this.crosshair.visible = false;
    this.events.onMouseMove?.(-1, -1, false);
  }
}