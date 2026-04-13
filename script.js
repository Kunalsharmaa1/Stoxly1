/* ═══════════════════════════════════════════
   STOXLY — app.js
   All UI logic, navigation, chart rendering,
   watchlist management and interactions.
   ═══════════════════════════════════════════ */

/* ── State ───────────────────────────────── */
let currentStock = 'RELIANCE';
let currentTF    = '3M';
let watchlist    = ['RELIANCE', 'TCS', 'INFY', 'HDFC'];
let chartInstance = null;

/* ── DOM References ──────────────────────── */
const homeSearchInput = document.getElementById('homeSearch');
const analyzeBtn      = document.getElementById('analyzeBtn');
const loaderOverlay   = document.getElementById('loader');
const toastEl         = document.getElementById('toast');
const starBtn         = document.getElementById('starBtn');

/* ════════════════════════════════════════════
   NAVIGATION
   ════════════════════════════════════════════ */

/**
 * Switch to a named page and highlight the correct nav button.
 * @param {string} pageName  - 'home' | 'analyze' | 'watchlist' | 'profile'
 */
function goPage(pageName) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // Deactivate all nav items
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Show target page
  document.getElementById('page-' + pageName).classList.add('active');
  // Activate matching nav button
  document.getElementById('nav-' + pageName).classList.add('active');

  // Side effects per page
  if (pageName === 'watchlist') renderWatchlist();
  if (pageName === 'profile')   syncProfileStats();
  if (pageName === 'analyze')   renderAnalyze(currentStock);
}

// Wire up nav buttons
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => goPage(btn.dataset.page));
});

/* ════════════════════════════════════════════
   HOME PAGE
   ════════════════════════════════════════════ */

// Enable/disable Analyze button based on input
homeSearchInput.addEventListener('input', () => {
  const hasValue = homeSearchInput.value.trim().length > 0;
  analyzeBtn.classList.toggle('ready', hasValue);
});

// Timeframe selector
document.querySelectorAll('.tf-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTF = btn.dataset.tf;
    // If on analyze page, redraw chart with new timeframe
    if (document.getElementById('page-analyze').classList.contains('active')) {
      drawChart(currentStock);
    }
  });
});

// Quick-search chips
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    homeSearchInput.value = chip.dataset.sym;
    analyzeBtn.classList.add('ready');
  });
});

// Analyze button click
analyzeBtn.addEventListener('click', runAnalysis);

/**
 * Validate input, show loader, then switch to Analyze page.
 */
function runAnalysis() {
  const sym = homeSearchInput.value.trim().toUpperCase();

  if (!sym) return;

  if (!STOCKS[sym]) {
    showToast('Not found. Try: RELIANCE, TCS, INFY, HDFC, SBI');
    return;
  }

  showLoader();
  setTimeout(() => {
    hideLoader();
    currentStock = sym;
    goPage('analyze');
  }, 1100);
}

/* ════════════════════════════════════════════
   ANALYZE PAGE
   ════════════════════════════════════════════ */

/**
 * Render the full Analyze page for a given stock symbol.
 * @param {string} sym - Stock ticker, e.g. 'RELIANCE'
 */
