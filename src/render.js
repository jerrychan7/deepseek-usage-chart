import { getFilteredAmountRows, getFilteredCostRows, snapshotFilterState } from './state.js';
import { clearCharts, resizeCharts, resizeChart, renderDailyCost, renderTokenType, renderDailyTokens, renderKeyCost, renderKeyTokens } from './charts.js';
import { renderKeyTable } from './table.js';

let _saveFilterState = null;

export function setSaveFilterState(fn) {
  _saveFilterState = fn;
}

export function syncCostView() {
  const toggle = document.getElementById('costViewToggle');
  const isBar = toggle && toggle.checked;
  const sunburstWrap = document.getElementById('sunburstWrap');
  const barWrap = document.getElementById('keyCostWrap');
  const legend = document.getElementById('tokenTypeLegend');
  if (sunburstWrap) sunburstWrap.style.display = isBar ? 'none' : '';
  if (barWrap) barWrap.style.display = isBar ? '' : 'none';
  if (legend) legend.style.display = isBar ? 'none' : '';
  requestAnimationFrame(() => {
    if (isBar) resizeChart('keyCostChart');
    else resizeChart('tokenTypeChart');
  });
}

export function applyFilter() {
  clearCharts();
  const amountRows = getFilteredAmountRows();
  const costRows = getFilteredCostRows();
  renderKeyTable(amountRows);
  renderTokenType(amountRows);
  renderDailyTokens(amountRows);
  renderKeyCost(amountRows);
  renderKeyTokens(amountRows);
  renderDailyCost(costRows);
  requestAnimationFrame(() => resizeCharts());
  requestAnimationFrame(() => syncCostView());
  if (_saveFilterState) _saveFilterState();
}
