/* Sales Analytics Dashboard — static client-side app (no server required). */

const REGIONS = ["North America", "Europe", "LATAM", "Asia Pacific"];
const PRODUCT_CATEGORIES = ["Analytics", "CRM", "Marketing", "Support", "Security"];
const SALES_REPS = [
  "Avery Collins",
  "Jordan Blake",
  "Priya Nair",
  "Marcus Chen",
  "Elena Rossi",
  "Sam Okafor",
  "Nina Petrova",
  "Liam Sullivan",
];
const STATUSES = ["Completed", "Pending", "Refunded", "Cancelled"];
const DEFAULT_STATUSES = ["Completed"];

const REGION_COLORS = {
  "North America": "#4C78A8",
  Europe: "#72B7B2",
  LATAM: "#E29E4A",
  "Asia Pacific": "#8C7BB5",
};
const CATEGORY_COLORS = {
  Analytics: "#4C78A8",
  CRM: "#72B7B2",
  Marketing: "#E29E4A",
  Support: "#8C7BB5",
  Security: "#C46D6D",
};
const CHART_SEQUENCE = ["#4C78A8", "#72B7B2", "#E29E4A", "#8C7BB5", "#C46D6D", "#6B9E5C"];
const REFUND_WARNING_THRESHOLD = 10.0;

const DATA = SALES_DATA.map((row) => ({ ...row, order_date: new Date(row.order_date) }));

const dataMinDate = new Date(Math.min(...DATA.map((r) => r.order_date)));
const dataMaxDate = new Date(Math.max(...DATA.map((r) => r.order_date)));

const state = {
  startDate: null,
  endDate: null,
  regions: [...REGIONS],
  categories: [...PRODUCT_CATEGORIES],
  reps: [...SALES_REPS],
  statuses: [...DEFAULT_STATUSES],
};

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function defaultDateRange() {
  const end = new Date(dataMaxDate);
  const start = new Date(end);
  start.setDate(start.getDate() - 180);
  return [start < dataMinDate ? new Date(dataMinDate) : start, end];
}

function resetState() {
  const [start, end] = defaultDateRange();
  state.startDate = start;
  state.endDate = end;
  state.regions = [...REGIONS];
  state.categories = [...PRODUCT_CATEGORIES];
  state.reps = [...SALES_REPS];
  state.statuses = [...DEFAULT_STATUSES];
}

function filterRows(rows, { start, end, regions, categories, reps, statuses }) {
  return rows.filter(
    (r) =>
      r.order_date >= start &&
      r.order_date <= end &&
      regions.includes(r.region) &&
      categories.includes(r.product_category) &&
      reps.includes(r.sales_rep) &&
      statuses.includes(r.status)
  );
}

function currentFilterParams() {
  return {
    start: state.startDate,
    end: state.endDate,
    regions: state.regions,
    categories: state.categories,
    reps: state.reps,
    statuses: state.statuses,
  };
}

function previousPeriodParams() {
  const periodMs = state.endDate - state.startDate;
  const prevEnd = new Date(state.startDate.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - periodMs);
  return {
    start: prevStart,
    end: prevEnd,
    regions: state.regions,
    categories: state.categories,
    reps: state.reps,
    statuses: state.statuses,
  };
}

