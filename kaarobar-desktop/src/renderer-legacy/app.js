const API_URL = "http://localhost:4000/api/v1";
const SESSION_KEY = "kaarobar_desktop_session";

let mode = "login";
let session = null;
let products = [];
let cart = [];
let till = null;
let businesses = [];
let branches = [];
let memberships = [];
let invProducts = [];
let invSuppliers = [];
let invPos = [];
let invTransfers = [];
let returnSale = null;
let returnQtys = {};
let roleSettings = {};
let essData = null;
let essTab = "clock";
let accountingTab = "tb";
let accountingAccounts = [];
let accountingJournals = [];
let accountingFrom = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 13);
  return d.toISOString().slice(0, 10);
})();
let accountingTo = (() => new Date().toISOString().slice(0, 10))();
let accountingGlAccountId = "";

let hrTab = "employees";
let hrEmployees = [];
let hrAttendance = [];
let hrLeave = [];
let hrPayroll = [];

let reportsFrom = accountingFrom;
let reportsTo = accountingTo;
let reportsBranch = null;
let reportsSalesByDay = [];
let reportsLowStock = [];

let settingsUsage = null;
let settingsBusinesses = [];
let settingsTab = "subscriptions";

const $ = (id) => document.getElementById(id);

function closeModal() {
  const root = $("modal-root");
  if (!root) return;
  root.classList.add("hidden");
  root.setAttribute("aria-hidden", "true");
  $("modal-body").innerHTML = "";
  $("modal-error").classList.add("hidden");
  $("modal-error").textContent = "";
}

function openModal({ title, subtitle = "", bodyHtml, wide = false }) {
  $("modal-title").textContent = title;
  $("modal-sub").textContent = subtitle;
  $("modal-sub").classList.toggle("hidden", !subtitle);
  $("modal-body").innerHTML = bodyHtml;
  $("modal-error").classList.add("hidden");
  $("modal-error").textContent = "";
  $("modal-root").querySelector(".modal-sheet").classList.toggle("wide", wide);
  $("modal-root").classList.remove("hidden");
  $("modal-root").setAttribute("aria-hidden", "false");
}

function setModalError(msg) {
  const el = $("modal-error");
  if (!msg) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.textContent = msg;
  el.classList.remove("hidden");
}

function money(n) {
  return Number(n || 0).toFixed(2);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function setSession(next) {
  session = next;
  memberships = next?.memberships || [];
  if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  else localStorage.removeItem(SESSION_KEY);
}

const ROLE_BUNDLES = {
  owner_manage: ["owner"],
  pos: ["owner", "admin", "branch_manager", "cashier", "employee"],
  pos_approve: ["owner", "admin", "branch_manager"],
  inventory: ["owner", "admin", "branch_manager", "inventory_manager", "employee"],
  accounting: ["owner", "admin", "accountant"],
  hr: ["owner", "admin", "hr_manager", "branch_manager"],
  reports: ["owner", "admin", "branch_manager", "accountant"],
  settings: ["owner", "admin"],
  notifications: ["owner", "admin", "branch_manager", "cashier", "inventory_manager", "accountant", "hr_manager", "employee"],
  employee_self: [
    "owner",
    "admin",
    "branch_manager",
    "hr_manager",
    "employee",
    "cashier",
    "inventory_manager",
    "accountant",
  ],
  any_staff: [
    "owner",
    "admin",
    "branch_manager",
    "cashier",
    "inventory_manager",
    "accountant",
    "hr_manager",
    "employee",
  ],
};

const NAV_BUNDLE = {
  dashboard: "any_staff",
  pos: "pos",
  returns: "pos",
  inventory: "inventory",
  accounting: "accounting",
  hr: "hr",
  reports: "reports",
  notifications: "notifications",
  ess: "employee_self",
  settings: "owner_manage",
  profile: "any_staff",
};

function activeRoles() {
  if (!session?.business_id) return [];
  return [...new Set(
    memberships
      .filter((m) => m.business_id === session.business_id && m.status === "active")
      .filter((m) => !m.branch_id || !session.branch_id || m.branch_id === session.branch_id)
      .flatMap((m) => (m.roles || []).map(normalizeRole))
  )];
}

function normalizeRole(role) {
  if (role === "manager") return "branch_manager";
  if (role === "inventory_clerk") return "inventory_manager";
  if (role === "hr") return "hr_manager";
  return role;
}

function canAccess(bundle) {
  const roles = activeRoles();
  if (roles.includes("owner")) return true;
  return roles.some((role) => {
    const override = roleSettings?.[role]?.[bundle];
    if (typeof override === "boolean") return override;
    return (ROLE_BUNDLES[bundle] || []).includes(role);
  });
}

function applyNavAccess() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    const bundle = NAV_BUNDLE[btn.dataset.nav];
    const allowed = !bundle || canAccess(bundle);
    btn.classList.toggle("hidden", !allowed);
  });
}

async function api(path, init = {}, sess = session) {
  const headers = { "Content-Type": "application/json", ...(init.headers || {}) };
  if (sess?.access_token) headers.Authorization = `Bearer ${sess.access_token}`;
  if (sess?.business_id) headers["x-business-id"] = sess.business_id;
  if (sess?.branch_id) headers["x-branch-id"] = sess.branch_id;
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(body?.error || body?.message || `HTTP ${res.status}`);
  return body;
}

function showAuth() {
  $("auth-view").classList.remove("hidden");
  $("app-shell").classList.add("hidden");
}

function showApp() {
  $("auth-view").classList.add("hidden");
  $("app-shell").classList.remove("hidden");
}

function t(key, vars) {
  return window.KaarobarI18n ? window.KaarobarI18n.t(key, vars) : key;
}

function notify(message, type = "info") {
  if (window.KaarobarToast) {
    window.KaarobarToast.show(message, { type });
  }
}

function applyChromeI18n() {
  if (!window.KaarobarI18n) return;
  const map = {
    '[data-nav="dashboard"]': "nav.dashboard",
    '[data-nav="pos"]': "nav.pos",
    '[data-nav="returns"]': "nav.returns",
    '[data-nav="inventory"]': "nav.inventory",
    '[data-nav="accounting"]': "nav.accounting",
    '[data-nav="hr"]': "nav.hr",
    '[data-nav="reports"]': "nav.reports",
    '[data-nav="notifications"]': "nav.notifications",
    '[data-nav="ess"]': "nav.ess",
    '[data-nav="settings"]': "nav.settings",
    '[data-nav="profile"]': "nav.profile",
  };
  Object.entries(map).forEach(([sel, key]) => {
    document.querySelectorAll(sel).forEach((el) => {
      el.textContent = t(key);
    });
  });
  if ($("logout")) $("logout").textContent = t("common.signOut");
  if ($("workspace-label")) $("workspace-label").textContent = t("common.workspace");
  if ($("status") && !$("status").textContent.includes("sync")) {
    $("status").textContent = t("common.online");
  }
  if ($("locale-select")) $("locale-select").value = window.KaarobarI18n.getLocale();
  if ($("auth-title")) setAuthMode(mode);
  const dashLead = document.querySelector("#dashboard-view .lead");
  if (dashLead) dashLead.textContent = t("desktop.dashboardLead");
  const dashTitle = document.querySelector("#dashboard-view h1");
  if (dashTitle) dashTitle.textContent = t("desktop.dashboardTitle");
  const dashEyebrow = document.querySelector("#dashboard-view .eyebrow");
  if (dashEyebrow) dashEyebrow.textContent = t("desktop.dashboardEyebrow");
  const statLabels = [
    ["stat-sales", "desktop.salesToday"],
    ["stat-cash", "desktop.cashPosition"],
    ["stat-stock", "desktop.lowStock"],
    ["stat-approvals", "desktop.approvals"],
  ];
  statLabels.forEach(([id, key]) => {
    const value = $(id);
    const label = value?.previousElementSibling;
    if (label) label.textContent = t(key);
  });
  if ($("lbl-subtotal")) $("lbl-subtotal").textContent = t("common.subtotal");
  if ($("lbl-discount-line")) $("lbl-discount-line").textContent = t("pos.discount");
  if ($("lbl-tax-line")) $("lbl-tax-line").textContent = t("common.tax");
  if ($("lbl-total-bill")) $("lbl-total-bill").textContent = t("pos.totalBill");
  const discountLbl = $("lbl-discount-input");
  if (discountLbl) {
    discountLbl.childNodes[0].textContent = `${t("pos.discount")} `;
  }
  const taxLbl = $("lbl-tax-input");
  if (taxLbl) {
    taxLbl.childNodes[0].textContent = `${t("pos.taxOptional")} `;
  }
  if ($("pay")) $("pay").textContent = `${t("pos.placeOrder")} →`;
}

function navigate(view) {
  const bundle = NAV_BUNDLE[view];
  if (bundle && !canAccess(bundle)) {
    notify(t("rbac.accessDeniedTitle"), "warning");
    view = "dashboard";
  }
  ["dashboard", "pos", "returns", "inventory", "accounting", "hr", "reports", "notifications", "settings", "ess", "profile"].forEach((v) => {
    const el = $(`${v}-view`);
    if (el) el.classList.toggle("hidden", v !== view);
  });
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.nav === view);
  });
  if (view === "pos") loadPos();
  if (view === "returns") loadReturns();
  if (view === "inventory") loadInventory();
  if (view === "accounting") loadAccounting();
  if (view === "hr") loadHr();
  if (view === "reports") loadReports();
  if (view === "notifications") loadNotifications();
  if (view === "settings") loadSettings();
  if (view === "ess") loadEss();
  if (view === "dashboard") loadDashboardStats();
  if (view === "profile") loadProfile();
}

function setAuthMode(next) {
  mode = next;
  $("auth-title").textContent =
    mode === "login" ? t("auth.signInTitle") : t("auth.signUpTitle");
  $("auth-sub").textContent =
    mode === "login" ? t("auth.signInSub") : t("auth.signUpSub");
  $("signup-fields").classList.toggle("hidden", mode === "login");
  $("auth-submit").textContent =
    mode === "login" ? t("common.signIn") : t("common.signUp");
  $("auth-toggle").textContent =
    mode === "login" ? t("auth.needAccount") : t("auth.haveAccount");
}

function renderTenantSelects() {
  $("business-select").innerHTML = businesses
    .map(
      (b) =>
        `<option value="${b.id}" ${b.id === session?.business_id ? "selected" : ""}>${b.name}</option>`
    )
    .join("");
  $("branch-select").innerHTML = branches
    .map(
      (b) =>
        `<option value="${b.id}" ${b.id === session?.branch_id ? "selected" : ""}>${b.name}</option>`
    )
    .join("");
}

