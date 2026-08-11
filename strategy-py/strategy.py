import pandas as pd

EMA_PERIOD = 10


def init(context):
    context.log("Multi-ticker Option expert strategy initialized")
    context.entered = False
    context.primary_prices = []

def onBar(bar, context):
    """
    This strategy executes a trade when a secondary market indicator (e.g. TSLA)
    reaches a certain price threshold.
    Note that onBar is triggered ONLY for the primary asset (e.g. AAPL),
    but the current prices and option chains of all assets are available.
    """
    # 1. Access the primary asset bar data
    primary_symbol = bar.get("symbol")
    primary_price = bar.get("price")
    context.primary_prices.append(primary_price)
    if len(context.primary_prices) > EMA_PERIOD:
        context.primary_prices.pop(0)
    if len(context.primary_prices) < EMA_PERIOD:
        context.log(f"Collecting {EMA_PERIOD}-bar EMA history for {primary_symbol}.")
        return
    ema = pd.Series(context.primary_prices, dtype="float64").ewm(span=EMA_PERIOD, adjust=False).mean().iloc[-1]
    
    # 2. Access the secondary asset(s) data via bar["tickers"]
    tickers = bar.get("tickers", {})
    
    # Let's say we have TSLA as a secondary asset (market indicator)
    tsla_bar = tickers.get("TSLA")
    if not tsla_bar:
        # If TSLA bar is not available yet, wait for next bar
        return
        
    tsla_price = tsla_bar.get("price")
    context.log(f"Current {primary_symbol} Price: {primary_price} | {EMA_PERIOD}-EMA: {ema:.2f} | TSLA Price: {tsla_price}")
    
    # 3. Decision logic: if TSLA price crosses a threshold, open a spread on TSLA or primary symbol
    if not context.entered and primary_price > ema and tsla_price > 200.0:
        # Get expiration dates for TSLA options
        tsla_chain = tsla_bar.get("optionChain", {})
        tsla_expirations = list(tsla_chain.keys())
        if not tsla_expirations:
            return
            
        first_expiration = tsla_expirations[0]
        
        # 4. Find option contracts on the secondary symbol (TSLA)
        # We specify "symbol": "TSLA" in the filters so find_option searches the TSLA chain
        short_call = context.find_option({
            "symbol": "TSLA",
            "expiration": first_expiration,
            "right": "C",
            "minDelta": 0.10,
            "targetDelta": 0.25,
        })
        long_put = context.find_option({
            "symbol": "TSLA",
            "expiration": first_expiration,
            "right": "P",
            "targetDelta": 0.25,
        })
        
        if not short_call or not long_put:
            context.log("TSLA option contracts not found for the selected criteria.")
            return

        context.log(f"Entering Risk Reversal on TSLA. Short Call strike: {short_call['strike']}, Long Put strike: {long_put['strike']}")
        
        # 5. Place a multi-leg order
        context.spread([
            {
                "instrumentType": "OPTION",
                "symbol": "TSLA",
                "expiration": short_call["expiration"],
                "strike": short_call["strike"],
                "right": short_call["right"],
                "qty": 1,
                "side": "SELL",
            },
            {
                "instrumentType": "OPTION",
                "symbol": "TSLA",
                "expiration": long_put["expiration"],
                "strike": long_put["strike"],
                "right": long_put["right"],
                "qty": 1,
                "side": "BUY",
            },
        ], label="tsla-risk-reversal")
        
        context.entered = True

def onEnd(summary, context):
    context.log("Strategy Ended successfully.")
