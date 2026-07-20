const API_URL = "http://localhost:4000/api/v1";
const SESSION_KEY = "kaarobar_desktop_session";

const views = {
  auth: document.getElementById("auth-view"),
  dashboard: document.getElementById("dashboard-view"),
  pos: document.getElementById("pos-view"),
};

let mode = "login"; // login | signup
let session = null;
let products = [];
const cart = [];

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

function show(view) {
  Object.values(views).forEach((el) => el.classList.add("hidden"));
  views[view].classList.remove("hidden");
}

function money(n) {
  return Number(n || 0).toFixed(2);
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

function setAuthMode(next) {
  mode = next;
  document.getElementById("auth-title").textContent = mode === "login" ? "Sign in" : "Create account";
  document.getElementById("auth-sub").textContent =
    mode === "login"
      ? "Dashboard and till for your branch."
      : "Create an owner account and your first business.";
  document.getElementById("signup-fields").classList.toggle("hidden", mode === "login");
  document.getElementById("auth-submit").textContent = mode === "login" ? "Sign in" : "Create account";
  document.getElementById("auth-toggle").textContent =
    mode === "login" ? "Need an account? Create one" : "Already have an account? Sign in";
}

async function hydrateTenant(baseSession) {
  let next = { ...baseSession };
  const biz = await api("/businesses", {}, next);
  if (biz.data?.[0] && !next.business_id) {
    next.business_id = biz.data[0].id;
    const br = await api(`/businesses/${next.business_id}/branches`, {}, next);
    if (br.data?.[0]) next.branch_id = br.data[0].id;
  }
  setSession(next);
  return next;
}

async function loadDashboard() {
  document.getElementById("user-name").textContent = session.user.name;
  try {
    const dash = await api("/reports/dashboard");
    const d = dash.data || {};
    document.getElementById("stat-sales").textContent = d.sales_today ?? "—";
    document.getElementById("stat-cash").textContent = d.cash_position ?? "—";
    document.getElementById("stat-stock").textContent = d.low_stock_count ?? "—";
    document.getElementById("stat-approvals").textContent = d.pending_approvals ?? "—";
  } catch (err) {
    document.getElementById("stat-sales").textContent = "—";
  }
  show("dashboard");
}

function renderProducts(list) {
  document.getElementById("products").innerHTML = list
    .map(
      (p) => `
      <button class="product" data-id="${p.id}">
        <strong>${p.name}</strong><br/>
        <span>${p.sku}</span><br/>
        <span>Rs ${money(p.price)}</span>
      </button>`
    )
    .join("");
}

function renderCart() {
  const el = document.getElementById("cart-items");
  el.innerHTML = cart
    .map(
      (l) => `
      <li><span>${l.name} × ${l.qty}</span><strong>${money(l.qty * l.price)}</strong></li>`
    )
    .join("");
  const subtotal = cart.reduce((s, l) => s + l.qty * l.price, 0);
  const tax = cart.reduce((s, l) => s + l.qty * l.price * (l.taxRate || 0.18), 0);
  document.getElementById("subtotal").textContent = money(subtotal);
  document.getElementById("tax").textContent = money(tax);
  document.getElementById("total").textContent = money(subtotal + tax);
  document.getElementById("pay").disabled = cart.length === 0;
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
    products = [
      { id: "demo-1", sku: "TEA-001", name: "Green Tea 250g", price: 450, taxRate: 0.18 },
      { id: "demo-2", sku: "RCE-010", name: "Basmati Rice 5kg", price: 1850, taxRate: 0.18 },
    ];
  }
  renderProducts(products);
  renderCart();
  show("pos");
}

async function onAuthSubmit() {
  const err = document.getElementById("auth-error");
  err.classList.add("hidden");
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const btn = document.getElementById("auth-submit");
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
            name: document.getElementById("name").value.trim(),
            business_name: document.getElementById("business").value.trim(),
          }),
        },
        null
      );
    }
    await hydrateTenant({ access_token: result.access_token, user: result.user });
    await loadDashboard();
  } catch (e) {
    err.textContent = e.message || "Authentication failed";
    err.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
}

function logout() {
  setSession(null);
  cart.length = 0;
  setAuthMode("login");
  show("auth");
}

document.getElementById("auth-submit").addEventListener("click", onAuthSubmit);
document.getElementById("auth-toggle").addEventListener("click", () => {
  setAuthMode(mode === "login" ? "signup" : "login");
});
document.getElementById("open-pos").addEventListener("click", loadPos);
document.getElementById("open-pos-main").addEventListener("click", loadPos);
document.getElementById("back-dash").addEventListener("click", loadDashboard);
document.getElementById("logout").addEventListener("click", logout);
document.getElementById("logout-pos").addEventListener("click", logout);

document.getElementById("products").addEventListener("click", (e) => {
  const btn = e.target.closest(".product");
  if (!btn) return;
  const product = products.find((p) => p.id === btn.dataset.id);
  if (!product) return;
  const existing = cart.find((l) => l.id === product.id);
  if (existing) existing.qty += 1;
  else cart.push({ ...product, qty: 1 });
  renderCart();
});

document.getElementById("search").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  renderProducts(
    products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
  );
});

document.getElementById("pay").addEventListener("click", async () => {
  const msg = document.getElementById("pos-message");
  const total = Number(document.getElementById("total").textContent);
  const client_txn_id = crypto.randomUUID();
  try {
    await api("/sales", {
      method: "POST",
      body: JSON.stringify({
        branch_id: session.branch_id,
        client_txn_id,
        items: cart.map((l) => ({
          product_id: l.id,
          quantity: l.qty,
          unit_price: l.price,
        })),
        payments: [{ method: "cash", amount: total }],
      }),
    });
    cart.length = 0;
    renderCart();
    msg.textContent = `Sale completed (${client_txn_id.slice(0, 8)}…)`;
  } catch (err) {
    msg.textContent = err.message || "Checkout failed — queued locally when offline sync ships.";
  }
});

async function boot() {
  setAuthMode("login");
  if (window.kaarobarPos) {
    const status = await window.kaarobarPos.getStatus();
    const label = status.online
      ? `Online · pending sync ${status.pendingSyncCount}`
      : `Offline · pending sync ${status.pendingSyncCount}`;
    document.getElementById("status").textContent = label;
    document.getElementById("pos-status").textContent = label;
  }

  session = getSession();
  if (session?.access_token) {
    try {
      await hydrateTenant(session);
      await loadDashboard();
      return;
    } catch {
      setSession(null);
    }
  }
  show("auth");
}

boot();