function formatCurrencyShort(value) {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatDelta(current, previous) {
  if (previous === 0) return { text: "n/a", direction: "" };
  const change = ((current - previous) / previous) * 100;
  const sign = change >= 0 ? "+" : "";
  return { text: `${sign}${change.toFixed(1)}%`, direction: change >= 0 ? "up" : "down" };
}

function computeKPIs(revenueRows, refundBaseRows) {
  const totalRevenue = revenueRows.reduce((sum, r) => sum + r.total_revenue, 0);
  const orders = revenueRows.length;
  const avgOrderValue = orders ? totalRevenue / orders : 0;

  const totalAll = refundBaseRows.length;
  const refunded = refundBaseRows.filter((r) => r.status === "Refunded").length;
  const refundRate = totalAll ? (refunded / totalAll) * 100 : 0;

  return { totalRevenue, orders, avgOrderValue, refundRate };
}

function groupSum(rows, keyFn, valueFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    map.set(key, (map.get(key) || 0) + valueFn(row));
  }
  return map;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const PLOTLY_LAYOUT_BASE = {
  margin: { l: 50, r: 20, t: 10, b: 40 },
  plot_bgcolor: "rgba(0,0,0,0)",
  paper_bgcolor: "rgba(0,0,0,0)",
  legend: { orientation: "h", yanchor: "bottom", y: 1.02, xanchor: "left", x: 0 },
  font: { color: getComputedStyle(document.documentElement).getPropertyValue("--text").trim() || "#1a1d21" },
};

function plotlyConfig() {
  return { responsive: true, displaylogo: false };
}

function renderRevenueOverTime(rows) {
  const monthly = groupSum(rows, (r) => monthKey(r.order_date), (r) => r.total_revenue);
  const keys = [...monthly.keys()].sort();
  const values = keys.map((k) => monthly.get(k));
  const rollingAvg = values.map((_, i) => {
    const windowVals = values.slice(Math.max(0, i - 2), i + 1);
    return windowVals.reduce((a, b) => a + b, 0) / windowVals.length;
  });
  const labels = keys.map(monthLabel);

  Plotly.newPlot(
    "chart-revenue-time",
    [
      {
        x: labels,
        y: values,
        mode: "lines+markers",
        name: "Monthly revenue",
        line: { color: CHART_SEQUENCE[0], width: 2 },
      },
      {
        x: labels,
        y: rollingAvg,
        mode: "lines",
        name: "3-month rolling avg",
        line: { color: CHART_SEQUENCE[2], width: 2, dash: "dash" },
      },
    ],
    { ...PLOTLY_LAYOUT_BASE },
    plotlyConfig()
  );
}

function renderRevenueByRegion(rows) {
  const grouped = groupSum(rows, (r) => r.region, (r) => r.total_revenue);
  const regions = REGIONS.filter((r) => grouped.has(r));
  Plotly.newPlot(
    "chart-revenue-region",
    [
      {
        x: regions,
        y: regions.map((r) => grouped.get(r)),
        type: "bar",
        marker: { color: regions.map((r) => REGION_COLORS[r]) },
      },
    ],
    { ...PLOTLY_LAYOUT_BASE, yaxis: { title: "Revenue" } },
    plotlyConfig()
  );
}

function renderTopProducts(rows) {
  const grouped = groupSum(rows, (r) => r.product_name, (r) => r.total_revenue);
  const sorted = [...grouped.entries()].sort((a, b) => a[1] - b[1]).slice(-10);
  Plotly.newPlot(
    "chart-top-products",
    [
      {
        x: sorted.map((e) => e[1]),
        y: sorted.map((e) => e[0]),
        type: "bar",
        orientation: "h",
        marker: { color: CHART_SEQUENCE[0] },
      },
    ],
    { ...PLOTLY_LAYOUT_BASE, xaxis: { title: "Revenue" } },
    plotlyConfig()
  );
}

function renderTreemap(rows) {
  const grouped = new Map();
  for (const r of rows) {
    const key = `${r.product_category}||${r.product_name}`;
    grouped.set(key, (grouped.get(key) || 0) + r.total_revenue);
  }
  const categories = [...new Set(rows.map((r) => r.product_category))];
  const labels = [...categories];
  const parents = categories.map(() => "");
  const values = categories.map((c) =>
    [...grouped.entries()].filter(([k]) => k.startsWith(c + "||")).reduce((s, [, v]) => s + v, 0)
  );
  const colors = categories.map((c) => CATEGORY_COLORS[c]);

  for (const [key, value] of grouped.entries()) {
    const [category, product] = key.split("||");
    labels.push(product);
    parents.push(category);
    values.push(value);
    colors.push(CATEGORY_COLORS[category]);
  }

  Plotly.newPlot(
    "chart-treemap",
    [
      {
        type: "treemap",
        labels,
        parents,
        values,
        marker: { colors },
        branchvalues: "total",
      },
    ],
    { ...PLOTLY_LAYOUT_BASE },
    plotlyConfig()
  );
}

function renderRevenueByRep(rows) {
  const grouped = groupSum(rows, (r) => r.sales_rep, (r) => r.total_revenue);
  const sorted = [...grouped.entries()].sort((a, b) => b[1] - a[1]);
  Plotly.newPlot(
    "chart-revenue-rep",
    [
      {
        x: sorted.map((e) => e[0]),
        y: sorted.map((e) => e[1]),
        type: "bar",
        marker: { color: CHART_SEQUENCE[1] },
      },
    ],
    { ...PLOTLY_LAYOUT_BASE, yaxis: { title: "Revenue" } },
    plotlyConfig()
  );
}

function renderRepTable(revenueRows, refundBaseRows) {
  const revenueByRep = new Map();
  for (const r of revenueRows) {
    const entry = revenueByRep.get(r.sales_rep) || { orders: 0, revenue: 0 };
    entry.orders += 1;
    entry.revenue += r.total_revenue;
    revenueByRep.set(r.sales_rep, entry);
  }

  const refundByRep = new Map();
  for (const r of refundBaseRows) {
    const entry = refundByRep.get(r.sales_rep) || { total: 0, refunded: 0 };
    entry.total += 1;
    if (r.status === "Refunded") entry.refunded += 1;
    refundByRep.set(r.sales_rep, entry);
  }

  const rows = [...revenueByRep.entries()]
    .map(([rep, { orders, revenue }]) => {
      const refundInfo = refundByRep.get(rep) || { total: 0, refunded: 0 };
      const refundRate = refundInfo.total ? (refundInfo.refunded / refundInfo.total) * 100 : 0;
      return { rep, orders, revenue, avgOrderValue: revenue / orders, refundRate };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const tbody = document.querySelector("#rep-table tbody");
  tbody.innerHTML = "";
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No data for current filters.</td></tr>';
    return;
  }
  for (const row of rows) {
    const tr = document.createElement("tr");
    const refundClass = row.refundRate > REFUND_WARNING_THRESHOLD ? "refund-high" : "";
    tr.innerHTML = `
      <td>${row.rep}</td>
      <td>${row.orders.toLocaleString("en-US")}</td>
      <td>$${row.revenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
      <td>$${row.avgOrderValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
      <td class="${refundClass}">${row.refundRate.toFixed(1)}%</td>
    `;
    tbody.appendChild(tr);
  }
}

const RAW_COLUMNS = [
  "order_id",
  "order_date",
  "customer_name",
  "region",
  "product_category",
  "product_name",
  "sales_rep",
  "units_sold",
  "unit_price",
  "total_revenue",
  "discount_pct",
  "status",
];

function renderRawDataTable(rows) {
  const thead = document.querySelector("#raw-table thead");
  const tbody = document.querySelector("#raw-table tbody");
  thead.innerHTML = `<tr>${RAW_COLUMNS.map((c) => `<th>${c}</th>`).join("")}</tr>`;
  tbody.innerHTML = "";

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${RAW_COLUMNS.length}" class="empty-state">No data for current filters.</td></tr>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = RAW_COLUMNS.map((c) => {
      let value = row[c];
      if (c === "order_date") value = toISODate(value);
      if (c === "unit_price" || c === "total_revenue") value = Number(value).toFixed(2);
      if (c === "discount_pct") value = Number(value).toFixed(1);
      return `<td>${value}</td>`;
    }).join("");
    fragment.appendChild(tr);
  }
  tbody.appendChild(fragment);
  document.getElementById("raw-row-count").textContent = `${rows.length.toLocaleString("en-US")} rows`;
}

