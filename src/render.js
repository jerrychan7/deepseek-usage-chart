import { getFilteredAmountRows, getFilteredCostRows, snapshotFilterState } from './state.js';
import { clearCharts, resizeCharts, resizeChart, renderDailyCost, renderTokenType, renderDailyTokens, renderKeyCost, renderKeyCostNormalized, renderKeyTokens } from './charts.js';
import { renderKeyTable } from './table.js';

let _saveFilterState = null;

export function setSaveFilterState(fn) {
  _saveFilterState = fn;
}

export function syncCostView() {
  const isSunburst = document.getElementById('costSunburstCb')?.checked;
  const isNormalized = document.getElementById('costNormalizedCb')?.checked;
  const show = (el) => { if (el) el.style.display = ''; };
  const hide = (el) => { if (el) el.style.display = 'none'; };
  hide(document.getElementById('sunburstWrap'));
  hide(document.getElementById('keyCostWrap'));
  hide(document.getElementById('keyCostNormWrap'));
  hide(document.getElementById('tokenTypeLegend'));
  if (isSunburst) {
    show(document.getElementById('sunburstWrap'));
    show(document.getElementById('tokenTypeLegend'));
  } else if (isNormalized) {
    show(document.getElementById('keyCostNormWrap'));
  } else {
    show(document.getElementById('keyCostWrap'));
  }
  requestAnimationFrame(() => {
    if (isSunburst) resizeChart('tokenTypeChart');
    else if (isNormalized) resizeChart('keyCostNormChart');
    else resizeChart('keyCostChart');
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
  renderKeyCostNormalized(amountRows);
  renderKeyTokens(amountRows);
  renderDailyCost(costRows);
  requestAnimationFrame(() => resizeCharts());
  requestAnimationFrame(() => syncCostView());
  if (_saveFilterState) _saveFilterState();
}
