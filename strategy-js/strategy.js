/**
 * User Strategy Template
 *
 * Functions available in context:
 * - context.now(): returns current timestamp
 * - context.log(msg): log message
 * - context.order(symbol, qty, side): place market order
 */

function init(context) {
    context.log("Strategy Initialized");
    context.hasBought = false;
}

function onBar(bar, context) {
    if (!context.hasBought) {
        context.log(`Price is ${bar.price}, buying 1...`);
        context.order("SPX", 1, "BUY");
        context.hasBought = true;
    }
}

function onEnd(summary, context) {
    context.log("Strategy Ended");
}

// For Node.js Sandbox (vm2), we might need to expose these
module.exports = { init, onBar, onEnd };
