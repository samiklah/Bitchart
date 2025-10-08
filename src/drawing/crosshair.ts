/**
 * Crosshair and price label drawing functions for the Volume Footprint Chart.
 * Handles cursor tracking and current price display.
 */

import { Scales } from '../scales';

/**
 * Draws the crosshair lines and labels at the current mouse position.
 */
export function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  margin: any,
  crosshair: { x: number; y: number; visible: boolean },
  scales: Scales,
  data: any[],
  theme: any
): void {
  if (!crosshair.visible) return;

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
  const price = scales.rowIndexToPrice(
    (crosshair.y - margin.top) / scales.rowHeightPx()
  );
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
export function drawCurrentPriceLabel(
  ctx: CanvasRenderingContext2D,
  width: number,
  lastPrice: number | null,
  margin: any,
  scales: Scales,
  theme: any
): void {
  if (!lastPrice) return;

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
  ctx.fillStyle = '#26a69a';  // Green background like in the image
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

  // Draw border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

  // Draw price text
  ctx.fillStyle = '#ffffff';  // White text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(labelText, boxX + boxWidth / 2, boxY + boxHeight / 2);

  ctx.restore();
}