async function hydrateTenant(baseSession) {
  let next = { ...baseSession };
  try {
    const me = await api("/auth/me", {}, next);
    memberships = me.memberships || [];
    next.user = me.user || next.user;
    next.memberships = memberships;
  } catch {
    memberships = next.memberships || [];
  }
  const biz = await api("/businesses", {}, next);
  businesses = biz.data || [];
  if (businesses[0] && !next.business_id) next.business_id = businesses[0].id;

  if (next.business_id) {
    const br = await api(`/businesses/${next.business_id}/branches`, {}, next);
    branches = br.data || [];
    if (branches[0] && !next.branch_id) next.branch_id = branches[0].id;
    try {
      const roleRes = await api(`/businesses/${next.business_id}/role-settings`, {}, next);
      roleSettings = roleRes.data?.roles || {};
    } catch {
      roleSettings = {};
    }
  } else {
    branches = [];
    roleSettings = {};
  }

  setSession(next);
  applyNavAccess();
  renderTenantSelects();
  return next;
}

async function loadDashboardStats() {
  const fullName = session?.user?.name || "";
  $("user-name").textContent = fullName;
  if ($("user-initials")) {
    $("user-initials").textContent =
      fullName
        .split(" ")
        .map((p) => p[0] || "")
        .join("")
        .slice(0, 2)
        .toUpperCase() || "K";
  }
  try {
    const dash = await api("/reports/dashboard");
    const d = dash.data || {};
    $("stat-sales").textContent = d.sales_today ?? "—";
    $("stat-cash").textContent = d.cash_position ?? "—";
    $("stat-stock").textContent = d.low_stock_count ?? "—";
    $("stat-approvals").textContent = d.pending_approvals ?? "—";
  } catch {
    $("stat-sales").textContent = "—";
  }
}

async function enterApp() {
  showApp();
  navigate("dashboard");
  await loadDashboardStats();
}

/* —— POS —— */

function renderProducts(list) {
  if ($("product-count")) $("product-count").textContent = t("desktop.productCount", { count: list.length });
  $("products").innerHTML = list
    .map((p) => {
      const initials = String(p.name || "")
        .split(" ")
        .map((w) => w[0] || "")
        .join("")
        .slice(0, 2)
        .toUpperCase();
      const inCart = cart.find((l) => l.id === p.id);
      return `
      <button class="product${inCart ? " selected" : ""}" data-id="${p.id}" type="button">
        <span class="product-avatar">${initials || "P"}</span>
        <strong>${p.name}</strong>
        <span class="muted">${p.sku}</span>
        <span class="product-price">Rs ${money(p.price)}${inCart ? ` · ×${inCart.qty}` : ""}</span>
      </button>`;
    })
    .join("");
}

function renderCart() {
  const discountValue = Number($("discount-amount")?.value || 0);
  const taxValue = Number($("tax-amount")?.value || 0);
  $("cart-items").innerHTML = cart
    .map(
      (l) => `
      <li>
        <div class="cart-line">
          <span>${l.name}</span>
          <strong>${money(l.qty * l.price)}</strong>
        </div>
        <div class="qty-row">
          <button type="button" data-qty="${l.id}" data-delta="-1">−</button>
          <span>${l.qty}</span>
          <button type="button" data-qty="${l.id}" data-delta="1">+</button>
          <button type="button" class="link" data-remove="${l.id}">Remove</button>
        </div>
      </li>`
    )
    .join("");

  const subtotal = cart.reduce((s, l) => s + l.qty * l.price, 0);
  const discount = round2(Math.min(Math.max(discountValue, 0), subtotal));
  const tax = round2(Math.max(taxValue, 0));
  const total = round2(subtotal - discount + tax);
  $("subtotal").textContent = money(subtotal);
  $("discount").textContent = money(discount);
  $("tax").textContent = money(tax);
  $("total").textContent = money(total);
  $("pay-cash").value = money(total);
  $("pay-card").value = "";
  $("pay-wallet").value = "";
  $("pay").disabled = cart.length === 0;
  const q = ($("search")?.value || "").trim().toLowerCase();
  const list = q
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode || "").toLowerCase().includes(q)
      )
    : products;
  renderProducts(list);
}

function renderTill() {
  const box = $("till-box");
  if (till) {
    box.innerHTML = `
      <p>Open · float Rs ${till.opening_cash}</p>
      <div class="row">
        <input id="closing-cash" type="text" placeholder="Closing cash" />
        <button id="close-till" class="btn btn-ghost" type="button">Close</button>
      </div>`;
    $("close-till").onclick = closeTill;
  } else {
    box.innerHTML = `
      <div class="row">
        <input id="opening-cash" type="text" value="0" placeholder="Opening cash" />
        <button id="open-till" class="btn btn-primary" type="button">Open</button>
      </div>`;
    $("open-till").onclick = openTill;
  }
}

async function openTill() {
  try {
    const res = await api("/tills/open", {
      method: "POST",
      body: JSON.stringify({
        branch_id: session.branch_id,
        opening_cash: $("opening-cash").value || "0",
      }),
    });
    till = res.data;
    renderTill();
    notify(t("pos.tillOpen"), "success");
  } catch (err) {
    notify(err.message, "error");
  }
}

async function closeTill() {
  try {
    const res = await api(`/tills/${till.id}/close`, {
      method: "POST",
      body: JSON.stringify({ closing_cash: $("closing-cash").value || "0" }),
    });
    const over = res.data.over_short;
    till = null;
    renderTill();
    notify(
      over && Number(over) !== 0 ? `${t("pos.tillClosed")} (${over})` : t("pos.tillClosed"),
      "success"
    );
  } catch (err) {
    notify(err.message, "error");
  }
}

async function loadPos() {
  try {
    const res = await api("/products");
    products = (res.data || []).map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      price: Number(p.price || 0),
      taxRate: Number(p.tax_rate || 0.18),
    }));
  } catch {
    products = [];
  }
  try {
    const t = await api("/tills/current");
    till = t.data;
  } catch {
    till = null;
  }
  renderProducts(products);
  renderCart();
  renderTill();
}

/* —— Returns —— */

async function loadReturns() {
  $("returns-message").textContent = "";
  try {
    const [pending, returns, tills] = await Promise.all([
      api("/returns/pending"),
      api("/returns"),
      api("/tills"),
    ]);
    $("pending-returns").innerHTML =
      (pending.data || [])
        .map(
          (r) => `
        <div class="list-row">
          <div>Rs ${r.refund_amount} · ${r.refund_method}<br/><span class="muted">${r.reason || ""}</span></div>
          <div class="row">
            <button type="button" class="btn btn-primary" data-approve="${r.id}">Approve</button>
            <button type="button" class="btn btn-ghost" data-reject="${r.id}">Reject</button>
          </div>
        </div>`
        )
        .join("") || "<p class='muted'>No pending returns</p>";

    $("recent-returns").innerHTML =
      (returns.data || [])
        .slice(0, 20)
        .map(
          (r) =>
            `<div class="list-row"><span>${r.status}</span><strong>Rs ${r.refund_amount}</strong><span>${r.refund_method}</span></div>`
        )
        .join("") || "<p class='muted'>None yet</p>";

    $("till-history").innerHTML =
      (tills.data || [])
        .map(
          (t) =>
            `<div class="list-row"><span>${t.status}</span><span>open ${t.opening_cash}</span><span>${t.expected_cash ?? "—"}</span><span>Δ ${t.over_short ?? "—"}</span></div>`
        )
        .join("") || "<p class='muted'>No tills</p>";
  } catch (err) {
    notify(err.message, "error");
  }
}

function renderReturnSale() {
  const box = $("return-sale");
  if (!returnSale) {
    box.classList.add("hidden");
    return;
  }
  box.classList.remove("hidden");
  box.innerHTML = `
    <p>Invoice ${returnSale.invoice_number} · Rs ${returnSale.total_amount}</p>
    ${(returnSale.items || [])
      .map(
        (item) => `
      <div class="row">
        <span class="grow">${item.name} (sold ${item.quantity})</span>
        <input data-rq="${item.product_id}" type="text" placeholder="Qty" value="${returnQtys[item.product_id] || ""}" style="width:80px" />
      </div>`
      )
      .join("")}
    <div class="row">
      <select id="refund-method">
        <option value="cash">Cash</option>
        <option value="card">Card</option>
        <option value="wallet">Wallet</option>
      </select>
      <input id="return-reason" type="text" placeholder="Reason" class="grow" />
      <button id="submit-return" class="btn btn-primary" type="button">Submit return</button>
    </div>`;

  box.querySelectorAll("[data-rq]").forEach((input) => {
    input.addEventListener("input", () => {
      returnQtys[input.dataset.rq] = input.value;
    });
  });
  $("submit-return").onclick = submitReturn;
}

async function lookupSale() {
  try {
    const res = await api(`/sales/${$("sale-id").value.trim()}`);
    returnSale = res.data;
    returnQtys = {};
    renderReturnSale();
  } catch (err) {
    returnSale = null;
    renderReturnSale();
    notify(err.message, "error");
  }
}

async function submitReturn() {
  const items = Object.entries(returnQtys)
    .filter(([, q]) => Number(q) > 0)
    .map(([product_id, quantity]) => ({ product_id, quantity }));
  if (!items.length) {
    notify(t("common.quantity"), "warning");
    return;
  }
  try {
    const res = await api("/returns", {
      method: "POST",
      body: JSON.stringify({
        sale_id: returnSale.id,
        branch_id: session.branch_id,
        reason: $("return-reason").value,
        refund_method: $("refund-method").value,
        items,
      }),
    });
    notify(`${t("returns.returnSubmitted")} · ${res.data.refund_amount}`, "success");
    returnSale = null;
    renderReturnSale();
    await loadReturns();
  } catch (err) {
    notify(err.message, "error");
  }
}

/* —— Inventory —— */

function showInvTab(tab) {
  document.querySelectorAll("#inv-tabs .tab").forEach((el) => {
    el.classList.toggle("active", el.dataset.invTab === tab);
  });
  ["stock", "products", "suppliers", "po", "transfers", "adjust"].forEach((t) => {
    $(`inv-${t}`).classList.toggle("hidden", t !== tab);
  });
}

