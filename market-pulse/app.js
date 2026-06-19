'use strict';

/* ─── ask-AI ──────────────────────────────────────────────
   Inside the Claude.ai app a global sendPrompt() exists.
   As a standalone website it doesn't — so we open Claude and
   pre-fill the question via the ?q= param, plus copy it to the
   clipboard as a guaranteed paste fallback. */
function askAI(prompt) {
  /* inside the Claude.ai app, just send it inline */
  if (typeof window.sendPrompt === 'function') {
    window.sendPrompt(prompt);
    return;
  }

  /* always copy to clipboard so paste is one keystroke if auto-fill fails */
  try { navigator.clipboard.writeText(prompt); } catch (_) {}
  const pasteKey = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘V' : 'Ctrl+V';

  const project = (localStorage.getItem('mpulse_claude_project') || '').trim();
  let url;
  if (project) {
    /* append ?q= so Claude pre-fills inside your project when supported;
       clipboard copy above covers the case where it opens empty */
    const sep = project.includes('?') ? '&' : '?';
    url = project + sep + 'q=' + encodeURIComponent(prompt);
    showToast('Copied ✓  Opening your project — if the box is empty, press ' + pasteKey + ' then Enter');
  } else {
    url = 'https://claude.ai/new?q=' + encodeURIComponent(prompt);
    showToast('Sent to Claude ✓  Tip: link a project in ⚙ Settings to keep one ongoing chat');
  }
  window.open(url, 'mpClaude');
}

/* build a rich, beginner-focused teaching prompt for a story */
function buildPrompt(kind, title, summary) {
  const ctx = `News headline: "${title}"` + (summary ? `\nContext: ${summary}` : '');
  if (kind === 'impact') {
    return `I'm a beginner teaching myself finance and personal investing. ${ctx}

Please help me learn from this story by covering, with clear headers:
1. **In plain English** — what happened, no jargon.
2. **Why it matters to an everyday person** — concrete effects on my savings, loans/mortgage, job, daily costs, and investments.
3. **An analogy** — a simple real-world comparison that makes it click.
4. **Key terms defined** — define every finance term involved, simply.
5. **A worked example** — a small, specific numeric example showing the impact.
6. **Beginner takeaway** — what a learner should watch next (educational, not financial advice).

Keep it friendly and assume I'm starting from zero.`;
  }
  return `I'm a beginner teaching myself finance. ${ctx}

Please explain this so I actually learn, with clear headers:
1. **Simple summary** — explain it like I'm new to finance, no jargon.
2. **Analogy** — a relatable real-world comparison.
3. **Key terms defined** — list and define every financial term in this story, in plain language.
4. **A concrete example** — a small, specific example (with numbers if useful) that shows how this works.
5. **Why it's important** — what it signals about the economy or markets and who it affects.

Keep the tone friendly and beginner-focused.`;
}

