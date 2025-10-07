export interface ISeriesApi<TData = any> {
    setData(data: TData[]): void;
    update(data: TData): void;
    data(): TData[];
    applyOptions(options: any): void;
    options(): any;
    priceScale(): IPriceScaleApi;
    visible(): boolean;
    setVisible(visible: boolean): void;
}
export interface IPriceScaleApi {
    applyOptions(options: PriceScaleOptions): void;
    options(): PriceScaleOptions;
    width(): number;
}
export interface PriceScaleOptions {
    scaleMargins?: {
        top?: number;
        bottom?: number;
    };
    mode?: number;
    autoScale?: boolean;
    visible?: boolean;
}
