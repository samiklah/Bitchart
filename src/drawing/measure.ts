/**
 * Measurement tool drawing functions for the Volume Footprint Chart.
 * Handles drawing of measurement rectangles and associated data labels.
 */

import { MeasureRectangle } from '../types';
import { Scales } from '../scales';

/**
 * Draws the measurement rectangle and associated data labels.
 */
export function drawMeasureRectangle(
  ctx: CanvasRenderingContext2D,
  measureRectangle: MeasureRectangle | null,
  scales: Scales,
  theme: any
): void {
  if (!measureRectangle) return;

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