function showToast(msg) {
  let t = document.getElementById('mp-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'mp-toast';
    t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#0d1526;border:1px solid #243654;color:#cbd5e1;padding:10px 18px;border-radius:6px;font-size:13px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.5);transition:opacity .3s';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2600);
}

/* ─── config ─────────────────────────────────────────── */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_PER_FEED = 6;

/* Twelve Data free API key. For security it is NOT stored in this (public) source —
   the user pastes it in Settings and it lives in their browser's localStorage
   (key `mpulse_td_key`). Powers live indices, commodities & forex; free tier is
   8 symbols/min, so we request exactly 8 below. Empty = Yahoo fallback / demo. */
const TD_KEY = '';

/* The free tier doesn't carry raw index/oil symbols, so we track the ETFs that
   mirror them (real, live prices). These rows are relabelled + shown as $ prices. */
const ETF_PROXY = { '^GSPC': 'SPY', '^IXIC': 'QQQ', '^DJI': 'DIA', 'CL=F': 'USO' };

/* credible sources — all verified working via rss2json free tier */
const FEEDS = [
  { name: 'Bloomberg',    url: 'https://feeds.bloomberg.com/markets/news.rss' },
  { name: 'CNBC',         url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258' },
  { name: 'Yahoo Finance',url: 'https://finance.yahoo.com/rss/topstories' },
  { name: 'NYT Business', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml' },
  { name: 'FT Markets',   url: 'https://www.ft.com/markets?format=rss' },
  { name: 'The Economist',url: 'https://www.economist.com/finance-and-economics/rss.xml' },
  { name: 'Sky Business', url: 'https://feeds.skynews.com/feeds/rss/business.xml' }
];

/* rss2json.com free tier — returns JSON, no XML parsing, good CORS support */
const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';
/* fallback CORS proxy for raw XML */
const PROXY_FALLBACK = 'https://corsproxy.io/?';

/* market tickers fetched from Yahoo Finance via proxy */
const TICKERS = [
  { sym: '^GSPC', label: 'S&P 500', abbr: 'SPX' },
  { sym: '^IXIC', label: 'Nasdaq', abbr: 'COMP' },
  { sym: '^DJI',  label: 'Dow Jones', abbr: 'DJIA' },
  { sym: 'BTC-USD', label: 'Bitcoin', abbr: 'BTC' },
  { sym: 'ETH-USD', label: 'Ethereum', abbr: 'ETH' },
  { sym: 'GC=F',   label: 'Gold', abbr: 'XAU' },
  { sym: 'CL=F',   label: 'WTI Crude', abbr: 'OIL' },
  { sym: '^TNX',   label: '10Y Yield', abbr: 'UST10' },
  { sym: 'EURUSD=X', label: 'EUR/USD', abbr: 'EUR' },
  { sym: 'JPY=X',  label: 'USD/JPY', abbr: 'JPY' }
];

const SIDEBAR_GROUPS = [
  { label: 'US Indices', syms: ['^GSPC','^IXIC','^DJI','^RUT'] },
  { label: 'Crypto', syms: ['BTC-USD','ETH-USD','SOL-USD'] },
  { label: 'Commodities', syms: ['GC=F','CL=F','SI=F'] },
  { label: 'Bonds', syms: ['^TNX','^TYX','HYG'] },
  { label: 'Forex', syms: ['EURUSD=X','JPY=X','GBPUSD=X'] }
];

const SIDEBAR_NAMES = {
  '^GSPC':'S&P 500 · SPY','^IXIC':'Nasdaq 100 · QQQ','^DJI':'Dow 30 · DIA','^RUT':'Russell 2000',
  'BTC-USD':'Bitcoin','ETH-USD':'Ethereum','SOL-USD':'Solana',
  'GC=F':'Gold','CL=F':'Crude oil · USO','SI=F':'Silver',
  '^TNX':'10Y Yield','^TYX':'30Y Yield','HYG':'HY Corp Bonds',
  'EURUSD=X':'EUR / USD','JPY=X':'USD / JPY','GBPUSD=X':'GBP / USD'
};

/* ─── glossary ───────────────────────────────────────── */
const GLOSSARY = [
  { term: 'S&P 500', def: 'A list of 500 large US companies used as the main benchmark for the US stock market.' },
  { term: 'Earnings', def: 'The profit a company reports — better-than-expected earnings usually push a stock higher.' },
  { term: 'Bull market', def: 'A period of rising prices and investor optimism, generally a 20%+ rise from a recent low.' },
  { term: 'Bear market', def: 'A period of falling prices, generally a 20%+ drop from a recent peak.' },
  { term: 'Interest rate', def: 'The cost of borrowing money. Higher rates slow borrowing and spending; lower rates stimulate them.' },
  { term: 'Inflation', def: 'When prices rise over time, meaning each dollar buys less than before.' },
  { term: 'Federal Reserve', def: 'The US central bank. It sets interest rates and manages the money supply to keep the economy stable.' },
  { term: 'GDP', def: 'Gross Domestic Product — the total value of all goods and services a country produces in a year.' },
  { term: 'ETF', def: 'A fund you buy on a stock exchange that tracks a basket of assets (e.g., all S&P 500 stocks).' },
  { term: 'Yield', def: 'The return on a bond. When bond prices fall, yields rise — they move in opposite directions.' },
  { term: 'Treasury bond', def: 'A loan to the US government that pays fixed interest. Considered the safest investment in the world.' },
  { term: 'Basis point', def: 'One-hundredth of a percent (0.01%). Used for small rate changes: 25bps = 0.25%.' },
  { term: 'Volatility', def: 'How much a price swings up and down. High volatility = more uncertainty and risk.' },
  { term: 'OPEC', def: 'A group of major oil-producing countries that coordinate production to influence global oil prices.' },
  { term: 'Market cap', def: 'A company\'s total stock value = share price × number of shares. Measures company size.' },
  { term: 'Recession', def: 'Two consecutive quarters of negative GDP growth — the economy is shrinking.' },
  { term: 'Quantitative easing', def: 'When a central bank buys bonds to inject money into the economy and lower long-term rates.' },
  { term: 'Hedge fund', def: 'A private investment fund that uses advanced strategies and often takes on higher risk.' },
  { term: 'Commodity', def: 'Raw materials like oil, gold, wheat, or copper that are traded on global exchanges.' },
  { term: 'Blockchain', def: 'A decentralized, tamper-proof digital ledger — the technology behind cryptocurrencies.' }
];

/* ─── indicator library ───────────────────────────────
   Plain-English explanation of every symbol in the ribbon
   & sidebar. Grouped for the "Learn indices" modal. */
const INDICATORS = {
  '^GSPC': { group:'Stock indices', name:'S&P 500 (tracked via SPY)', what:'Tracks the 500 largest US public companies — the most-watched gauge of the US stock market. The live price shown is SPY, the ETF that mirrors the index (this is how most beginners actually buy it).', why:'When it rises, most large US companies are gaining value — good for retirement funds and index investors. <b>Up = optimism, down = caution.</b>' },
  '^IXIC': { group:'Stock indices', name:'Nasdaq 100 (tracked via QQQ)', what:'Tracks the 100 biggest non-financial Nasdaq companies, heavily weighted toward tech like Apple, Microsoft and Nvidia. Live price shown is QQQ, the ETF that mirrors it.', why:'Moves more sharply than the S&P 500. <b>A tech-heavy "risk appetite" thermometer</b> — it soars in tech booms and falls hard in selloffs.' },
  '^DJI':  { group:'Stock indices', name:'Dow 30 (tracked via DIA)', what:'Tracks 30 large, established US "blue-chip" companies — the oldest famous US index. Live price shown is DIA, the ETF that mirrors it.', why:'A snapshot of big, stable household-name firms. <b>Less tech-driven</b> than the Nasdaq, so it tells a steadier story.' },
  '^RUT':  { group:'Stock indices', name:'Russell 2000', what:'Tracks 2,000 small US companies ("small caps").', why:'Small firms depend most on the domestic economy. <b>A leading clue on US growth and risk-taking</b> — rises when investors feel bold.' },
  'BTC-USD':{ group:'Crypto', name:'Bitcoin', what:'The first and largest cryptocurrency — a digital asset not controlled by any government or bank.', why:'Highly volatile. <b>Often seen as a "risk-on" bet</b> and sometimes as a hedge against currency weakness. Can move 10%+ in a day.' },
  'ETH-USD':{ group:'Crypto', name:'Ethereum', what:'The second-largest cryptocurrency. Its network powers apps, smart contracts and most of the crypto economy.', why:'Tends to follow Bitcoin but swings even more. <b>A barometer for the broader crypto/tech-innovation mood.</b>' },
  'SOL-USD':{ group:'Crypto', name:'Solana', what:'A fast, lower-cost blockchain competing with Ethereum for apps and trading.', why:'A higher-risk "altcoin." <b>Rises sharply in crypto rallies</b>, falls hardest in downturns.' },
  'GC=F':  { group:'Commodities', name:'Gold', what:'The price of one ounce of gold, the classic "safe haven" asset.', why:'Investors buy gold when they\'re nervous about inflation, war, or falling currencies. <b>Rising gold often signals fear</b> in markets.' },
  'CL=F':  { group:'Commodities', name:'Crude oil (tracked via USO)', what:'Crude oil drives gas, shipping and manufacturing costs. The live price shown is USO, the ETF that follows the price of oil.', why:'<b>Higher oil = higher inflation</b> and pressure on consumers; lower oil eases costs.' },
  'SI=F':  { group:'Commodities', name:'Silver', what:'The price of silver — both a precious metal and an industrial material used in electronics and solar panels.', why:'Acts partly like gold (a safe haven) and partly like an industrial metal. <b>Reflects both fear and factory demand.</b>' },
  '^TNX':  { group:'Bonds & rates', name:'10-Year Treasury Yield', what:'The interest rate the US government pays to borrow money for 10 years. The world\'s most important interest rate.', why:'Sets the baseline for mortgages, car loans and savings rates. <b>Rising yields make borrowing pricier</b> and can pull stocks down.' },
  '^TYX':  { group:'Bonds & rates', name:'30-Year Treasury Yield', what:'The interest rate on 30-year US government debt — the longest-term benchmark.', why:'Reflects long-run inflation and growth expectations. <b>A rising 30-year yield signals concern</b> about future inflation or debt.' },
  'HYG':   { group:'Bonds & rates', name:'High-Yield Corporate Bonds', what:'An ETF holding bonds from riskier ("junk-rated") companies that pay higher interest.', why:'When it falls, investors are worried companies might not repay debts. <b>An early warning sign for credit stress.</b>' },
  'EURUSD=X':{ group:'Currencies (Forex)', name:'EUR / USD', what:'How many US dollars one euro buys — the world\'s most-traded currency pair.', why:'Reflects the relative strength of the US vs. European economies. <b>A falling number means a stronger dollar.</b>' },
  'JPY=X': { group:'Currencies (Forex)', name:'USD / JPY', what:'How many Japanese yen one US dollar buys.', why:'The yen is a classic "safe haven." <b>When markets panic, the yen often strengthens</b> (this number falls).' },
  'GBPUSD=X':{ group:'Currencies (Forex)', name:'GBP / USD', what:'How many US dollars one British pound buys (nicknamed "cable").', why:'A gauge of UK economic health vs. the US. <b>Falls when the UK outlook weakens.</b>' }
};

/* ─── state ──────────────────────────────────────────── */
let allArticles = [];
let marketData  = {};
let currentCat  = 'all';
let currentLvl  = 'beginner';
let searchQ     = '';
let refreshTimer = null;
let favorites   = loadFavorites();

/* ─── init ───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  startClock();
  renderGlossary();
  renderSkeletons();
  updateSavedCount();
  loadAll();

  document.getElementById('search').addEventListener('input', e => {
    searchQ = e.target.value.toLowerCase().trim();
    renderFeed();
  });

  /* Escape closes any open modal */
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  /* clicking the ribbon or sidebar opens the indicator library */
  document.getElementById('ticker-track').addEventListener('click', openIndicatorLibrary);
  document.getElementById('sidebar-markets').addEventListener('click', openIndicatorLibrary);

  /* delegated clicks for ask buttons & term pills (safe against quotes in titles) */
  document.getElementById('news-feed').addEventListener('click', e => {
    const favBtn = e.target.closest('[data-fav]');
    if (favBtn) {
      e.stopPropagation();
      toggleFavorite(favBtn.getAttribute('data-fav'), favBtn);
      return;
    }
    const askBtn = e.target.closest('[data-ask]');
    if (askBtn) {
      e.stopPropagation();
      const id = askBtn.getAttribute('data-id') || '';
      const art = allArticles.find(x => x.id === id) || Object.values(favorites).find(x => x.id === id);
      const title = art ? art.title : (askBtn.getAttribute('data-title') || '');
      const summary = art ? art.summary : '';
      askAI(buildPrompt(askBtn.getAttribute('data-ask'), title, summary));
      return;
    }
    const termPill = e.target.closest('[data-term]');
    if (termPill) {
      e.stopPropagation();
      highlightGlossary(termPill.getAttribute('data-term'), e);
    }
  });
});

/* ─── clock ──────────────────────────────────────────── */
function startClock() {
  const el = document.getElementById('clock');
  const tick = () => {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' });
  };
  tick();
  setInterval(tick, 1000);
}

/* ─── load everything ────────────────────────────────── */
async function loadAll() {
  document.getElementById('refresh-btn').disabled = true;
  document.getElementById('refresh-btn').innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
      <path d="M21 12a9 9 0 11-3-6.7"/>
    </svg> Refreshing…`;

  await Promise.all([loadMarketData(), loadNews()]);

  document.getElementById('refresh-btn').disabled = false;
  document.getElementById('refresh-btn').innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12a9 9 0 11-3-6.7"/>
    </svg> Refresh`;

  updateLastRefreshed();
}

/* ─── market data ─────────────────────────────────────── */
async function loadMarketData() {
  const cacheKey = 'mpulse_market';
  const cached = getCache(cacheKey);
  if (cached) {
    marketData = cached;
    renderMarket();
    renderTicker();
    renderStatCards();
    return;
  }

  /* start from a snapshot so the UI is never empty; everything is flagged
     stale: true and only cleared when a live source overwrites it */
  marketData = snapshotMarket();
  let gotLive = false;

  /* 1. crypto — CoinGecko: free, CORS-enabled, no API key, reliable */
  try {
    const cg = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true', { signal: AbortSignal.timeout(8000) });
    const d = await cg.json();
    const map = { 'BTC-USD': 'bitcoin', 'ETH-USD': 'ethereum', 'SOL-USD': 'solana' };
    Object.entries(map).forEach(([sym, id]) => {
      if (d[id]) {
        marketData[sym] = { price: d[id].usd, change: 0, changePct: d[id].usd_24h_change, name: SIDEBAR_NAMES[sym], stale: false };
        gotLive = true;
      }
    });
  } catch (_) {}

  /* 2. indices (via ETFs) / gold / FX — Twelve Data (reliable, free key required).
     Exactly 8 symbols to stay inside the free 8/min limit. Key from browser storage. */
  const tdKey = (localStorage.getItem('mpulse_td_key') || TD_KEY || '').trim();
  if (tdKey) {
    try {
      const tdMap = {
        '^GSPC': 'SPY', '^IXIC': 'QQQ', '^DJI': 'DIA',
        'CL=F': 'USO', 'GC=F': 'XAU/USD',
        'EURUSD=X': 'EUR/USD', 'JPY=X': 'USD/JPY', 'GBPUSD=X': 'GBP/USD'
      };
      const tdSyms = [...new Set(Object.values(tdMap))].join(',');
      const r = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(tdSyms)}&apikey=${tdKey}`, { signal: AbortSignal.timeout(9000) });
      const d = await r.json();
      Object.entries(tdMap).forEach(([ysym, tsym]) => {
        // batch responses are keyed by symbol; a single symbol returns a flat object
        const q = d[tsym] || (d.symbol === tsym ? d : null);
        if (q && q.close != null && !q.code) {
          marketData[ysym] = {
            price: +q.close,
            change: +q.change || 0,
            changePct: +q.percent_change || 0,
            name: SIDEBAR_NAMES[ysym] || q.name || ysym,
            stale: false,
            etf: !!ETF_PROXY[ysym]
          };
          gotLive = true;
        }
      });
    } catch (_) {}
  }

  /* 3. anything still on the snapshot (e.g. bond yields ^TNX/^TYX, HYG, or
     symbols TD didn't return) — try Yahoo Finance via proxy as a last resort. */
  try {
    const stillStale = [...new Set(SIDEBAR_GROUPS.flatMap(g => g.syms))].filter(s => marketData[s] && marketData[s].stale);
    if (stillStale.length) {
      const y = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${stillStale.join(',')}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,shortName`;
      const res = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent(y), { signal: AbortSignal.timeout(9000) });
      const wrapper = await res.json();
      const data = JSON.parse(wrapper.contents);
      const quotes = data?.quoteResponse?.result || [];
      quotes.forEach(q => {
        if (q.regularMarketPrice != null) {
          marketData[q.symbol] = {
            price: q.regularMarketPrice,
            change: q.regularMarketChange,
            changePct: q.regularMarketChangePercent,
            name: q.shortName || SIDEBAR_NAMES[q.symbol] || q.symbol,
            stale: false
          };
          gotLive = true;
        }
      });
    }
  } catch (_) {}

  if (gotLive) setCache(cacheKey, marketData);

  renderMarket();
  renderTicker();
  renderStatCards();
  updateDataNotice();
}

