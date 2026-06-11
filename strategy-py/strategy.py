def init(context):
    context.log("Strategy Initialized")
    context.has_bought = False

def onBar(bar, context):
    price = bar.get("price")
    
    if not context.has_bought:
        context.log(f"Price is {price}, buying 1...")
        context.order("SPX", 1, "BUY")
        context.has_bought = True

def onEnd(summary, context):
    context.log("Strategy Ended")