function renderAnalyze(sym) {
  const s = STOCKS[sym];
  if (!s) return;
  currentStock = sym;

  const isUp = s.change >= 0;

  // ── Header ──────────────────────────────
  document.getElementById('analyzeTickerLabel').textContent = sym;
  document.getElementById('analyzePriceLabel').textContent  = '₹' + s.price.toFixed(2);

  const chEl = document.getElementById('analyzePriceChange');
  chEl.textContent = (isUp ? '▲ +' : '▼ ') + Math.abs(s.change).toFixed(1) +
                     ' (' + Math.abs(s.changePct).toFixed(2) + '%)';
  chEl.className = 'price-change ' + (isUp ? 'up' : 'down');

  // ── Star button ──────────────────────────
  updateStarButton(sym);

  // ── RSI ─────────────────────────────────
  document.getElementById('rsiVal').textContent   = s.rsi;
  const rsiEl = document.getElementById('rsiLabel');
  rsiEl.textContent = s.rsiLabel;
  rsiEl.className   = 'ind-sub ' + sentimentColor(s.rsiLabel, 'rsi');

  // ── MACD ────────────────────────────────
  const macdValEl = document.getElementById('macdVal');
  macdValEl.textContent = s.macd;
  macdValEl.className   = 'ind-value sm ' + sentimentColor(s.macd, 'signal');

  const macdLblEl = document.getElementById('macdLabel');
  macdLblEl.textContent = s.macdLabel;
  macdLblEl.className   = 'ind-sub ' + sentimentColor(s.macdLabel, 'strength');

  // ── MA ──────────────────────────────────
  const maValEl = document.getElementById('maVal');
  maValEl.textContent = s.ma;
  maValEl.className   = 'ind-value sm ' + sentimentColor(s.ma, 'trend');

  const maLblEl = document.getElementById('maLabel');
  maLblEl.textContent = s.maLabel;
  maLblEl.className   = 'ind-sub ' + sentimentColor(s.maLabel, 'sentiment');

  // ── Signal box ──────────────────────────
  const signalBox = document.getElementById('signalBox');
  signalBox.className = 'signal-box ' + s.signal.toLowerCase();
  document.getElementById('signalWord').textContent = s.signal;
  document.getElementById('confVal').textContent    = s.confidence + '%';

  const riskEl = document.getElementById('riskVal');
  riskEl.textContent = s.risk;
  riskEl.className   = 'signal-meta-val risk-' + s.risk.toLowerCase();

  // ── Why points ──────────────────────────
  document.getElementById('whyPoints').innerHTML = s.why
    .map(w => `<div class="why-point"><div class="why-dot"></div><div>${w}</div></div>`)
    .join('');

  // ── News ────────────────────────────────
  document.getElementById('newsItems').innerHTML = s.news
    .map(n => `
      <div class="news-item">
        <span>${n.title}</span>
        <span class="news-time">${n.time}</span>
      </div>`)
    .join('');

  // ── Chart ───────────────────────────────
  drawChart(sym);
}

/**
 * Return a CSS colour class based on the value and context.
 * @param {string} value   - The indicator value/label
 * @param {string} context - Hint about what kind of value this is
 */
function sentimentColor(value, context) {
  const v = value.toLowerCase();
  if (['bullish', 'uptrend', 'positive', 'strong', 'oversold'].includes(v)) return 'green';
  if (['bearish', 'downtrend', 'negative', 'weak', 'overbought'].includes(v)) return 'red';
  return 'orange'; // neutral, moderate, sideways, stable, etc.
}

/* ── Chart ─────────────────────────────────────────────────────────────────── */

/**
 * Draw (or redraw) the price line chart using Chart.js.
 * @param {string} sym - Stock ticker
 */
function drawChart(sym) {
  const s = STOCKS[sym];
  const data = s.chart[currentTF];

  // Build x-axis labels based on timeframe
  const labels = buildChartLabels(currentTF, data.length);

  // Destroy previous chart instance to avoid canvas reuse error
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const canvas = document.getElementById('stockChart');
  const ctx    = canvas.getContext('2d');
  const isUp   = s.change >= 0;
  const color  = isUp ? '#22c55e' : '#ef4444';

  // Gradient fill under the line
  const gradient = ctx.createLinearGradient(0, 0, 0, 180);
  gradient.addColorStop(0, isUp ? 'rgba(34,197,94,0.28)' : 'rgba(239,68,68,0.28)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor:            color,
        backgroundColor:        gradient,
        borderWidth:            2.5,
        fill:                   true,
        tension:                0.4,
        pointRadius:            0,
        pointHoverRadius:       5,
        pointHoverBackgroundColor: color
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e2940',
          titleColor:      '#94a3b8',
          bodyColor:       '#f1f5f9',
          padding:         10,
          callbacks: {
            label: ctx => '₹' + ctx.parsed.y.toLocaleString('en-IN', { minimumFractionDigits: 2 })
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(30,41,64,0.5)' },
          ticks: { color: '#64748b', font: { family: 'Sora', size: 11 } }
        },
        y: {
          grid: { color: 'rgba(30,41,64,0.5)' },
          ticks: {
            color: '#64748b',
            font: { family: 'Sora', size: 11 },
            callback: v => '₹' + v.toLocaleString('en-IN')
          }
        }
      }
    }
  });
}

