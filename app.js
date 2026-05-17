/* ---- constants ---- */
const MODEL_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#3b82f6'
];

const TYPE_COLORS = {
  output_tokens:          '#f59e0b',
  input_cache_hit_tokens: '#3b82f6',
  input_cache_miss_tokens:'#ef4444',
  request_count:          '#8b5cf6'
};

const TYPE_LABELS = {
  output_tokens:           '输出 Token',
  input_cache_hit_tokens:  '输入缓存命中',
  input_cache_miss_tokens: '输入缓存未命中',
  request_count:           '请求次数'
};

const TOKEN_TYPES = ['output_tokens', 'input_cache_hit_tokens', 'input_cache_miss_tokens'];

/* ---- theme ---- */
function getTheme() {
  const stored = localStorage.getItem('theme');
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('themeToggle').textContent = theme === 'dark' ? '☀' : '☾';
  localStorage.setItem('theme', theme);
}

function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  charts.forEach(c => c.setTheme(next === 'dark' ? 'dark' : undefined));
  if (allAmountRows.length > 0) applyFilter();
}

function applyStackBorderRadius(chart) {
  chart.on('legendselectchanged', (params) => {
    const selected = params.selected;
    const seriesOpt = chart.getOption().series;
    let lastVisible = -1;
    for (let i = seriesOpt.length - 1; i >= 0; i--) {
      const name = seriesOpt[i].name;
      if (selected[name] !== false) { lastVisible = i; break; }
    }
    chart.setOption({
      series: seriesOpt.map((s, i) => ({
        itemStyle: { borderRadius: i === lastVisible ? [4, 4, 0, 0] : 0 }
      }))
    });
  });
}

document.getElementById('themeToggle').addEventListener('click', toggleTheme);
applyTheme(getTheme());

/* ---- DOM refs ---- */
const dropZone   = document.getElementById('dropZone');
const errorEl    = document.getElementById('error');
const loadingEl  = document.getElementById('loading');
const contentEl  = document.getElementById('content');
const fileNameEl = document.getElementById('fileName');
const summaryEl  = document.getElementById('summary');
const keySummaryEl = document.getElementById('keySummary');

const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.zip';

let charts = [];

/* ---- filter state ---- */
let allCostRows = [];
let allAmountRows = [];
let activeKeys = new Set();  // empty set = show all keys
let currencySymbol = '¥';
let currencyCode = 'CNY';
let multiCurrency = false;

const CURRENCY_SYMBOLS = { CNY: '¥', USD: '$', EUR: '€', GBP: '£' };

function getCurrencySymbol(code) {
  return CURRENCY_SYMBOLS[code] || code;
}

function getFilteredAmountRows() {
  if (activeKeys.size === 0) return allAmountRows;
  return allAmountRows.filter(r => activeKeys.has(r.api_key_name));
}

/* ---- upload events ---- */
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => {
  if (e.target.files.length) handleFile(e.target.files[0]);
});
dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

/* ---- CSV parser ---- */
function parseCSV(text) {
  const lines = [];
  let cur = '', inQ = false;
  for (const ch of text) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === '\n' && !inQ) { lines.push(cur); cur = ''; }
    else cur += ch;
  }
  if (cur) lines.push(cur);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < headers.length) continue;
    const row = {};
    headers.forEach((h, idx) => row[h] = (cols[idx] || '').trim());
    rows.push(row);
  }
  return rows;
}

/* ---- helpers ---- */
function formatNum(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toString();
}

