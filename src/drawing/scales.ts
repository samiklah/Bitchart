/**
 * Scale and axis drawing functions for the Volume Footprint Chart.
 * Handles rendering of price bars, timeline, and related scale elements.
 */

import { Scales } from '../scales';

/**
 * Draws the price bar on the right side and price labels.
 */
export function drawPriceBar(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  margin: any,
  scales: Scales,
  theme: any
): void {
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
export function drawTimeline(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  margin: any,
  scales: Scales,
  data: any[],
  theme: any
): void {
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
    let date: Date;
    if (i < data.length && data[i]) {
      date = new Date(data[i].time);
    } else {
      // Extrapolate future times based on data intervals
      if (data.length > 1) {
        const lastTime = new Date(data[data.length - 1].time).getTime();
        const prevTime = new Date(data[data.length - 2].time).getTime();
        const interval = lastTime - prevTime; // Time between last two data points
        date = new Date(lastTime + (i - data.length + 1) * interval);
      } else {
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
export function drawScales(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  margin: any,
  scales: Scales,
  data: any[],
  theme: any
): void {
  drawPriceBar(ctx, width, height, margin, scales, theme);
  drawTimeline(ctx, width, height, margin, scales, data, theme);
}