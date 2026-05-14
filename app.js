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
  const chart = echarts.init(dom);
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
  const cacheRate = cacheTotal > 0 ? (cacheHit / cacheTotal * 100).toFixed(1) : '0.0';

  const totalOutput = amountRows.filter(r => r.type === 'output_tokens')
    .reduce((s, r) => s + parseInt(r.amount || 0), 0);
  const totalInput = cacheHit + cacheMiss;
  const days = new Set(costRows.map(r => r.utc_date)).size;

  summaryEl.innerHTML = [
    { label: '总费用',       value: `¥${totalCost.toFixed(2)}`,   sub: `${days} 天` },
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
      <div class="value">¥${cost.toFixed(2)}</div>
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

  chart.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: v => '¥' + v.toFixed(2)
    },
    legend: { data: models, bottom: 0 },
    grid: { left: 60, right: 20, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: dates },
    yAxis: { type: 'value', name: 'CNY (¥)' },
    series: models.map(model => ({
      name: model,
      type: 'bar',
      stack: 'total',
      data: dates.map(d => {
        const row = (byDate.get(d) || []).find(r => r.model === model);
        return row ? parseFloat(row.cost) : 0;
      }),
      itemStyle: { color: colorMap[model], borderRadius: [4, 4, 0, 0] },
      emphasis: { focus: 'series' }
    }))
  });
}

/* ---- chart: token type doughnut ---- */
function renderTokenType(amountRows) {
  const chart = createChart('tokenTypeChart');
  if (!chart) return;

  const tokenRows = amountRows.filter(r => r.type !== 'request_count');
  const byType = groupBy(tokenRows, ['type']);
  const types = TOKEN_TYPES.filter(t => byType.has(t));

  chart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: p => `${p.name}: ${formatNum(p.value)} (${p.percent}%)`
    },
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
      label: { formatter: '{b}\n{d}%' },
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

  chart.setOption({
    tooltip: {
      trigger: 'axis',
      valueFormatter: v => formatNum(v)
    },
    legend: { data: TOKEN_TYPES.map(t => TYPE_LABELS[t]), bottom: 0 },
    grid: { left: 80, right: 20, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: dates },
    yAxis: {
      type: 'value',
      name: 'Tokens',
      axisLabel: { formatter: v => formatNum(v) }
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

  chart.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: v => '¥' + v.toFixed(2)
    },
    legend: { data: models, bottom: 0 },
    grid: { left: 60, right: 20, top: 20, bottom: 50 },
    xAxis: { type: 'category', data: keys, axisLabel: { rotate: 30 } },
    yAxis: { type: 'value', name: 'CNY (¥)' },
    series: models.map(model => ({
      name: model,
      type: 'bar',
      stack: 'total',
      data: keys.map(key => {
        const rows = byKeyModel.get(`${key}|${model}`) || [];
        return computeCost(rows);
      }),
      itemStyle: { color: colorMap[model], borderRadius: [4, 4, 0, 0] },
      emphasis: { focus: 'series' }
    }))
  });
}

/* ---- chart: token usage by API key (grouped bar by token type) ---- */
function renderKeyTokens(amountRows) {
  const chart = createChart('keyTokenChart');
  if (!chart) return;

  const tokenRows = amountRows.filter(r => r.type !== 'request_count');
  const byKeyType = groupBy(tokenRows, ['api_key_name', 'type']);
  const keys = [...new Set(tokenRows.map(r => r.api_key_name))].sort();

  chart.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: v => formatNum(v)
    },
    legend: { data: TOKEN_TYPES.map(t => TYPE_LABELS[t]), bottom: 0 },
    grid: { left: 80, right: 20, top: 20, bottom: 50 },
    xAxis: { type: 'category', data: keys, axisLabel: { rotate: 30 } },
    yAxis: {
      type: 'value',
      name: 'Tokens',
      axisLabel: { formatter: v => formatNum(v) }
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

    dropZone.classList.add('loaded');
    fileNameEl.textContent = '已加载: ' + file.name;
    loadingEl.style.display = 'none';
    contentEl.style.display = '';

    renderSummary(costRows, amountRows);
    renderKeySummary(amountRows);
    renderDailyCost(costRows);
    renderTokenType(amountRows);
    renderDailyTokens(amountRows);
    renderKeyCost(amountRows);
    renderKeyTokens(amountRows);

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