function groupBy(arr, keys) {
  const map = new Map();
  for (const item of arr) {
    const k = keys.map(k => item[k]).join('|');
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

function clearCharts() {
  charts.forEach(c => c.dispose());
  charts = [];
}

function createChart(domId) {
  const dom = document.getElementById(domId);
  if (!dom) return null;
  const existing = echarts.getInstanceByDom(dom);
  if (existing) existing.dispose();
  const theme = getTheme() === 'dark' ? 'dark' : undefined;
  const chart = echarts.init(dom, theme);
  charts.push(chart);
  return chart;
}

window.addEventListener('resize', () => {
  charts.forEach(c => c.resize());
});

function computeCost(rows) {
  return rows.reduce((sum, r) => {
    if (r.type === 'request_count') return sum;
    return sum + parseFloat(r.price || 0) * parseInt(r.amount || 0);
  }, 0);
}

function computeTokens(rows) {
  return rows.filter(r => r.type !== 'request_count')
    .reduce((s, r) => s + parseInt(r.amount || 0), 0);
}

/* ---- render: global summary ---- */
function renderSummary(costRows, amountRows) {
  const totalCost = costRows.reduce((s, r) => s + parseFloat(r.cost || 0), 0);

  const cacheHit  = amountRows.filter(r => r.type === 'input_cache_hit_tokens')
    .reduce((s, r) => s + parseInt(r.amount || 0), 0);
  const cacheMiss = amountRows.filter(r => r.type === 'input_cache_miss_tokens')
    .reduce((s, r) => s + parseInt(r.amount || 0), 0);
  const cacheTotal = cacheHit + cacheMiss;
  const cacheRate = cacheTotal > 0 ? (cacheHit / cacheTotal * 100).toFixed(3) : '0.000';

  const totalOutput = amountRows.filter(r => r.type === 'output_tokens')
    .reduce((s, r) => s + parseInt(r.amount || 0), 0);
  const totalInput = cacheHit + cacheMiss;
  const days = new Set(costRows.map(r => r.utc_date)).size;

  summaryEl.innerHTML = [
    { label: '总费用',       value: `${currencySymbol}${totalCost.toFixed(2)}`,   sub: `${days} 天` },
    { label: '缓存命中率',   value: `${cacheRate}%`,              sub: `${(cacheHit/1e6).toFixed(1)}M / ${(cacheTotal/1e6).toFixed(1)}M` },
    { label: '输出 Token',   value: formatNum(totalOutput),       sub: 'output tokens' },
    { label: '总输入 Token', value: formatNum(totalInput),        sub: 'input tokens (含缓存)' }
  ].map(c => `<div class="summary-card"><div class="label">${c.label}</div><div class="value">${c.value}</div><div class="sub">${c.sub}</div></div>`).join('');
}

/* ---- render: per-API-key summary cards ---- */
function renderKeySummary(amountRows) {
  const byKey = groupBy(amountRows, ['api_key_name']);
  const keys = [...byKey.keys()].sort();

  keySummaryEl.innerHTML = keys.map(key => {
    const rows = byKey.get(key);
    const cost = computeCost(rows);
    const tokens = computeTokens(rows);
    const requests = rows.filter(r => r.type === 'request_count')
      .reduce((s, r) => s + parseInt(r.amount || 0), 0);
    const models = [...new Set(rows.map(r => r.model))].join(', ');

    return `<div class="summary-card">
      <div class="label">${escapeHtml(key)}</div>
      <div class="value">${currencySymbol}${cost.toFixed(2)}</div>
      <div class="sub">${formatNum(tokens)} tokens · ${formatNum(requests)} 请求 · ${escapeHtml(models)}</div>
    </div>`;
  }).join('');
}

function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return str.replace(/[&<>"']/g, c => map[c]);
}

/* ---- chart: daily cost by model (cost.csv, stacked bar) ---- */
function renderDailyCost(costRows) {
  const chart = createChart('dailyCostChart');
  if (!chart) return;

  const byDate = groupBy(costRows, ['utc_date']);
  const dates = [...byDate.keys()].sort();
  const models = [...new Set(costRows.map(r => r.model))].sort().reverse();
  const colorMap = {};
  models.forEach((m, i) => colorMap[m] = MODEL_COLORS[i % MODEL_COLORS.length]);

  chart.setOption({ backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: v => v > 0 && v < 0.01 ? '<' + currencySymbol + '0.01' : currencySymbol + v.toFixed(2)
    },
    legend: { data: models, bottom: 0 },
    xAxis: { type: 'category', data: dates },
    yAxis: { type: 'value', name: currencyCode + ' (' + currencySymbol + ')' },
    series: models.map((model, i) => ({
      name: model,
      type: 'bar',
      stack: 'total',
      data: dates.map(d => {
        const row = (byDate.get(d) || []).find(r => r.model === model);
        return row ? parseFloat(row.cost) : 0;
      }),
      itemStyle: { color: colorMap[model], borderRadius: i === models.length - 1 ? [4, 4, 0, 0] : 0 },
      emphasis: { focus: 'series' }
    }))
  });
  applyStackBorderRadius(chart);
}

/* ---- chart: token type doughnut ---- */
function renderTokenType(amountRows) {
  const chart = createChart('tokenTypeChart');
  if (!chart) return;

  const tokenRows = amountRows.filter(r => r.type !== 'request_count');
  const byType = groupBy(tokenRows, ['type']);
  const types = TOKEN_TYPES.filter(t => byType.has(t));

  chart.setOption({ backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: p => `${p.name}: ${formatNum(p.value)} (${p.percent}%)`    },
    legend: { bottom: 0 },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['50%', '45%'],
      data: types.map(t => ({
        name: TYPE_LABELS[t],
        value: byType.get(t).reduce((s, r) => s + parseInt(r.amount || 0), 0),
        itemStyle: { color: TYPE_COLORS[t] }
      })),
      label: { formatter: '{b}\n{d}%'},
      emphasis: { focus: 'self' }
    }]
  });
}

