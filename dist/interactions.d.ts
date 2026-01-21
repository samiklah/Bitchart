/**
 * Manages user interactions and input handling for the Volume Footprint Chart.
 * Processes mouse/touch events, wheel zooming, panning, and measurement tools.
 */
import { VFCEvents, MeasureRectangle } from './types';
import { Scales } from './scales';
/**
 * Handles user interactions with the chart, including mouse/touch events, zooming, panning, and measuring.
 * Manages crosshair positioning, momentum scrolling, and measurement tools.
 */
export declare class Interactions {
    private canvas;
    private margin;
    private view;
    private events;
    private crosshair;
    private momentum;
    private readonly PAN_INVERT;
    private scales;
    private zoomLimits;
    private isDraggingCvdDivider;
    private cvdDividerHitZone;
    private isDraggingTableDivider;
    private isMeasureMode;
    private measureRectangle;
    /**
     * Creates an Interactions instance to handle user input for the chart.
     * @param canvas The HTML canvas element
     * @param margin Chart margin configuration
     * @param view Current view state (zoom and offset)
     * @param events Event callbacks
     * @param crosshair Crosshair position state
     * @param scales Scales instance for coordinate conversions
     */
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
    }, events: VFCEvents & {
        onCvdResize?: (ratio: number) => void;
    }, crosshair: {
        x: number;
        y: number;
        visible: boolean;
    }, scales: Scales, zoomLimits?: {
        min: number;
        max: number;
    });
    /**
     * Handles mouse wheel events for zooming different chart areas.
     * Zooms price axis when over price bar, time axis when over timeline, both when over chart body.
     * @param e The wheel event
     */
    handleWheel(e: WheelEvent): void;
    handlePointerDown(e: PointerEvent): void;
    private handleMeasurePointerDown;
    setMeasureMode(enabled: boolean): void;
    getMeasureMode(): boolean;
    getMeasureRectangle(): MeasureRectangle | null;
    clearMeasureRectangle(): void;
    /** Updates the scales reference when options change */
    setScales(scales: Scales): void;
    private handleCvdDividerDrag;
    private handleTableDividerDrag;
    private cancelMomentum;
    private startMomentum;
    private stepMomentum;
    private setupMouseTracking;
    private handleMouseMove;
    private handleMouseLeave;
}