async function loadInventory() {
  $("inv-message").textContent = "";
  try {
    const [stock, prods, suppliers, pos, transfers] = await Promise.all([
      api("/inventory").catch(() => ({ data: [] })),
      api("/products").catch(() => ({ data: [] })),
      api("/suppliers").catch(() => ({ data: [] })),
      api("/inventory/purchase-orders").catch(() => ({ data: [] })),
      api("/inventory/transfers").catch(() => ({ data: [] })),
    ]);
    invProducts = prods.data || [];
    invSuppliers = suppliers.data || [];
    invPos = pos.data || [];
    invTransfers = transfers.data || [];

    $("inv-stock").innerHTML = `
      <table class="table">
        <thead><tr><th>SKU</th><th>Name</th><th>On hand</th><th>Avg cost</th></tr></thead>
        <tbody>
          ${(stock.data || [])
            .map(
              (r) =>
                `<tr><td>${r.sku || ""}</td><td>${r.name || ""}</td><td>${r.quantity_on_hand}</td><td>${r.avg_cost}</td></tr>`
            )
            .join("")}
        </tbody>
      </table>`;

    $("inv-products").innerHTML = `
      <div class="toolbar">
        <button type="button" class="btn btn-primary" id="open-product-modal">New product</button>
      </div>
      <table class="table">
        <thead><tr><th>SKU</th><th>Barcode</th><th>Name</th><th>Kind</th><th>Price</th></tr></thead>
        <tbody>
          ${invProducts
            .map(
              (p) =>
                `<tr><td>${p.sku}</td><td>${p.barcode || "—"}</td><td>${p.name}</td><td>${p.product_kind || "goods"}</td><td>${p.price ?? "—"}</td></tr>`
            )
            .join("")}
        </tbody>
      </table>`;
    $("open-product-modal").onclick = () => {
      openModal({
        title: "New product",
        subtitle: "Barcode enables scan-to-cart. Image optional (use web/mobile for photos).",
        wide: true,
        bodyHtml: `
          <form id="product-form" class="form-stack">
            <label>SKU<input name="sku" required /></label>
            <label>Barcode<input name="barcode" placeholder="Scan or type" /></label>
            <label>Name<input name="name" required /></label>
            <label>Kind
              <select name="product_kind">
                <option value="goods">Goods</option>
                <option value="service">Service</option>
                <option value="combo">Combo</option>
              </select>
            </label>
            <label>Unit
              <select name="unit">
                ${["pcs", "kg", "g", "ml", "l", "box", "pack", "hour", "session"]
                  .map((u) => `<option value="${u}">${u}</option>`)
                  .join("")}
              </select>
            </label>
            <label>Price<input name="price" placeholder="0.00" /></label>
            <label>Duration (min, services)<input name="duration_minutes" placeholder="45" /></label>
            <div class="modal-actions">
              <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
              <button class="btn btn-primary" type="submit">Create product</button>
            </div>
          </form>`,
      });
      $("product-form").onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          await api("/products", {
            method: "POST",
            body: JSON.stringify({
              sku: fd.get("sku"),
              barcode: fd.get("barcode") || undefined,
              name: fd.get("name"),
              product_kind: fd.get("product_kind"),
              unit: fd.get("unit"),
              duration_minutes: fd.get("duration_minutes") || undefined,
              price: fd.get("price") || undefined,
            }),
          });
          closeModal();
          notify(t("inventory.productCreated"), "success");
          await loadInventory();
          showInvTab("products");
        } catch (err) {
          setModalError(err.message);
        }
      };
    };

    $("inv-suppliers").innerHTML = `
      <div class="toolbar">
        <button type="button" class="btn btn-primary" id="open-supplier-modal">Add supplier</button>
      </div>
      <table class="data-table">
        <thead><tr><th>Company</th><th>Contact</th><th>City</th><th>Catalogs</th></tr></thead>
        <tbody>
          ${
            invSuppliers
              .map(
                (s) => `<tr>
              <td><strong>${s.name}</strong>${s.code ? `<div class="muted">${s.code}</div>` : ""}</td>
              <td>${s.contact_name || "—"}<div class="muted">${s.contact_phone || s.contact_email || ""}</div></td>
              <td>${s.city || "—"}</td>
              <td>${(s.catalogs || []).slice(0, 3).join(", ") || "—"}</td>
            </tr>`
              )
              .join("") ||
            `<tr><td colspan="4" class="muted">No suppliers yet</td></tr>`
          }
        </tbody>
      </table>`;
    $("open-supplier-modal").onclick = () => {
      openModal({
        title: "Add supplier",
        subtitle: "Company, liaison, and catalogs for purchasing.",
        wide: true,
        bodyHtml: `
          <form id="supplier-form" class="form-stack">
            <div class="grid-2">
              <label>Trade name<input name="name" required /></label>
              <label>Legal name<input name="legal_name" /></label>
              <label>Code<input name="code" placeholder="LHR-DIST" /></label>
              <label>City<input name="city" /></label>
              <label>Contact person<input name="contact_name" /></label>
              <label>Role<input name="contact_role" placeholder="Account manager" /></label>
              <label>Phone<input name="contact_phone" /></label>
              <label>Email<input name="contact_email" type="email" /></label>
              <label>Payment terms<input name="payment_terms" value="Net 30" /></label>
              <label>Catalogs<input name="catalogs" placeholder="grocery, beverages" /></label>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
              <button class="btn btn-primary" type="submit">Add supplier</button>
            </div>
          </form>`,
      });
      $("supplier-form").onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const catalogs = String(fd.get("catalogs") || "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
        try {
          await api("/suppliers", {
            method: "POST",
            body: JSON.stringify({
              name: fd.get("name"),
              legal_name: fd.get("legal_name") || null,
              code: fd.get("code") || null,
              city: fd.get("city") || null,
              contact_name: fd.get("contact_name") || null,
              contact_role: fd.get("contact_role") || null,
              contact_phone: fd.get("contact_phone") || null,
              contact_email: fd.get("contact_email") || null,
              payment_terms: fd.get("payment_terms") || null,
              catalogs,
              country: "PK",
              currency: "PKR",
              status: "active",
            }),
          });
          closeModal();
          notify(t("inventory.supplierAdded"), "success");
          await loadInventory();
          showInvTab("suppliers");
        } catch (err) {
          setModalError(err.message);
        }
      };
    };

    $("inv-po").innerHTML = `
      <div class="toolbar">
        <button type="button" class="btn btn-primary" id="open-po-modal">New PO</button>
      </div>
      <div class="two-col">
        <form id="grn-form" class="card form-stack">
          <h3>Receive GRN</h3>
          <select name="purchase_order_id" id="grn-po" required>
            <option value="">Purchase order</option>
            ${invPos
              .filter((p) => p.status !== "received" && p.status !== "cancelled")
              .map(
                (p) =>
                  `<option value="${p.id}" data-product="${p.items?.[0]?.product_id || ""}" data-qty="${p.items?.[0]?.quantity || ""}">${p.supplier_name || p.id.slice(0, 8)} · ${p.status}</option>`
              )
              .join("")}
          </select>
          <input name="quantity_received" id="grn-qty" placeholder="Qty received" required />
          <button class="btn btn-primary" type="submit">Receive</button>
        </form>
        <div class="card">
          <h3>Purchase orders</h3>
          <table class="table">
            <thead><tr><th>Supplier</th><th>Status</th><th>Lines</th></tr></thead>
            <tbody>
              ${invPos
                .map(
                  (p) =>
                    `<tr><td>${p.supplier_name || p.supplier_id.slice(0, 8)}</td><td>${p.status}</td><td>${p.items?.length || 0}</td></tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>`;

    $("open-po-modal").onclick = () => {
      openModal({
        title: "New purchase order",
        subtitle: "Raise a PO against a supplier for this branch.",
        wide: true,
        bodyHtml: `
          <form id="po-form" class="form-stack">
            <label>Supplier
              <select name="supplier_id" required>
                <option value="">Select…</option>
                ${invSuppliers.map((s) => `<option value="${s.id}">${s.name}</option>`).join("")}
              </select>
            </label>
            <label>Product
              <select name="product_id" required>
                <option value="">Select…</option>
                ${invProducts.map((p) => `<option value="${p.id}">${p.name}</option>`).join("")}
              </select>
            </label>
            <label>Quantity<input name="quantity" value="10" /></label>
            <label>Unit cost<input name="unit_cost" value="50" /></label>
            <div class="modal-actions">
              <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
              <button class="btn btn-primary" type="submit">Create PO</button>
            </div>
          </form>`,
      });
      $("po-form").onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          await api("/inventory/purchase-orders", {
            method: "POST",
            body: JSON.stringify({
              branch_id: session.branch_id,
              supplier_id: fd.get("supplier_id"),
              items: [
                {
                  product_id: fd.get("product_id"),
                  quantity: fd.get("quantity"),
                  unit_cost: fd.get("unit_cost"),
                },
              ],
            }),
          });
          closeModal();
          notify(t("inventory.poCreated"), "success");
          await loadInventory();
          showInvTab("po");
        } catch (err) {
          setModalError(err.message);
        }
      };
    };

    $("grn-po").onchange = (e) => {
      const opt = e.target.selectedOptions[0];
      $("grn-qty").value = opt?.dataset.qty || "";
    };

    $("grn-form").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const opt = $("grn-po").selectedOptions[0];
      try {
        await api("/inventory/grn", {
          method: "POST",
          body: JSON.stringify({
            branch_id: session.branch_id,
            purchase_order_id: fd.get("purchase_order_id"),
            items: [
              {
                product_id: opt?.dataset.product,
                quantity_received: fd.get("quantity_received"),
              },
            ],
          }),
        });
        notify(t("inventory.grnReceived"), "success");
        await loadInventory();
        showInvTab("po");
      } catch (err) {
        notify(err.message, "error");
      }
    };

    $("inv-transfers").innerHTML = `
      <form id="transfer-form" class="form-grid">
        <input name="to_branch_id" placeholder="To branch ID" required />
        <select name="product_id" required>
          <option value="">Product</option>
          ${invProducts.map((p) => `<option value="${p.id}">${p.name}</option>`).join("")}
        </select>
        <input name="quantity" value="1" placeholder="Qty" />
        <button class="btn btn-primary" type="submit">Create transfer</button>
      </form>
      <div id="transfer-list">
        ${invTransfers
          .map(
            (t) => `
          <div class="list-row">
            <span>${t.status} · ${t.items?.[0]?.quantity || "?"} units</span>
            ${
              t.status === "pending"
                ? `<button type="button" class="btn btn-primary" data-confirm-transfer="${t.id}">Confirm</button>`
                : ""
            }
          </div>`
          )
          .join("")}
      </div>`;

    $("transfer-form").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api("/inventory/transfers", {
          method: "POST",
          body: JSON.stringify({
            from_branch_id: session.branch_id,
            to_branch_id: fd.get("to_branch_id"),
            items: [
              {
                product_id: fd.get("product_id"),
                quantity: fd.get("quantity"),
              },
            ],
          }),
        });
        notify(t("inventory.transferCreated"), "success");
        await loadInventory();
      } catch (err) {
        notify(err.message, "error");
      }
    };

    $("inv-adjust").innerHTML = `
      <form id="adjust-form" class="form-stack" style="max-width:420px">
        <select name="product_id" required>
          <option value="">Product</option>
          ${invProducts.map((p) => `<option value="${p.id}">${p.name}</option>`).join("")}
        </select>
        <input name="quantity_delta" placeholder="Qty delta (e.g. -2)" required />
        <select name="reason_code">
          ${["adjustment", "damage", "theft", "count_correction", "expired", "sample"]
            .map((r) => `<option value="${r}">${r}</option>`)
            .join("")}
        </select>
        <button class="btn btn-primary" type="submit">Apply adjustment</button>
      </form>`;

    $("adjust-form").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api("/inventory/adjust", {
          method: "POST",
          body: JSON.stringify({
            branch_id: session.branch_id,
            product_id: fd.get("product_id"),
            quantity_delta: fd.get("quantity_delta"),
            reason_code: fd.get("reason_code"),
          }),
        });
        notify(t("inventory.stockAdjusted"), "success");
        await loadInventory();
      } catch (err) {
        notify(err.message, "error");
      }
    };

    showInvTab("stock");
  } catch (err) {
    notify(err.message, "error");
  }
}

/* —— Accounting / HR / Reports / Notifications / Settings —— */

async function loadAccounting() {
  if (!canAccess("accounting")) return;

  // Lazily fetch core datasets.
  if (accountingAccounts.length === 0 || accountingJournals.length === 0) {
    try {
      const [acc, je] = await Promise.all([
        api("/accounts").catch(() => ({ data: [] })),
        api("/journals").catch(() => ({ data: [] })),
      ]);
      accountingAccounts = acc.data || [];
      accountingJournals = je.data || [];
      if (!accountingGlAccountId && accountingAccounts[0]) {
        accountingGlAccountId = accountingAccounts[0].id;
      }
    } catch (err) {
      $("accounting-message").textContent = err.message;
      return;
    }
  }

  const tabButtons = [
    { id: "tb", label: t("accounting.trialBalance") || "Trial balance" },
    { id: "pl", label: t("accounting.profitLoss") || "P&L" },
    { id: "bs", label: t("accounting.balanceSheet") || "Balance sheet" },
    { id: "gl", label: t("accounting.generalLedger") || "General ledger" },
    { id: "journals", label: "Journals" },
    { id: "coa", label: t("accounting.tabs.coa") || "Chart of accounts" },
    { id: "ar", label: t("accounting.aging") || "A/R aging" },
    { id: "ap", label: "A/P aging" },
  ];

  $("accounting-body").innerHTML = `
    <div class="tabs" id="accounting-tabs">
      ${tabButtons
        .map(
          (b) =>
            `<button type="button" data-account-tab="${b.id}" class="tab ${
              accountingTab === b.id ? "active" : ""
            }">${b.label}</button>`
        )
        .join("")}
    </div>

    <div id="accounting-toolbar" class="toolbar" style="justify-content:flex-start">
      ${["tb", "pl", "gl"].includes(accountingTab) ? `
        <label style="width:auto; margin:0 14px 0 0">
          From <input id="accounting-from" type="date" value="${accountingFrom}" />
        </label>
        <label style="width:auto; margin:0">
          To <input id="accounting-to" type="date" value="${accountingTo}" />
        </label>
      ` : ""}

      ${accountingTab === "bs" ? `
        <label style="width:auto; margin:0 14px 0 0">
          As of <input id="accounting-to" type="date" value="${accountingTo}" />
        </label>
      ` : ""}

      ${accountingTab === "gl" ? `
        <label style="width:auto; margin:0 14px 0 0">
          Account <select id="accounting-gl-account">
            ${accountingAccounts
              .map(
                (a) =>
                  `<option value="${a.id}" ${
                    a.id === accountingGlAccountId ? "selected" : ""
                  }>${a.code || ""} · ${a.name || ""}</option>`
              )
              .join("")}
          </select>
        </label>
      ` : ""}

      ${accountingTab === "journals" ? `
        <div style="margin-left:auto">
          <button type="button" class="btn btn-primary" id="open-je-modal" style="width:auto">Post journal</button>
        </div>
      ` : ""}
    </div>

    <div id="accounting-content" class="card" style="margin-top:14px"></div>
  `;

  $("accounting-tabs").querySelectorAll("button[data-account-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      accountingTab = btn.dataset.accountTab;
      loadAccounting();
    });
  });

  // Toolbar change handlers.
  const fromInput = $("accounting-from");
  if (fromInput) {
    fromInput.onchange = () => {
      accountingFrom = fromInput.value;
      loadAccounting();
    };
  }
  const toInput = $("accounting-to");
  if (toInput) {
    toInput.onchange = () => {
      accountingTo = toInput.value;
      loadAccounting();
    };
  }
  const glAccountSelect = $("accounting-gl-account");
  if (glAccountSelect) {
    glAccountSelect.onchange = () => {
      accountingGlAccountId = glAccountSelect.value;
      loadAccounting();
    };
  }

  async function renderAccountingContent() {
    $("accounting-message").textContent = "";
    const content = $("accounting-content");
    if (!content) return;

    if (accountingTab === "coa") {
      const rows = accountingAccounts.map(
        (a) => `
        <tr>
          <td>${a.code || ""}</td>
          <td>${a.name || ""}</td>
          <td>${a.type || ""}</td>
          <td style="text-align:right">
            <button type="button" class="btn btn-ghost" data-edit-account="${a.id}" style="width:auto">Edit</button>
          </td>
        </tr>`
      );
      content.innerHTML = `
        <table class="table">
          <thead><tr><th>Code</th><th>Name</th><th>Type</th><th style="text-align:right">Actions</th></tr></thead>
          <tbody>${rows.join("") || "<tr><td colspan='4' class='muted'>No accounts</td></tr>"}</tbody>
        </table>
      `;
      content.querySelectorAll("[data-edit-account]").forEach((btn) => {
        btn.onclick = () => openAccountEditModal(btn.dataset.editAccount);
      });
      return;
    }

    if (accountingTab === "journals") {
      const jeRows = accountingJournals
        .map(
          (j) => `
        <tr>
          <td>${j.date}</td>
          <td>${j.description || ""}</td>
          <td>${j.source_type || ""}</td>
          <td style="text-align:right">
            ${
              j.is_locked && j.source_type !== "reversal"
                ? `<button type="button" class="btn btn-ghost" data-reverse-journal="${j.id}" style="width:auto">Reverse</button>`
                : ""
            }
          </td>
        </tr>
      `
        )
        .join("");

      content.innerHTML = `
        <div class="two-col">
          <div>
            <table class="table">
              <thead><tr><th>Date</th><th>Description</th><th>Source</th><th style="text-align:right">Actions</th></tr></thead>
              <tbody>${jeRows || "<tr><td colspan='4' class='muted'>No journals yet</td></tr>"}</tbody>
            </table>
          </div>
          <div>
            <p class="muted">Lines are shown below each entry after selection (simplified for desktop).</p>
          </div>
        </div>
      `;

      content.querySelectorAll("[data-reverse-journal]").forEach((btn) => {
        btn.onclick = async () => {
          try {
            await api(`/journals/${btn.dataset.reverseJournal}/reverse`, {
              method: "POST",
              body: "{}",
            });
            notify("Journal reversed", "success");
            accountingJournals = [];
            accountingAccounts = [];
            await loadAccounting(); // refresh core & re-render
          } catch (err) {
            notify(err.message, "error");
          }
        };
      });
      return;
    }

    // Report statement tabs
    if (["tb", "pl", "bs", "gl", "ar", "ap"].includes(accountingTab)) {
      try {
        if (accountingTab === "tb") {
          const res = await api(`/reports/trial-balance?from=${encodeURIComponent(accountingFrom)}&to=${encodeURIComponent(accountingTo)}`);
          const rows = (res.data || []).map((r) => [r.code, r.name, r.debit, r.credit]);
          content.innerHTML = renderStatementTable(["Code", "Account", "Debit", "Credit"], rows);
        } else if (accountingTab === "pl") {
          const res = await api(`/reports/profit-and-loss?from=${encodeURIComponent(accountingFrom)}&to=${encodeURIComponent(accountingTo)}`);
          const d = res.data;
          const rows = (d?.lines || []).map((r) => [r.code, r.name, r.type, r.amount]);
          content.innerHTML = `${renderStatementTable(["Code", "Account", "Type", "Amount"], rows)}
            <p class="muted" style="margin-top:10px">Revenue ${d?.total_revenue} − Expense ${d?.total_expense} = <strong>${d?.net_income}</strong></p>`;
        } else if (accountingTab === "bs") {
          const res = await api(`/reports/balance-sheet?as_of=${encodeURIComponent(accountingTo)}`);
          const d = res.data;
          const rows = (d?.lines || []).map((r) => [r.code, r.name, r.type, r.balance]);
          content.innerHTML = `${renderStatementTable(["Code", "Account", "Type", "Balance"], rows)}
            <p class="muted" style="margin-top:10px">Assets ${d?.total_assets} · Liabilities ${d?.total_liabilities} · Equity ${d?.total_equity}</p>`;
        } else if (accountingTab === "gl") {
          const res = await api(`/reports/general-ledger?account_id=${encodeURIComponent(accountingGlAccountId)}&from=${encodeURIComponent(accountingFrom)}&to=${encodeURIComponent(accountingTo)}`);
          const rows = (res.data || []).map((r) => [r.date, r.description, r.debit, r.credit, r.balance]);
          content.innerHTML = renderStatementTable(["Date", "Description", "Debit", "Credit", "Balance"], rows);
        } else if (accountingTab === "ar") {
          const res = await api("/ar/aging");
          const rows = (res.data || []).map((r) => [r.invoice_number || r.id, r.customer_name || "—", r.balance_due, r.bucket]);
          content.innerHTML = renderStatementTable(["Invoice", "Customer", "Balance", "Bucket"], rows);
        } else if (accountingTab === "ap") {
          const res = await api("/ap/aging");
          const rows = (res.data || []).map((r) => [r.bill_number || r.id, r.supplier_name || "—", r.balance_due, r.bucket]);
          content.innerHTML = renderStatementTable(["Bill", "Supplier", "Balance", "Bucket"], rows);
        }
      } catch (err) {
        content.innerHTML = `<p class="muted">${err.message}</p>`;
      }
    }
  }

  function renderStatementTable(headers, rows) {
    return `
      <table class="table">
        <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map(
                    (r) =>
                      `<tr>${r
                        .map((c) => `<td>${c ?? "—"}</td>`)
                        .join("")}</tr>`
                  )
                  .join("")
              : `<tr><td colspan="${headers.length}" class="muted">No rows</td></tr>`
          }
        </tbody>
      </table>
    `;
  }

  function openAccountEditModal(accountId) {
    const a = accountingAccounts.find((x) => x.id === accountId);
    if (!a) return;
    openModal({
      title: "Edit account",
      subtitle: "Update chart of accounts name, code, or type.",
      wide: true,
      bodyHtml: `
        <form id="account-edit-form" class="form-stack">
          <input type="hidden" name="account_id" value="${a.id}" />
          <label>Code<input name="code" type="text" value="${a.code || ""}" required /></label>
          <label>Name<input name="name" type="text" value="${a.name || ""}" required /></label>
          <label>Type
            <select name="type">
              ${["asset","liability","equity","revenue","expense"].map((t) => `
                <option value="${t}" ${a.type === t ? "selected" : ""}>${t}</option>
              `).join("")}
            </select>
          </label>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
            <button type="submit" class="btn btn-primary">Save changes</button>
          </div>
        </form>
      `,
    });

    const form = $("account-edit-form");
    if (!form) return;
    form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const fd = new FormData(form);
        await api(`/accounts/${a.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            code: fd.get("code"),
            name: fd.get("name"),
            type: fd.get("type"),
          }),
        });
        notify("Account updated", "success");
        closeModal();
        accountingAccounts = [];
        await loadAccounting();
      } catch (err) {
        setModalError(err.message);
      }
    };
  }

  function openPostJournalModal() {
    const lineDefaults = accountingAccounts[0] ? accountingAccounts[0].id : "";
    openModal({
      title: "Post journal",
      subtitle: "Enter a balanced two-line manual journal entry.",
      wide: true,
      bodyHtml: `
        <form id="journal-post-form" class="form-stack">
          <label>Description<input name="description" type="text" placeholder="Description" required value="" /></label>
          <div class="grid-2">
            <div>
              <label>Line A - Account
                <select name="account_id_a" required>
                  ${accountingAccounts
                    .map((acc) => `<option value="${acc.id}" ${acc.id === lineDefaults ? "selected" : ""}>${acc.code || ""} ${acc.name || ""}</option>`)
                    .join("")}
                </select>
              </label>
              <label>Debit<input name="debit_a" type="text" placeholder="0" /></label>
              <label>Credit<input name="credit_a" type="text" placeholder="0" /></label>
            </div>
            <div>
              <label>Line B - Account
                <select name="account_id_b" required>
                  ${accountingAccounts
                    .map((acc) => `<option value="${acc.id}" ${acc.id === lineDefaults ? "selected" : ""}>${acc.code || ""} ${acc.name || ""}</option>`)
                    .join("")}
                </select>
              </label>
              <label>Debit<input name="debit_b" type="text" placeholder="0" /></label>
              <label>Credit<input name="credit_b" type="text" placeholder="0" /></label>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
            <button type="submit" class="btn btn-primary">Post journal</button>
          </div>
        </form>
      `,
    });

    const form = $("journal-post-form");
    if (!form) return;
    form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const fd = new FormData(form);
        await api("/journals", {
          method: "POST",
          body: JSON.stringify({
            description: String(fd.get("description") || ""),
            date: accountingTo,
            lines: [
              {
                account_id: String(fd.get("account_id_a") || ""),
                debit: String(fd.get("debit_a") || "0"),
                credit: String(fd.get("credit_a") || "0"),
              },
              {
                account_id: String(fd.get("account_id_b") || ""),
                debit: String(fd.get("debit_b") || "0"),
                credit: String(fd.get("credit_b") || "0"),
              },
            ],
          }),
        });
        notify("Journal posted", "success");
        closeModal();
        accountingAccounts = [];
        await loadAccounting();
      } catch (err) {
        setModalError(err.message);
      }
    };
  }

  // Hook the "Post journal" button.
  const openJeBtn = $("open-je-modal");
  if (openJeBtn) openJeBtn.onclick = openPostJournalModal;

  await renderAccountingContent();
}

