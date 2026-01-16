/**
 * Main entry point for the Volume Footprint Chart library.
 * Exports the primary API, types, and backward-compatible aliases.
 */
export { createChart } from './api/create-chart';
export type { IChartApi, ChartOptions, VolumeFootprintSeriesOptions, VolumeFootprintData, ISeriesApi, ITimeScaleApi, IPriceScaleApi } from './api/ichart-api';
export { Chart } from './chart';
export { Scales } from './scales';
export { Interactions } from './interactions';
export { Drawing } from './drawing';
export { Aggregator, Timeframe } from './aggregator';
export { Chart as VFC } from './chart';
export { DOM } from './dom/dom';
export type { DOMData, DOMLevel, DOMOptions, DOMTheme } from './dom/dom-types';
