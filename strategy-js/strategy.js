/**
 * User Strategy Template
 *
 * Functions available in context:
 * - context.now(): returns current timestamp
 * - context.log(msg): log message
 * - context.order(symbol, qty, side): place a legacy stock order
 * - context.findOption(filters): search the current option chain
 * - context.spread(legs, metadata): send a multi-leg order
 */

// Installed from strategy-js/package.json. This calculation is local and does
// not perform any network request.
const { EMA } = require("technicalindicators");
const EMA_PERIOD = 10;

function init(context) {
    context.log("Option Expert strategy initialized");
    context.entered = false;
    context.primaryPrices = [];
}

function onBar(bar, context) {
    /**
     * This strategy executes a trade when a secondary market indicator (e.g. TSLA)
     * reaches a certain price threshold.
     * Note that onBar is triggered ONLY for the primary asset (e.g. AAPL),
     * but the current prices and option chains of all assets are available.
     */
    // 1. Access the primary asset bar data
    const primarySymbol = bar.symbol;
    const primaryPrice = bar.price;
    context.primaryPrices.push(primaryPrice);
    if (context.primaryPrices.length > EMA_PERIOD) context.primaryPrices.shift();
    const emaValues = EMA.calculate({ period: EMA_PERIOD, values: context.primaryPrices });
    const ema = emaValues.at(-1);
    if (ema === undefined) {
        context.log(`Collecting ${EMA_PERIOD}-bar EMA history for ${primarySymbol}.`);
        return;
    }

    // 2. Access the secondary asset(s) data via bar.tickers
    const tickers = bar.tickers || {};

    // Let's say we have TSLA as a secondary asset (market indicator)
    const tslaBar = tickers.TSLA;
    if (!tslaBar) {
        // If TSLA bar is not available yet, wait for next bar
        return;
    }

    const tslaPrice = tslaBar.price;
    context.log(`Current ${primarySymbol} Price: ${primaryPrice} | ${EMA_PERIOD}-EMA: ${ema.toFixed(2)} | TSLA Price: ${tslaPrice}`);

    // 3. Decision logic: if TSLA price crosses a threshold, open a spread on TSLA or primary symbol
    if (!context.entered && primaryPrice > ema && tslaPrice > 200.0) {
        // Get expiration dates for TSLA options
        const tslaChain = tslaBar.optionChain || {};
        const tslaExpirations = Object.keys(tslaChain);
        if (tslaExpirations.length === 0) {
            return;
        }

        const firstExpiration = tslaExpirations[0];

        // 4. Find option contracts on the secondary symbol (TSLA)
        // We specify "symbol": "TSLA" in the filters so findOption searches the TSLA chain
        const shortCall = context.findOption({
            symbol: "TSLA",
            expiration: firstExpiration,
            right: "C",
            minDelta: 0.10,
            targetDelta: 0.25,
        });
        const longPut = context.findOption({
            symbol: "TSLA",
            expiration: firstExpiration,
            right: "P",
            targetDelta: 0.25,
        });

        if (!shortCall || !longPut) {
            context.log("TSLA option contracts not found for the selected criteria.");
            return;
        }

        context.log(`Entering Risk Reversal on TSLA. Short Call strike: ${shortCall.strike}, Long Put strike: ${longPut.strike}`);

        // 5. Place a multi-leg order
        context.spread(
            [
                {
                    instrumentType: "OPTION",
                    symbol: "TSLA",
                    expiration: shortCall.expiration,
                    strike: shortCall.strike,
                    right: shortCall.right,
                    qty: 1,
                    side: "SELL",
                },
                {
                    instrumentType: "OPTION",
                    symbol: "TSLA",
                    expiration: longPut.expiration,
                    strike: longPut.strike,
                    right: longPut.right,
                    qty: 1,
                    side: "BUY",
                },
            ],
            { label: "tsla-risk-reversal" }
        );

        context.entered = true;
    }
}

function onEnd(summary, context) {
    context.log("Strategy Ended successfully.");
}

// For Node.js Sandbox (vm2), we need to expose these
module.exports = { init, onBar, onEnd };
