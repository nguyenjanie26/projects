# Projects

A single home for my projects. Each project lives in its own subfolder.

## Projects

### [Market Pulse](./market-pulse/)
A static, beginner-friendly finance-news dashboard. Aggregates headlines from major
outlets (Reuters, AP, MarketWatch, CNBC, FT, Yahoo Finance), explains them in plain
English, and shows live market data (crypto via CoinGecko, indices via Yahoo Finance).

- **Live site:** https://nguyenjanie26.github.io/projects/market-pulse/
- **Run locally:** `cd market-pulse && python3 -m http.server 5174`, then open
  <http://localhost:5174/>.
- No build step, no dependencies — hand-written HTML/CSS/JS.

See [CLAUDE.md](./CLAUDE.md) for architecture notes.
