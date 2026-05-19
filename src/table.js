import { computeCost, escapeHtml, formatNum } from './utils.js';
import { getCurrencySymbol, currencySymbol, currencyCode, multiCurrency, allCostRows } from './state.js';

export function renderKeyTable(amountRows) {
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

  function rowHtml(label, m, cls, labelCls, currency, costStr, avgCostStr, isModel) {
    const hs = isModel ? (key) => ' style="' + heatStyle(m, key) + '"' : () => '';
    return `<tr class="${cls}">` +
      `<td class="${labelCls || ''}">${escapeHtml(label)}</td>` +
      `<td class="val-cost"${hs('cost')}>${costStr || fmt(m.cost, 'cost', currency)}</td>` +
      `<td${hs('requests')}>${fmt(m.requests, 'count')}</td>` +
      `<td${hs('output')}>${fmt(m.output, 'count')}</td>` +
      `<td${hs('hit')}>${fmt(m.hit, 'count')}</td>` +
      `<td${hs('miss')}>${fmt(m.miss, 'count')}</td>` +
      `<td${hs('total')}>${fmt(m.total, 'count')}</td>` +
      `<td class="val-rate"${hs('rate')}>${fmt(m.rate, 'rate')}</td>` +
      `<td${hs('avgCost')}>${avgCostStr || fmt(m.avgCost, 'avg_cost', currency)}</td>` +
      `<td${hs('avgTokens')}>${fmt(m.avgTokens, 'avg_tokens')}</td>` +
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

  // Heatmap: per-column value ranges from model rows for cell background gradients.
  // Light mode (photopic): cones dominant → brand indigo is fine, moderate alpha range.
  // Dark mode (mesopic/scotopic): rod-dominant, Purkinje shift → use teal (~500nm),
  // which rods are most sensitive to. Indigo/purple becomes near-black in dim light.
  // Alpha must also be higher on dark bg for comparable perceived contrast.
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const heatRGB = isDark ? '45,212,191' : '99,102,241';    // teal-400 / indigo-500
  const alphaMin = isDark ? 0.10 : 0.08;
  const alphaMax = isDark ? 0.40 : 0.50;
  const colRanges = (() => {
    const vals = { cost:[], requests:[], output:[], hit:[], miss:[], total:[], rate:[], avgCost:[], avgTokens:[] };
    for (const kd of keyData) {
      for (const mr of kd.modelRows) {
        const m = mr.m;
        if (typeof m.cost === 'number') vals.cost.push(m.cost);
        if (typeof m.requests === 'number') vals.requests.push(m.requests);
        if (typeof m.output === 'number') vals.output.push(m.output);
        if (typeof m.hit === 'number') vals.hit.push(m.hit);
        if (typeof m.miss === 'number') vals.miss.push(m.miss);
        if (typeof m.total === 'number') vals.total.push(m.total);
        const r = parseFloat(m.rate); if (!isNaN(r)) vals.rate.push(r);
        const ac = parseFloat(m.avgCost); if (!isNaN(ac)) vals.avgCost.push(ac);
        if (typeof m.avgTokens === 'number') vals.avgTokens.push(m.avgTokens);
      }
    }
    const ranges = {};
    for (const key of Object.keys(vals)) {
      const a = vals[key];
      if (a.length < 2) { ranges[key] = null; continue; }
      const mn = Math.min(...a), mx = Math.max(...a);
      ranges[key] = { min: mn, max: mx, diff: mx - mn };
    }
    return ranges;
  })();
  function getHeatVal(m, key) {
    if (key === 'rate' || key === 'avgCost') return parseFloat(m[key]);
    return m[key];
  }
  function heatStyle(m, key) {
    const r = colRanges[key];
    if (!r || r.diff === 0) return '';
    const val = getHeatVal(m, key);
    if (typeof val !== 'number' || isNaN(val)) return '';
    const intensity = Math.max(0, Math.min(1, (val - r.min) / r.diff));
    // Light mode: log10 scale — stretches low end so small values are also distinguishable
    const mapped = isDark ? intensity : Math.log10(1 + intensity * 9);
    const a = alphaMin + mapped * (alphaMax - alphaMin);
    return 'background:rgba(' + heatRGB + ',' + a.toFixed(3) + ')';
  }

  let bodyHtml = '';
  let grand = { cost:0, requests:0, output:0, hit:0, miss:0, total:0 };
  let grandByCurrency = {};

  for (const kd of keyData) {
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
      bodyHtml += rowHtml('　' + mr.model, mr.m, 'model-row', 'model-label', cur, null, null, true);
    }
    const label = singleKey ? kd.key + ' 总计' : kd.key + ' 小计';
    bodyHtml += rowHtml(label, kd.sub, 'subtotal-row', 'subtotal-label', null, subCostStr, subAvgStr);
    grand.cost     += kd.sub.cost;
    grand.requests += kd.sub.requests;
    grand.output   += kd.sub.output;
    grand.hit      += kd.sub.hit;
    grand.miss     += kd.sub.miss;
    grand.total    += kd.sub.total;
    for (const [c, v] of Object.entries(subByCurrency)) {
      grandByCurrency[c] = (grandByCurrency[c] || 0) + v;
    }
  }

  if (!singleKey) {
    const grandCostStr = multiCurrency ? fmtCurrencyCost(grandByCurrency) : null;
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
