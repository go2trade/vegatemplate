"""Free-form research example for the VegaOptions research runner."""

import json
import os


dataset_path = os.environ["RESEARCH_DATASET_PATH"]
output_path = os.environ["RESEARCH_OUTPUT_PATH"]
params = json.loads(os.environ.get("RESEARCH_PARAMS_JSON", "{}"))

counts_by_symbol: dict[str, int] = {}
price_ranges: dict[str, dict[str, float]] = {}

with open(dataset_path, "r", encoding="utf-8") as rows:
    for line in rows:
        if not line.strip():
            continue
        row = json.loads(line)
        symbol = str(row.get("symbol") or "UNKNOWN")
        counts_by_symbol[symbol] = counts_by_symbol.get(symbol, 0) + 1
        raw_price = row.get("close", row.get("c", row.get("price")))
        if raw_price is None:
            continue
        price = float(raw_price)
        current = price_ranges.setdefault(symbol, {"min": price, "max": price})
        current["min"] = min(current["min"], price)
        current["max"] = max(current["max"], price)

result = {
    "thesis": "Describe the idea being tested here.",
    "request": {
        "assets": params.get("assets"),
        "interval": params.get("interval"),
    },
    "observationsBySymbol": counts_by_symbol,
    "priceRanges": price_ranges,
}

with open(output_path, "w", encoding="utf-8") as output:
    json.dump(result, output, indent=2)
