import { IChartApi, ChartOptions, VolumeFootprintSeriesOptions, VolumeFootprintData } from './ichart-api';
import { ISeriesApi } from './iseries-api';
import { ITimeScaleApi } from './itime-scale-api';
import { IPriceScaleApi } from './iprice-scale-api';
export declare class ChartApi implements IChartApi {
    private chart;
    private series;
    private timeScaleApi;
    private priceScaleApi;
    constructor(container: HTMLElement, options: ChartOptions);
    addVolumeFootprintSeries(options?: VolumeFootprintSeriesOptions): ISeriesApi<VolumeFootprintData>;
    removeSeries(seriesApi: ISeriesApi<any>): void;
    timeScale(): ITimeScaleApi;
    priceScale(): IPriceScaleApi;
    applyOptions(options: ChartOptions): void;
    options(): ChartOptions;
    resize(width: number, height: number): void;
    remove(): void;
}
