export interface ITimeScaleApi {
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
export interface TimeScaleOptions {
    visible?: boolean;
    timeVisible?: boolean;
    secondsVisible?: boolean;
    borderVisible?: boolean;
    borderColor?: string;
    barSpacing?: number;
    minBarSpacing?: number;
    fixLeftEdge?: boolean;
    fixRightEdge?: boolean;
    lockVisibleTimeRangeOnResize?: boolean;
    rightOffset?: number;
    barSpacingMargin?: number;
}
export interface TimeScaleRange {
    from: string | number;
    to: string | number;
}
