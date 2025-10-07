import { ITimeScaleApi, TimeScaleOptions, TimeScaleRange } from './itime-scale-api';
import { IChartImplementation } from './ichart-api';

export class TimeScaleApi implements ITimeScaleApi {
  private chart: IChartImplementation;

  constructor(chart: IChartImplementation) {
    this.chart = chart;
  }

  applyOptions(options: TimeScaleOptions): void {
    // Apply time scale options
  }

  options(): TimeScaleOptions {
    return {
      visible: true,
      timeVisible: true,
      barSpacing: 30
    };
  }

  scrollToPosition(position: number, animated?: boolean): void {
    // Scroll to position
  }

  scrollToRealTime(): void {
    // Scroll to real time
  }

  getVisibleRange(): TimeScaleRange | null {
    return null;
  }

  setVisibleRange(range: TimeScaleRange): void {
    // Set visible range
  }

  resetTimeScale(): void {
    // Reset time scale
  }

  fitContent(): void {
    // Fit content
  }

  timeToCoordinate(time: string | number): number | null {
    return null;
  }

  coordinateToTime(coordinate: number): string | number | null {
    return null;
  }
}