/* static snapshot — every entry flagged stale so the UI can label it */
function snapshotMarket() {
  const s = {
    '^GSPC':  { price: 5847.23, changePct: 2.38, name: 'S&P 500' },
    '^IXIC':  { price: 19213.5, changePct: 3.11, name: 'Nasdaq' },
    '^DJI':   { price: 42180.1, changePct: 1.58, name: 'Dow Jones' },
    '^RUT':   { price: 2148.7,  changePct: -0.57, name: 'Russell 2000' },
    'BTC-USD':{ price: 105200,  changePct: 12.1, name: 'Bitcoin' },
    'ETH-USD':{ price: 3821,    changePct: 5.96, name: 'Ethereum' },
    'SOL-USD':{ price: 178.4,   changePct: 4.82, name: 'Solana' },
    'GC=F':   { price: 2341,    changePct: 0.81, name: 'Gold' },
    'CL=F':   { price: 71.4,    changePct: -3.83, name: 'WTI Crude' },
    'SI=F':   { price: 29.14,   changePct: 1.07, name: 'Silver' },
    '^TNX':   { price: 4.312,   changePct: 1.48, name: '10Y Yield' },
    '^TYX':   { price: 4.571,   changePct: 1.58, name: '30Y Yield' },
    'HYG':    { price: 79.12,   changePct: -0.35, name: 'HY Corp Bonds' },
    'EURUSD=X':{ price: 1.0892, changePct: 0.40, name: 'EUR / USD' },
    'JPY=X':  { price: 157.2,   changePct: -0.53, name: 'USD / JPY' },
    'GBPUSD=X':{ price: 1.2741, changePct: 0.41, name: 'GBP / USD' }
  };
  Object.values(s).forEach(v => { v.change = 0; v.stale = true; });
  return s;
}

