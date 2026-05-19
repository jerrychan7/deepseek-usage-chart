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

export function resizeChart(domId) {
  const dom = document.getElementById(domId);
  if (!dom) return;
  const chart = window.echarts.getInstanceByDom(dom);
  if (chart) chart.resize();
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
  // svg renderer mode only use in debug
  // const chart = echarts.init(dom, theme, { renderer: 'svg' });
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

/* ---- cost distribution sunburst ---- */
export function renderTokenType(amountRows) {
  const chart = createChart('tokenTypeChart');
  if (!chart) return;

  const costRows = amountRows.filter(r => r.type !== 'request_count');
  const byModel = groupBy(costRows, ['model']);
  const byModelKey = groupBy(costRows, ['model', 'api_key_name']);

  const models = [...byModel.keys()].sort().reverse();
  const modelColorMap = {};
  models.forEach((m, i) => modelColorMap[m] = MODEL_COLORS[i % MODEL_COLORS.length]);

  const allKeys = [...new Set(costRows.map(r => r.api_key_name))].sort();
  const keyColorMap = {};
  allKeys.forEach((k, i) => keyColorMap[k] = MODEL_COLORS[(models.length + i) % MODEL_COLORS.length]);

  // Build key→models mapping for legend hover
  const keyToModels = {};
  allKeys.forEach(k => { keyToModels[k] = []; });
  costRows.forEach(r => {
    if (!keyToModels[r.api_key_name].includes(r.model)) {
      keyToModels[r.api_key_name].push(r.model);
    }
  });

  // Sunburst data: models as roots, each with key children
  const sunburstData = models.map(m => ({
    name: m,
    value: computeCost(byModel.get(m)),
    itemStyle: { color: modelColorMap[m] },
    children: [...new Set(costRows.filter(r => r.model === m).map(r => r.api_key_name))].sort().map(k => ({
      name: k,
      value: computeCost(byModelKey.get(`${m}|${k}`) || []),
      itemStyle: { color: keyColorMap[k] }
    }))
  }));

  chart.setOption({ backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: p => {
        const val = p.value;
        const formatted = val > 0 && val < 0.01 ? '<' + currencySymbol + '0.01' : currencySymbol + val.toFixed(2);
        return `${p.name}: ${formatted}`;
      }
    },
    legend: { show: false },
    series: [{
      type: 'sunburst',
      data: sunburstData,
      radius: ['18%', '80%'],
      center: ['50%', '45%'],
      levels: [
        {},
        {
          // inner ring (models): tangential labels
          label: {
            rotate: 'tangential',
            fontSize: 11,
          }
        },
        {
          // outermost ring (keys): radial labels
        },
      ],
      itemStyle: {
        borderRadius: 4,
        borderColor: 'transparent',
        borderWidth: 2
      },
      emphasis: {
        focus: 'relative'
      }
    }]
  });

  // Legend dim helper (chart hover uses built-in focus:'relative')
  function applyDim(hoverName) {
    const isModel = models.includes(hoverName);
    const opt = chart.getOption();
    const walk = (nodes, depth, parentMatch) => {
      (nodes || []).forEach(n => {
        const selfMatch = n.name === hoverName || (depth === 0 && keyToModels[hoverName]?.includes(n.name));
        // Only propagate parentMatch for model hover (model → all its keys bright)
        const match = (isModel && parentMatch) || selfMatch;
        n.itemStyle = n.itemStyle || {};
        n.itemStyle.opacity = match ? 1 : 0.15;
        if (n.children) walk(n.children, depth + 1, isModel && match);
      });
    };
    walk(opt.series[0].data, 0, false);
    chart.setOption(opt);
  }
  function clearDim() {
    const opt = chart.getOption();
    const walk = (nodes) => {
      (nodes || []).forEach(n => {
        if (n.itemStyle) n.itemStyle.opacity = 1;
        if (n.children) walk(n.children);
      });
    };
    walk(opt.series[0].data);
    chart.setOption(opt);
  }

  // Build custom HTML legend with models + keys
  const legendEl = document.getElementById('tokenTypeLegend');
  if (legendEl) {
    const modelItems = models.map(m =>
      `<span class="legend-item" data-name="${m}" data-type="model">
        <span class="legend-dot" style="background:${modelColorMap[m]}"></span>${m}
      </span>`
    ).join('');
    const keyItems = allKeys.map(k =>
      `<span class="legend-item" data-name="${k}" data-type="key">
        <span class="legend-dot" style="background:${keyColorMap[k]}"></span>${k}
      </span>`
    ).join('');
    legendEl.innerHTML = `<div class="legend-row">${modelItems}</div><div class="legend-row">${keyItems}</div>`;

    // Legend click handler: toggle visibility via legend selection
    const hidden = new Set();
    legendEl.addEventListener('click', (e) => {
      const item = e.target.closest('.legend-item');
      if (!item) return;
      const name = item.dataset.name;
      const type = item.dataset.type;

      if (hidden.has(name)) {
        hidden.delete(name);
        item.classList.remove('dimmed');
      } else {
        hidden.add(name);
        item.classList.add('dimmed');
      }

      // For sunburst, hide segments by removing from data; show by re-adding
      // Simple approach: rebuild sunburst data filtering out hidden items
      const rebuildChildren = (parentModels) => {
        return parentModels
          .filter(m => !hidden.has(m.name))
          .map(m => ({
            name: m.name,
            value: m.value,
            itemStyle: { color: modelColorMap[m.name] },
            children: m.children
              ? m.children.filter(c => !hidden.has(c.name))
              : undefined
          }));
      };
      const opt = chart.getOption();
      opt.series[0].data = rebuildChildren(sunburstData);
      chart.clear();
      chart.setOption(opt);
    });

    // Legend hover → dim non-relevant items via opacity
    legendEl.addEventListener('mouseover', (e) => {
      const item = e.target.closest('.legend-item');
      if (!item) return;
      const name = item.dataset.name;
      if (hidden.has(name)) return;
      applyDim(name);
    });
    legendEl.addEventListener('mouseleave', () => clearDim());
  }
}

