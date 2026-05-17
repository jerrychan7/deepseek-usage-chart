import { MODEL_COLORS, TYPE_COLORS, TYPE_LABELS, TOKEN_TYPES, formatNum, groupBy, computeCost } from './utils.js';
import { currencySymbol, currencyCode } from './state.js';

const charts = [];

export function clearCharts() {
  charts.forEach(c => c.dispose());
  charts.length = 0;
}

export function resizeCharts() {
  charts.forEach(c => c.resize());
}

function getTheme() {
  const stored = localStorage.getItem('theme');
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setAllChartsTheme(theme) {
  charts.forEach(c => c.setTheme(theme === 'dark' ? 'dark' : undefined));
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

/* ---- daily cost by model ---- */
export function renderDailyCost(costRows) {
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

/* ---- token type doughnut ---- */
export function renderTokenType(amountRows) {
  const chart = createChart('tokenTypeChart');
  if (!chart) return;

  const tokenRows = amountRows.filter(r => r.type !== 'request_count');
  const byType = groupBy(tokenRows, ['type']);
  const types = TOKEN_TYPES.filter(t => byType.has(t));

  chart.setOption({ backgroundColor: 'transparent',
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

/* ---- daily token trends ---- */
export function renderDailyTokens(amountRows) {
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

/* ---- cost by API key (stacked by model) ---- */
export function renderKeyCost(amountRows) {
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

/* ---- token usage by API key (grouped bar by token type) ---- */
export function renderKeyTokens(amountRows) {
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