/* show a clear notice if any visible market data is snapshot/demo */
function updateDataNotice() {
  const anyStale = Object.values(marketData).some(v => v.stale);
  const el = document.getElementById('data-notice');
  if (el) el.style.display = anyStale ? 'block' : 'none';
}

/* ─── render sidebar market ───────────────────────────── */
function renderMarket() {
  const el = document.getElementById('sidebar-markets');
  el.innerHTML = SIDEBAR_GROUPS.map(group => `
    <div class="side-section">
      <div class="side-header"><span class="side-label">${group.label}</span></div>
      ${group.syms.map(sym => {
        const q = marketData[sym];
        if (!q) return '';
        const dir = q.changePct > 0.05 ? 'up' : q.changePct < -0.05 ? 'dn' : 'flat';
        const arrow = dir === 'up' ? '▲' : dir === 'dn' ? '▼' : '—';
        const pct = q.changePct != null ? (q.changePct > 0 ? '+' : '') + q.changePct.toFixed(2) + '%' : '—';
        const price = formatPrice(sym, q.price);
        return `
          <div class="market-row">
            <div>
              <div class="mkt-name">${SIDEBAR_NAMES[sym] || q.name}</div>
              <div class="mkt-sym">${sym}</div>
            </div>
            <div class="mkt-right">
              <div class="mkt-val">${price}</div>
              <div class="mkt-chg ${dir}">${arrow} ${pct}</div>
            </div>
          </div>`;
      }).join('')}
    </div>
    <hr class="side-divider">
  `).join('');
}

