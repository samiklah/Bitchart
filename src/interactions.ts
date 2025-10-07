import { VFCEvents } from './types';

export class Interactions {
  private canvas: HTMLCanvasElement;
  private margin: { top: number; bottom: number; left: number; right: number };
  private view: { zoomY: number; zoomX: number; offsetRows: number; offsetX: number };
  private events: VFCEvents;
  private momentum = { raf: 0, vx: 0, lastTs: 0, active: false };
  private readonly PAN_INVERT = { x: true, y: false };

  constructor(
    canvas: HTMLCanvasElement,
    margin: { top: number; bottom: number; left: number; right: number },
    view: { zoomY: number; zoomX: number; offsetRows: number; offsetX: number },
    events: VFCEvents
  ) {
    this.canvas = canvas;
    this.margin = margin;
    this.view = view;
    this.events = events;
  }

  handleWheel(e: WheelEvent): void {
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
      this.events.onZoom?.(this.view.zoomX, this.view.zoomY);
    } else if (overChartBody) {
      const prev = this.view.zoomX;
      const factor = (e.deltaY < 0 ? 1.1 : 0.9);
      const next = Math.max(0.1, Math.min(8, prev * factor));
      this.view.zoomX = next;
      this.view.zoomY *= (next / prev); // Also zoom the price axis
      this.view.zoomY = Math.max(0.1, Math.min(8, this.view.zoomY));
      // Adjust offsetX to keep the same startIndex (prevent scrolling)
      this.view.offsetX *= (next / prev);
      this.events.onZoom?.(this.view.zoomX, this.view.zoomY);
    } else if (overTimeline) {
      // Timeline zoom: same mechanism as chart but only affects X axis
      const prev = this.view.zoomX;
      const factor = (e.deltaY < 0 ? 1.1 : 0.9);
      const next = Math.max(0.1, Math.min(8, prev * factor));
      this.view.zoomX = next;
      this.view.offsetX *= (next / prev);
      this.events.onZoom?.(this.view.zoomX, this.view.zoomY);
    }
  }

  handlePointerDown(e: PointerEvent): void {
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

      // 1:1 mouse movement like the original volume_footprint_chart.html
      this.view.offsetX += (this.PAN_INVERT.x ? -dx : dx);
      this.view.offsetRows += (this.PAN_INVERT.y ? -dy : dy) / (22 * this.view.zoomY); // rowHeightPx()
      velX = (this.PAN_INVERT.x ? -dx : dx) / dt;
      this.events.onPan?.(this.view.offsetX, this.view.offsetRows);
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
}