/* ---- daily token trends ---- */
export function renderDailyTokens(amountRows) {
  const chart = createChart('dailyTokenChart');
  if (!chart) return;

  const tokenRows = amountRows.filter(r => r.type !== 'request_count');
  const byDateType = groupBy(tokenRows, ['utc_date', 'type']);
  const dates = [...new Set(tokenRows.map(r => r.utc_date))].sort();

  function getDaily(type) {
    return dates.map(d => {
      const rows = byDateType.get(`${d}|${type}`) || [];
      return rows.reduce((s, r) => s + parseInt(r.amount || 0), 0);
    });
  }

  const singleAxis = document.getElementById('dualAxisToggle')?.checked;

  chart.setOption({ backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      valueFormatter: v => formatNum(v)
    },
    legend: { data: TOKEN_TYPES.map(t => TYPE_LABELS[t]), bottom: 0 },
    grid: { containLabel: true },
    xAxis: { type: 'category', data: dates },
    yAxis: singleAxis
      ? { type: 'value', name: 'Tokens', axisLabel: { formatter: v => formatNum(v) } }
      : [
          { type: 'value', name: 'Tokens', axisLabel: { formatter: v => formatNum(v) } },
          { type: 'value', name: '缓存命中', axisLabel: { formatter: v => formatNum(v) }, splitLine: { show: false } }
        ],
    series: TOKEN_TYPES.map(type => ({
      name: TYPE_LABELS[type],
      type: 'line',
      yAxisIndex: singleAxis ? 0 : (type === 'input_cache_hit_tokens' ? 1 : 0),
      data: getDaily(type),
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
  const models = [...new Set(amountRows.map(r => r.model))].sort().reverse();
  const colorMap = {};
  models.forEach((m, i) => colorMap[m] = MODEL_COLORS[i % MODEL_COLORS.length]);

  // Build sorted data items, each with key name, per-model costs, and total
  const items = [...new Set(amountRows.map(r => r.api_key_name))].map(key => ({
    key,
    costs: models.map(m => computeCost(byKeyModel.get(`${key}|${m}`) || [])),
    get total() { return this.costs.reduce((s, v) => s + v, 0); }
  }));

  function render(orderBy) {
    const sorted = [...items].sort(orderBy);
    chart.setOption({ backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: v => v > 0 && v < 0.01 ? '<' + currencySymbol + '0.01' : currencySymbol + v.toFixed(2),
        formatter: (params) => {
          let total = 0, count = 0;
          let lines = '';
          params.forEach(p => {
            if (p.value > 0) {
              total += p.value;
              count++;
              const val = p.value > 0 && p.value < 0.01 ? '<' + currencySymbol + '0.01' : currencySymbol + p.value.toFixed(2);
              lines += p.marker + ' ' + p.seriesName + '：' + val + '<br/>';
            }
          });
          let html = '<strong>' + params[0].axisValue + '</strong><br/>' + lines;
          if (count > 1) {
            const totalStr = total > 0 && total < 0.01 ? '<' + currencySymbol + '0.01' : currencySymbol + total.toFixed(2);
            html += '<br/><strong>总计：' + totalStr + '</strong>';
          }
          return html;
        }
      },
      legend: { data: models, bottom: 0 },
      grid: { containLabel: true },
      xAxis: { type: 'value', name: currencyCode + ' (' + currencySymbol + ')' },
      yAxis: { type: 'category', data: sorted.map(d => d.key), inverse: false },
      series: models.map((model, mi) => ({
        name: model,
        type: 'bar',
        stack: 'total',
        data: sorted.map(d => d.costs[mi]),
        itemStyle: { color: colorMap[model], borderRadius: 0 },
        emphasis: { focus: 'series' }
      }))
    });
  }

  // Default: sort ascending (yAxis inverse:false → first item at bottom, so asc = big at top)
  render((a, b) => a.total - b.total);

  // Legend click: toggle visibility + re-sort by visible models' totals
  chart.on('legendselectchanged', (params) => {
    const selected = params.selected;
    const visible = models.filter(m => selected[m] !== false);
    const visibleIndices = visible.map(m => models.indexOf(m));

    // Sort ascending so largest visible total is at top
    const sortFn = (a, b) => {
      const sa = visibleIndices.reduce((s, mi) => s + a.costs[mi], 0);
      const sb = visibleIndices.reduce((s, mi) => s + b.costs[mi], 0);
      return sa - sb;
    };

    const sorted = [...items].sort(sortFn);

    const series = models.map((model, mi) => ({
      name: model,
      type: 'bar',
      stack: 'total',
      data: sorted.map(d => d.costs[mi]),
      itemStyle: { color: colorMap[model] },
      emphasis: { focus: 'series' }
    }));

    chart.setOption({
      yAxis: { data: sorted.map(d => d.key) },
      series
    });
  });
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
