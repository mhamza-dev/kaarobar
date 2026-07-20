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

function navigate(view) {
  ["dashboard", "pos", "returns", "inventory"].forEach((v) => {
    $(`${v}-view`).classList.toggle("hidden", v !== view);
  });
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.nav === view);
  });
  if (view === "pos") loadPos();
  if (view === "returns") loadReturns();
  if (view === "inventory") loadInventory();
  if (view === "dashboard") loadDashboardStats();
}

function setAuthMode(next) {
  mode = next;
  $("auth-title").textContent = mode === "login" ? "Sign in" : "Create account";
  $("auth-sub").textContent =
    mode === "login"
      ? "Dashboard and till for your branch."
      : "Create an owner account and your first business.";
  $("signup-fields").classList.toggle("hidden", mode === "login");
  $("auth-submit").textContent = mode === "login" ? "Sign in" : "Create account";
  $("auth-toggle").textContent =
    mode === "login" ? "Need an account? Create one" : "Already have an account? Sign in";
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
    .map(
      (p) => `
      <button class="product" data-id="${p.id}" type="button">
        <strong>${p.name}</strong><br/>
        <span>${p.sku}</span><br/>
        <span>Rs ${money(p.price)}</span>
      </button>`
    )
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
    $("pos-message").textContent = "Till opened";
  } catch (err) {
    $("pos-message").textContent = err.message;
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
    $("pos-message").textContent =
      over && Number(over) !== 0 ? `Till closed (over/short ${over})` : "Till closed";
  } catch (err) {
    $("pos-message").textContent = err.message;
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
    $("returns-message").textContent = err.message;
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
    $("returns-message").textContent = err.message;
  }
}

async function submitReturn() {
  const items = Object.entries(returnQtys)
    .filter(([, q]) => Number(q) > 0)
    .map(([product_id, quantity]) => ({ product_id, quantity }));
  if (!items.length) {
    $("returns-message").textContent = "Enter at least one quantity";
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
    $("returns-message").textContent = `Return ${res.data.status} · Rs ${res.data.refund_amount}`;
    returnSale = null;
    renderReturnSale();
    await loadReturns();
  } catch (err) {
    $("returns-message").textContent = err.message;
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
      <form id="product-form" class="form-grid">
        <input name="sku" placeholder="SKU" required />
        <input name="name" placeholder="Name" required />
        <input name="price" placeholder="Price" required />
        <button class="btn btn-primary" type="submit">Add product</button>
      </form>
      <table class="table">
        <thead><tr><th>SKU</th><th>Name</th><th>Price</th></tr></thead>
        <tbody>
          ${invProducts
            .map(
              (p) =>
                `<tr><td>${p.sku}</td><td>${p.name}</td><td>${p.price ?? "—"}</td></tr>`
            )
            .join("")}
        </tbody>
      </table>`;
    $("product-form").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api("/products", {
          method: "POST",
          body: JSON.stringify({
            sku: fd.get("sku"),
            name: fd.get("name"),
            price: fd.get("price"),
          }),
        });
        $("inv-message").textContent = "Product created";
        await loadInventory();
      } catch (err) {
        $("inv-message").textContent = err.message;
      }
    };

    $("inv-suppliers").innerHTML = `
      <form id="supplier-form" class="row">
        <input name="name" placeholder="Supplier name" required class="grow" />
        <button class="btn btn-primary" type="submit">Add</button>
      </form>
      <ul class="plain-list">
        ${invSuppliers.map((s) => `<li>${s.name}</li>`).join("")}
      </ul>`;
    $("supplier-form").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api("/suppliers", {
          method: "POST",
          body: JSON.stringify({ name: fd.get("name") }),
        });
        $("inv-message").textContent = "Supplier added";
        await loadInventory();
      } catch (err) {
        $("inv-message").textContent = err.message;
      }
    };

    $("inv-po").innerHTML = `
      <div class="two-col">
        <form id="po-form" class="card form-stack">
          <h3>New PO</h3>
          <select name="supplier_id" required>
            <option value="">Supplier</option>
            ${invSuppliers.map((s) => `<option value="${s.id}">${s.name}</option>`).join("")}
          </select>
          <select name="product_id" required>
            <option value="">Product</option>
            ${invProducts.map((p) => `<option value="${p.id}">${p.name}</option>`).join("")}
          </select>
          <input name="quantity" value="10" placeholder="Qty" />
          <input name="unit_cost" value="50" placeholder="Unit cost" />
          <button class="btn btn-primary" type="submit">Create PO</button>
        </form>
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
      </div>
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
      </table>`;

    $("grn-po").onchange = (e) => {
      const opt = e.target.selectedOptions[0];
      $("grn-qty").value = opt?.dataset.qty || "";
    };

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
        $("inv-message").textContent = "PO created";
        await loadInventory();
      } catch (err) {
        $("inv-message").textContent = err.message;
      }
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
        $("inv-message").textContent = "GRN received";
        await loadInventory();
      } catch (err) {
        $("inv-message").textContent = err.message;
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
        $("inv-message").textContent = "Transfer created";
        await loadInventory();
      } catch (err) {
        $("inv-message").textContent = err.message;
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
        $("inv-message").textContent = "Stock adjusted";
        await loadInventory();
      } catch (err) {
        $("inv-message").textContent = err.message;
      }
    };

    showInvTab("stock");
  } catch (err) {
    $("inv-message").textContent = err.message;
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
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    )
  );
});

$("pay").addEventListener("click", async () => {
  const msg = $("pos-message");
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
    msg.textContent = `Payments must total ${money(total)} (got ${money(paySum)})`;
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
    msg.textContent = `Sale ${res.data.invoice_number}`;
  } catch (err) {
    msg.textContent = err.message || "Checkout failed";
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
      $("returns-message").textContent = "Return approved";
      await loadReturns();
    }
    if (reject) {
      await api(`/returns/${reject.dataset.reject}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: "Rejected by manager" }),
      });
      $("returns-message").textContent = "Return rejected";
      await loadReturns();
    }
  } catch (err) {
    $("returns-message").textContent = err.message;
  }
});

$("inv-tabs").addEventListener("click", (e) => {
  const tab = e.target.closest("[data-inv-tab]");
  if (tab) showInvTab(tab.dataset.invTab);
});

document.addEventListener("click", async (e) => {
  const confirmBtn = e.target.closest("[data-confirm-transfer]");
  if (!confirmBtn) return;
  try {
    await api(`/inventory/transfers/${confirmBtn.dataset.confirmTransfer}/confirm`, {
      method: "POST",
      body: "{}",
    });
    $("inv-message").textContent = "Transfer confirmed";
    await loadInventory();
  } catch (err) {
    $("inv-message").textContent = err.message;
  }
});

async function boot() {
  setAuthMode("login");
  if (window.kaarobarPos) {
    const status = await window.kaarobarPos.getStatus();
    const label = status.online
      ? `Online · pending sync ${status.pendingSyncCount}`
      : `Offline · pending sync ${status.pendingSyncCount}`;
    $("status").textContent = label;
  }

  session = getSession();
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
