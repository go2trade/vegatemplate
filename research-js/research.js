const fs = require("fs");
const readline = require("readline");

const datasetPath = process.env.RESEARCH_DATASET_PATH;
const outputPath = process.env.RESEARCH_OUTPUT_PATH;
const params = JSON.parse(process.env.RESEARCH_PARAMS_JSON || "{}");
const { dateFrom, dateTo } = params;

async function main() {
  const countsBySymbol = {};
  const priceRanges = {};
  const rows = readline.createInterface({
    input: fs.createReadStream(datasetPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rows) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    const symbol = String(row.symbol || "UNKNOWN");
    countsBySymbol[symbol] = (countsBySymbol[symbol] || 0) + 1;
    const rawPrice = row.close ?? row.c ?? row.price;
    if (rawPrice === undefined || rawPrice === null) continue;
    const price = Number(rawPrice);
    const current = priceRanges[symbol] || { min: price, max: price };
    current.min = Math.min(current.min, price);
    current.max = Math.max(current.max, price);
    priceRanges[symbol] = current;
  }

  fs.writeFileSync(outputPath, JSON.stringify({
    thesis: "Describe the idea being tested here.",
    request: { assets: params.assets, dateFrom, dateTo, interval: params.interval },
    observationsBySymbol: countsBySymbol,
    priceRanges,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