function rowsToCSV(rows) {
  const header = RAW_COLUMNS.join(",");
  const lines = rows.map((row) =>
    RAW_COLUMNS.map((c) => {
      let value = row[c];
      if (c === "order_date") value = toISODate(value);
      if (typeof value === "string" && value.includes(",")) value = `"${value}"`;
      return value;
    }).join(",")
  );
  return [header, ...lines].join("\n");
}

function downloadCSV(rows) {
  const csv = rowsToCSV(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sales_data_filtered.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function renderKPIRow(current, previous) {
  const revenueDelta = formatDelta(current.totalRevenue, previous.totalRevenue);
  const ordersDelta = formatDelta(current.orders, previous.orders);
  const aovDelta = formatDelta(current.avgOrderValue, previous.avgOrderValue);
  const refundDelta = formatDelta(current.refundRate, previous.refundRate);

  document.getElementById("kpi-revenue-value").textContent = formatCurrencyShort(current.totalRevenue);
  document.getElementById("kpi-orders-value").textContent = current.orders.toLocaleString("en-US");
  document.getElementById("kpi-aov-value").textContent = formatCurrencyShort(current.avgOrderValue);
  document.getElementById("kpi-refund-value").textContent = `${current.refundRate.toFixed(1)}%`;

  setDelta("kpi-revenue-delta", revenueDelta, false);
  setDelta("kpi-orders-delta", ordersDelta, false);
  setDelta("kpi-aov-delta", aovDelta, false);
  setDelta("kpi-refund-delta", refundDelta, true);
}

function setDelta(elementId, delta, inverse) {
  const el = document.getElementById(elementId);
  el.textContent = delta.text;
  el.classList.remove("up", "down");
  if (delta.direction) {
    const displayDirection = inverse ? (delta.direction === "up" ? "down" : "up") : delta.direction;
    el.classList.add(displayDirection);
  }
}

function renderAll() {
  const filtered = filterRows(DATA, currentFilterParams());
  const refundBase = filterRows(DATA, { ...currentFilterParams(), statuses: STATUSES });
  const prevFiltered = filterRows(DATA, previousPeriodParams());
  const prevRefundBase = filterRows(DATA, { ...previousPeriodParams(), statuses: STATUSES });

  const currentKPIs = computeKPIs(filtered, refundBase);
  const previousKPIs = computeKPIs(prevFiltered, prevRefundBase);
  renderKPIRow(currentKPIs, previousKPIs);

  const chartsContainer = document.getElementById("charts-container");
  const emptyState = document.getElementById("charts-empty-state");

  if (filtered.length === 0) {
    chartsContainer.style.display = "none";
    emptyState.style.display = "block";
    return;
  }
  chartsContainer.style.display = "block";
  emptyState.style.display = "none";

  renderRevenueOverTime(filtered);
  renderRevenueByRegion(filtered);
  renderTopProducts(filtered);
  renderTreemap(filtered);
  renderRevenueByRep(filtered);
  renderRepTable(filtered, refundBase);
  renderRawDataTable(filtered);

  document.getElementById("download-csv-btn").onclick = () => downloadCSV(filtered);
}

function buildCheckboxGroup(containerId, options, selected, onChange) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  for (const option of options) {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = option;
    checkbox.checked = selected.includes(option);
    checkbox.addEventListener("change", onChange);
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(option));
    container.appendChild(label);
  }
}

