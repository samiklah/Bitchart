import { ISeriesApi } from './iseries-api';
import { ITimeScaleApi } from './itime-scale-api';
import { IPriceScaleApi } from './iprice-scale-api';

// Re-export interfaces for convenience
export type { ISeriesApi } from './iseries-api';
export type { ITimeScaleApi } from './itime-scale-api';
export type { IPriceScaleApi } from './iprice-scale-api';

export interface IChartApi {
  addVolumeFootprintSeries(options?: VolumeFootprintSeriesOptions): ISeriesApi<VolumeFootprintData>;
  removeSeries(seriesApi: ISeriesApi<any>): void;
  timeScale(): ITimeScaleApi;
  priceScale(): IPriceScaleApi;
  applyOptions(options: ChartOptions): void;
  options(): ChartOptions;
  resize(width: number, height: number): void;
  remove(): void;
}

export interface IChartImplementation {
  setData(data: any[]): void;
  updateOptions(options: any): void;
  resize(width: number, height: number): void;
  destroy(): void;
  getOptions(): any;
  getShowGrid(): boolean;
}

export interface ChartOptions {
  width: number;
  height: number;
  layout?: {
    backgroundColor?: string;
    textColor?: string;
    fontSize?: number;
    fontFamily?: string;
  };
  grid?: {
    vertLines?: {
      color?: string;
      style?: number;
      visible?: boolean;
    };
    horzLines?: {
      color?: string;
      style?: number;
      visible?: boolean;
    };
  };
  timeScale?: {
    visible?: boolean;
    timeVisible?: boolean;
    secondsVisible?: boolean;
  };
  priceScale?: {
    visible?: boolean;
    mode?: PriceScaleMode;
    autoScale?: boolean;
  };
}

export enum PriceScaleMode {
  Normal = 0,
  Logarithmic = 1,
  Percentage = 2,
}

export interface VolumeFootprintSeriesOptions {
  upColor?: string;
  downColor?: string;
  borderVisible?: boolean;
  borderColor?: string;
  borderUpColor?: string;
  borderDownColor?: string;
  wickVisible?: boolean;
  wickColor?: string;
  wickUpColor?: string;
  wickDownColor?: string;
  priceFormat?: {
    type?: 'price' | 'volume';
    precision?: number;
  };
}

export interface VolumeFootprintData {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  footprint?: Array<{
    price: number;
    buy: number;
    sell: number;
  }>;
}