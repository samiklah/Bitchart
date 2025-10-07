import { ISeriesApi } from './iseries-api';
import { IPriceScaleApi } from './iprice-scale-api';
import { VolumeFootprintData, VolumeFootprintSeriesOptions } from './ichart-api';
import { IChartImplementation } from './ichart-api';
export declare class VolumeFootprintSeriesApi implements ISeriesApi<VolumeFootprintData> {
    private chart;
    private seriesOptions;
    constructor(chart: IChartImplementation, options?: VolumeFootprintSeriesOptions);
    setData(data: VolumeFootprintData[]): void;
    update(data: VolumeFootprintData): void;
    data(): VolumeFootprintData[];
    applyOptions(options: VolumeFootprintSeriesOptions): void;
    options(): VolumeFootprintSeriesOptions;
    priceScale(): IPriceScaleApi;
    visible(): boolean;
    setVisible(visible: boolean): void;
}