async function loadHr() {
  if (!canAccess("hr")) return;

  $("hr-message").textContent = "";

  const tabs = [
    { id: "employees", label: t("hr.tabs.employees") || "Employees" },
    { id: "attendance", label: t("hr.tabs.attendance") || "Attendance" },
    { id: "leave", label: t("hr.tabs.leave") || "Leave" },
    { id: "payroll", label: t("hr.tabs.payroll") || "Payroll" },
  ];

  try {
    const [employees, attendance, leave, payroll] = await Promise.all([
      api("/employees").catch(() => ({ data: [] })),
      api("/attendance").catch(() => ({ data: [] })),
      api("/leave").catch(() => ({ data: [] })),
      api("/payroll").catch(() => ({ data: [] })),
    ]);

    hrEmployees = employees.data || [];
    hrAttendance = attendance.data || [];
    hrLeave = leave.data || [];
    hrPayroll = payroll.data || [];

    $("hr-body").innerHTML = `
      <div class="toolbar" style="justify-content:flex-start">
        ${hrTab === "employees" ? `
          <button type="button" class="btn btn-primary" id="open-employee-modal" style="width:auto">${t("hr.addEmployee") || "Add employee"}</button>
          <button type="button" class="btn btn-ghost" id="open-invite-modal" style="width:auto">${t("hr.inviteUser") || "Invite user"}</button>
        ` : ""}
        ${hrTab === "payroll" ? `
          <button type="button" class="btn btn-primary" id="open-payroll-modal" style="width:auto">${t("hr.runPayroll") || "Run payroll"}</button>
        ` : ""}
      </div>

      <div class="tabs" id="hr-tabs">
        ${tabs.map((tb) => `<button type="button" data-hr-tab="${tb.id}" class="tab ${hrTab === tb.id ? "active" : ""}">${tb.label}</button>`).join("")}
      </div>

      <div id="hr-content"></div>
    `;

    $("hr-tabs").querySelectorAll("[data-hr-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        hrTab = btn.dataset.hrTab;
        loadHr();
      });
    });

    const content = $("hr-content");
    if (!content) return;

    if (hrTab === "employees") {
      content.innerHTML = `
        <table class="table">
          <thead><tr><th>Code</th><th>Name</th><th>Position</th><th style="text-align:right">Basic</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead>
          <tbody>
            ${
              hrEmployees.length
                ? hrEmployees
                    .map(
                      (e) => `
                  <tr>
                    <td>${e.employee_code || ""}</td>
                    <td>${e.name || ""}</td>
                    <td>${e.position || "—"}</td>
                    <td style="text-align:right">${e.basic_salary || "0"}</td>
                    <td class="muted">${e.status || ""}</td>
                    <td style="text-align:right">
                      <button type="button" class="btn btn-ghost" data-edit-employee="${e.id}" style="width:auto">Edit</button>
                    </td>
                  </tr>
                `
                    )
                    .join("")
                : `<tr><td colspan="6" class="muted">No employees yet</td></tr>`
            }
          </tbody>
        </table>
      `;

      content.querySelectorAll("[data-edit-employee]").forEach((btn) => {
        btn.onclick = () => openEmployeeEditModal(btn.dataset.editEmployee);
      });

      const newBtn = $("open-employee-modal");
      if (newBtn) newBtn.onclick = () => openEmployeeEditModal(null);

      const inviteBtn = $("open-invite-modal");
      if (inviteBtn) inviteBtn.onclick = openInviteModal;
    }

    if (hrTab === "attendance") {
      content.innerHTML = `
        <table class="table">
          <thead><tr><th>Date</th><th>Employee</th><th>In</th><th>Out</th><th>Source</th></tr></thead>
          <tbody>
            ${
              hrAttendance.length
                ? hrAttendance
                    .map(
                      (a) => `
                  <tr>
                    <td>${a.date}</td>
                    <td>${a.employee_name || "—"}</td>
                    <td>${a.clock_in ? formatDateTime(a.clock_in) : "—"}</td>
                    <td>${a.clock_out ? formatDateTime(a.clock_out) : "—"}</td>
                    <td class="muted">${a.source || ""}</td>
                  </tr>
                `
                    )
                    .join("")
                : `<tr><td colspan="5" class="muted">No attendance yet</td></tr>`
            }
          </tbody>
        </table>
      `;
    }

    if (hrTab === "leave") {
      content.innerHTML = `
        <div class="space-y-3">
          ${
            hrLeave.length
              ? hrLeave
                  .map(
                    (l) => `
                <div class="card" style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px">
                  <div>
                    <div style="font-weight:700">${l.employee_name || "Employee"} · ${l.type}</div>
                    <div class="muted" style="margin-top:4px">${l.start_date} → ${l.end_date}</div>
                    <div class="muted" style="margin-top:4px">Status: ${l.status || ""}${l.reason ? ` · ${l.reason}` : ""}</div>
                  </div>
                  ${
                    l.status === "Pending"
                      ? `
                    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end">
                      <button type="button" class="btn btn-primary" data-leave-action="${l.id}|approve" style="width:auto">Approve</button>
                      <button type="button" class="btn btn-ghost" data-leave-action="${l.id}|reject" style="width:auto">Reject</button>
                    </div>
                  `
                      : `<div class="muted" style="padding-top:8px">—</div>`
                  }
                </div>
              `
                  )
                  .join("")
              : `<p class="muted">No leave requests</p>`
          }
        </div>
      `;

      content.querySelectorAll("[data-leave-action]").forEach((btn) => {
        btn.onclick = () => decideLeave(btn.dataset.leaveAction);
      });
    }

    if (hrTab === "payroll") {
      content.innerHTML = `
        <div class="space-y-3">
          ${
            hrPayroll.length
              ? hrPayroll
                  .map(
                    (run) => `
                <div class="card" style="padding:16px">
                  <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px">
                    <div>
                      <div style="font-weight:700">${run.period_start} → ${run.period_end}</div>
                      <div class="muted">Status: ${run.status || ""}</div>
                    </div>
                    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end">
                      ${
                        run.status === "Draft" || run.status === "Rejected"
                          ? `<button type="button" class="btn btn-primary" data-payroll-action="${run.id}|submit" style="width:auto">Submit</button>`
                          : ""
                      }
                      ${
                        run.status === "PendingApproval"
                          ? `
                        <button type="button" class="btn btn-primary" data-payroll-action="${run.id}|approve" style="width:auto">Approve & post</button>
                        <button type="button" class="btn btn-ghost" data-payroll-action="${run.id}|reject" style="width:auto">Reject</button>
                      `
                          : ""
                      }
                    </div>
                  </div>

                  <div style="margin-top:12px;overflow:auto">
                    <table class="table">
                      <thead><tr><th>Employee</th><th>Days</th><th>OT hrs</th><th style="text-align:right">Gross</th><th style="text-align:right">Net</th></tr></thead>
                      <tbody>
                        ${
                          run.payslips?.length
                            ? run.payslips
                                .map(
                                  (s) => `
                            <tr>
                              <td>${s.employee_name || s.employee_code || s.id.slice(0, 8)}</td>
                              <td>${s.days_worked || "—"}</td>
                              <td>${s.overtime_hours || "—"}</td>
                              <td style="text-align:right">${s.gross_pay || "0"}</td>
                              <td style="text-align:right">${s.net_pay || "0"}</td>
                            </tr>
                          `
                                )
                                .join("")
                            : `<tr><td colspan="5" class="muted">No payslips</td></tr>`
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              `
                  )
                  .join("")
              : `<p class="muted">No payroll runs</p>`
          }
        </div>
      `;

      content.querySelectorAll("[data-payroll-action]").forEach((btn) => {
        btn.onclick = () => payrollAction(btn.dataset.payrollAction);
      });

      const payrollBtn = $("open-payroll-modal");
      if (payrollBtn) payrollBtn.onclick = openPayrollModal;
    }

    async function decideLeave(payload) {
      const [id, action] = String(payload).split("|");
      try {
        await api(`/leave/${id}/${action}`, { method: "POST", body: "{}" });
        notify(action === "approve" ? "Leave approved" : "Leave rejected", "success");
        await loadHr();
      } catch (err) {
        notify(err.message, "error");
      }
    }

    async function payrollAction(payload) {
      const [id, action] = String(payload).split("|");
      try {
        await api(`/payroll/${id}/${action}`, { method: "POST", body: "{}" });
        notify("Payroll updated", "success");
        await loadHr();
      } catch (err) {
        notify(err.message, "error");
      }
    }

    function openEmployeeEditModal(employeeId) {
      const existing = hrEmployees.find((x) => x.id === employeeId) || null;
      const isEdit = !!existing;
      const today = new Date().toISOString().slice(0, 10);
      openModal({
        title: isEdit ? "Edit employee" : "Add employee",
        subtitle: isEdit ? "Update payroll details and employment status." : "Create a payroll record for someone at the active branch.",
        wide: true,
        bodyHtml: `
          <form id="employee-edit-form" class="form-stack">
            <label>Employee code<input name="employee_code" type="text" required value="${existing?.employee_code || ""}" /></label>
            <label>Full name<input name="name" type="text" required value="${existing?.name || ""}" /></label>
            <label>Position<input name="position" type="text" value="${existing?.position || "Cashier"}" /></label>
            <label>Basic salary<input name="basic_salary" type="text" required value="${existing?.basic_salary || "30000"}" /></label>
            <label>Transport allowance<input name="transport" type="text" value="${existing?.allowances?.transport || "3000"}" /></label>
            <label>Status
              <select name="status">
                <option value="active" ${existing?.status === "active" ? "selected" : ""}>active</option>
                <option value="inactive" ${existing?.status === "inactive" ? "selected" : ""}>inactive</option>
                <option value="terminated" ${existing?.status === "terminated" ? "selected" : ""}>terminated</option>
              </select>
            </label>
            <div class="modal-actions">
              <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
              <button type="submit" class="btn btn-primary">${isEdit ? "Save changes" : "Save employee"}</button>
            </div>
          </form>
        `,
      });

      const form = $("employee-edit-form");
      if (!form) return;
      form.onsubmit = async (e) => {
        e.preventDefault();
        try {
          const fd = new FormData(form);
          const payload = {
            employee_code: fd.get("employee_code"),
            name: fd.get("name"),
            position: fd.get("position"),
            basic_salary: fd.get("basic_salary"),
            allowances: { transport: fd.get("transport") },
            status: fd.get("status"),
            join_date: today,
          };

          if (isEdit) {
            delete payload.join_date; // update doesn't require explicit join_date.
            await api(`/employees/${existing.id}`, {
              method: "PATCH",
              body: JSON.stringify(payload),
            });
            notify("Employee updated", "success");
          } else {
            payload.branch_id = session.branch_id;
            await api("/employees", {
              method: "POST",
              body: JSON.stringify({ ...payload, branch_id: session.branch_id }),
            });
            notify("Employee created", "success");
          }

          closeModal();
          await loadHr();
        } catch (err) {
          setModalError(err.message);
        }
      };
    }

    function openInviteModal() {
      openModal({
        title: "Invite staff",
        subtitle: "Grant access to someone who already has a Kaarobar login.",
        wide: true,
        bodyHtml: `
          <form id="invite-form" class="form-stack">
            <label>Email<input name="email" type="email" required placeholder="cashier@kaarobar.local" /></label>
            <label>Role
              <select name="role">
                ${
                  ["cashier","branch_manager","inventory_manager","accountant","hr_manager","employee"]
                    .map((r) => `<option value="${r}">${r}</option>`)
                    .join("")
                }
              </select>
            </label>
            <div class="modal-actions">
              <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
              <button type="submit" class="btn btn-primary">Send invite</button>
            </div>
          </form>
        `,
      });
      const form = $("invite-form");
      if (!form) return;
      form.onsubmit = async (e) => {
        e.preventDefault();
        try {
          const fd = new FormData(form);
          const email = String(fd.get("email") || "").trim();
          const role = String(fd.get("role") || "cashier");
          if (!session?.business_id) {
            notify("Select a business first.", "warning");
            return;
          }
          await api(`/businesses/${session.business_id}/memberships`, {
            method: "POST",
            body: JSON.stringify({
              email,
              roles: [role],
              branch_id: session.branch_id,
              status: "active",
            }),
          });
          notify("Invite sent", "success");
          closeModal();
          await loadHr();
        } catch (err) {
          notify(err.message, "error");
        }
      };
    }

    function openPayrollModal() {
      const d = new Date();
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const periodStart = start.toISOString().slice(0, 10);
      const periodEnd = new Date().toISOString().slice(0, 10);
      openModal({
        title: "Draft payroll",
        subtitle: "Draft payslips for the selected period.",
        wide: true,
        bodyHtml: `
          <form id="payroll-form" class="form-stack" style="max-width:520px">
            <label>Period start<input name="period_start" type="date" value="${periodStart}" required /></label>
            <label>Period end<input name="period_end" type="date" value="${periodEnd}" required /></label>
            <div class="modal-actions">
              <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
              <button type="submit" class="btn btn-primary">Create draft</button>
            </div>
          </form>
        `,
      });
      const form = $("payroll-form");
      if (!form) return;
      form.onsubmit = async (e) => {
        e.preventDefault();
        try {
          const fd = new FormData(form);
          await api("/payroll", {
            method: "POST",
            body: JSON.stringify({
              period_start: fd.get("period_start"),
              period_end: fd.get("period_end"),
            }),
          });
          notify("Payroll run created", "success");
          closeModal();
          await loadHr();
        } catch (err) {
          notify(err.message, "error");
        }
      };
    }
  } catch (err) {
    $("hr-message").textContent = err.message;
  }
}