function readCheckboxGroup(containerId) {
  return [...document.querySelectorAll(`#${containerId} input:checked`)].map((el) => el.value);
}

const DROPDOWN_FILTERS = [
  { key: "region", options: REGIONS },
  { key: "category", options: PRODUCT_CATEGORIES },
  { key: "rep", options: SALES_REPS },
  { key: "status", options: STATUSES },
];

const STATE_FIELD_BY_KEY = {
  region: "regions",
  category: "categories",
  rep: "reps",
  status: "statuses",
};

function dropdownLabelText(selectedCount, totalCount) {
  if (selectedCount === 0) return "None selected";
  if (selectedCount === totalCount) return "All";
  return `${selectedCount} of ${totalCount} selected`;
}

function updateDropdownLabel(key, totalCount) {
  const selectedCount = state[STATE_FIELD_BY_KEY[key]].length;
  document.getElementById(`${key}-toggle-text`).textContent = dropdownLabelText(selectedCount, totalCount);
}

function updateAllDropdownLabels() {
  DROPDOWN_FILTERS.forEach(({ key, options }) => updateDropdownLabel(key, options.length));
}

function closeAllDropdowns(except) {
  document.querySelectorAll(".dropdown.open").forEach((el) => {
    if (el !== except) el.classList.remove("open");
  });
}

