import { parseCSV } from './utils.js';
import { setCurrency, setData, clearData, resetFilters, setFilterState, snapshotFilterState, allAmountRows } from './state.js';
import { setAllChartsTheme, clearCharts, resizeCharts } from './charts.js';
import { applyFilter, setSaveFilterState } from './render.js';
import { renderFilter, renderModelFilter, renderDateFilter } from './filters.js';

/* ---- theme ---- */
const themeToggle = document.getElementById('themeToggle');

function getTheme() {
  const stored = localStorage.getItem('theme');
  if (stored) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'dark' ? '☀' : '☾';
  localStorage.setItem('theme', theme);
}

function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  setAllChartsTheme(next);
  if (allAmountRows.length > 0) applyFilter();
}

themeToggle.addEventListener('click', toggleTheme);
applyTheme(getTheme());

/* ---- summary-only toggle ---- */
const summaryCheck = document.getElementById('summaryOnly');
summaryCheck.addEventListener('change', () => {
  document.getElementById('keyTable').classList.toggle('summary-only', summaryCheck.checked);
  localStorage.setItem('summaryOnly', summaryCheck.checked ? '1' : '');
});
// restore persisted state
if (localStorage.getItem('summaryOnly') === '1') {
  summaryCheck.checked = true;
  // class will be applied on next table render
}

/* ---- DOM refs ---- */
const dropZone   = document.getElementById('dropZone');
const errorEl    = document.getElementById('error');
const loadingEl  = document.getElementById('loading');
const contentEl  = document.getElementById('content');
const fileNameEl = document.getElementById('fileName');
const btnClearCache = document.getElementById('btnClearCache');

const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.zip';

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

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => resizeCharts(), 200);
});

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

    setData(costRows, amountRows);
    resetFilters();

    const currencies = [...new Set(costRows.filter(r => r.currency).map(r => r.currency))];
    setCurrency(currencies);

    dropZone.classList.add('loaded');
    fileNameEl.textContent = '已加载: ' + file.name;
    btnClearCache.style.display = '';
    loadingEl.style.display = 'none';
    contentEl.style.display = '';

    saveCache(file);

    renderFilter();
    renderModelFilter();
    renderDateFilter();
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
  btnClearCache.style.display = 'none';
}

/* ---- localStorage cache ---- */
const CACHE_KEY = 'deepseek_usage_cache';

function saveCache(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const cache = {
      zipBase64: reader.result,
      fileName: file.name,
      filter: snapshotFilterState()
    };
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) {}
  };
  reader.readAsDataURL(file);
}

export function saveFilterState() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const cache = JSON.parse(raw);
    cache.filter = snapshotFilterState();
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {}
}

setSaveFilterState(saveFilterState);

async function restoreFromCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return false;
    const cache = JSON.parse(raw);
    if (!cache.zipBase64) return false;

    loadingEl.style.display = 'block';

    const res = await fetch(cache.zipBase64);
    const blob = await res.blob();
    const zip = await JSZip.loadAsync(blob);
    let amountText = null, costText = null;

    for (const [name, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      const base = name.split('/').pop();
      if (base.startsWith('amount-') && base.endsWith('.csv')) amountText = await entry.async('string');
      else if (base.startsWith('cost-') && base.endsWith('.csv')) costText = await entry.async('string');
    }

    if (!amountText || !costText) return false;

    const costRows = parseCSV(costText);
    const amountRows = parseCSV(amountText);
    if (costRows.length === 0 || amountRows.length === 0) return false;

    setData(costRows, amountRows);

    const currencies = [...new Set(costRows.filter(r => r.currency).map(r => r.currency))];
    setCurrency(currencies);

    if (cache.filter) {
      setFilterState(
        cache.filter.activeKeys || [],
        cache.filter.activeModels || [],
        cache.filter.dateMin || '',
        cache.filter.dateMax || ''
      );
    }

    dropZone.classList.add('loaded');
    fileNameEl.textContent = '已缓存: ' + (cache.fileName || '');
    btnClearCache.style.display = '';
    loadingEl.style.display = 'none';
    contentEl.style.display = '';

    renderFilter();
    renderModelFilter();
    renderDateFilter();
    applyFilter();
    return true;
  } catch (e) {
    localStorage.removeItem(CACHE_KEY);
    return false;
  }
}

function clearCache() {
  localStorage.removeItem(CACHE_KEY);
  btnClearCache.style.display = 'none';
  dropZone.classList.remove('loaded');
  fileNameEl.textContent = '';
  contentEl.style.display = 'none';
  clearCharts();
  clearData();
  resetFilters();
}

btnClearCache.addEventListener('click', e => { e.stopPropagation(); clearCache(); });

restoreFromCache();
