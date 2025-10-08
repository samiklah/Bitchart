/**
 * Grid and bounds drawing functions for the Volume Footprint Chart.
 * Handles background grid lines and chart boundary visualization.
 */

import { Scales } from '../scales';

/**
 * Draws the background grid lines.
 */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  margin: any,
  scales: Scales,
  theme: any
): void {
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
export function drawBounds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  margin: any,
  scales: Scales
): void {
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