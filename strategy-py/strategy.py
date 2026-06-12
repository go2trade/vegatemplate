def init(context):
    context.log("Option Expert strategy initialized")
    context.entered = False

def onBar(bar, context):
    if context.entered:
        return

    first_expiration = next(iter(bar.get("optionChain", {}).keys()), "")
    if not first_expiration:
        return

    short_call = context.find_option({
        "expiration": first_expiration,
        "right": "C",
        "minDelta": 0.10,
        "targetDelta": 0.25,
    })
    long_put = context.find_option({
        "expiration": first_expiration,
        "right": "P",
        "targetDelta": 0.25,
    })
    if not short_call or not long_put:
        return

    context.spread([
        {
            "instrumentType": "OPTION",
            "symbol": short_call["symbol"],
            "expiration": short_call["expiration"],
            "strike": short_call["strike"],
            "right": short_call["right"],
            "qty": 1,
            "side": "SELL",
        },
        {
            "instrumentType": "OPTION",
            "symbol": long_put["symbol"],
            "expiration": long_put["expiration"],
            "strike": long_put["strike"],
            "right": long_put["right"],
            "qty": 1,
            "side": "BUY",
        },
    ], label="demo-risk-reversal")
    context.entered = True

def onEnd(summary, context):
    context.log("Strategy Ended")
