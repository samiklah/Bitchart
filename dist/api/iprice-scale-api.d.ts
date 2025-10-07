export interface IPriceScaleApi {
    applyOptions(options: PriceScaleOptions): void;
    options(): PriceScaleOptions;
    width(): number;
    height(): number;
    isEmpty(): boolean;
    priceToCoordinate(price: number): number | null;
    coordinateToPrice(coordinate: number): number | null;
}
export interface PriceScaleOptions {
    scaleMargins?: {
        top?: number;
        bottom?: number;
    };
    mode?: PriceScaleMode;
    autoScale?: boolean;
    visible?: boolean;
    borderVisible?: boolean;
    borderColor?: string;
    textColor?: string;
    entireTextOnly?: boolean;
    ticksVisible?: boolean;
    minimumWidth?: number;
    invertScale?: boolean;
}
export declare enum PriceScaleMode {
    Normal = 0,
    Logarithmic = 1,
    Percentage = 2,
    IndexedTo100 = 3
}
