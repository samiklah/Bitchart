import { ITimeScaleApi, TimeScaleOptions, TimeScaleRange } from './itime-scale-api';
import { IChartImplementation } from './ichart-api';
export declare class TimeScaleApi implements ITimeScaleApi {
    private chart;
    constructor(chart: IChartImplementation);
    applyOptions(options: TimeScaleOptions): void;
    options(): TimeScaleOptions;
    scrollToPosition(position: number, animated?: boolean): void;
    scrollToRealTime(): void;
    getVisibleRange(): TimeScaleRange | null;
    setVisibleRange(range: TimeScaleRange): void;
    resetTimeScale(): void;
    fitContent(): void;
    timeToCoordinate(time: string | number): number | null;
    coordinateToTime(coordinate: number): string | number | null;
}