function formatPrice(sym, val) {
  if (val == null) return '—';
  const md = marketData[sym];
  if (md && md.etf) return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (sym === 'BTC-USD' || sym === 'ETH-USD') return '$' + val.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (sym === 'SOL-USD') return '$' + val.toFixed(2);
  if (sym === '^TNX' || sym === '^TYX') return val.toFixed(3) + '%';
  if (sym === 'GC=F' || sym === 'SI=F') return '$' + val.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (sym === 'CL=F') return '$' + val.toFixed(2);
  if (sym.includes('USD') || sym.includes('JPY')) return val < 10 ? val.toFixed(4) : val.toFixed(2);
  if (sym.startsWith('^')) return val.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return val.toFixed(2);
}

/* ─── render ticker tape ──────────────────────────────── */
function renderTicker() {
  const allSyms = TICKERS.map(t => t.sym);
  const items = allSyms.map(sym => {
    const q = marketData[sym];
    if (!q) return null;
    const dir = q.changePct > 0.05 ? 'up' : q.changePct < -0.05 ? 'dn' : 'flat';
    const pct = q.changePct != null ? (q.changePct > 0 ? '+' : '') + q.changePct.toFixed(2) + '%' : '—';
    const t = TICKERS.find(x => x.sym === sym);
    return `<span class="tick-item">
      <span class="tick-sym">${t ? t.abbr : sym}</span>
      <span class="tick-val">${formatPrice(sym, q.price)}</span>
      <span class="tick-chg ${dir}">${pct}</span>
    </span>`;
  }).filter(Boolean);

  const doubled = [...items, ...items].join('');
  document.getElementById('ticker-track').innerHTML = doubled;
}

/* ─── stat cards ──────────────────────────────────────── */
function renderStatCards() {
  const spx = marketData['^GSPC'];
  const btc = marketData['BTC-USD'];
  const oil = marketData['CL=F'];
  const tsy = marketData['^TNX'];

  const cards = [
    {
      label: spx && spx.etf ? 'S&P 500 · SPY' : 'S&P 500',
      val: spx ? formatPrice('^GSPC', spx.price) : '—',
      sub: spx ? (spx.changePct > 0 ? '▲' : '▼') + ' ' + Math.abs(spx.changePct).toFixed(2) + '% today' : '',
      color: spx ? (spx.changePct >= 0 ? 'green' : 'red') : 'blue'
    },
    {
      label: 'Bitcoin',
      val: btc ? '$' + btc.price.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—',
      sub: btc ? (btc.changePct > 0 ? '▲' : '▼') + ' ' + Math.abs(btc.changePct).toFixed(2) + '% today' : '',
      color: btc ? (btc.changePct >= 0 ? 'green' : 'red') : 'gold'
    },
    {
      label: oil && oil.etf ? 'Crude oil · USO' : 'WTI Crude Oil',
      val: oil ? formatPrice('CL=F', oil.price) : '—',
      sub: oil ? (oil.changePct > 0 ? '▲' : '▼') + ' ' + Math.abs(oil.changePct).toFixed(2) + '% today' : '',
      color: oil ? (oil.changePct >= 0 ? 'green' : 'red') : 'gold'
    },
    {
      label: '10-Year Treasury',
      val: tsy ? tsy.price.toFixed(3) + '%' : '—',
      sub: tsy ? (tsy.changePct > 0 ? '▲' : '▼') + ' ' + Math.abs(tsy.change || 0).toFixed(3) + ' today' : '',
      color: tsy ? (tsy.changePct >= 0 ? 'red' : 'green') : 'blue' // inverted for bonds
    }
  ];

  document.getElementById('stat-cards').innerHTML = cards.map(c => `
    <div class="stat-card ${c.color}">
      <div class="stat-card-label">${c.label}</div>
      <div class="stat-card-val">${c.val}</div>
      <div class="stat-card-sub">${c.sub}</div>
    </div>
  `).join('');
}

/* ─── news loading ────────────────────────────────────── */
async function loadNews() {
  const cacheKey = 'mpulse_news_v3';
  const cached = getCache(cacheKey);
  if (cached) {
    allArticles = cached;
    renderFeed();
    return;
  }

  const results = await Promise.allSettled(FEEDS.map(f => fetchFeed(f)));
  allArticles = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      allArticles.push(...r.value);
    }
  });

  // deduplicate by headline similarity
  allArticles = dedup(allArticles);

  // sort newest first
  allArticles.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (allArticles.length === 0) {
    allArticles = getFallbackArticles();
  }

  setCache(cacheKey, allArticles);
  renderFeed();
}