/**
 * Generate x-axis labels matching the number of data points.
 * @param {string} tf    - '1M' | '3M' | '6M'
 * @param {number} count - Number of data points
 * @returns {string[]}
 */
function buildChartLabels(tf, count) {
  const sets = {
    '1M': ['W1', 'W2', 'W3', 'W4'],
    '3M': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    '6M': ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
  };
  const full = sets[tf] || sets['3M'];
  // Slice to match actual data length
  return full.slice(0, count);
}

/* ── Star / Watchlist ──────────────────────────────────────────────────────── */

// Star button click
starBtn.addEventListener('click', () => toggleWatchlist(currentStock));

/**
 * Add or remove a stock from the watchlist, then update UI.
 * @param {string} sym
 */
function toggleWatchlist(sym) {
  const idx = watchlist.indexOf(sym);
  if (idx === -1) {
    watchlist.push(sym);
    showToast(sym + ' added to Watchlist ★');
  } else {
    watchlist.splice(idx, 1);
    showToast(sym + ' removed from Watchlist');
  }
  updateStarButton(sym);
  syncProfileStats();
}

/**
 * Reflect current watchlist state on the star icon.
 * @param {string} sym
 */
function updateStarButton(sym) {
  const inWl  = watchlist.includes(sym);
  const svgEl = starBtn.querySelector('svg');

  starBtn.classList.toggle('starred', inWl);
  svgEl.setAttribute('stroke', inWl ? '#facc15' : '#94a3b8');

  // Also fill the polygon for a solid star when starred
  const poly = svgEl.querySelector('polygon');
  if (poly) poly.setAttribute('fill', inWl ? '#facc15' : 'none');
}

/* ════════════════════════════════════════════
   WATCHLIST PAGE
   ════════════════════════════════════════════ */

/**
 * Build and inject the watchlist HTML.
 */
function renderWatchlist() {
  const container = document.getElementById('watchlistItems');
  const subtitle  = document.getElementById('wlSubtitle');

  subtitle.textContent = watchlist.length + ' stock' +
                         (watchlist.length !== 1 ? 's' : '') + ' in your watchlist';

  if (watchlist.length === 0) {
    container.innerHTML = `
      <div class="wl-empty">
        No stocks in your watchlist.<br>
        Analyze a stock and tap ★ to add it.
      </div>`;
    return;
  }

  container.innerHTML = watchlist.map(sym => {
    const s  = STOCKS[sym];
    const up = s.change >= 0;
    return `
      <div class="wl-item" data-sym="${sym}">
        <div class="wl-top">
          <div>
            <div class="wl-ticker">${sym}</div>
            <div class="wl-name">${s.name}</div>
          </div>
          <span class="badge ${s.signal.toLowerCase()}">${s.signal}</span>
        </div>
        <div class="wl-bottom">
          <div class="wl-price">₹${s.price.toFixed(2)}</div>
          <div class="wl-change ${up ? 'green' : 'red'}">
            ${up ? '▲ +' : '▼ '}${Math.abs(s.change).toFixed(1)} (${Math.abs(s.changePct).toFixed(2)}%)
          </div>
        </div>
      </div>`;
  }).join('');

  // Tap a watchlist item → open it in Analyze
  container.querySelectorAll('.wl-item').forEach(item => {
    item.addEventListener('click', () => {
      currentStock = item.dataset.sym;
      goPage('analyze');
    });
  });
}

/* ════════════════════════════════════════════
   PROFILE PAGE
   ════════════════════════════════════════════ */

/**
 * Keep profile stats in sync with watchlist length.
 */
function syncProfileStats() {
  document.getElementById('wlCount').textContent = watchlist.length;
}

/* ════════════════════════════════════════════
   TOAST NOTIFICATION
   ════════════════════════════════════════════ */

let toastTimer = null;

/**
 * Show a brief toast message at the bottom of the screen.
 * @param {string} msg
 */
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

/* ════════════════════════════════════════════
   LOADER
   ════════════════════════════════════════════ */

function showLoader() { loaderOverlay.classList.add('show'); }
function hideLoader() { loaderOverlay.classList.remove('show'); }

/* ════════════════════════════════════════════
   INITIALISE
   ════════════════════════════════════════════ */

// Render the Analyze page data on load (so it's ready when user navigates there)
renderAnalyze('RELIANCE');
renderWatchlist();
syncProfileStats();
