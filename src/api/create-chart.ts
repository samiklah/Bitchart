import { IChartApi, ChartOptions } from './ichart-api';
import { ChartApi } from './chart-api';

export function createChart(container: HTMLElement, options: ChartOptions): IChartApi {
  return new ChartApi(container, options);
}