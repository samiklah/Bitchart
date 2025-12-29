/**
 * Main entry point for the Volume Footprint Chart library.
 * Exports the primary API, types, and backward-compatible aliases.
 */

import { CandleData, VFCOptions, VFCEvents } from './types';
import { Chart } from './chart';

// Main VFC API exports
export { createChart } from './api/create-chart';
export type {
  IChartApi,
  ChartOptions,
  VolumeFootprintSeriesOptions,
  VolumeFootprintData,
  ISeriesApi,
  ITimeScaleApi,
  IPriceScaleApi
} from './api/ichart-api';

// Export the new modular Chart class
export { Chart } from './chart';
export { Scales } from './scales';
export { Interactions } from './interactions';
export { Drawing } from './drawing';
export { Aggregator, Timeframe } from './aggregator';

// Export the new modular Chart class as VFC for backward compatibility
export { Chart as VFC } from './chart';