async function loadReports() {
  if (!canAccess("reports")) return;
  $("reports-message").textContent = "";

  try {
    const [sales, stock, br] = await Promise.all([
      api(`/reports/sales-by-day?from=${encodeURIComponent(reportsFrom)}&to=${encodeURIComponent(reportsTo)}`),
      api("/reports/low-stock"),
      api("/reports/branch").catch(() => ({ data: null })),
    ]);

    reportsSalesByDay = sales.data || [];
    reportsLowStock = stock.data || [];
    reportsBranch = br.data || null;

    $("reports-body").innerHTML = `
      <div class="space-y-3">
        ${
          reportsBranch
            ? `
          <div class="stat-grid">
            <div class="stat"><span>Sales today</span><strong>${reportsBranch.sales_today ?? "0"}</strong></div>
            <div class="stat"><span>Tickets</span><strong>${reportsBranch.sales_count_today ?? "0"}</strong></div>
            <div class="stat"><span>Low stock</span><strong>${reportsBranch.low_stock_count ?? "0"}</strong></div>
            <div class="stat"><span>Pending returns</span><strong>${reportsBranch.pending_returns ?? "0"}</strong></div>
          </div>
        `
            : ""
        }

        <div class="toolbar" style="justify-content:flex-start">
          <label style="width:auto; margin:0 14px 0 0">
            ${t("common.from")} <input id="reports-from" type="date" value="${reportsFrom}" />
          </label>
          <label style="width:auto; margin:0">
            ${t("common.to")} <input id="reports-to" type="date" value="${reportsTo}" />
          </label>
          <div style="margin-left:auto">
            <button type="button" class="btn btn-primary" id="reload-reports" style="width:auto">Load</button>
          </div>
        </div>

        <div class="card">
          <h3 style="margin:0 0 10px">${t("reports.salesByDay") || "Sales by day"}</h3>
          <table class="table">
            <thead><tr><th>Date</th><th style="text-align:right">Sales</th><th style="text-align:right">Tickets</th></tr></thead>
            <tbody>
              ${
                reportsSalesByDay.length
                  ? reportsSalesByDay
                      .map(
                        (r) =>
                          `<tr><td>${r.date}</td><td style="text-align:right">${r.total ?? "0"}</td><td style="text-align:right">${r.count ?? 0}</td></tr>`
                      )
                      .join("")
                  : `<tr><td colspan="3" class="muted">No sales in range</td></tr>`
              }
            </tbody>
          </table>
        </div>

        <div class="card">
          <h3 style="margin:0 0 10px">${t("reports.lowStock") || "Low stock"}</h3>
          <table class="table">
            <thead><tr><th>SKU</th><th>Name</th><th style="text-align:right">On hand</th></tr></thead>
            <tbody>
              ${
                reportsLowStock.length
                  ? reportsLowStock
                      .map(
                        (r) =>
                          `<tr><td>${r.sku || ""}</td><td>${r.name || ""}</td><td style="text-align:right">${r.quantity_on_hand ?? "0"}</td></tr>`
                      )
                      .join("")
                  : `<tr><td colspan="3" class="muted">${t("reports.nothingBelowThreshold") || "Nothing below threshold"}</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    const fromInput = $("reports-from");
    const toInput = $("reports-to");
    const reloadBtn = $("reload-reports");
    if (reloadBtn) {
      reloadBtn.onclick = async () => {
        reportsFrom = fromInput.value;
        reportsTo = toInput.value;
        await loadReports();
      };
    }
  } catch (err) {
    $("reports-message").textContent = err.message;
  }
}