async function fetchFeed(feed) {
  /* try rss2json first — returns clean JSON, no XML parsing */
  try {
    const res = await fetch(RSS2JSON + encodeURIComponent(feed.url), { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    if (data.status === 'ok' && Array.isArray(data.items) && data.items.length > 0) {
      return parseRss2JsonItems(data.items, feed.name);
    }
  } catch (_) {}

  /* fallback: corsproxy.io + manual XML parse */
  try {
    const res = await fetch(PROXY_FALLBACK + encodeURIComponent(feed.url), { signal: AbortSignal.timeout(10000) });
    const xml = await res.text();
    return parseXmlFeed(xml, feed.name);
  } catch (_) {}

  return [];
}

function parseRss2JsonItems(items, sourceName) {
  return items.slice(0, MAX_PER_FEED).map(item => {
    const title = (item.title || '').trim();
    if (title.length < 10) return null;
    const rawDesc = item.description || item.content || '';
    const cleanDesc = rawDesc.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
    const text = title + ' ' + cleanDesc;
    return {
      id: btoa(unescape(encodeURIComponent(title.slice(0, 28)))).replace(/[^a-z0-9]/gi, '').slice(0, 12),
      title,
      summary: cleanDesc || 'Click the source link to read the full story.',
      link: item.link || '',
      date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      source: sourceName,
      cat: classifyCat(text),
      impact: classifyImpact(text),
      explain: generateExplain(title, cleanDesc),
      terms: extractTerms(text)
    };
  }).filter(Boolean);
}

function parseXmlFeed(xml, sourceName) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const items = Array.from(doc.querySelectorAll('item')).slice(0, MAX_PER_FEED);
  return items.map(item => {
    const title = (item.querySelector('title')?.textContent || '').trim();
    if (title.length < 10) return null;
    const rawDesc = item.querySelector('description')?.textContent || '';
    const cleanDesc = rawDesc.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
    const link = item.querySelector('link')?.textContent?.trim() || '';
    const pubDate = item.querySelector('pubDate')?.textContent || '';
    const text = title + ' ' + cleanDesc;
    return {
      id: btoa(unescape(encodeURIComponent(title.slice(0, 28)))).replace(/[^a-z0-9]/gi, '').slice(0, 12),
      title,
      summary: cleanDesc || 'Click the source link to read the full story.',
      link,
      date: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      source: sourceName,
      cat: classifyCat(text),
      impact: classifyImpact(text),
      explain: generateExplain(title, cleanDesc),
      terms: extractTerms(text)
    };
  }).filter(Boolean);
}

/* ─── classification helpers ──────────────────────────── */
function classifyCat(text) {
  const t = text.toLowerCase();
  if (/bitcoin|ethereum|crypto|blockchain|defi|nft|solana|coin/.test(t)) return 'crypto';
  if (/oil|gold|silver|commodity|copper|wheat|grain|lumber|natural gas/.test(t)) return 'commodities';
  if (/treasury|bond|yield|debt|borrow|gilt|credit|fixed.income/.test(t)) return 'bonds';
  if (/euro|yen|yuan|forex|currency|exchange.rate|dollar/.test(t)) return 'forex';
  if (/fed|central bank|rate|inflation|gdp|recession|unemployment|cpi|jobs|economy/.test(t)) return 'economy';
  return 'stocks';
}

function classifyImpact(text) {
  const t = text.toLowerCase();
  const pos = /surge|soar|rise|gain|jump|rally|record|beat|boost|growth|strong|bullish|climb/.test(t);
  const neg = /fall|drop|decline|plunge|crash|miss|weak|slowdown|recession|loss|bearish|slump/.test(t);
  if (pos && !neg) return 'up';
  if (neg && !pos) return 'dn';
  return 'flat';
}

function extractTerms(text) {
  const all = GLOSSARY.map(g => g.term);
  return all.filter(t => text.toLowerCase().includes(t.toLowerCase())).slice(0, 5);
}

function generateExplain(title, desc) {
  // simple rule-based beginner explanation enrichment
  const t = (title + ' ' + desc).toLowerCase();
  if (/federal reserve|fed rate|interest rate/.test(t))
    return 'The Federal Reserve (the "Fed") controls borrowing costs for the entire US economy. When it raises rates, loans get more expensive — mortgages, car loans, credit cards all cost more. When it cuts rates, borrowing becomes cheaper and spending tends to increase.';
  if (/bitcoin|crypto/.test(t))
    return 'Cryptocurrencies are digital assets not controlled by any government. Their prices move on supply, demand, investor sentiment, and regulatory news. They are high risk, high potential reward — prices can double or halve in weeks.';
  if (/s&p 500|nasdaq|stock market|equities/.test(t))
    return 'The stock market lets people buy tiny ownership stakes ("shares") in companies. When companies earn more money, share prices tend to rise. The S&P 500 tracks 500 large US companies and is the most-watched market benchmark worldwide.';
  if (/oil|opec|crude/.test(t))
    return 'Oil prices affect almost everything — transportation, manufacturing, heating. When oil gets cheaper, companies and consumers save money (good for the economy). Higher oil prices push up inflation. OPEC is the group of countries that largely controls global supply.';
  if (/inflation|cpi|prices/.test(t))
    return 'Inflation means prices are rising — the same dollar buys less than it used to. Central banks fight inflation by raising interest rates, which slows borrowing and spending. Too much inflation erodes savings; too little can signal a weak economy.';
  if (/gdp|growth|recession/.test(t))
    return 'GDP (Gross Domestic Product) measures the size of an economy. When GDP grows, people have more jobs and income. When GDP shrinks two quarters in a row, it is officially a recession — businesses cut costs, unemployment rises, and markets often fall.';
  if (/treasury|bond|yield/.test(t))
    return 'Government bonds are IOUs — you lend money to the government and they pay you interest. The "yield" is that interest rate. When investors feel uncertain about the economy, they buy bonds for safety, pushing yields down. Rising yields usually signal either higher inflation expectations or more government borrowing.';
  return desc.slice(0, 300) || 'This story covers developments in global financial markets. Click the source link to read the full report.';
}

function dedup(articles) {
  const seen = new Set();
  return articles.filter(a => {
    const key = a.title.toLowerCase().slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ─── render feed ─────────────────────────────────────── */
function renderFeed() {
  const el = document.getElementById('news-feed');

  /* "saved" is a special view: pull from the favorites store so starred
     stories stay readable even after they drop out of the live feed */
  const source = currentCat === 'saved' ? Object.values(favorites) : allArticles;

  let articles = source.filter(a => {
    if (currentCat !== 'all' && currentCat !== 'saved' && a.cat !== currentCat) return false;
    if (searchQ && !a.title.toLowerCase().includes(searchQ) && !a.summary.toLowerCase().includes(searchQ)) return false;
    return true;
  });

  if (currentCat === 'saved') articles.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));

  document.getElementById('story-count').textContent = articles.length;

  if (articles.length === 0) {
    const msg = currentCat === 'saved'
      ? 'No saved stories yet — tap the ☆ star on any story to save it here'
      : 'No stories match your filter';
    el.innerHTML = `
      <div class="feed-msg">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        ${msg}
      </div>`;
    return;
  }

  el.innerHTML = articles.map(a => articleHTML(a)).join('');
}

function articleHTML(a) {
  const dir = a.impact;
  const impactLabel = dir === 'up' ? '▲ Positive' : dir === 'dn' ? '▼ Caution' : '— Neutral';
  const timeAgo = relTime(a.date);
  const termsHTML = a.terms.length
    ? `<div class="terms-row">${a.terms.map(t => `<span class="term-pill" data-term="${escHtml(t)}">${escHtml(t)}</span>`).join('')}</div>`
    : '';
  const explainText = a.explain || a.summary;

  return `
  <article class="news-card" id="card-${a.id}">
    <div class="card-header" onclick="toggleCard('${a.id}')">
      <div>
        <div class="card-meta-row">
          <span class="cat-badge badge-${a.cat}">${a.cat}</span>
          <span class="source-tag">
            <span style="font-weight:600;color:var(--text-dim)">${a.source}</span>
            <span class="dot"></span>
            <span class="card-time">${timeAgo}</span>
          </span>
        </div>
        <div class="card-headline">${escHtml(a.title)}</div>
        <div class="card-tldr">${escHtml(a.summary.slice(0, 180))}${a.summary.length > 180 ? '…' : ''}</div>
      </div>
      <div class="card-right-col">
        <div style="display:flex;align-items:center;gap:8px">
          <button class="star-btn ${isFav(a.id) ? 'saved' : ''}" data-fav="${a.id}" title="Save to read later" aria-label="Save story">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          </button>
          <span class="impact-tag ${dir}">${impactLabel}</span>
        </div>
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </div>
    </div>
    <div class="card-body" id="body-${a.id}">
      <div class="explain-block">
        <div class="explain-block-label" id="explain-label-${a.id}">What this means — Beginner</div>
        <div class="explain-block-text" id="explain-text-${a.id}">${escHtml(explainText)}</div>
      </div>
      ${termsHTML}
      <div class="ask-row">
        <button class="ask-btn" data-ask="explain" data-id="${a.id}" data-title="${escHtml(a.title)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
          Explain simply ↗
        </button>
        <button class="ask-btn" data-ask="impact" data-id="${a.id}" data-title="${escHtml(a.title)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20"/></svg>
          Impact on me ↗
        </button>
        ${a.link ? `<div class="source-link">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Full story: <a href="${escHtml(a.link)}" target="_blank" rel="noopener">${a.source}</a>
        </div>` : ''}
      </div>
    </div>
  </article>`;
}

/* ─── toggle card ─────────────────────────────────────── */
function toggleCard(id) {
  const card = document.getElementById('card-' + id);
  const body = document.getElementById('body-' + id);
  const isOpen = card.classList.contains('expanded');

  document.querySelectorAll('.news-card.expanded').forEach(c => {
    c.classList.remove('expanded');
    c.querySelector('[id^=body-]').style.display = 'none';
  });

  if (!isOpen) {
    card.classList.add('expanded');
    body.style.display = 'block';
    updateExplainLevel(id);
  }
}

function updateExplainLevel(id) {
  const a = allArticles.find(x => x.id === id);
  if (!a) return;
  const label = document.getElementById('explain-label-' + id);
  const text = document.getElementById('explain-text-' + id);
  if (!label || !text) return;
  const lvlMap = { beginner: 'What this means — Beginner', intermediate: 'Analysis — Intermediate', expert: 'Expert view' };
  label.textContent = lvlMap[currentLvl] || lvlMap.beginner;

  if (currentLvl === 'beginner') {
    text.textContent = a.explain || a.summary;
  } else if (currentLvl === 'intermediate') {
    text.textContent = a.summary.length > 100 ? a.summary : (a.explain || a.summary);
  } else {
    text.textContent = a.title + '. ' + a.summary;
  }
}

/* ─── filter & level controls ─────────────────────────── */
function filterCat(cat, btn) {
  currentCat = cat;
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderFeed();
}

function setLevel(lvl, btn) {
  currentLvl = lvl;
  document.querySelectorAll('.level-seg button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.news-card.expanded').forEach(c => {
    const id = c.id.replace('card-', '');
    updateExplainLevel(id);
  });
}

/* ─── favorites ───────────────────────────────────────── */
function loadFavorites() {
  try { return JSON.parse(localStorage.getItem('mpulse_favs') || '{}'); }
  catch { return {}; }
}

function saveFavorites() {
  try { localStorage.setItem('mpulse_favs', JSON.stringify(favorites)); } catch (_) {}
}

function isFav(id) { return !!favorites[id]; }

function toggleFavorite(id, btn) {
  if (favorites[id]) {
    delete favorites[id];
    if (btn) btn.classList.remove('saved');
    showToast('Removed from saved');
  } else {
    const a = allArticles.find(x => x.id === id) || Object.values(favorites).find(x => x.id === id);
    if (a) {
      favorites[id] = { ...a, savedAt: Date.now() };
      if (btn) btn.classList.add('saved');
      showToast('Saved — find it under ★ Saved');
    }
  }
  saveFavorites();
  updateSavedCount();
  if (currentCat === 'saved') renderFeed();
}

function updateSavedCount() {
  const n = Object.keys(favorites).length;
  const el = document.getElementById('saved-count');
  if (el) el.textContent = n ? '(' + n + ')' : '';
}

/* ─── modal system ────────────────────────────────────── */
function openModal(title, bodyHTML) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function openIndicatorLibrary() {
  const groups = {};
  Object.entries(INDICATORS).forEach(([sym, ind]) => {
    (groups[ind.group] = groups[ind.group] || []).push([sym, ind]);
  });

  let html = `<p style="font-size:12px;color:var(--text-dim);line-height:1.7;margin-bottom:16px">
    Every number scrolling across the top ribbon, explained in plain English — with today's live value.
    These are the indicators professionals watch to read the global economy.</p>`;

  Object.entries(groups).forEach(([group, list]) => {
    html += `<div class="ind-group-label">${group}</div>`;
    list.forEach(([sym, ind]) => {
      const q = marketData[sym];
      let live = '<span style="color:var(--text-lo)">—</span>';
      if (q) {
        const dir = q.changePct > 0.05 ? 'up' : q.changePct < -0.05 ? 'dn' : 'flat';
        const arrow = dir === 'up' ? '▲' : dir === 'dn' ? '▼' : '—';
        const pct = q.changePct != null ? (q.changePct > 0 ? '+' : '') + q.changePct.toFixed(2) + '%' : '';
        live = `<span class="px">${formatPrice(sym, q.price)}</span><br><span class="chg ${dir}">${arrow} ${pct}</span>`;
      }
      html += `
        <div class="ind-card">
          <div class="ind-head">
            <div><span class="ind-name">${ind.name}</span> <span class="ind-sym">${sym}</span></div>
            <div class="ind-live">${live}</div>
          </div>
          <div class="ind-desc">${ind.what}</div>
          <div class="ind-why">${ind.why}</div>
        </div>`;
    });
  });

  openModal('Indicator library — what every number means', html);
}

function openSettings() {
  const current = localStorage.getItem('mpulse_claude_project') || '';
  const tdCurrent = localStorage.getItem('mpulse_td_key') || '';
  const html = `
    <div class="setting-block">
      <div class="setting-label">Live market-data API key (Twelve Data)</div>
      <div class="setting-hint">
        Paste your free <a href="https://twelvedata.com/register" target="_blank" rel="noopener" style="color:var(--accent)">Twelve Data</a>
        key to turn on live indices, gold, oil and forex. It's stored <b>only in this browser</b>
        (never uploaded or shared), so you enter it once per device. Crypto is always live without a key.
      </div>
      <input class="setting-input" id="td-key-input" placeholder="e.g. a1b2c3d4e5f6..." value="${escHtml(tdCurrent)}">
      <button class="setting-save" onclick="saveTdKey()">Save key</button>
    </div>
    <div class="setting-block">
      <div class="setting-label">Your Claude project link</div>
      <div class="setting-hint">
        Paste a Claude <b>Project</b> URL here. Then the "Explain simply" and "Impact on me" buttons
        always open <b>that same conversation</b> (in one reused tab) and copy the question to your clipboard —
        so Claude remembers everything you've already discussed.
      </div>
      <input class="setting-input" id="claude-project-input" placeholder="https://claude.ai/project/..." value="${escHtml(current)}">
      <button class="setting-save" onclick="saveClaudeProject()">Save</button>
    </div>
    <div class="setting-block">
      <div class="setting-label">How to create a project (one time)</div>
      <ol class="setting-steps">
        <li>Open <a href="https://claude.ai/projects" target="_blank" rel="noopener" style="color:var(--accent)">claude.ai/projects</a> and click <b>Create project</b>.</li>
        <li>Name it e.g. "My finance tutor".</li>
        <li>Open the project and copy its URL from your browser's address bar.</li>
        <li>Paste it above and click Save.</li>
      </ol>
    </div>`;
  openModal('Settings', html);
}

function saveClaudeProject() {
  const val = document.getElementById('claude-project-input').value.trim();
  if (val) {
    localStorage.setItem('mpulse_claude_project', val);
    showToast('Saved — questions now open your project');
  } else {
    localStorage.removeItem('mpulse_claude_project');
    showToast('Cleared — questions open a new Claude chat');
  }
  closeModal();
}

function saveTdKey() {
  const val = document.getElementById('td-key-input').value.trim();
  if (val) {
    localStorage.setItem('mpulse_td_key', val);
    showToast('Key saved — loading live prices…');
  } else {
    localStorage.removeItem('mpulse_td_key');
    showToast('Key cleared — using demo/fallback prices');
  }
  localStorage.removeItem('mpulse_market'); // bust cached quotes so live data loads now
  closeModal();
  loadMarketData();
}

/* ─── glossary ────────────────────────────────────────── */
function renderGlossary() {
  document.getElementById('glossary-grid').innerHTML = GLOSSARY.map(g => `
    <div class="g-card" id="gcard-${g.term.replace(/\s+/g,'-')}">
      <div class="g-term">${g.term}</div>
      <div class="g-def">${g.def}</div>
    </div>
  `).join('');
}

function toggleGlossary() {
  document.getElementById('glossary-section').classList.toggle('open');
}

function highlightGlossary(term, e) {
  if (e) e.stopPropagation();
  const sec = document.getElementById('glossary-section');
  sec.classList.add('open');
  const card = document.getElementById('gcard-' + term.replace(/\s+/g, '-'));
  if (card) {
    card.classList.add('highlight');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => card.classList.remove('highlight'), 2500);
  }
}

/* ─── skeletons ───────────────────────────────────────── */
function renderSkeletons() {
  const el = document.getElementById('news-feed');
  el.innerHTML = Array.from({ length: 5 }, () => `
    <div class="skeleton">
      <div class="skel-line" style="width:15%;height:10px;margin-bottom:10px"></div>
      <div class="skel-line" style="width:85%"></div>
      <div class="skel-line" style="width:65%"></div>
      <div class="skel-line" style="width:50%;height:10px;margin-top:4px"></div>
    </div>
  `).join('');
}

/* ─── last refreshed ──────────────────────────────────── */
function updateLastRefreshed() {
  const el = document.getElementById('last-refresh');
  if (el) el.textContent = 'Last refreshed ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/* ─── cache helpers ───────────────────────────────────── */
function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

function getCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return data;
  } catch { return null; }
}

