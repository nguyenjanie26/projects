# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`market-pulse/` is a **static, zero-dependency** finance-news dashboard aimed at beginners: it
aggregates headlines from major outlets, enriches them client-side with plain-English explanations,
and shows live market data. There is **no build step, no framework, no package.json, no tests** — it
is hand-written vanilla HTML/CSS/JS served as static files.

## Running it

```bash
# from the repo root — serve the static files, then open the printed URL
cd market-pulse && python3 -m http.server 5174
# open http://localhost:5174/
```

- After editing `app.js`/`styles.css`, the browser must be **hard-refreshed** (`Cmd+Shift+R`) — the
  app also caches data in `localStorage`, so a normal reload can show stale content.
- `.claude/launch.json` defines a `market-pulse` server config, but the built-in preview tool cannot
  start it: macOS sandboxing blocks access to the "Claude Folder" path (`Operation not permitted`).
  Use the manual `python3 -m http.server` command above instead.
- `market-pulse/serve.py` is a leftover helper from debugging that path issue; the plain
  `http.server` command is the canonical way to run.

## Architecture

Three files, each one concern:

- `market-pulse/index.html` — DOM skeleton + static chrome (topbar, sidebar, filter bar, modal shell).
  Buttons in the static HTML use **inline `onclick`** and therefore depend on functions being exposed
  on `window` (see below).
- `market-pulse/styles.css` — Bloomberg-terminal dark theme. **All color/spacing is driven by CSS
  custom properties** defined in `:root` at the top. Change the palette there, not in component rules.
- `market-pulse/app.js` — everything else. Organized into clearly commented `/* ─── section ─── */`
  blocks (config, state, init, data loading, rendering, favorites, modals, utilities).

### Data flow

Two independent live sources, each with a fallback so the UI is never empty:

1. **News** (`loadNews` → `fetchFeed`): RSS feeds listed in `FEEDS`. Browsers can't fetch RSS
   cross-origin, so requests go through **`api.rss2json.com` (primary, returns JSON)** and fall back
   to **`corsproxy.io` + manual `DOMParser` XML parsing** (`parseXmlFeed`). Raw feed items are
   normalized into the article model by `parseRss2JsonItems` / `parseXmlFeed`.
2. **Market data** (`loadMarketData`): layered, because no single free key-less source covers
   everything reliably anymore. It starts from `snapshotMarket()` (every entry flagged `stale: true`),
   then overlays live data: **crypto from CoinGecko** (reliable, CORS-enabled, no key) and
   **indices/commodities/bonds/FX from Yahoo Finance via the allorigins proxy** (best effort — Yahoo
   rate-limits and may require auth). Any row still `stale` keeps the snapshot value, and
   `updateDataNotice()` reveals the `#data-notice` "demo prices" banner. For full live coverage, swap
   in a keyed provider (Finnhub / Twelve Data / Alpha Vantage).

**External-dependency rot is the main maintenance burden.** These free endpoints drift: `corsproxy.io`
(news fallback) already changed to a non-proxy landing page, and the original `PROXY` constant was once
referenced after deletion (silent crash → frozen snapshot). When market or news data looks stale,
suspect a dead/changed third-party endpoint first.

The "summarization / beginner-friendly" layer is **rule-based, not an LLM call**:
`classifyCat`, `classifyImpact`, `extractTerms`, and `generateExplain` are keyword/regex heuristics
that turn a raw headline+blurb into a categorized, explained article. The article object shape they
produce (`{ id, title, summary, link, date, source, cat, impact, explain, terms }`) is assumed
throughout rendering — keep it consistent if you add a new source.

### State & caching

- App state lives in module-level vars in the `state` section: `allArticles`, `marketData`,
  `currentCat`, `currentLvl`, `searchQ`, `favorites`.
- `localStorage` keys: `mpulse_news_v3` (cached articles, 6h TTL), `mpulse_market` (quotes),
  `mpulse_favs` (saved stories), `mpulse_claude_project` (user's Claude project URL).
- **When you change the article object shape, bump the version suffix on the news cache key**
  (`mpulse_news_v3` → `_v4`). Otherwise returning users get the old shape from cache and rendering
  breaks. (`getCache`/`setCache` handle TTL.)

### Two conventions that are load-bearing

1. **Event delegation, not interpolated inline handlers, for anything rendered from feed data.**
   Article titles contain apostrophes and quotes (e.g. "Warsh's Debut"), which silently break
   `onclick="fn('...')"` strings. Feed-rendered controls therefore use `data-*` attributes (e.g.
   `data-ask`, `data-fav`, `data-term`, `data-id`) read by a single delegated listener on
   `#news-feed` in the init block. Follow this pattern for any new interactive element in a card.
   (Static HTML in `index.html` may keep inline `onclick` since its strings are author-controlled.)
2. **Functions called from `index.html`'s inline `onclick` must be attached to `window`** at the
   bottom of `app.js` (the `expose globals` block). Adding a function and wiring it to an inline
   handler without exposing it will throw a ReferenceError.

### Ask-AI integration (`askAI`)

Dual-mode by design:
- Inside the Claude.ai artifact host, a global `sendPrompt()` exists and is used directly.
- As a standalone site, it copies a richly-structured teaching prompt (built by `buildPrompt`) to the
  clipboard and opens Claude in a **single reused tab** (`window.open(url, 'mpClaude')`). It cannot
  inject text into Claude.ai — that's a cross-origin browser security boundary — so it relies on the
  `?q=` URL param (best effort) plus clipboard paste. If `mpulse_claude_project` is set, it targets
  that project URL to preserve conversation context.

### Adding a market indicator

Symbols are Yahoo Finance tickers and must stay in sync across three structures: `TICKERS` (ribbon),
`SIDEBAR_GROUPS` + `SIDEBAR_NAMES` (sidebar), and `INDICATORS` (the "Learn indices" modal, which also
shows the live value). `formatPrice` has per-symbol formatting rules (yields, FX, crypto) — extend it
for new symbol types.
