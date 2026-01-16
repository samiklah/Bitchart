/**
 * Crosshair and price label drawing functions for the Volume Footprint Chart.
 * Handles cursor tracking and current price display.
 */

import { Scales } from '../scales';

interface IndicatorData {
  oiData: { timestamp: number; value: number }[];
  fundingRateData: { timestamp: number; value: number }[];
  cvdValues: number[];
}

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
  theme: any,
  indicatorData?: IndicatorData
): void {
  if (!crosshair.visible) return;

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
  if (cvdHeight > 0) vLineBottom = cvdBottom;
  if (oiHeight > 0) vLineBottom = oiBottom;
  if (frHeight > 0) vLineBottom = frBottom;

  ctx.moveTo(crosshair.x, margin.top);
  ctx.lineTo(crosshair.x, vLineBottom);
  ctx.stroke();

  // Draw horizontal line (only in the current pane)
  ctx.beginPath();
  if (inMainChart) {
    ctx.moveTo(margin.left, crosshair.y);
    ctx.lineTo(chartRight, crosshair.y);
  } else if (inCVD) {
    ctx.moveTo(margin.left, crosshair.y);
    ctx.lineTo(chartRight, crosshair.y);
  } else if (inOI) {
    ctx.moveTo(margin.left, crosshair.y);
    ctx.lineTo(chartRight, crosshair.y);
  } else if (inFR) {
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
    // Show price with commas and 2 decimal places
    const price = scales.rowIndexToPrice(
      (crosshair.y - margin.top) / scales.rowHeightPx()
    );
    labelText = price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else if (inOI && indicatorData && indicatorData.oiData.length > 0) {
    // Show OI value - calculate based on Y position in OI pane
    const oiMin = Math.min(...indicatorData.oiData.map(p => p.value));
    const oiMax = Math.max(...indicatorData.oiData.map(p => p.value));
    const range = oiMax - oiMin || 1;
    const ratio = 1 - (crosshair.y - oiTop) / oiHeight;
    const oiValue = oiMin + ratio * range;
    labelText = scales.formatK(oiValue);
    labelColor = '#ff9500'; // Orange for OI
    textColor = '#fff';
  } else if (inFR && indicatorData && indicatorData.fundingRateData.length > 0) {
    // Show Funding Rate value - calculate based on Y position in FR pane
    const frMin = Math.min(...indicatorData.fundingRateData.map(p => p.value));
    const frMax = Math.max(...indicatorData.fundingRateData.map(p => p.value));
    const range = frMax - frMin || 0.0001;
    const ratio = 1 - (crosshair.y - frTop) / frHeight;
    const frValue = frMin + ratio * range;
    labelText = (frValue * 100).toFixed(4) + '%';
    labelColor = frValue >= 0 ? '#22c55e' : '#ef4444'; // Green/Red for FR
    textColor = '#fff';
  } else if (inCVD && indicatorData && indicatorData.cvdValues.length > 0) {
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

  // Get the chart area bounds (main chart only, excluding indicator panes)
  const chartTop = margin.top;
  const chartBottom = margin.top + scales.chartHeight();

  // Only draw if the price is within the visible chart area
  // Clip the Y coordinate to the chart bounds for the label
  const clampedY = Math.max(chartTop, Math.min(chartBottom, y));
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
  const labelText = lastPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  ctx.font = 'bold 12px system-ui';
  const textWidth = ctx.measureText(labelText).width;
  const boxWidth = textWidth + 8;
  const boxHeight = 18;

  // Position the label in the price bar area, clamped to chart bounds
  const boxX = right + 2;
  const labelY = Math.max(chartTop + boxHeight / 2, Math.min(chartBottom - boxHeight / 2, y));
  const boxY = labelY - boxHeight / 2;

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
  ctx.fillText(labelText, boxX + boxWidth / 2, labelY);

  ctx.restore();
}