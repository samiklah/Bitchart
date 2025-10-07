import { IPriceScaleApi, PriceScaleOptions } from './iprice-scale-api';
import { IChartImplementation } from './ichart-api';
export declare class PriceScaleApi implements IPriceScaleApi {
    private chart;
    constructor(chart: IChartImplementation);
    applyOptions(options: PriceScaleOptions): void;
    options(): PriceScaleOptions;
    width(): number;
    height(): number;
    isEmpty(): boolean;
    priceToCoordinate(price: number): number | null;
    coordinateToPrice(coordinate: number): number | null;
}
