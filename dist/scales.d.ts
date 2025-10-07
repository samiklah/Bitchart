import { CandleData } from './types';
export declare class Scales {
    private data;
    private margin;
    private view;
    private canvasWidth;
    private canvasHeight;
    private TICK;
    private baseRowPx;
    private TEXT_VIS;
    constructor(data: CandleData[], margin: {
        top: number;
        bottom: number;
        left: number;
        right: number;
    }, view: {
        zoomY: number;
        zoomX: number;
        offsetRows: number;
        offsetX: number;
    }, canvasWidth: number, canvasHeight: number, TICK: number, baseRowPx: number, TEXT_VIS: {
        minZoomX: number;
        minRowPx: number;
        minBoxPx: number;
    });
    chartHeight(): number;
    rowHeightPx(): number;
    scaledSpacing(): number;
    scaledCandle(): number;
    scaledBox(): number;
    scaledImb(): number;
    shouldShowCellText(): boolean;
    priceToRowIndex(price: number): number;
    rowIndexToPrice(row: number): number;
    rowToY(row: number): number;
    priceToY(price: number): number;
    indexToX(i: number, startIndex: number): number;
    getVisibleRange(): {
        startIndex: number;
        endIndex: number;
    };
    computePriceBarLabels(): Array<{
        price: number;
        y: number;
    }>;
    formatK(v: number): string;
    private get xShift();
    screenXToDataIndex(screenX: number): number;
    private get ladderTop();
}