/* ---- chart: daily token trends ---- */
function renderDailyTokens(amountRows) {
  const chart = createChart('dailyTokenChart');
  if (!chart) return;

  const tokenRows = amountRows.filter(r => r.type !== 'request_count');
  const byDateType = groupBy(tokenRows, ['utc_date', 'type']);
  const dates = [...new Set(tokenRows.map(r => r.utc_date))].sort();

  chart.setOption({ backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      valueFormatter: v => formatNum(v)
    },
    legend: { data: TOKEN_TYPES.map(t => TYPE_LABELS[t]), bottom: 0 },
    xAxis: { type: 'category', data: dates },
    yAxis: {
      type: 'value',
      name: 'Tokens',
      axisLabel: { formatter: v => formatNum(v)}
    },
    series: TOKEN_TYPES.map(type => ({
      name: TYPE_LABELS[type],
      type: 'line',
      data: dates.map(d => {
        const rows = byDateType.get(`${d}|${type}`) || [];
        return rows.reduce((s, r) => s + parseInt(r.amount || 0), 0);
      }),
      itemStyle: { color: TYPE_COLORS[type] },
      lineStyle: { color: TYPE_COLORS[type], width: 2 },
      symbol: 'circle',
      symbolSize: 6,
      emphasis: { focus: 'series' }
    }))
  });
}

/* ---- chart: cost by API key (stacked by model) ---- */
function renderKeyCost(amountRows) {
  const chart = createChart('keyCostChart');
  if (!chart) return;

  const byKeyModel = groupBy(amountRows, ['api_key_name', 'model']);
  const keys = [...new Set(amountRows.map(r => r.api_key_name))].sort();
  const models = [...new Set(amountRows.map(r => r.model))].sort().reverse();
  const colorMap = {};
  models.forEach((m, i) => colorMap[m] = MODEL_COLORS[i % MODEL_COLORS.length]);

  chart.setOption({ backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: v => v > 0 && v < 0.01 ? '<' + currencySymbol + '0.01' : currencySymbol + v.toFixed(2)
    },
    legend: { data: models, bottom: 0 },
    xAxis: { type: 'category', data: keys },
    yAxis: { type: 'value', name: currencyCode + ' (' + currencySymbol + ')' },
    series: models.map((model, i) => ({
      name: model,
      type: 'bar',
      stack: 'total',
      data: keys.map(key => {
        const rows = byKeyModel.get(`${key}|${model}`) || [];
        return computeCost(rows);
      }),
      itemStyle: { color: colorMap[model], borderRadius: i === models.length - 1 ? [4, 4, 0, 0] : 0 },
      emphasis: { focus: 'series' }
    }))
  });
  applyStackBorderRadius(chart);
}

/* ---- chart: token usage by API key (grouped bar by token type) ---- */
function renderKeyTokens(amountRows) {
  const chart = createChart('keyTokenChart');
  if (!chart) return;

  const tokenRows = amountRows.filter(r => r.type !== 'request_count');
  const byKeyType = groupBy(tokenRows, ['api_key_name', 'type']);
  const keys = [...new Set(tokenRows.map(r => r.api_key_name))].sort();

  chart.setOption({ backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: v => formatNum(v)
    },
    legend: { data: TOKEN_TYPES.map(t => TYPE_LABELS[t]), bottom: 0 },
    xAxis: { type: 'category', data: keys },
    yAxis: {
      type: 'value',
      name: 'Tokens',
      axisLabel: { formatter: v => formatNum(v)}
    },
    series: TOKEN_TYPES.map(type => ({
      name: TYPE_LABELS[type],
      type: 'bar',
      data: keys.map(key => {
        const rows = byKeyType.get(`${key}|${type}`) || [];
        return rows.reduce((s, r) => s + parseInt(r.amount || 0), 0);
      }),
      itemStyle: { color: TYPE_COLORS[type], borderRadius: [4, 4, 0, 0] },
      emphasis: { focus: 'series' }
    }))
  });
}

