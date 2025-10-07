import { IChartApi, IChartImplementation, ChartOptions, VolumeFootprintSeriesOptions, VolumeFootprintData } from './ichart-api';
import { ISeriesApi } from './iseries-api';
import { ITimeScaleApi } from './itime-scale-api';
import { IPriceScaleApi } from './iprice-scale-api';
import { Chart as VFC } from '../chart'; // Import the Chart implementation directly
import { VolumeFootprintSeriesApi } from './volume-footprint-series-api';
import { TimeScaleApi } from './time-scale-api';
import { PriceScaleApi } from './price-scale-api';

export class ChartApi implements IChartApi {
  private chart: IChartImplementation;
  private series: ISeriesApi[] = [];
  private timeScaleApi: TimeScaleApi;
  private priceScaleApi: PriceScaleApi;

  constructor(container: HTMLElement, options: ChartOptions) {
    // Convert options to VFC format
    const vfcOptions = {
      width: options.width,
      height: options.height,
      showGrid: options.grid?.horzLines?.visible ?? true,
      showBounds: false,
      tickSize: 10,
      initialZoomX: 2, // Higher zoom to show footprints
      initialZoomY: 1,
      margin: { top: 0, bottom: 40, left: 0, right: 60 }
    };

    this.chart = new VFC(container, vfcOptions);
    this.timeScaleApi = new TimeScaleApi(this.chart);
    this.priceScaleApi = new PriceScaleApi(this.chart);
  }

  addVolumeFootprintSeries(options?: VolumeFootprintSeriesOptions): ISeriesApi<VolumeFootprintData> {
    const seriesApi = new VolumeFootprintSeriesApi(this.chart, options);
    this.series.push(seriesApi);
    return seriesApi;
  }

  removeSeries(seriesApi: ISeriesApi<any>): void {
    const index = this.series.indexOf(seriesApi);
    if (index > -1) {
      this.series.splice(index, 1);
    }
  }

  timeScale(): ITimeScaleApi {
    return this.timeScaleApi;
  }

  priceScale(): IPriceScaleApi {
    return this.priceScaleApi;
  }

  applyOptions(options: ChartOptions): void {
    // Convert and apply options
    const vfcOptions = {
      width: options.width,
      height: options.height,
      showGrid: options.grid?.horzLines?.visible ?? true
    };
    this.chart.updateOptions(vfcOptions);
  }

  options(): ChartOptions {
    const opts = this.chart.getOptions();
    return {
      width: opts.width,
      height: opts.height,
      grid: {
        horzLines: { visible: this.chart.getShowGrid() }
      }
    };
  }

  resize(width: number, height: number): void {
    this.chart.resize(width, height);
  }

  remove(): void {
    this.chart.destroy();
  }
}