async function loadNotifications() {
  try {
    const res = await api("/notifications");
    const rows = res.data || [];

    $("notifications-list").innerHTML =
      rows.length
        ? rows
            .map(
              (n) => `
          <div class="list-row" style="border-top:1px solid var(--border)">
            <div style="flex:1; min-width:0">
              <div style="font-weight:700">${n.title || n.type || "Notification"}</div>
              <div class="muted" style="margin-top:4px">${n.body ? String(n.body).slice(0,120) : ""}</div>
              <div class="muted" style="margin-top:6px">${n.sent_at ? new Date(n.sent_at).toLocaleString() : ""}</div>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end">
              <div class="muted">${n.status || "unread"}</div>
              ${
                n.status === "unread" || n.status === "pending"
                  ? `<button type="button" class="btn btn-ghost" data-mark-notification="${n.id}" style="width:auto">Mark read</button>`
                  : ""
              }
            </div>
          </div>
        `
            )
            .join("")
        : "<p class='muted'>No notifications yet.</p>";

    $("notifications-list").querySelectorAll("[data-mark-notification]").forEach((btn) => {
      btn.onclick = async () => {
        try {
          await api(`/notifications/${btn.dataset.markNotification}/read`, {
            method: "POST",
            body: "{}",
          });
          notify("Notification marked as read", "success");
          await loadNotifications();
        } catch (err) {
          notify(err.message, "error");
        }
      };
    });
  } catch (err) {
    $("notifications-list").innerHTML = `<p class="muted">${err.message}</p>`;
  }
}

async function loadRoleSettings() {
  if (!session?.business_id || !canAccess("owner_manage")) return {};
  const res = await api(`/businesses/${session.business_id}/role-settings`);
  return res.data?.roles || {};
}