/* ─── utility ─────────────────────────────────────────── */
function relTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escAttr(s) {
  return String(s).replace(/'/g,"&#39;").slice(0, 100);
}

/* ─── fallback articles (when all fetches fail) ───────── */
function getFallbackArticles() {
  return [
    {
      id:'fallback1', title:'Live data unavailable — check your connection',
      summary:'Could not load live news feeds. Make sure you are connected to the internet, then click Refresh.',
      date: new Date().toISOString(), source:'System', cat:'economy', impact:'flat',
      explain:'The dashboard fetches live stories from Reuters, AP, MarketWatch, CNBC, and Yahoo Finance. If you see this message, check your internet connection and try refreshing.',
      terms:[], link:''
    }
  ];
}

/* ─── expose globals needed by inline onclick ─────────── */
window.filterCat = filterCat;
window.setLevel  = setLevel;
window.toggleCard = toggleCard;
window.highlightGlossary = highlightGlossary;
window.toggleGlossary = toggleGlossary;
window.loadAll = loadAll;
window.askAI = askAI;
window.openIndicatorLibrary = openIndicatorLibrary;
window.openSettings = openSettings;
window.closeModal = closeModal;
window.saveClaudeProject = saveClaudeProject;
window.saveTdKey = saveTdKey;
window.toggleFavorite = toggleFavorite;
