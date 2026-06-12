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

function init(context) {
    context.log("Option Expert strategy initialized");
    context.entered = false;
}

function onBar(bar, context) {
    if (context.entered) {
        return;
    }

    const firstExpiration = Object.keys(bar.optionChain || {})[0];
    if (!firstExpiration) {
        return;
    }

    const shortCall = context.findOption({
        expiration: firstExpiration,
        right: "C",
        minDelta: 0.10,
        targetDelta: 0.25,
    });
    const longPut = context.findOption({
        expiration: firstExpiration,
        right: "P",
        targetDelta: 0.25,
    });
    if (!shortCall || !longPut) {
        return;
    }

    context.spread(
        [
            {
                instrumentType: "OPTION",
                symbol: shortCall.symbol,
                expiration: shortCall.expiration,
                strike: shortCall.strike,
                right: shortCall.right,
                qty: 1,
                side: "SELL",
            },
            {
                instrumentType: "OPTION",
                symbol: longPut.symbol,
                expiration: longPut.expiration,
                strike: longPut.strike,
                right: longPut.right,
                qty: 1,
                side: "BUY",
            },
        ],
        { label: "demo-risk-reversal" },
    );
    context.entered = true;
}

function onEnd(summary, context) {
    context.log("Strategy Ended");
}

// For Node.js Sandbox (vm2), we might need to expose these
module.exports = { init, onBar, onEnd };