/* ---- detail table ---- */
function renderKeyTable(amountRows) {
  const wrap = document.getElementById('keyTableWrap');
  if (amountRows.length === 0) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';

  const costHeader = multiCurrency ? '费用' : `费用 ${currencySymbol}`;
  const avgHeader = multiCurrency ? '平均费用/请求' : `平均费用/请求 ${currencySymbol}`;
  const headers = ['API Key / 模型', costHeader, '请求数', '输出 Token', '输入缓存命中', '输入缓存未命中', '总 Token', '缓存命中率', avgHeader, '平均 Token/请求'];

  function metrics(rs) {
    const cost     = computeCost(rs);
    const requests = rs.filter(r => r.type === 'request_count')
      .reduce((s, r) => s + parseInt(r.amount || 0), 0);
    const output   = rs.filter(r => r.type === 'output_tokens')
      .reduce((s, r) => s + parseInt(r.amount || 0), 0);
    const hit      = rs.filter(r => r.type === 'input_cache_hit_tokens')
      .reduce((s, r) => s + parseInt(r.amount || 0), 0);
    const miss     = rs.filter(r => r.type === 'input_cache_miss_tokens')
      .reduce((s, r) => s + parseInt(r.amount || 0), 0);
    const total    = output + hit + miss;
    const rate     = (hit + miss) > 0 ? (hit / (hit + miss) * 100).toFixed(3) : '-';
    const avgCost  = requests > 0 ? (cost / requests).toFixed(4) : '-';
    const avgTokens = requests > 0 ? Math.round(total / requests) : '-';
    return { cost, requests, output, hit, miss, total, rate, avgCost, avgTokens };
  }

  function fmt(v, type, currency) {
    if (type === 'cost' || type === 'avg_cost') {
      const val = type === 'cost'
        ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : v;
      if (!multiCurrency || !currency) return val;
      const sym = getCurrencySymbol(currency);
      return sym.length <= 2 ? sym + val : sym + ' ' + val;
    }
    if (type === 'rate')       return v === '-' ? '-' : v + '%';
    if (type === 'avg_tokens') return v === '-' ? '-' : v.toLocaleString();
    if (typeof v === 'number') return v.toLocaleString();
    return v;
  }

  function rowHtml(label, m, cls, labelCls, currency, costStr, avgCostStr) {
    return `<tr class="${cls}">` +
      `<td class="${labelCls || ''}">${escapeHtml(label)}</td>` +
      `<td class="val-cost">${costStr || fmt(m.cost, 'cost', currency)}</td>` +
      `<td>${fmt(m.requests, 'count')}</td>` +
      `<td>${fmt(m.output, 'count')}</td>` +
      `<td>${fmt(m.hit, 'count')}</td>` +
      `<td>${fmt(m.miss, 'count')}</td>` +
      `<td>${fmt(m.total, 'count')}</td>` +
      `<td class="val-rate">${fmt(m.rate, 'rate')}</td>` +
      `<td>${avgCostStr || fmt(m.avgCost, 'avg_cost', currency)}</td>` +
      `<td>${fmt(m.avgTokens, 'avg_tokens')}</td>` +
      '</tr>';
  }

  function fmtCurrencyCost(byCurrency) {
    if (!multiCurrency) return '';
    const entries = Object.entries(byCurrency).filter(([, v]) => v > 0);
    return entries.map(([c, v]) => {
      const sym = getCurrencySymbol(c);
      const prefix = sym.length <= 2 ? sym : sym + ' ';
      return prefix + v.toFixed(2);
    }).join(' + ');
  }

  const keys = [...new Set(amountRows.map(r => r.api_key_name))].sort();
  const singleKey = keys.length === 1;

  // model → currency lookup from cost.csv
  const modelCurrency = new Map();
  allCostRows.forEach(r => { if (r.currency && !modelCurrency.has(r.model)) modelCurrency.set(r.model, r.currency); });

  const keyData = keys.map(key => {
    const keyRows = amountRows.filter(r => r.api_key_name === key);
    const models = [...new Set(keyRows.map(r => r.model))].sort().reverse();
    const modelRows = models.map(m => ({
      model: m,
      m: metrics(keyRows.filter(r => r.model === m))
    }));
    const sub = metrics(keyRows);
    return { key, modelRows, sub };
  });

  let bodyHtml = '';
  let grand = { cost:0, requests:0, output:0, hit:0, miss:0, total:0 };
  let grandByCurrency = {};

  for (const kd of keyData) {
    // per-currency breakdown for subtotal
    const subByCurrency = {};
    const subAvgByCurrency = {};
    for (const mr of kd.modelRows) {
      const cur = modelCurrency.get(mr.model) || currencyCode;
      subByCurrency[cur] = (subByCurrency[cur] || 0) + mr.m.cost;
      if (mr.m.requests > 0) {
        subAvgByCurrency[cur] = subAvgByCurrency[cur] || { cost: 0, requests: 0 };
        subAvgByCurrency[cur].cost += mr.m.cost;
        subAvgByCurrency[cur].requests += mr.m.requests;
      }
    }
    const subCostStr = multiCurrency ? fmtCurrencyCost(subByCurrency) : null;
    const subAvgStr = multiCurrency
      ? Object.entries(subAvgByCurrency).filter(([, v]) => v.requests > 0).map(([c, v]) => {
    const sym = getCurrencySymbol(c);
    const prefix = sym.length <= 2 ? sym : sym + ' ';
    return prefix + (v.cost / v.requests).toFixed(4);
  }).join(' + ')
      : null;

    for (const mr of kd.modelRows) {
      const cur = modelCurrency.get(mr.model);
      bodyHtml += rowHtml('　' + mr.model, mr.m, 'model-row', 'model-label', cur);
    }
    const label = singleKey ? kd.key + ' 总计' : kd.key + ' 小计';
    bodyHtml += rowHtml(label, kd.sub, 'subtotal-row', 'subtotal-label', null, subCostStr, subAvgStr);
    grand.cost     += kd.sub.cost;
    grand.requests += kd.sub.requests;
    grand.output   += kd.sub.output;
    grand.hit      += kd.sub.hit;
    grand.miss     += kd.sub.miss;
    grand.total    += kd.sub.total;
    // accumulate per-currency grand totals
    for (const [c, v] of Object.entries(subByCurrency)) {
      grandByCurrency[c] = (grandByCurrency[c] || 0) + v;
    }
  }

  if (!singleKey) {
    const grandCostStr = multiCurrency ? fmtCurrencyCost(grandByCurrency) : null;
    // grand avg cost by currency
    const grandAvgByCurrency = {};
    for (const kd of keyData) {
      for (const mr of kd.modelRows) {
        const cur = modelCurrency.get(mr.model) || currencyCode;
        if (mr.m.requests > 0) {
          grandAvgByCurrency[cur] = grandAvgByCurrency[cur] || { cost: 0, requests: 0 };
          grandAvgByCurrency[cur].cost += mr.m.cost;
          grandAvgByCurrency[cur].requests += mr.m.requests;
        }
      }
    }
    const grandAvgStr = multiCurrency
      ? Object.entries(grandAvgByCurrency).filter(([, v]) => v.requests > 0).map(([c, v]) => {
    const sym = getCurrencySymbol(c);
    const prefix = sym.length <= 2 ? sym : sym + ' ';
    return prefix + (v.cost / v.requests).toFixed(4);
  }).join(' + ')
      : null;
    grand.rate      = (grand.hit + grand.miss) > 0 ? (grand.hit / (grand.hit + grand.miss) * 100).toFixed(3) : '-';
    grand.avgCost   = grand.requests > 0 ? (grand.cost / grand.requests).toFixed(4) : '-';
    grand.avgTokens = grand.requests > 0 ? Math.round(grand.total / grand.requests) : '-';
    bodyHtml += rowHtml('总计', grand, 'total-row', '', null, grandCostStr, grandAvgStr);
  }

  document.getElementById('keyTable').querySelector('thead').innerHTML =
    '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';
  document.getElementById('keyTable').querySelector('tbody').innerHTML = bodyHtml;
}