function renderRoleSettingsEditor() {
  const managedRoles = ["owner", "admin", "employee"];
  const bundles = ["pos", "inventory", "accounting", "hr", "reports", "settings", "notifications", "employee_self"];

  const table = `
    <table class="table">
      <thead>
        <tr><th>Role</th>${bundles.map((b) => `<th>${b}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${managedRoles
          .map(
            (role) => `
          <tr>
            <td>${role}</td>
            ${bundles
              .map((bundle) => {
                const checked = roleSettings?.[role]?.[bundle] ? "checked" : "";
                const disabled = role === "owner" && bundle !== "notifications" ? "disabled" : "";
                return `<td><input type="checkbox" data-role="${role}" data-bundle="${bundle}" ${checked} ${disabled} /></td>`;
              })
              .join("")}
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
    <div class="row" style="margin-top:12px">
      <button type="button" class="btn btn-primary" id="save-role-settings" style="width:auto">Save role settings</button>
    </div>
  `;

  const mount = $("role-settings-body") || $("settings-body");
  if (!mount) return;
  mount.innerHTML = table;

  mount.querySelectorAll("input[type='checkbox']").forEach((input) => {
    input.addEventListener("change", () => {
      const role = input.dataset.role;
      const bundle = input.dataset.bundle;
      if (!roleSettings[role]) roleSettings[role] = {};
      roleSettings[role][bundle] = input.checked;
    });
  });

  const saveBtn = $("save-role-settings");
  if (saveBtn) {
    saveBtn.onclick = async () => {
      try {
        await api(`/businesses/${session.business_id}/role-settings`, {
          method: "PUT",
          body: JSON.stringify({ roles: roleSettings }),
        });
        notify("Role settings saved", "success");
      } catch (err) {
        notify(err.message, "error");
      }
    };
  }
}

async function loadSettings() {
  $("settings-message").textContent = "";

  if (!canAccess("owner_manage")) {
    $("settings-body").innerHTML = "<p class='muted'>Only owner can manage role settings.</p>";
    return;
  }

  try {
    const [billRes, bizRes] = await Promise.all([
      api("/billing/subscription").catch(() => ({ data: null })),
      api("/businesses").catch(() => ({ data: [] })),
    ]);

    settingsUsage = billRes.data || null;
    settingsBusinesses = bizRes.data || [];

    $("settings-body").innerHTML = `
      <div class="tabs" id="settings-tabs">
        <button type="button" data-settings-tab="subscriptions" class="tab ${settingsTab === "subscriptions" ? "active" : ""}">Subscriptions</button>
        <button type="button" data-settings-tab="integrations" class="tab ${settingsTab === "integrations" ? "active" : ""}">Integrations</button>
        <button type="button" data-settings-tab="roles" class="tab ${settingsTab === "roles" ? "active" : ""}">Roles</button>
      </div>

      <div id="settings-subscriptions-panel" class="${settingsTab === "subscriptions" ? "" : "hidden"}">
        <div class="card">
          <h3 style="margin:0 0 8px">${t("settings.subscription") || "Subscription"}</h3>
          ${
            settingsUsage
              ? `
            <p class="muted" style="margin:0 0 12px">${t("settings.plan") || "Plan"}: <strong>${settingsUsage.subscription?.plan || ""}</strong></p>
            <p class="muted" style="margin:0 0 12px">Status: <strong>${settingsUsage.subscription?.status || ""}</strong></p>
            <div class="stat-grid" style="grid-template-columns: repeat(3, 1fr)">
              <div class="stat"><span>${t("settings.businesses")}</span><strong>${settingsUsage.usage?.businesses ?? 0}</strong></div>
              <div class="stat"><span>${t("settings.branches")}</span><strong>${settingsUsage.usage?.branches ?? 0}</strong></div>
              <div class="stat"><span>${t("settings.users")}</span><strong>${settingsUsage.usage?.users ?? 0}</strong></div>
            </div>
          `
              : `<p class="muted">Subscription info not available.</p>`
          }
        </div>
      </div>

      <div id="settings-integrations-panel" class="${settingsTab === "integrations" ? "" : "hidden"}">
        <div class="card">
          <h3 style="margin:0 0 8px">${t("settings.fbrTitle") || "FBR Tier-1"}</h3>
          <p class="muted" style="margin:0 0 12px">${t("settings.fbrDesc") || ""}</p>
          <ul class="plain-list">
            ${
              settingsBusinesses.length
                ? settingsBusinesses
                    .map(
                      (b) => `
                <li style="display:flex;align-items:center;justify-content:space-between;gap:12px">
                  <div>
                    <div style="font-weight:700">${b.name || ""}</div>
                    <div class="muted">Business ID: ${b.id || ""}</div>
                  </div>
                  <button type="button" class="btn btn-primary" data-toggle-fbr="${b.id}" style="width:auto; background:${b.fbr_tier1 ? "var(--brand-hover)" : "var(--brand)"}">
                    ${b.fbr_tier1 ? (t("common.enabled") || "Enabled") : (t("common.disabled") || "Disabled")}
                  </button>
                </li>
              `
                    )
                    .join("")
                : `<li class="muted">No businesses</li>`
            }
          </ul>
        </div>
      </div>

      <div id="settings-roles-panel" class="${settingsTab === "roles" ? "" : "hidden"}">
        <div class="card">
          <h3 style="margin:0 0 10px">Role settings</h3>
          <div id="role-settings-body"></div>
        </div>
      </div>
    `;

    const tabsEl = $("settings-tabs");
    if (tabsEl) {
      tabsEl.querySelectorAll("[data-settings-tab]").forEach((btn) => {
        btn.onclick = async () => {
          settingsTab = btn.dataset.settingsTab || "subscriptions";
          await loadSettings();
        };
      });
    }

    // FBR toggle events.
    $("settings-body").querySelectorAll("[data-toggle-fbr]").forEach((btn) => {
      btn.onclick = async () => {
        try {
          const businessId = btn.dataset.toggleFbr;
          const biz = settingsBusinesses.find((x) => x.id === businessId);
          if (!biz) return;
          await api(`/businesses/${businessId}`, {
            method: "PATCH",
            body: JSON.stringify({ fbr_tier1: !biz.fbr_tier1 }),
          });
          notify("FBR setting updated", "success");
          await loadSettings();
        } catch (err) {
          notify(err.message, "error");
        }
      };
    });

    if (settingsTab === "roles") {
      roleSettings = await loadRoleSettings();
      renderRoleSettingsEditor();
    }
  } catch (err) {
    $("settings-message").textContent = err.message;
  }
}

/* —— ESS (Employee Staff Tools) —— */

function setEssTab(nextTab) {
  essTab = nextTab;
  const clock = $("ess-clock");
  const leave = $("ess-leave");
  const payslips = $("ess-payslips");
  if (clock) clock.classList.toggle("hidden", essTab !== "clock");
  if (leave) leave.classList.toggle("hidden", essTab !== "leave");
  if (payslips) payslips.classList.toggle("hidden", essTab !== "payslips");

  document.querySelectorAll("#ess-tabs [data-ess-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.essTab === essTab);
  });
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function renderEssTabs(data) {
  const hint = $("ess-hint");
  const emp = data?.employee;
  if (hint) {
    hint.textContent = emp
      ? `${emp.name || "Employee"} · ${emp.employee_code || ""}`
      : "Link your login to an employee profile to use ESS.";
  }

  if (data?.open_attendance && data.open_attendance.clock_in) {
    const clockEl = $("ess-clock");
    if (clockEl) {
      clockEl.classList.remove("hidden");
      clockEl.innerHTML = `
        <div class="card">
          <div class="panel-head" style="margin-bottom:8px">
            <div>
              <h3 style="margin:0">On shift since</h3>
              <p class="muted" style="margin:4px 0 0">${formatDateTime(data.open_attendance.clock_in)}</p>
            </div>
            <button type="button" class="btn btn-primary" id="ess-clock-out" style="width:auto">Clock out</button>
          </div>
        </div>
        <div class="card" style="margin-top:14px">
          <h3 style="margin:0 0 10px">Recent attendance</h3>
          <div id="ess-attendance-list" class="plain-list">
            ${(data.attendance || [])
              .slice(0, 8)
              .map(
                (a) => `
              <div style="display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid var(--border);">
                <div>${a.date}</div>
                <div class="muted">${a.clock_in ? formatDateTime(a.clock_in) : "—"} → ${
                  a.clock_out ? formatDateTime(a.clock_out) : "open"
                }</div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `;
      const btn = $("ess-clock-out");
      if (btn) {
        btn.onclick = async () => {
          try {
            await api(`/attendance/${data.open_attendance.id}/clock-out`, {
              method: "POST",
              body: "{}",
            });
            await loadEss();
          } catch (err) {
            notify(err.message, "error");
          }
        };
      }
    }
  } else {
    const clockEl = $("ess-clock");
    if (clockEl) {
      clockEl.classList.remove("hidden");
      clockEl.innerHTML = `
        <div class="card">
          <h3 style="margin:0 0 6px">Not clocked in</h3>
          <p class="muted" style="margin:0 0 12px">Mark attendance for today from your desktop.</p>
          <button type="button" class="btn btn-primary" id="ess-clock-in" style="width:auto">Clock in</button>
        </div>
      `;
      const btn = $("ess-clock-in");
      if (btn) {
        btn.onclick = async () => {
          if (!session?.branch_id) {
            notify("Select a branch first.", "warning");
            return;
          }
          try {
            await api(`/attendance/clock-in`, {
              method: "POST",
              body: JSON.stringify({ source: "desktop", branch_id: session.branch_id }),
            });
            await loadEss();
          } catch (err) {
            notify(err.message, "error");
          }
        };
      }
    }
  }

  // Leave tab
  const leaveEl = $("ess-leave");
  if (leaveEl) {
    const leave = data?.leave || [];
    leaveEl.innerHTML = `
      <div class="card">
        <h3 style="margin:0 0 10px">Request leave</h3>
        <form id="ess-leave-form" class="form-stack" style="max-width:520px">
          <label>Type
            <select id="ess-leave-type" required>
              <option value="annual">annual</option>
              <option value="sick">sick</option>
              <option value="other">other</option>
            </select>
          </label>
          <label>Start date
            <input id="ess-leave-start" type="date" required />
          </label>
          <label>End date
            <input id="ess-leave-end" type="date" required />
          </label>
          <label>Reason
            <input id="ess-leave-reason" type="text" placeholder="Reason" />
          </label>
          <div class="modal-actions" style="justify-content:flex-start">
            <button type="submit" class="btn btn-primary" style="width:auto">Submit request</button>
          </div>
        </form>
      </div>
      <div class="card" style="margin-top:14px">
        <h3 style="margin:0 0 10px">My requests</h3>
        <div class="plain-list">
          ${
            leave.length
              ? leave
                  .map(
                    (l) => `
                  <div class="list-row">
                    <div>
                      <div style="font-weight:700">${l.type}</div>
                      <div class="muted">${l.start_date} → ${l.end_date}</div>
                      ${l.reason ? `<div class="muted">Reason: ${l.reason}</div>` : ""}
                    </div>
                    <div class="muted">${l.status}</div>
                  </div>
                `
                  )
                  .join("")
              : `<p class="muted">No leave requests</p>`
          }
        </div>
      </div>
    `;

    const form = $("ess-leave-form");
    const today = new Date().toISOString().slice(0, 10);
    const start = $("ess-leave-start");
    const end = $("ess-leave-end");
    if (start) start.value = today;
    if (end) end.value = today;

    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        try {
          const payload = {
            type: $("ess-leave-type")?.value || "annual",
            start_date: $("ess-leave-start")?.value,
            end_date: $("ess-leave-end")?.value,
            reason: $("ess-leave-reason")?.value || "",
          };
          await api("/leave", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          notify("Leave requested", "success");
          await loadEss();
        } catch (err) {
          notify(err.message, "error");
        }
      };
    }
  }

  // Payslips tab
  const payslipsEl = $("ess-payslips");
  if (payslipsEl) {
    const payslips = data?.payslips || [];
    payslipsEl.innerHTML = `
      <div class="card">
        <h3 style="margin:0 0 10px">Payslips</h3>
        ${
          payslips.length === 0
            ? `<p class="muted">No payslips yet.</p>`
            : `
          <div class="plain-list">
            ${payslips
              .map(
                (p) => `
              <div class="list-row">
                <div>
                  <div style="font-weight:700">${p.period_start || "—"} → ${p.period_end || "—"}</div>
                  <div class="muted">Gross ${p.gross_pay} · Net ${p.net_pay}</div>
                </div>
                <div class="muted">${p.status || ""}</div>
              </div>
            `
              )
              .join("")}
          </div>
        `
        }
      </div>
    `;
  }
}

async function loadEss() {
  if (!canAccess("employee_self")) return;
  try {
    const res = await api("/ess/me");
    essData = res.data;
    setEssTab(essTab);
    renderEssTabs(essData || {});
  } catch (err) {
    notify(err.message, "error");
  }
}

/* —— Auth —— */

async function onAuthSubmit() {
  const err = $("auth-error");
  err.classList.add("hidden");
  const email = $("email").value.trim();
  const password = $("password").value;
  const btn = $("auth-submit");
  btn.disabled = true;
  try {
    let result;
    if (mode === "login") {
      result = await api(
        "/auth/login",
        { method: "POST", body: JSON.stringify({ email, password }) },
        null
      );
    } else {
      result = await api(
        "/auth/register",
        {
          method: "POST",
          body: JSON.stringify({
            email,
            password,
            name: $("name").value.trim(),
            business_name: $("business").value.trim(),
          }),
        },
        null
      );
    }
    await hydrateTenant({ access_token: result.access_token, user: result.user });
    await enterApp();
  } catch (e) {
    err.textContent = e.message || "Authentication failed";
    err.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
}

function logout() {
  setSession(null);
  cart = [];
  till = null;
  setAuthMode("login");
  showAuth();
}

/* —— Events —— */

$("auth-submit").addEventListener("click", onAuthSubmit);
$("auth-toggle").addEventListener("click", () => {
  setAuthMode(mode === "login" ? "signup" : "login");
});
$("logout").addEventListener("click", logout);

document.querySelectorAll("[data-nav]").forEach((btn) => {
  btn.addEventListener("click", () => navigate(btn.dataset.nav));
});

if ($("ess-tabs")) {
  $("ess-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-ess-tab]");
    if (!btn) return;
    const next = btn.dataset.essTab;
    if (!next) return;
    setEssTab(next);
  });
}

if ($("locale-select")) {
  $("locale-select").addEventListener("change", (e) => {
    window.KaarobarI18n?.setLocale(e.target.value);
    applyChromeI18n();
  });
}

if ($("profile-form")) {
  $("profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("profile-msg").textContent = "";
    try {
      const body = {
        name: $("profile-name").value.trim(),
        phone: $("profile-phone").value.trim(),
        locale: $("profile-locale").value,
      };
      const pw = $("profile-password").value.trim();
      if (pw) body.password = pw;
      const res = await api("/auth/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (session) {
        setSession({
          ...session,
          user: {
            ...session.user,
            ...res.user,
          },
        });
      }
      window.KaarobarI18n?.setLocale(res.user.locale === "ur" ? "ur" : "en");
      applyChromeI18n();
      $("profile-password").value = "";
      notify(t("profile.saved"), "success");
      if ($("user-name")) $("user-name").textContent = res.user.name;
    } catch (err) {
      notify(err.message, "error");
    }
  });
}

$("business-select").addEventListener("change", async (e) => {
  const business_id = e.target.value;
  const next = { ...session, business_id, branch_id: undefined };
  setSession(next);
  const br = await api(`/businesses/${business_id}/branches`);
  branches = br.data || [];
  if (branches[0]) {
    next.branch_id = branches[0].id;
    setSession(next);
  }
  try {
    const roleRes = await api(`/businesses/${business_id}/role-settings`);
    roleSettings = roleRes.data?.roles || {};
  } catch {
    roleSettings = {};
  }
  renderTenantSelects();
  applyNavAccess();
  await loadDashboardStats();
});

$("branch-select").addEventListener("change", async (e) => {
  setSession({ ...session, branch_id: e.target.value });
  await loadDashboardStats();
});

$("products").addEventListener("click", (e) => {
  const btn = e.target.closest(".product");
  if (!btn) return;
  const product = products.find((p) => p.id === btn.dataset.id);
  if (!product) return;
  const existing = cart.find((l) => l.id === product.id);
  if (existing) existing.qty += 1;
  else cart.push({ ...product, qty: 1 });
  renderCart();
});

$("cart-items").addEventListener("click", (e) => {
  const qtyBtn = e.target.closest("[data-qty]");
  if (qtyBtn) {
    const line = cart.find((l) => l.id === qtyBtn.dataset.qty);
    if (!line) return;
    line.qty += Number(qtyBtn.dataset.delta);
    if (line.qty <= 0) cart = cart.filter((l) => l.id !== line.id);
    renderCart();
    return;
  }
  const removeBtn = e.target.closest("[data-remove]");
  if (removeBtn) {
    cart = cart.filter((l) => l.id !== removeBtn.dataset.remove);
    renderCart();
  }
});

$("search").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  renderProducts(
    products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode || "").toLowerCase().includes(q)
    )
  );
});

$("discount-amount").addEventListener("input", () => renderCart());
$("tax-amount").addEventListener("input", () => renderCart());

$("search").addEventListener("keydown", async (e) => {
  if (e.key !== "Enter") return;
  const code = e.target.value.trim();
  if (!code) return;
  e.preventDefault();
  try {
    const res = await api(`/products/by-barcode/${encodeURIComponent(code)}`);
    const p = res.data;
    const existing = cart.find((l) => l.id === p.id);
    if (existing) existing.qty += 1;
    else
      cart.push({
        id: p.id,
        name: p.name,
        sku: p.sku,
        price: Number(p.price || 0),
        tax_rate: Number(p.tax_rate || 0.18),
        qty: 1,
      });
    $("search").value = "";
    renderCart();
    notify(`${t("common.create")}: ${p.name}`, "info");
  } catch (err) {
    notify(err.message || t("common.error"), "error");
  }
});

$("pay").addEventListener("click", async () => {
  const subtotal = cart.reduce((s, l) => s + l.qty * l.price, 0);
  const discount = round2(Math.min(Math.max(Number($("discount-amount").value || 0), 0), subtotal));
  const tax = round2(Math.max(Number($("tax-amount").value || 0), 0));
  const total = round2(subtotal - discount + tax);
  const payments = [];
  const cash = Number($("pay-cash").value || 0);
  const card = Number($("pay-card").value || 0);
  const wallet = Number($("pay-wallet").value || 0);
  if (cash > 0) payments.push({ method: "cash", amount: round2(cash) });
  if (card > 0) payments.push({ method: "card", amount: round2(card) });
  if (wallet > 0) payments.push({ method: "wallet", amount: round2(wallet) });
  const paySum = round2(payments.reduce((s, p) => s + p.amount, 0));
  if (!payments.length || Math.abs(paySum - total) > 0.001) {
    notify(`${t("common.total")}: ${money(total)} / ${money(paySum)}`, "warning");
    return;
  }
  try {
    const res = await api("/sales", {
      method: "POST",
      body: JSON.stringify({
        branch_id: session.branch_id,
        client_txn_id: crypto.randomUUID(),
        till_id: till?.id,
        items: cart.map((l) => ({ product_id: l.id, quantity: l.qty })),
        discount_amount: discount,
        tax_amount: tax,
        payments,
      }),
    });
    cart = [];
    renderCart();
    notify(`${t("pos.saleComplete")} · ${res.data.invoice_number}`, "success");
  } catch (err) {
    notify(err.message || t("pos.checkoutFailed"), "error");
  }
});

$("lookup-sale").addEventListener("click", lookupSale);

$("pending-returns").addEventListener("click", async (e) => {
  const approve = e.target.closest("[data-approve]");
  const reject = e.target.closest("[data-reject]");
  try {
    if (approve) {
      await api(`/returns/${approve.dataset.approve}/approve`, {
        method: "POST",
        body: "{}",
      });
      notify(t("returns.returnApproved"), "success");
      await loadReturns();
    }
    if (reject) {
      await api(`/returns/${reject.dataset.reject}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: "Rejected by manager" }),
      });
      notify(t("returns.returnRejected"), "success");
      await loadReturns();
    }
  } catch (err) {
    notify(err.message, "error");
  }
});

