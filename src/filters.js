import { escapeHtml } from './utils.js';
import { allAmountRows, allCostRows, activeKeys, activeModels, dateMin, dateMax, setDateMin, setDateMax } from './state.js';
import { applyFilter } from './render.js';

function filterRows(rows) {
  let result = rows;
  if (activeKeys.size > 0) result = result.filter(r => activeKeys.has(r.api_key_name));
  if (activeModels.size > 0) result = result.filter(r => activeModels.has(r.model));
  if (dateMin) result = result.filter(r => r.utc_date >= dateMin);
  if (dateMax) result = result.filter(r => r.utc_date <= dateMax);
  return result;
}

export function getFilteredAmountRows() {
  return filterRows(allAmountRows);
}

export function getFilteredCostRows() {
  let result = allCostRows;
  if (activeModels.size > 0) result = result.filter(r => activeModels.has(r.model));
  if (dateMin) result = result.filter(r => r.utc_date >= dateMin);
  if (dateMax) result = result.filter(r => r.utc_date <= dateMax);
  return result;
}

/* ---- key filter ---- */
export function renderFilter() {
  const keys = [...new Set(allAmountRows.map(r => r.api_key_name))].sort();
  const bar = document.getElementById('filterBar');
  const container = document.getElementById('filterKeys');
  if (keys.length <= 1) { bar.style.display = 'none'; return; }

  bar.style.display = '';
  container.innerHTML = keys.map(key => {
    const checked = activeKeys.has(key) ? 'checked' : '';
    return `<label class="filter-chip"><input type="checkbox" value="${escapeHtml(key)}" ${checked}> ${escapeHtml(key)}</label>`;
  }).join('');

  const checkboxes = container.querySelectorAll('input[type=checkbox]');
  const btnSelectAll = document.getElementById('btnSelectAll');
  const btnClear = document.getElementById('btnClear');

  function updateButtons() {
    const checked = [...checkboxes].filter(cb => cb.checked);
    btnSelectAll.style.display = checked.length === 0 || checked.length === checkboxes.length ? 'none' : '';
    btnClear.style.display = checked.length === 0 ? 'none' : '';
  }

  function onCheckChange() {
    activeKeys.clear();
    checkboxes.forEach(cb => { if (cb.checked) activeKeys.add(cb.value); });
    updateButtons();
    applyFilter();
  }

  checkboxes.forEach(cb => cb.addEventListener('change', onCheckChange));

  btnSelectAll.onclick = () => {
    checkboxes.forEach(cb => { cb.checked = true; });
    activeKeys.clear();
    checkboxes.forEach(cb => { activeKeys.add(cb.value); });
    updateButtons();
    applyFilter();
  };

  btnClear.onclick = () => {
    checkboxes.forEach(cb => { cb.checked = false; });
    activeKeys.clear();
    updateButtons();
    applyFilter();
  };

  updateButtons();
}

/* ---- model filter ---- */
export function renderModelFilter() {
  const models = [...new Set(allAmountRows.map(r => r.model))].sort().reverse();
  const bar = document.getElementById('modelFilterRow');
  const container = document.getElementById('filterModels');
  if (models.length <= 1) { bar.style.display = 'none'; return; }

  bar.style.display = '';
  container.innerHTML = models.map(m => {
    const checked = activeModels.has(m) ? 'checked' : '';
    return `<label class="filter-chip"><input type="checkbox" value="${escapeHtml(m)}" ${checked}> ${escapeHtml(m)}</label>`;
  }).join('');

  const checkboxes = container.querySelectorAll('input[type=checkbox]');
  const btnSelectAll = document.getElementById('btnSelectAllModels');
  const btnClear = document.getElementById('btnClearModels');

  function updateButtons() {
    const checked = [...checkboxes].filter(cb => cb.checked);
    btnSelectAll.style.display = checked.length === 0 || checked.length === checkboxes.length ? 'none' : '';
    btnClear.style.display = checked.length === 0 ? 'none' : '';
  }

  function onCheckChange() {
    activeModels.clear();
    checkboxes.forEach(cb => { if (cb.checked) activeModels.add(cb.value); });
    updateButtons();
    applyFilter();
  }

  checkboxes.forEach(cb => cb.addEventListener('change', onCheckChange));

  btnSelectAll.onclick = () => {
    checkboxes.forEach(cb => { cb.checked = true; });
    activeModels.clear();
    checkboxes.forEach(cb => { activeModels.add(cb.value); });
    updateButtons();
    applyFilter();
  };

  btnClear.onclick = () => {
    checkboxes.forEach(cb => { cb.checked = false; });
    activeModels.clear();
    updateButtons();
    applyFilter();
  };

  updateButtons();
}

/* ---- date filter ---- */
export function renderDateFilter() {
  const dates = [...new Set(allCostRows.map(r => r.utc_date))].sort();
  const bar = document.getElementById('dateFilterRow');
  bar.style.display = '';
  const minDate = dates[0] || '';
  const maxDate = dates[dates.length - 1] || '';

  document.getElementById('dateMin').min = minDate;
  document.getElementById('dateMin').max = maxDate;
  document.getElementById('dateMin').value = dateMin;
  document.getElementById('dateMax').min = minDate;
  document.getElementById('dateMax').max = maxDate;
  document.getElementById('dateMax').value = dateMax;

  document.getElementById('dateMin').onchange = e => {
    setDateMin(e.target.value);
    applyFilter();
  };
  document.getElementById('dateMax').onchange = e => {
    setDateMax(e.target.value);
    applyFilter();
  };
}
