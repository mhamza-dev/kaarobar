const API_URL = "http://localhost:4000/api/v1";
const SESSION_KEY = "kaarobar_desktop_session";

let mode = "login";
let session = null;
let products = [];
let cart = [];
let till = null;
let businesses = [];
let branches = [];
let invProducts = [];
let invSuppliers = [];
let invPos = [];
let invTransfers = [];
let returnSale = null;
let returnQtys = {};

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
  if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  else localStorage.removeItem(SESSION_KEY);
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
    '[data-nav="profile"]': "nav.profile",
  };
  Object.entries(map).forEach(([sel, key]) => {
    document.querySelectorAll(sel).forEach((el) => {
      el.textContent = t(key);
    });
  });
  if ($("logout")) $("logout").textContent = t("common.signOut");
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
}

function navigate(view) {
  ["dashboard", "pos", "returns", "inventory", "profile"].forEach((v) => {
    const el = $(`${v}-view`);
    if (el) el.classList.toggle("hidden", v !== view);
  });
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.nav === view);
  });
  if (view === "pos") loadPos();
  if (view === "returns") loadReturns();
  if (view === "inventory") loadInventory();
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
  const biz = await api("/businesses", {}, next);
  businesses = biz.data || [];
  if (businesses[0] && !next.business_id) next.business_id = businesses[0].id;

  if (next.business_id) {
    const br = await api(`/businesses/${next.business_id}/branches`, {}, next);
    branches = br.data || [];
    if (branches[0] && !next.branch_id) next.branch_id = branches[0].id;
  } else {
    branches = [];
  }

  setSession(next);
  renderTenantSelects();
  return next;
}

async function loadDashboardStats() {
  $("user-name").textContent = session?.user?.name || "";
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
  const tax = cart.reduce((s, l) => s + l.qty * l.price * (l.taxRate || 0.18), 0);
  const total = round2(subtotal + tax);
  $("subtotal").textContent = money(subtotal);
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
  renderTenantSelects();
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
  const total = Number($("total").textContent);
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
