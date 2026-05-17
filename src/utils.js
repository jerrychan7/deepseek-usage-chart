/* ---- constants ---- */
export const MODEL_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#3b82f6'
];

export const TYPE_COLORS = {
  output_tokens:          '#f59e0b',
  input_cache_hit_tokens: '#3b82f6',
  input_cache_miss_tokens:'#ef4444',
  request_count:          '#8b5cf6'
};

export const TYPE_LABELS = {
  output_tokens:           '输出 Token',
  input_cache_hit_tokens:  '输入缓存命中',
  input_cache_miss_tokens: '输入缓存未命中',
  request_count:           '请求次数'
};

export const TOKEN_TYPES = ['output_tokens', 'input_cache_hit_tokens', 'input_cache_miss_tokens'];

/* ---- CSV parser ---- */
export function parseCSV(text) {
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
export function formatNum(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toString();
}

export function groupBy(arr, keys) {
  const map = new Map();
  for (const item of arr) {
    const k = keys.map(k => item[k]).join('|');
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

export function computeCost(rows) {
  return rows.reduce((sum, r) => {
    if (r.type === 'request_count') return sum;
    return sum + parseFloat(r.price || 0) * parseInt(r.amount || 0);
  }, 0);
}

export function computeTokens(rows) {
  return rows.filter(r => r.type !== 'request_count')
    .reduce((s, r) => s + parseInt(r.amount || 0), 0);
}

export function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return str.replace(/[&<>"']/g, c => map[c]);
}
