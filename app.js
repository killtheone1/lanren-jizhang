const storageKey = "phone-ledger-bills-v1";
const body = document.querySelector("#items-body");
const rowTemplate = document.querySelector("#item-row-template");
const customerName = document.querySelector("#customer-name");
const billDate = document.querySelector("#bill-date");
const billNumber = document.querySelector("#bill-number");
const saveState = document.querySelector("#save-state");
const modelSummary = document.querySelector("#model-summary");
const grandTotal = document.querySelector("#grand-total");
const totalQuantity = document.querySelector("#total-quantity");
const lineCount = document.querySelector("#line-count");
const historyPanel = document.querySelector("#history-panel");
const historyList = document.querySelector("#history-list");
const scrim = document.querySelector("#scrim");
let activeSavedId = null;

function today() { return new Date().toISOString().slice(0, 10); }
function createBillNumber() { return `XS${new Date().toISOString().replace(/[-:T.Z]/g, "").slice(2, 12)}`; }
function asNumber(value) { const parsed = Number.parseFloat(value); return Number.isFinite(parsed) ? parsed : 0; }
function money(value) { return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", minimumFractionDigits: 2 }).format(value); }
function formatQuantity(value) { return Number.isInteger(value) ? value : value.toFixed(2).replace(/\.00$/, ""); }
function rows() { return [...body.querySelectorAll("tr")]; }
function rowData(row) {
  return {
    model: row.querySelector(".model-input").value.trim(),
    price: asNumber(row.querySelector(".price-input").value),
    quantity: asNumber(row.querySelector(".quantity-input").value)
  };
}
function activeRows() { return rows().map(rowData).filter(item => item.model || item.price || item.quantity); }
function setSavedState(text = "未保存") { saveState.textContent = text; }

function addRow(data = {}) {
  const row = rowTemplate.content.firstElementChild.cloneNode(true);
  row.querySelector(".model-input").value = data.model ?? "";
  row.querySelector(".price-input").value = data.price ?? "";
  row.querySelector(".quantity-input").value = data.quantity ?? "";
  row.querySelectorAll("input").forEach(input => input.addEventListener("input", () => { setSavedState(); recalculate(); }));
  row.querySelector(".delete-line").addEventListener("click", () => {
    if (rows().length === 1) {
      row.querySelectorAll("input").forEach(input => { input.value = ""; });
    } else { row.remove(); }
    setSavedState(); recalculate();
  });
  body.append(row);
  recalculate();
  return row;
}

function recalculate() {
  const grouped = new Map();
  let total = 0;
  let quantity = 0;
  rows().forEach(row => {
    const item = rowData(row);
    const amount = item.price * item.quantity;
    const cell = row.querySelector(".amount-cell");
    cell.textContent = money(amount);
    cell.classList.toggle("negative", amount < 0);
    if (item.model) {
      const current = grouped.get(item.model) || { quantity: 0, amount: 0 };
      current.quantity += item.quantity;
      current.amount += amount;
      grouped.set(item.model, current);
    }
    total += amount;
    quantity += item.quantity;
  });
  modelSummary.replaceChildren();
  if (!grouped.size) {
    const empty = document.createElement("p");
    empty.className = "empty-summary";
    empty.textContent = "录入型号、单价和数量后，这里会自动汇总。";
    modelSummary.append(empty);
  } else {
    grouped.forEach((item, model) => {
      const row = document.createElement("div");
      row.className = "summary-row";
      const displayQuantity = `${formatQuantity(item.quantity)} 台${item.quantity < 0 ? "（退货）" : ""}`;
      row.innerHTML = `<span class="summary-model"></span><span class="summary-quantity"></span><span class="summary-amount"></span>`;
      row.querySelector(".summary-model").textContent = model;
      row.querySelector(".summary-quantity").textContent = displayQuantity;
      const amount = row.querySelector(".summary-amount");
      amount.textContent = money(item.amount);
      amount.classList.toggle("negative", item.amount < 0);
      modelSummary.append(row);
    });
  }
  grandTotal.textContent = money(total);
  totalQuantity.textContent = `共 ${formatQuantity(quantity)} 台`;
  lineCount.textContent = `${activeRows().length} 条明细`;
}

function currentBill() {
  const allRows = activeRows();
  return {
    id: activeSavedId || crypto.randomUUID(),
    customer: customerName.value.trim() || "未填写客户",
    date: billDate.value || today(),
    number: billNumber.value.trim(),
    rows: allRows,
    updatedAt: new Date().toISOString()
  };
}
function billTotal(bill) { return bill.rows.reduce((sum, item) => sum + item.price * item.quantity, 0); }
function getBills() { try { return JSON.parse(localStorage.getItem(storageKey)) || []; } catch { return []; } }
function saveBills(bills) { localStorage.setItem(storageKey, JSON.stringify(bills)); }

function saveCurrentBill() {
  const bill = currentBill();
  if (!bill.rows.length) { saveState.textContent = "请至少录入一条商品明细"; return; }
  const bills = getBills();
  const index = bills.findIndex(item => item.id === bill.id);
  if (index >= 0) bills[index] = bill; else bills.unshift(bill);
  saveBills(bills);
  activeSavedId = bill.id;
  saveState.textContent = "已保存到本机";
  renderHistory();
}
function loadBill(bill) {
  activeSavedId = bill.id;
  customerName.value = bill.customer === "未填写客户" ? "" : bill.customer;
  billDate.value = bill.date;
  billNumber.value = bill.number || "";
  body.replaceChildren();
  (bill.rows.length ? bill.rows : [{}]).forEach(addRow);
  recalculate();
  saveState.textContent = "已载入历史账单";
  closeHistory();
}
function renderHistory() {
  const bills = getBills();
  historyList.replaceChildren();
  if (!bills.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "还没有保存的账单";
    historyList.append(empty);
    return;
  }
  bills.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).forEach(bill => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-item";
    button.innerHTML = `<span class="history-name"></span><span class="history-meta"></span><span class="history-total"></span>`;
    button.querySelector(".history-name").textContent = bill.customer;
    button.querySelector(".history-meta").textContent = `${bill.date} · ${bill.rows.length} 条明细`;
    button.querySelector(".history-total").textContent = money(billTotal(bill));
    button.addEventListener("click", () => loadBill(bill));
    historyList.append(button);
  });
}
function openHistory() { renderHistory(); historyPanel.classList.add("is-open"); historyPanel.setAttribute("aria-hidden", "false"); scrim.hidden = false; }
function closeHistory() { historyPanel.classList.remove("is-open"); historyPanel.setAttribute("aria-hidden", "true"); scrim.hidden = true; }
function newBill() {
  activeSavedId = null;
  customerName.value = "";
  billDate.value = today();
  billNumber.value = createBillNumber();
  body.replaceChildren();
  addRow();
  setSavedState();
  recalculate();
  closeHistory();
}

document.querySelector("#add-line").addEventListener("click", () => { const row = addRow(); row.querySelector(".model-input").focus(); setSavedState(); });
document.querySelector("#save-bill").addEventListener("click", saveCurrentBill);
document.querySelector("#new-bill").addEventListener("click", newBill);
document.querySelector("#history-toggle").addEventListener("click", openHistory);
document.querySelector("#close-history").addEventListener("click", closeHistory);
scrim.addEventListener("click", closeHistory);
document.querySelector("#print-bill").addEventListener("click", () => window.print());
[customerName, billDate, billNumber].forEach(input => input.addEventListener("input", () => setSavedState()));

billDate.value = today();
billNumber.value = createBillNumber();
addRow();
