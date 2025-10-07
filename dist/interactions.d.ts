import { VFCEvents } from './types';
export declare class Interactions {
    private canvas;
    private margin;
    private view;
    private events;
    private crosshair;
    private momentum;
    private readonly PAN_INVERT;
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
    });
    handleWheel(e: WheelEvent): void;
    handlePointerDown(e: PointerEvent): void;
    private cancelMomentum;
    private startMomentum;
    private stepMomentum;
    private setupMouseTracking;
    private handleMouseMove;
    private handleMouseLeave;
}
