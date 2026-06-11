# Backtest Strategy Template

This repository contains templates for writing strategies for the Backtest
Platform.

## Structure

- `strategy-js/strategy.js`: JavaScript Strategy
- `strategy-py/strategy.py`: Python Strategy

## API Reference

### `init(context)`

Called once at the start.

- `context.log(msg)`
- `context.order(symbol, qty, side)`

### `onBar(bar, context)`

Called for every bar.

- `bar`: { time, price, ... }

### `onEnd(summary, context)`

Called at the end of simulation.

## Deployment

1. Fork this repo.
2. Edit your strategy.
3. Commit and Push.
4. Copy Repo URL and Commit Hash to the Backtest Platform.
# vegatemplate
