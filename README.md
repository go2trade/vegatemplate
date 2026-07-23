# Backtest Strategy Template

https://vegaoptions.org
This repository is the starter template for VegaOptions backtest strategies.
It is written for both human developers and AI coding tools such as Codex,
Cursor, Claude, or any IDE agent that needs precise instructions.

The platform supports two distinct run types:

- **Backtest**: write a structured strategy in JavaScript or Python, receive
  bar-by-bar data, place simulated orders, and review a performance report.
- **Research**: run a free-form Python or JavaScript program over the raw
  historical JSONL data and return any valid JSON result.

Backtests use the `init`, `onBar`, and `onEnd` lifecycle documented below.
Research scripts do not use that lifecycle and are documented in
[Free-form Research](#free-form-research).

## What AI Tools Should Know First

If you ask an AI tool to write or modify a strategy in this template, it should
follow these rules:

1. Do all trading decisions inside `onBar(bar, context)`.
2. Use `context` to store strategy state between bars.
3. Use `bar.price` or `bar.spot` as the normalized current underlying price.
4. Use `bar.o/h/l/c/v` or `bar.open/high/low/close/volume` only if those fields
   exist in the dataset.
5. Use `context.findOption(...)` or `context.findOptions(...)` to select option
   contracts from the current chain snapshot.
6. Use positive `qty` values and explicit `side: "BUY"` or `side: "SELL"`.
7. For option orders, always specify enough contract identity:
   `symbol`, `expiration`, `strike`, and `right`.
8. Use `context.spread(...)` for multi-leg option trades.
9. Do not rely on internet access or external APIs at runtime. The strategy
   receives all market data from the backtest runner.
10. Do not try to place executable orders in `init()` or `onEnd()`. Only orders
    produced during `onBar()` are executed by the runner.

## Repository Structure

- `strategy-js/strategy.js`: JavaScript strategy entrypoint
- `strategy-py/strategy.py`: Python strategy entrypoint
- `research-js/research.js`: optional free-form JavaScript research entrypoint
- `research-py/research.py`: optional free-form Python research entrypoint
- `data/nvda_stock_15m.json`: example 15-minute OHLC data shape
- `data/nvda_stock_1d.json`: example daily OHLC data shape

Important: `strategy-js/` and `strategy-py/` must live directly at the
repository root. Do not leave them nested inside an extra top-level folder
created by `git clone`, GitHub download ZIP extraction, or manual copying. The
runner looks for these entrypoints from the repo root.

The files in `data/` are examples for AI tools and developers. They are useful
for understanding the bar format, but the platform will generate the real
dataset and stream it to the strategy during a backtest run.

## Free-form Research

Submit the job with `"runType": "research"` to execute a research script
directly. The script does not export functions and does not implement
`init`, `onBar`, or `onEnd`. It can organize its analysis in any way, read the
dataset multiple times, test competing explanations, and change direction
based on intermediate calculations.

Supported entrypoints:

- Python: `research-py/research.py` or `research.py`
- JavaScript: `research-js/research.js`, `.mjs`, or `.cjs`, or the same names
  at the repository root

The runner provides:

- `RESEARCH_DATASET_PATH`: chronologically merged JSONL input
- `RESEARCH_OUTPUT_PATH`: required destination for the final JSON value
- `RESEARCH_PARAMS_JSON`: the data request parameters as JSON

Each input line retains the provider fields and includes an injected `symbol`
field. Read it line by line for large datasets. The script must exit with code
zero and write valid JSON to `RESEARCH_OUTPUT_PATH`. Standard output and error
are captured in the job logs. Internet access is not available at runtime.

Python:

```py
import json
import os

dataset_path = os.environ["RESEARCH_DATASET_PATH"]
output_path = os.environ["RESEARCH_OUTPUT_PATH"]

prices = []
with open(dataset_path, encoding="utf-8") as rows:
    for line in rows:
        row = json.loads(line)
        price = row.get("close", row.get("c", row.get("price")))
        if price is not None:
            prices.append(float(price))

result = {
    "observations": len(prices),
    "minimum": min(prices) if prices else None,
    "maximum": max(prices) if prices else None,
}
with open(output_path, "w", encoding="utf-8") as output:
    json.dump(result, output)
```

JavaScript:

```js
const fs = require("fs");

const rows = fs.readFileSync(process.env.RESEARCH_DATASET_PATH, "utf8")
  .split(/\r?\n/)
  .filter(Boolean)
  .map(JSON.parse);

const result = {
  observations: rows.length,
  symbols: [...new Set(rows.map((row) => row.symbol))],
};
fs.writeFileSync(process.env.RESEARCH_OUTPUT_PATH, JSON.stringify(result));
```

The platform validates the file and publishes it under `result` in the final
`results.json` response.

## Execution Model

The backtest platform does the following:

1. Clones your repository.
2. Detects the strategy entrypoint.
3. Installs dependencies if needed.
4. Builds the project if configured.
5. Streams bars into your strategy one by one.
6. Executes returned orders against the current bar snapshot.
7. Produces metrics, trades, positions, and an equity curve report.

The selected timeframe in the UI or API, such as `15m`, `1h`, or `1d`,
controls how often `onBar()` is called.

## Strategy Lifecycle

### `init(context)`

Called once before the first bar.

Use it for:

- initializing state
- setting flags
- precomputing constants
- writing startup logs

Do not use it for real trades. Orders returned from `init()` are not executed by
the engine.

### `onBar(bar, context)`

Called once for every incoming bar.

This is the main trading hook. Use it to:

- read price and OHLC data
- inspect the option chain
- read current portfolio state
- decide whether to enter, adjust, or exit positions
- return orders or call `context.order(...)` / `context.spread(...)`

### `onEnd(summary, context)`

Called once after the simulation finishes.

Use it for:

- final logs
- reporting
- debugging
- final metric inspection

Do not use it to place trades. The runner does not execute end-of-run orders.

## Market Data Available To The Strategy

The strategy does not call `getPrice()` or fetch its own candles. Instead, each
invocation of `onBar(bar, context)` receives the current market snapshot.

### Always Available Normalized Fields

These fields are normalized by the backtest runner and are the safest values to
use in strategy code:

- `bar.time`: ISO UTC timestamp string
- `bar.timestamp`: epoch milliseconds
- `bar.symbol`: underlying symbol
- `bar.price`: normalized current price for the bar
- `bar.spot`: same as `bar.price`
- `bar.portfolio`: current portfolio snapshot
- `bar.optionChain`: option chain grouped by expiration
- `bar.optionChainFlat`: flattened option contracts list

`bar.price` is usually derived from the bar close, current mark, or similar
final value for the current bar snapshot.

### Raw OHLC Fields

The original dataset fields are passed through as well.

Typical datasets may include either compact fields:

- `bar.o`
- `bar.h`
- `bar.l`
- `bar.c`
- `bar.v`

or expanded fields:

- `bar.open`
- `bar.high`
- `bar.low`
- `bar.close`
- `bar.volume`

Because datasets may differ, AI-generated strategies should prefer safe fallbacks.

JavaScript:

```js
const open = bar.open ?? bar.o ?? bar.price;
const high = bar.high ?? bar.h ?? bar.price;
const low = bar.low ?? bar.l ?? bar.price;
const close = bar.close ?? bar.c ?? bar.price;
const volume = bar.volume ?? bar.v ?? 0;
```

Python:

```py
open_price = bar.get("open", bar.get("o", bar.get("price", 0.0)))
high_price = bar.get("high", bar.get("h", bar.get("price", 0.0)))
low_price = bar.get("low", bar.get("l", bar.get("price", 0.0)))
close_price = bar.get("close", bar.get("c", bar.get("price", 0.0)))
volume = bar.get("volume", bar.get("v", 0.0))
```

## Option Data Available To The Strategy

If the backtest request includes option-chain data, then every bar may also
contain:

- `bar.optionChain`: grouped by expiration
- `bar.optionChainFlat`: flat list of contracts ready for filtering

### `bar.optionChain`

Grouped shape:

```json
{
  "20260619": [
    {
      "strike": 600,
      "call": { "...": "contract snapshot" },
      "put": { "...": "contract snapshot" }
    }
  ]
}
```

Each strike row can contain:

- `strike`
- `call`
- `put`

Each contract snapshot may contain:

- `id`
- `symbol`
- `expiration`
- `strike`
- `right`
- `type`
- `bid`
- `ask`
- `last`
- `mark`
- `price`
- `volume`
- `openInterest`
- `impliedVolatility`
- `multiplier`
- `greeks.delta`
- `greeks.gamma`
- `greeks.theta`
- `greeks.vega`
- `greeks.rho`
- `analyticsEstimated`

### `bar.optionChainFlat`

This is usually the easiest structure for AI tools to work with.

It is a flat array of contracts, one object per call or put. This is the data
used internally by `context.findOption(...)` and `context.findOptions(...)`.

### Greeks

If the upstream data already contains Greeks, the runner uses them.
If not, the runner estimates them so the strategy can still filter by delta,
gamma, theta, and vega.

This makes filters like `minDelta: 0.10` safe to use even when the original
dataset is incomplete.

## Context API

The context object is the strategy runtime helper.

State placed on `context` is preserved across bars, which makes it a good place
to store:

- flags such as `entered`, `cooldown`, or `lastSignal`
- rolling indicators you compute yourself
- trade identifiers
- position management settings

### Common Methods

- `context.now()`
  Returns the current bar time. This is meaningful during `onBar()`.

- `context.log(message)`
  Writes to the backtest logs.

- `context.getBar()` in JavaScript
- `context.get_bar()` in Python
  Returns a deep copy of the current bar payload.

- `context.getPortfolio()` in JavaScript
- `context.get_portfolio()` in Python
  Returns a deep copy of the current portfolio snapshot.

- `context.findOption(filters)` in JavaScript
- `context.find_option(filters)` in Python
  Returns the best matching contract or `null` / `None`.

- `context.findOptions(filters)` in JavaScript
- `context.find_options(filters)` in Python
  Returns a list of matching contracts.

- `context.order(...)`
  Queues a single stock or option order.

- `context.spread(legs, metadata)`
  Queues a multi-leg order, typically for option spreads.

## Multi-Ticker Backtests

When a backtest is configured with multiple tickers (up to 5):
- The simulation runs sequentially. `onBar(bar, context)` is triggered **only** for the primary ticker (the first ticker in your selected assets list).
- Secondary tickers act as market indicators/references.
- At any given timestamp, the data stream updates secondary ticker prices **before** the primary ticker triggers `onBar`.
- To access the latest price and state of secondary tickers, read the `bar.tickers` dictionary:
  - In Python: `bar["tickers"]["TSLA"]` or `bar.get("tickers", {}).get("TSLA")`
  - In JavaScript: `bar.tickers.TSLA`
- To search for option contracts on a secondary symbol, pass the `"symbol"` filter to `context.find_option` / `context.findOption`:
  - Python: `context.find_option({"symbol": "TSLA", "right": "C", "targetDelta": 0.25})`
  - JavaScript: `context.findOption({symbol: "TSLA", right: "C", targetDelta: 0.25})`

## Option Search Filters

Use `context.findOption(...)` or `context.findOptions(...)` with any mix of:

- `symbol`
- `expiration`
- `right`
- `type`
- `minDelta`
- `maxDelta`
- `targetDelta`
- `minStrike`
- `maxStrike`

### Notes

- `right` can be `C`, `P`, `CALL`, or `PUT`
- delta filtering uses absolute delta
- `targetDelta` sorts the result by closeness to the requested delta
- if no `targetDelta` is given, contracts are sorted by earliest expiration and
  then by strike closeness to the current spot price

Example:

```js
const shortCall = context.findOption({
  expiration: "20260619",
  right: "C",
  minDelta: 0.10,
  maxDelta: 0.35,
  targetDelta: 0.20,
});
```

This is the standard way to express rules such as "do not sell delta smaller
than 10".

## Order Formats

### Legacy Stock Order

JavaScript:

```js
context.order("SPY", 100, "BUY");
```

Python:

```py
context.order("SPY", 100, "BUY")
```

### Single-Leg Structured Order

Use this format for both stocks and options.

```js
context.order({
  instrumentType: "OPTION",
  symbol: "SPY",
  expiration: "20260619",
  strike: 600,
  right: "C",
  qty: 1,
  side: "SELL",
});
```

Important:

- `qty` should be a positive integer
- use `side` to express direction
- do not send negative quantities
- `instrumentType` should be `OPTION` or `STOCK`

If `expiration`, `strike`, or `right` are present, the runner usually infers
that the order is an option order even if `instrumentType` is omitted. Still,
AI tools should include `instrumentType` explicitly for clarity.

### Multi-Leg Spread Order

```js
context.spread(
  [
    {
      instrumentType: "OPTION",
      symbol: "SPY",
      expiration: "20260619",
      strike: 600,
      right: "C",
      qty: 1,
      side: "SELL",
    },
    {
      instrumentType: "OPTION",
      symbol: "SPY",
      expiration: "20260619",
      strike: 590,
      right: "P",
      qty: 1,
      side: "BUY",
    },
  ],
  { label: "risk-reversal" },
);
```

You may also include:

- `groupId`
- `label`

These values help group related legs in reports.

## Portfolio Snapshot

The strategy can inspect current portfolio state through `bar.portfolio` or
`context.getPortfolio()` / `context.get_portfolio()`.

The snapshot includes:

- `initialCapital`
- `cash`
- `equity`
- `realizedPnl`
- `unrealizedPnl`
- `marketValue`
- `exposure.netDelta`
- `exposure.netGamma`
- `exposure.netTheta`
- `exposure.netVega`
- `positions`

Each position may include:

- `symbol`
- `instrumentType`
- `type`
- `expiration`
- `strike`
- `right`
- `quantity`
- `averagePrice`
- `lastPrice`
- `marketValue`
- `unrealizedPnl`
- `greeks`

This allows AI-generated strategies to:

- avoid duplicate entries
- cap risk
- rebalance spreads
- flatten exposure before expiration
- enforce net delta or vega limits

## Execution And Fill Model

The runner currently simulates fills as follows:

- stock orders fill from the underlying bar price
- option orders fill from the option contract mark
- buy orders add slippage
- sell orders subtract slippage
- fees are applied per contract quantity
- no partial fills
- no limit-order book simulation

AI tools should therefore treat the current system as a bar-based research
engine, not a tick-perfect execution simulator.

## Dependency Support

The runner can bundle more than a single strategy file.

### Python

If the strategy is inside a Python project and a `requirements.txt` file exists
near the strategy entrypoint, the runner installs it automatically.

Typical layout:

```text
strategy-py/
  strategy.py
  requirements.txt
  indicators.py
  risk.py
```

### JavaScript / Node

If the strategy lives inside a Node project and a `package.json` file exists,
the runner installs dependencies automatically.

Typical layout:

```text
strategy-js/
  strategy.js
  package.json
  package-lock.json
  lib/
    signals.js
```

If you need a build step, add one of these keys to `package.json`:

```json
{
  "vegaOptionsBacktest": {
    "buildCommand": "npm run build",
    "builtEntrypoint": "dist/strategy.js"
  }
}
```

`backtest` is also accepted as an alias:

```json
{
  "backtest": {
    "buildCommand": "npm run build",
    "builtEntrypoint": "dist/strategy.js"
  }
}
```

## AI Prompting Recipes

These prompts work well when asking an AI tool to generate a strategy in this
template.

### Prompt: build an options strategy

```text
Build a strategy for the VegaOptions backtest template.

Requirements:
- Use onBar(bar, context) for all trading decisions.
- Use bar.price as the normalized underlying price.
- Read OHLC from bar.o/h/l/c if present.
- Use context.findOption or context.findOptions to select option contracts.
- Never use negative qty values. Use side BUY/SELL with positive qty.
- Use context.spread for multi-leg trades.
- Filter out contracts with absolute delta below 0.10 when selling premium.
- Keep state on context.
- Add clear logs for entry, exit, and risk actions.
```

### Prompt: intraday OHLC strategy

```text
Write a 15-minute intraday options strategy for this backtest template.
Use bar.o/h/l/c or bar.open/high/low/close if present.
Compute signals from the incoming bars instead of fetching outside data.
```

### Prompt: portfolio-aware strategy

```text
Build a strategy that checks context.getPortfolio() before entering new trades.
Do not add a new position if net delta exceeds the configured limit.
```

## Example: minimal option entry

JavaScript:

```js
function init(context) {
  context.entered = false;
}

function onBar(bar, context) {
  if (context.entered) return;

  const expiration = Object.keys(bar.optionChain || {})[0];
  if (!expiration) return;

  const shortCall = context.findOption({
    expiration,
    right: "C",
    minDelta: 0.10,
    targetDelta: 0.25,
  });

  const longPut = context.findOption({
    expiration,
    right: "P",
    targetDelta: 0.25,
  });

  if (!shortCall || !longPut) return;

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

module.exports = { init, onBar };
```

## Deployment

1. Fork or clone this template repo.
2. Make sure `strategy-js/` and `strategy-py/` are still at the repo root after
   cloning. A layout like `my-repo/strategy-js/...` is correct; an extra nested
   wrapper folder above `strategy-js/` or `strategy-py/` is not.
3. Edit either `strategy-js/strategy.js` or `strategy-py/strategy.py`.
4. Add helper modules, dependencies, and optional build config if needed.
5. Commit and push the repository.
6. Submit the repo URL and branch or commit hash to the backtest platform.
7. Choose symbol, date range, timeframe, and execution settings.
8. Run the backtest and inspect the report;
