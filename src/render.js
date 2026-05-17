import { getFilteredAmountRows, getFilteredCostRows, snapshotFilterState } from './state.js';
import { clearCharts, resizeCharts, renderDailyCost, renderTokenType, renderDailyTokens, renderKeyCost, renderKeyTokens } from './charts.js';
import { renderKeyTable } from './table.js';

let _saveFilterState = null;

export function setSaveFilterState(fn) {
  _saveFilterState = fn;
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
  if (_saveFilterState) _saveFilterState();
}