/* ---- filter UI ---- */
function renderFilter() {
  const keys = [...new Set(allAmountRows.map(r => r.api_key_name))].sort();
  const bar = document.getElementById('filterBar');
  const container = document.getElementById('filterKeys');
  if (keys.length <= 1) { bar.style.display = 'none'; return; }

  bar.style.display = '';
  activeKeys = new Set();
  container.innerHTML = keys.map(key =>
    `<label class="filter-chip"><input type="checkbox" value="${escapeHtml(key)}"> ${escapeHtml(key)}</label>`
  ).join('');

  const checkboxes = container.querySelectorAll('input[type=checkbox]');
  const btnSelectAll = document.getElementById('btnSelectAll');
  const btnClear = document.getElementById('btnClear');

  function updateButtons() {
    const checked = [...checkboxes].filter(cb => cb.checked);
    btnSelectAll.style.display = checked.length === 0 || checked.length === checkboxes.length ? 'none' : '';
    btnClear.style.display = checked.length === 0 ? 'none' : '';
  }

  function onCheckChange() {
    activeKeys = new Set();
    checkboxes.forEach(cb => { if (cb.checked) activeKeys.add(cb.value); });
    updateButtons();
    applyFilter();
  }

  checkboxes.forEach(cb => cb.addEventListener('change', onCheckChange));

  btnSelectAll.onclick = () => {
    checkboxes.forEach(cb => { cb.checked = true; });
    activeKeys = new Set([...checkboxes].map(cb => cb.value));
    updateButtons();
    applyFilter();
  };

  btnClear.onclick = () => {
    checkboxes.forEach(cb => { cb.checked = false; });
    activeKeys = new Set();
    updateButtons();
    applyFilter();
  };

  updateButtons();
}

