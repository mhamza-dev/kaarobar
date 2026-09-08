defmodule Kaarobar.RowLevelSecurityTest do
  @moduledoc """
  The second isolation layer, tested directly against Postgres.

  Every other test in this suite goes through `Kaarobar.Repo.Scoped`, which is
  the *first* layer — it is what these queries deliberately bypass, to prove
  the database itself refuses an unscoped or wrongly-scoped read, not just
  that the application code remembers to ask correctly. See
  `priv/repo/migrations/20260909000000_enable_row_level_security.exs`.

  ## Why these run as `backend_app`, not as this connection's own role

  The connection every test in this suite runs on connects as `DATABASE_USER`
  — `postgres`, the database's bootstrap superuser in every environment this
  application runs in today. Postgres superusers bypass row-level security
  unconditionally; no policy and no `FORCE ROW LEVEL SECURITY` changes that.
  Testing against this connection's own role would prove nothing either way.

  `backend_app` (created by
  `priv/repo/migrations/20260909000200_create_restricted_app_role.exs`) is
  granted ordinary read/write access and nothing more — no ownership, no
  bypass. `SET ROLE` into it for the span of an assertion and the *policies*
  are what get tested, independent of which role happens to run this
  application's connection pool today.
  """

  use Kaarobar.DataCase, async: true

  alias Kaarobar.Catalog.Product
  alias Kaarobar.Customers.Customer

  defp as_backend_app(fun) do
    Repo.query!("SET ROLE backend_app")

    try do
      fun.()
    after
      Repo.query!("RESET ROLE")
    end
  end

  describe "a query with no tenant context set" do
    test "sees no rows on a protected table, even though some exist" do
      %{scope: scope} = owner_scope()
      product_fixture(scope)

      as_backend_app(fn ->
        Repo.query!("RESET app.current_org_id")
        assert Repo.all(Product) == []
      end)
    end

    test "cannot insert a row on a protected table either" do
      %{organization: organization, business: business} = owner_scope()

      as_backend_app(fn ->
        Repo.query!("RESET app.current_org_id")

        assert_raise Postgrex.Error, ~r/row-level security/, fn ->
          Repo.insert!(%Customer{
            organization_id: organization.id,
            business_id: business.id,
            name: "No context, no insert"
          })
        end
      end)
    end
  end

  describe "a query scoped to the wrong tenant" do
    test "sees the other tenant's rows as zero, not as an error" do
      # Each product has to be created while its own organization's context
      # is the active one, or the insert's WITH CHECK fails the same way a
      # cross-tenant write from the app would.
      %{scope: mine} = owner_scope()
      product_fixture(mine, %{"name" => "Only mine"})

      %{scope: theirs} = owner_scope()
      product_fixture(theirs, %{"name" => "Only theirs"})

      as_backend_app(fn ->
        Repo.set_tenant_context(mine.organization.id, local: true)
        names = Product |> Repo.all() |> Enum.map(& &1.name)

        assert "Only mine" in names
        refute "Only theirs" in names
      end)
    end

    test "the right tenant's context is enough on its own to read them" do
      %{scope: mine} = owner_scope()
      product_fixture(mine, %{"name" => "Readable with the right context"})

      as_backend_app(fn ->
        Repo.set_tenant_context(mine.organization.id, local: true)
        names = Product |> Repo.all() |> Enum.map(& &1.name)

        assert "Readable with the right context" in names
      end)
    end
  end

  describe "Kaarobar.Repo.with_tenant_context/2" do
    test "sets app.current_org_id for fun and clears it again after" do
      %{scope: scope} = owner_scope()

      during =
        Repo.with_tenant_context(scope.organization.id, fn ->
          %{rows: [[value]]} = Repo.query!("SELECT current_setting('app.current_org_id', true)")
          value
        end)

      assert during == scope.organization.id

      %{rows: [[after_value]]} = Repo.query!("SELECT current_setting('app.current_org_id', true)")
      assert after_value in [nil, ""]
    end

    test "clears it even when fun raises" do
      %{scope: scope} = owner_scope()

      assert_raise RuntimeError, "boom", fn ->
        Repo.with_tenant_context(scope.organization.id, fn -> raise "boom" end)
      end

      %{rows: [[value]]} = Repo.query!("SELECT current_setting('app.current_org_id', true)")
      assert value in [nil, ""]
    end
  end

  describe "Kaarobar.Repo.as_system/1" do
    test "actually has the table access it needs, not just the RLS bypass" do
      # `BYPASSRLS` skips row-level *policies* — it grants nothing on its
      # own. A prior version of this migration created `backend_system` with
      # no table privileges at all, which looked fine right up until the
      # first real cross-tenant read tried to run: `SET ROLE` would succeed
      # and every query after it would fail with `permission denied`.
      %{scope: mine} = owner_scope()
      product_fixture(mine, %{"name" => "Visible across every tenant"})

      names = Repo.as_system(fn -> Product |> Repo.all() |> Enum.map(& &1.name) end)

      assert "Visible across every tenant" in names
    end

    test "runs fun as backend_system and reverts the role after" do
      %{rows: [[before_role]]} = Repo.query!("SELECT current_user")

      during = Repo.as_system(fn -> Repo.query!("SELECT current_user").rows end)
      assert during == [["backend_system"]]

      %{rows: [[after_role]]} = Repo.query!("SELECT current_user")
      assert after_role == before_role
    end

    test "reverts the role even when fun raises" do
      %{rows: [[before_role]]} = Repo.query!("SELECT current_user")

      assert_raise RuntimeError, "boom", fn ->
        Repo.as_system(fn -> raise "boom" end)
      end

      %{rows: [[after_role]]} = Repo.query!("SELECT current_user")
      assert after_role == before_role
    end

    test "backend_system is the one role that bypasses RLS" do
      assert %{rows: [[true]]} =
               Repo.query!("SELECT rolbypassrls FROM pg_roles WHERE rolname = 'backend_system'")

      assert %{rows: [[false]]} =
               Repo.query!("SELECT rolbypassrls FROM pg_roles WHERE rolname = 'backend_app'")
    end
  end

  describe "tables RLS deliberately leaves unprotected" do
    test "businesses and branches stay readable by backend_app without a tenant context" do
      %{business: business, branch: branch} = owner_scope()

      as_backend_app(fn ->
        Repo.query!("RESET app.current_org_id")

        assert Repo.get(Kaarobar.Tenancy.Business, business.id)
        assert Repo.get(Kaarobar.Tenancy.Branch, branch.id)
      end)
    end
  end

  describe "policy coverage" do
    test "every RLS-protected table both enables and forces it" do
      %{rows: rows} =
        Repo.query!("""
        SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_policy p ON p.polrelid = c.oid
        WHERE n.nspname = 'public'
        GROUP BY c.relname, c.relrowsecurity, c.relforcerowsecurity
        """)

      assert rows != []

      for [table, enabled, forced] <- rows do
        assert enabled, "#{table} has a policy but RLS is not enabled on it"
        assert forced, "#{table} has a policy but is not FORCEd, so its owner would bypass it"
      end
    end
  end
end
