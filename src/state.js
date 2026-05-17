export const CURRENCY_SYMBOLS = { CNY: '¥', USD: '$', EUR: '€', GBP: '£' };

export function getCurrencySymbol(code) {
  return CURRENCY_SYMBOLS[code] || code;
}

/* ---- currency ---- */
export let currencySymbol = '¥';
export let currencyCode = 'CNY';
export let multiCurrency = false;

export function setCurrency(currencies) {
  multiCurrency = currencies.length > 1;
  if (currencies.length === 1) {
    currencyCode = currencies[0];
    currencySymbol = getCurrencySymbol(currencyCode);
  } else if (currencies.length > 1) {
    currencyCode = currencies.join('/');
  }
}

/* ---- data ---- */
export let allCostRows = [];
export let allAmountRows = [];

export function setData(costRows, amountRows) {
  allCostRows = costRows;
  allAmountRows = amountRows;
}

export function clearData() {
  allCostRows = [];
  allAmountRows = [];
}

/* ---- filter state ---- */
export let activeKeys = new Set();
export let activeModels = new Set();
export let dateMin = '';
export let dateMax = '';

export function resetFilters() {
  activeKeys = new Set();
  activeModels = new Set();
  dateMin = '';
  dateMax = '';
}

export function setFilterState(keys, models, dMin, dMax) {
  activeKeys = new Set(keys);
  activeModels = new Set(models);
  dateMin = dMin || '';
  dateMax = dMax || '';
}

export function snapshotFilterState() {
  return {
    activeKeys: [...activeKeys],
    activeModels: [...activeModels],
    dateMin,
    dateMax
  };
}

/* ---- derived data ---- */
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
