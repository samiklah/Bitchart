/**
 * Aggregator module for combining 1-minute candles into higher timeframes.
 * Supports 5m, 15m, 30m, and 1h aggregations with live update capabilities.
 */
import { CandleData } from './types';
export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h';
/**
 * Aggregates 1-minute candle data into higher timeframes.
 * Maintains base 1m data and efficiently updates aggregated candles.
 */
export declare class Aggregator {
    private base1mData;
    private currentTimeframe;
    private aggregatedCache;
    /**
     * Get the multiplier for a given timeframe (how many 1m candles per aggregated candle)
     */
    static getTimeframeMultiple(tf: Timeframe): number;
    /**
     * Get the timeframe period start for a given timestamp
     */
    private getTimeframeBucket;
    /**
     * Merge footprint levels from multiple candles, summing volumes at matching prices
     */
    private mergeFootprints;
    /**
     * Aggregate a group of 1m candles into a single candle
     */
    private aggregateCandles;
    /**
     * Set the base 1-minute data and clear cache
     */
    setBase1mData(data: CandleData[]): void;
    /**
     * Get the base 1m data
     */
    getBase1mData(): CandleData[];
    /**
     * Add a new 1m candle (when timeframe closes and new candle starts)
     */
    add1mCandle(candle: CandleData): void;
    /**
     * Update the last 1m candle with new trade data
     * This is called when trades are added to the current candle
     */
    update1mCandle(candle: CandleData): void;
    /**
     * Get current timeframe
     */
    getTimeframe(): Timeframe;
    /**
     * Set current timeframe
     */
    setTimeframe(tf: Timeframe): void;
    /**
     * Get aggregated candle data for a specific timeframe
     */
    getAggregatedData(timeframe?: Timeframe): CandleData[];
    /**
     * Perform the actual aggregation
     */
    private aggregate;
    /**
     * Get the data to display for the current timeframe
     */
    getData(): CandleData[];
}