function applyFilter() {
  clearCharts();
  const amountRows = getFilteredAmountRows();
  renderKeySummary(amountRows);
  renderKeyTable(amountRows);
  renderTokenType(amountRows);
  renderDailyTokens(amountRows);
  renderKeyCost(amountRows);
  renderKeyTokens(amountRows);
  renderDailyCost(allCostRows); // cost.csv has no per-key data
  requestAnimationFrame(() => charts.forEach(c => c.resize()));
}

/* ---- main handler ---- */
async function handleFile(file) {
  errorEl.style.display = 'none';
  if (!file.name.endsWith('.zip')) {
    showError('请上传 .zip 文件');
    return;
  }

  loadingEl.style.display = 'block';
  contentEl.style.display = 'none';
  clearCharts();

  try {
    const zip = await JSZip.loadAsync(file);
    let amountText = null, costText = null;

    for (const [name, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      const base = name.split('/').pop();
      if (base.startsWith('amount-') && base.endsWith('.csv')) amountText = await entry.async('string');
      else if (base.startsWith('cost-') && base.endsWith('.csv')) costText = await entry.async('string');
    }

    if (!amountText || !costText) {
      showError('ZIP 文件中未找到 amount-*.csv 或 cost-*.csv 文件，请确认是 DeepSeek 官网下载的月度用量文件');
      loadingEl.style.display = 'none';
      return;
    }

    const costRows   = parseCSV(costText);
    const amountRows = parseCSV(amountText);

    if (costRows.length === 0 || amountRows.length === 0) {
      showError('CSV 文件解析失败或数据为空');
      loadingEl.style.display = 'none';
      return;
    }

    allCostRows = costRows;
    allAmountRows = amountRows;

    // extract currency from cost data
    const currencies = [...new Set(costRows.filter(r => r.currency).map(r => r.currency))];
    multiCurrency = currencies.length > 1;
    if (currencies.length === 1) {
      currencyCode = currencies[0];
      currencySymbol = getCurrencySymbol(currencyCode);
    } else if (currencies.length > 1) {
      currencyCode = currencies.join('/');
    }

    dropZone.classList.add('loaded');
    fileNameEl.textContent = '已加载: ' + file.name;
    loadingEl.style.display = 'none';
    contentEl.style.display = '';

    renderSummary(costRows, amountRows);
    renderFilter();
    applyFilter();

  } catch (err) {
    showError('解析文件出错: ' + err.message);
    loadingEl.style.display = 'none';
    console.error(err);
  }
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.style.display = 'block';
  dropZone.classList.remove('loaded');
  fileNameEl.textContent = '';
}
