import { VFCEvents, MeasureRectangle } from './types';
import { Scales } from './scales';
export declare class Interactions {
    private canvas;
    private margin;
    private view;
    private events;
    private crosshair;
    private momentum;
    private readonly PAN_INVERT;
    private scales;
    private isMeasureMode;
    private measureRectangle;
    constructor(canvas: HTMLCanvasElement, margin: {
        top: number;
        bottom: number;
        left: number;
        right: number;
    }, view: {
        zoomY: number;
        zoomX: number;
        offsetRows: number;
        offsetX: number;
    }, events: VFCEvents, crosshair: {
        x: number;
        y: number;
        visible: boolean;
    }, scales: Scales);
    handleWheel(e: WheelEvent): void;
    handlePointerDown(e: PointerEvent): void;
    private handleMeasurePointerDown;
    setMeasureMode(enabled: boolean): void;
    getMeasureRectangle(): MeasureRectangle | null;
    clearMeasureRectangle(): void;
    private cancelMomentum;
    private startMomentum;
    private stepMomentum;
    private setupMouseTracking;
    private handleMouseMove;
    private handleMouseLeave;
}
