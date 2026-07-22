defmodule KaarobarWeb.DevCredsController do
  @moduledoc false
  # Dev-only page listing login emails from the DB. Passwords are never stored
  # in plaintext; seeded accounts use Password@123 (see priv/repo/seeds.exs).

  use Phoenix.Controller, formats: [:html], layouts: []

  import Ecto.Query
  import Plug.Conn

  alias Kaarobar.Repo
  alias Kaarobar.Schemas.{Business, CustomerAccount, Employee, Membership, User}

  @demo_password "Password@123"

  def index(conn, _params) do
    unless Application.get_env(:kaarobar, :dev_routes, false) do
      raise "DevCredsController must not be reachable when :dev_routes is disabled"
    end

    owners = list_owners()
    staff = list_staff()
    customers = list_customer_accounts()

    conn
    |> put_resp_content_type("text/html")
    |> send_resp(200, render_page(owners, staff, customers))
  end

  defp list_owners do
    from(b in Business,
      join: u in User,
      on: u.id == b.owner_id,
      order_by: [asc: u.email, asc: b.name],
      select: %{
        email: u.email,
        name: u.name,
        user_status: u.status,
        business_id: b.id,
        business_name: b.name,
        industry: b.industry
      }
    )
    |> Repo.all()
  end

  defp list_staff do
    from(m in Membership,
      join: u in User,
      on: u.id == m.user_id,
      join: b in Business,
      on: b.id == m.business_id,
      left_join: e in Employee,
      on: e.user_id == u.id and e.business_id == b.id,
      order_by: [asc: u.email, asc: b.name],
      select: %{
        email: u.email,
        name: coalesce(e.name, u.name),
        user_status: u.status,
        membership_status: m.status,
        roles: m.roles,
        business_id: b.id,
        business_name: b.name,
        employee_code: e.employee_code,
        position: e.position,
        is_owner: b.owner_id == u.id
      }
    )
    |> Repo.all()
  end

  defp list_customer_accounts do
    from(a in CustomerAccount,
      join: c in assoc(a, :customer),
      join: b in assoc(a, :business),
      order_by: [asc: a.email, asc: b.name],
      select: %{
        email: a.email,
        status: a.status,
        email_verified: a.email_verified,
        customer_name: c.name,
        customer_phone: c.phone,
        portal_enabled: c.portal_enabled,
        business_id: b.id,
        business_name: b.name
      }
    )
    |> Repo.all()
  end

  defp render_page(owners, staff, customers) do
    """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1"/>
      <title>Kaarobar · Dev credentials</title>
      <style>
        :root {
          --bg: #0f1419;
          --panel: #1a222c;
          --border: #2c3846;
          --text: #e8eef4;
          --muted: #9aabbc;
          --accent: #3d9a6a;
          --warn: #c9a227;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 13px;
          line-height: 1.45;
          background: var(--bg);
          color: var(--text);
        }
        header {
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--border);
          background: linear-gradient(180deg, #162018 0%, var(--bg) 100%);
        }
        h1 { margin: 0 0 0.35rem; font-size: 1.15rem; font-weight: 600; }
        .banner {
          color: var(--warn);
          margin: 0.5rem 0 0;
          max-width: 70rem;
        }
        .meta { color: var(--muted); margin: 0.35rem 0 0; }
        main { padding: 1rem 1.5rem 3rem; }
        .toolbar {
          display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center;
          margin-bottom: 1.25rem;
        }
        input[type="search"] {
          flex: 1; min-width: 16rem; max-width: 28rem;
          padding: 0.5rem 0.75rem;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--panel);
          color: var(--text);
        }
        .count { color: var(--muted); }
        section { margin-bottom: 2rem; }
        h2 {
          margin: 0 0 0.65rem;
          font-size: 0.95rem;
          color: var(--accent);
          font-weight: 600;
          letter-spacing: 0.02em;
        }
        .wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; }
        table { width: 100%; border-collapse: collapse; background: var(--panel); }
        th, td {
          text-align: left; padding: 0.45rem 0.7rem;
          border-bottom: 1px solid var(--border);
          vertical-align: top;
        }
        th {
          font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em;
          color: var(--muted); background: #141b22; position: sticky; top: 0;
        }
        tr:last-child td { border-bottom: none; }
        tr.hidden { display: none; }
        code, .pwd {
          background: #0c1015; padding: 0.1rem 0.35rem; border-radius: 4px;
          color: #b8e0c8;
        }
        .id { color: var(--muted); font-size: 0.72rem; word-break: break-all; }
        .empty { color: var(--muted); padding: 0.75rem; }
        .tag {
          display: inline-block; padding: 0.05rem 0.35rem; border-radius: 4px;
          background: #243040; color: var(--muted); margin: 0 0.15rem 0.15rem 0;
          font-size: 0.7rem;
        }
      </style>
    </head>
    <body>
      <header>
        <h1>Dev credentials</h1>
        <p class="banner">
          Dev environment only. Passwords are Argon2-hashed in the DB and cannot be recovered.
          Seeded accounts use <span class="pwd">#{h(@demo_password)}</span>.
        </p>
        <p class="meta">
          Staff login: email + password · Portal login: business id + email + password ·
          Generated #{h(DateTime.utc_now() |> DateTime.truncate(:second) |> DateTime.to_iso8601())}
        </p>
      </header>
      <main>
        <div class="toolbar">
          <input type="search" id="q" placeholder="Filter by email, name, business…" autocomplete="off"/>
          <span class="count" id="counts"></span>
        </div>

        <section data-section="owners">
          <h2>Owners (#{length(owners)})</h2>
          #{table_owners(owners)}
        </section>

        <section data-section="staff">
          <h2>Employees / staff memberships (#{length(staff)})</h2>
          #{table_staff(staff)}
        </section>

        <section data-section="customers">
          <h2>Customer portal accounts (#{length(customers)})</h2>
          #{table_customers(customers)}
        </section>
      </main>
      <script>
        const q = document.getElementById("q");
        const counts = document.getElementById("counts");
        function applyFilter() {
          const needle = (q.value || "").trim().toLowerCase();
          let visible = 0, total = 0;
          document.querySelectorAll("tbody tr[data-search]").forEach((row) => {
            total += 1;
            const show = !needle || row.dataset.search.includes(needle);
            row.classList.toggle("hidden", !show);
            if (show) visible += 1;
          });
          counts.textContent = needle ? (visible + " / " + total + " shown") : (total + " rows");
        }
        q.addEventListener("input", applyFilter);
        applyFilter();
      </script>
    </body>
    </html>
    """
  end

  defp table_owners([]), do: ~s(<p class="empty">No owner businesses found.</p>)

  defp table_owners(rows) do
    body =
      Enum.map_join(rows, "", fn r ->
        search = search_blob([r.email, r.name, r.business_name, r.business_id])

        """
        <tr data-search="#{h(search)}">
          <td>#{h(r.email)}</td>
          <td>#{h(r.name)}</td>
          <td>#{h(r.business_name)}<div class="id">#{h(r.business_id)}</div></td>
          <td>#{h(r.industry)}</td>
          <td>#{h(r.user_status)}</td>
          <td><span class="pwd">#{h(@demo_password)}</span></td>
        </tr>
        """
      end)

    """
    <div class="wrap"><table>
      <thead><tr>
        <th>Email</th><th>Name</th><th>Business</th><th>Industry</th><th>Status</th><th>Password</th>
      </tr></thead>
      <tbody>#{body}</tbody>
    </table></div>
    """
  end

  defp table_staff([]), do: ~s(<p class="empty">No memberships found.</p>)

  defp table_staff(rows) do
    body =
      Enum.map_join(rows, "", fn r ->
        roles = Enum.map_join(r.roles || [], "", &~s(<span class="tag">#{h(&1)}</span>))
        owner_tag = if r.is_owner, do: ~s(<span class="tag">owner</span>), else: ""
        search =
          search_blob([
            r.email,
            r.name,
            r.business_name,
            r.business_id,
            r.employee_code,
            r.position,
            Enum.join(r.roles || [], " ")
          ])

        """
        <tr data-search="#{h(search)}">
          <td>#{h(r.email)}</td>
          <td>#{h(r.name)}#{owner_tag}</td>
          <td>#{roles}</td>
          <td>#{h(r.position)}#{if r.employee_code, do: ~s(<div class="id">#{h(r.employee_code)}</div>), else: ""}</td>
          <td>#{h(r.business_name)}<div class="id">#{h(r.business_id)}</div></td>
          <td>#{h(r.membership_status)}</td>
          <td><span class="pwd">#{h(@demo_password)}</span></td>
        </tr>
        """
      end)

    """
    <div class="wrap"><table>
      <thead><tr>
        <th>Email</th><th>Name</th><th>Roles</th><th>HR</th><th>Business</th><th>Membership</th><th>Password</th>
      </tr></thead>
      <tbody>#{body}</tbody>
    </table></div>
    """
  end

  defp table_customers([]), do: ~s(<p class="empty">No customer portal accounts found.</p>)

  defp table_customers(rows) do
    body =
      Enum.map_join(rows, "", fn r ->
        search =
          search_blob([
            r.email,
            r.customer_name,
            r.customer_phone,
            r.business_name,
            r.business_id
          ])

        verified = if r.email_verified, do: "yes", else: "no"
        portal = if r.portal_enabled, do: "yes", else: "no"

        """
        <tr data-search="#{h(search)}">
          <td>#{h(r.email)}</td>
          <td>#{h(r.customer_name)}<div class="id">#{h(r.customer_phone)}</div></td>
          <td>#{h(r.business_name)}<div class="id">#{h(r.business_id)}</div></td>
          <td>#{h(r.status)}</td>
          <td>#{verified}</td>
          <td>#{portal}</td>
          <td><span class="pwd">#{h(@demo_password)}</span></td>
        </tr>
        """
      end)

    """
    <div class="wrap"><table>
      <thead><tr>
        <th>Email</th><th>Customer</th><th>Business (portal ID)</th><th>Account</th><th>Verified</th><th>Portal on</th><th>Password</th>
      </tr></thead>
      <tbody>#{body}</tbody>
    </table></div>
    """
  end

  defp search_blob(parts) do
    parts
    |> Enum.map(&to_string( &1 || ""))
    |> Enum.join(" ")
    |> String.downcase()
  end

  defp h(nil), do: ""

  defp h(value) do
    value
    |> to_string()
    |> String.replace("&", "&amp;")
    |> String.replace("<", "&lt;")
    |> String.replace(">", "&gt;")
    |> String.replace("\"", "&quot;")
  end
end
