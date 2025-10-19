/**
 * Footprint-specific drawing functions for the Volume Footprint Chart.
 * Handles rendering of volume profiles, imbalance markers, and related visualizations.
 */

import { CandleData } from '../types';
import { Scales } from '../scales';
import { createVolumeColorMappers, computeVolumeArea } from '../helpers/utils';

/**
 * Draws the footprint volume boxes for buy and sell volumes at each price level.
 */
export function drawFootprintBoxes(
  ctx: CanvasRenderingContext2D,
  rows: any[],
  pocIdx: number,
  enableProfile: boolean,
  leftX: number,
  rightX: number,
  scales: Scales,
  theme: any
): { minRow: number, maxRow: number, totBuy: number, totSell: number } {
  const sideMax = Math.max(...rows.map(f => Math.max(f.buy, f.sell)), 1);
  const buyBase = theme.volumeBuyBase ?? 0.15;
  const sellBase = theme.volumeSellBase ?? 0.15;
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
export function drawImbalanceMarkers(
  ctx: CanvasRenderingContext2D,
  rows: any[],
  leftX: number,
  rightX: number,
  scales: Scales,
  theme: any
): void {
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
export function drawVolumeNumbers(
  ctx: CanvasRenderingContext2D,
  rows: any[],
  pocIdx: number,
  enableProfile: boolean,
  leftX: number,
  rightX: number,
  scales: Scales,
  theme: any,
  zoomX: number
): void {
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
export function drawValueAreaBoundaries(
  ctx: CanvasRenderingContext2D,
  cx: number,
  half: number,
  VAH: number,
  VAL: number,
  leftX: number,
  rightX: number,
  scales: Scales,
  theme: any,
  zoomX: number
): void {
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
export function drawDeltaTotalLabels(
  ctx: CanvasRenderingContext2D,
  cx: number,
  maxRow: number,
  totBuy: number,
  totSell: number,
  totalVol: number,
  scales: Scales,
  theme: any,
  zoomX: number
): void {
  const yLowFootprint = scales.rowToY(maxRow) + 2;
  const delta = totBuy - totSell;
  const deltaPercent = totalVol > 0 ? (delta / totalVol) * 100 : 0;
  const deltaFontSize = Math.max(8, Math.min(18, 12 * zoomX));
  ctx.textAlign = 'center';
  ctx.font = `${deltaFontSize}px system-ui`;
  ctx.fillStyle = delta >= 0 ? (theme.deltaPositive || '#16a34a') : (theme.deltaNegative || '#dc2626');
  ctx.fillText(`Delta ${scales.formatK(delta)}`, cx, yLowFootprint + 14);
  ctx.fillText(`${deltaPercent >= 0 ? '+' : ''}${deltaPercent.toFixed(1)}%`, cx, yLowFootprint + 28);
  ctx.fillStyle = theme.totalColor || '#fff';
  ctx.fillText(`Total ${scales.formatK(totalVol)}`, cx, yLowFootprint + 46);
}

/**
 * Draws the traditional candlestick wick (high/low line) and body (open/close rectangle).
 */
export function drawCandleWickAndBody(
  ctx: CanvasRenderingContext2D,
  cx: number,
  half: number,
  candle: CandleData,
  scales: Scales,
  theme: any
): void {
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
export function drawFootprint(
  ctx: CanvasRenderingContext2D,
  candle: CandleData,
  i: number,
  startIndex: number,
  scales: Scales,
  theme: any,
  view: any,
  showVolumeFootprint: boolean
): void {
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