$("inv-tabs").addEventListener("click", (e) => {
  const tab = e.target.closest("[data-inv-tab]");
  if (tab) showInvTab(tab.dataset.invTab);
});

document.addEventListener("click", (e) => {
  if (e.target.closest("[data-close-modal]")) {
    closeModal();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("modal-root").classList.contains("hidden")) {
    closeModal();
  }
});

document.addEventListener("click", async (e) => {
  const confirmBtn = e.target.closest("[data-confirm-transfer]");
  if (!confirmBtn) return;
  try {
    await api(`/inventory/transfers/${confirmBtn.dataset.confirmTransfer}/confirm`, {
      method: "POST",
      body: "{}",
    });
    notify(t("inventory.transferConfirmed"), "success");
    await loadInventory();
  } catch (err) {
    notify(err.message, "error");
  }
});

async function loadProfile() {
  try {
    const res = await api("/auth/me");
    const u = res.user || {};
    $("profile-name").value = u.name || "";
    $("profile-email").value = u.email || "";
    $("profile-phone").value = u.phone || "";
    $("profile-locale").value = u.locale === "ur" ? "ur" : "en";
    $("profile-password").value = "";
    $("profile-msg").textContent = "";
  } catch (err) {
    notify(err.message, "error");
  }
}

async function boot() {
  if (window.KaarobarI18n) {
    await window.KaarobarI18n.loadCatalogs();
    applyChromeI18n();
  }
  setAuthMode("login");
  if (window.kaarobarPos) {
    const status = await window.kaarobarPos.getStatus();
    const label = status.online
      ? `Online · pending sync ${status.pendingSyncCount}`
      : `Offline · pending sync ${status.pendingSyncCount}`;
    $("status").textContent = label;
  }

  session = getSession();
  if (session?.user?.locale === "ur" || session?.user?.locale === "en") {
    window.KaarobarI18n?.setLocale(session.user.locale);
    applyChromeI18n();
  }
  if (session?.access_token) {
    try {
      await hydrateTenant(session);
      await enterApp();
      return;
    } catch {
      setSession(null);
    }
  }
  showAuth();
}

boot();
