/**
 * Aggregator module for combining 1-minute candles into higher timeframes.
 * Supports 5m, 15m, 30m, and 1h aggregations with live update capabilities.
 */

import { CandleData, FootprintLevel } from './types';

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h';

/**
 * Aggregates 1-minute candle data into higher timeframes.
 * Maintains base 1m data and efficiently updates aggregated candles.
 */
export class Aggregator {
    private base1mData: CandleData[] = [];
    private currentTimeframe: Timeframe = '1m';
    private aggregatedCache: Map<Timeframe, CandleData[]> = new Map();

    /**
     * Get the multiplier for a given timeframe (how many 1m candles per aggregated candle)
     */
    static getTimeframeMultiple(tf: Timeframe): number {
        switch (tf) {
            case '1m': return 1;
            case '5m': return 5;
            case '15m': return 15;
            case '30m': return 30;
            case '1h': return 60;
            default: return 1;
        }
    }

    /**
     * Get the timeframe period start for a given timestamp
     */
    private getTimeframeBucket(time: Date, tf: Timeframe): number {
        const multiple = Aggregator.getTimeframeMultiple(tf);
        const minutes = time.getUTCMinutes();
        const bucketMinutes = Math.floor(minutes / multiple) * multiple;

        const bucket = new Date(time);
        bucket.setUTCMinutes(bucketMinutes);
        bucket.setUTCSeconds(0);
        bucket.setUTCMilliseconds(0);

        return bucket.getTime();
    }

    /**
     * Merge footprint levels from multiple candles, summing volumes at matching prices
     */
    private mergeFootprints(footprints: FootprintLevel[][]): FootprintLevel[] {
        const merged = new Map<number, FootprintLevel>();

        for (const levels of footprints) {
            for (const level of levels) {
                const existing = merged.get(level.price);
                if (existing) {
                    existing.buy += level.buy;
                    existing.sell += level.sell;
                } else {
                    merged.set(level.price, { price: level.price, buy: level.buy, sell: level.sell });
                }
            }
        }

        // Sort by price descending (highest first)
        return Array.from(merged.values()).sort((a, b) => b.price - a.price);
    }

    /**
     * Aggregate a group of 1m candles into a single candle
     */
    private aggregateCandles(candles: CandleData[]): CandleData {
        if (candles.length === 0) {
            throw new Error('Cannot aggregate empty candle array');
        }

        if (candles.length === 1) {
            return { ...candles[0] };
        }

        const first = candles[0];
        const last = candles[candles.length - 1];

        return {
            time: first.time, // Use first candle's timestamp
            open: first.open,
            high: Math.max(...candles.map(c => c.high)),
            low: Math.min(...candles.map(c => c.low)),
            close: last.close,
            footprint: this.mergeFootprints(candles.map(c => c.footprint))
        };
    }

    /**
     * Set the base 1-minute data and clear cache
     */
    setBase1mData(data: CandleData[]): void {
        this.base1mData = [...data];
        this.aggregatedCache.clear();
    }

    /**
     * Get the base 1m data
     */
    getBase1mData(): CandleData[] {
        return this.base1mData;
    }

    /**
     * Add a new 1m candle (when timeframe closes and new candle starts)
     */
    add1mCandle(candle: CandleData): void {
        this.base1mData.push(candle);
        this.aggregatedCache.clear(); // Invalidate cache
    }

    /**
     * Update the last 1m candle with new trade data
     * This is called when trades are added to the current candle
     */
    update1mCandle(candle: CandleData): void {
        if (this.base1mData.length === 0) {
            this.base1mData.push(candle);
        } else {
            const lastCandle = this.base1mData[this.base1mData.length - 1];
            const lastTime = new Date(lastCandle.time).getTime();
            const candleTime = new Date(candle.time).getTime();

            if (lastTime === candleTime) {
                // Same timestamp - update the last candle
                this.base1mData[this.base1mData.length - 1] = candle;
            } else {
                // Different timestamp - this is a new candle
                this.base1mData.push(candle);
            }
        }
        this.aggregatedCache.clear(); // Invalidate cache
    }

    /**
     * Get current timeframe
     */
    getTimeframe(): Timeframe {
        return this.currentTimeframe;
    }

    /**
     * Set current timeframe
     */
    setTimeframe(tf: Timeframe): void {
        this.currentTimeframe = tf;
    }

    /**
     * Get aggregated candle data for a specific timeframe
     */
    getAggregatedData(timeframe: Timeframe = this.currentTimeframe): CandleData[] {
        if (timeframe === '1m') {
            return this.base1mData;
        }

        // Check cache
        const cached = this.aggregatedCache.get(timeframe);
        if (cached) {
            return cached;
        }

        // Aggregate the data
        const aggregated = this.aggregate(timeframe);
        this.aggregatedCache.set(timeframe, aggregated);
        return aggregated;
    }

    /**
     * Perform the actual aggregation
     */
    private aggregate(timeframe: Timeframe): CandleData[] {
        if (this.base1mData.length === 0) {
            return [];
        }

        const result: CandleData[] = [];
        const buckets = new Map<number, CandleData[]>();

        // Group candles by timeframe bucket
        for (const candle of this.base1mData) {
            const time = new Date(candle.time);
            const bucket = this.getTimeframeBucket(time, timeframe);

            if (!buckets.has(bucket)) {
                buckets.set(bucket, []);
            }
            buckets.get(bucket)!.push(candle);
        }

        // Sort buckets by time and aggregate each
        const sortedBuckets = Array.from(buckets.entries())
            .sort((a, b) => a[0] - b[0]);

        for (const [, candles] of sortedBuckets) {
            result.push(this.aggregateCandles(candles));
        }

        return result;
    }

    /**
     * Get the data to display for the current timeframe
     */
    getData(): CandleData[] {
        return this.getAggregatedData(this.currentTimeframe);
    }
}