function setupDropdowns() {
  DROPDOWN_FILTERS.forEach(({ key, options }) => {
    const dropdown = document.getElementById(`${key}-dropdown`);
    const toggle = document.getElementById(`${key}-toggle`);

    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = dropdown.classList.contains("open");
      closeAllDropdowns();
      dropdown.classList.toggle("open", !isOpen);
    });

    dropdown.querySelector('[data-action="select-all"]').addEventListener("click", (event) => {
      event.stopPropagation();
      setFilterSelection(key, [...options]);
    });

    dropdown.querySelector('[data-action="clear"]').addEventListener("click", (event) => {
      event.stopPropagation();
      setFilterSelection(key, []);
    });
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".dropdown")) closeAllDropdowns();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAllDropdowns();
  });
}

function setFilterSelection(key, values) {
  document.querySelectorAll(`#${key}-filter input`).forEach((checkbox) => {
    checkbox.checked = values.includes(checkbox.value);
  });
  state[STATE_FIELD_BY_KEY[key]] = values;
  updateAllDropdownLabels();
  renderAll();
}

function syncFiltersToUI() {
  document.getElementById("start-date").value = toISODate(state.startDate);
  document.getElementById("end-date").value = toISODate(state.endDate);
  buildCheckboxGroup("region-filter", REGIONS, state.regions, onFilterChange);
  buildCheckboxGroup("category-filter", PRODUCT_CATEGORIES, state.categories, onFilterChange);
  buildCheckboxGroup("rep-filter", SALES_REPS, state.reps, onFilterChange);
  buildCheckboxGroup("status-filter", STATUSES, state.statuses, onFilterChange);
  updateAllDropdownLabels();
}

function onFilterChange() {
  state.startDate = new Date(document.getElementById("start-date").value);
  state.endDate = new Date(document.getElementById("end-date").value);
  state.regions = readCheckboxGroup("region-filter");
  state.categories = readCheckboxGroup("category-filter");
  state.reps = readCheckboxGroup("rep-filter");
  state.statuses = readCheckboxGroup("status-filter");
  updateAllDropdownLabels();
  renderAll();
}

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.target).classList.add("active");
    });
  });
}

function setupResetButton() {
  document.getElementById("reset-filters-btn").addEventListener("click", () => {
    resetState();
    syncFiltersToUI();
    renderAll();
  });
}

function init() {
  document.getElementById("start-date").min = toISODate(dataMinDate);
  document.getElementById("start-date").max = toISODate(dataMaxDate);
  document.getElementById("end-date").min = toISODate(dataMinDate);
  document.getElementById("end-date").max = toISODate(dataMaxDate);
  document.getElementById("start-date").addEventListener("change", onFilterChange);
  document.getElementById("end-date").addEventListener("change", onFilterChange);

  resetState();
  syncFiltersToUI();
  setupTabs();
  setupDropdowns();
  setupResetButton();
  renderAll();
}

document.addEventListener("DOMContentLoaded", init);
