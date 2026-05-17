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
