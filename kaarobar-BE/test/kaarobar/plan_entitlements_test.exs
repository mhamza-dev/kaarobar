defmodule Kaarobar.PlanEntitlementsTest do
  @moduledoc """
  Plan-based feature gating (ADM-FR-002 / ADM-FR-005).
  """
  use KaarobarWeb.ConnCase

  alias Kaarobar.{Accounts, Billing, Tenancy}
  alias Kaarobar.Guardian

  setup do
    {:ok, owner} =
      Accounts.register(%{
        email: "owner-plan-#{System.unique_integer()}@test.local",
        password: "password123",
        name: "Plan Owner"
      })

    {:ok, business} = Tenancy.create_business(owner.id, %{name: "Plan Co"})
    {:ok, branch} = Tenancy.create_branch(business.id, owner, %{name: "Main"})
    {:ok, token, _} = Guardian.encode_and_sign(owner, %{}, token_type: "access")

    %{owner: owner, business: business, branch: branch, token: token}
  end

  defp authed(conn, token, business_id, branch_id) do
    conn
    |> put_req_header("authorization", "Bearer #{token}")
    |> put_req_header("x-business-id", business_id)
    |> put_req_header("x-branch-id", branch_id)
  end

  test "ADM-FR-002 trial entitled_bundles exclude accounting and marketing", %{owner: owner} do
    assert {:ok, _} = Billing.set_plan(owner.id, "trial")
    bundles = Billing.entitled_bundles_for_owner(owner.id)

    assert "pos" in bundles
    assert "inventory" in bundles
    refute "accounting" in bundles
    refute "marketing" in bundles
    refute Billing.plan_allows_bundle?(owner.id, :accounting)
    refute Billing.plan_allows_bundle?(owner.id, "marketing")
    refute Billing.plan_allows_fbr?(owner.id)

    summary = Billing.usage_summary(owner.id)
    assert summary.entitled_bundles == bundles
    assert summary.allows_fbr == false
    assert is_list(hd(summary.plans).entitled_bundles)
  end

  test "ADM-FR-002 growth entitles marketing and FBR", %{owner: owner} do
    assert {:ok, _} = Billing.set_plan(owner.id, "growth")
    assert Billing.plan_allows_bundle?(owner.id, "marketing")
    assert Billing.plan_allows_bundle?(owner.id, :payroll_approve)
    assert Billing.plan_allows_fbr?(owner.id)
    assert Billing.usage_summary(owner.id).allows_fbr
  end

  test "ADM-FR-002 trial owner blocked from accounting API with plan_feature_locked", %{
    owner: owner,
    business: business,
    branch: branch,
    token: token,
    conn: conn
  } do
    assert {:ok, _} = Billing.set_plan(owner.id, "trial")

    conn =
      conn
      |> authed(token, business.id, branch.id)
      |> get("/api/v1/accounts")

    assert json_response(conn, 403)["error"] == "plan_feature_locked"
  end

  test "ADM-FR-002 trial owner blocked from marketing API with plan_feature_locked", %{
    owner: owner,
    business: business,
    branch: branch,
    token: token,
    conn: conn
  } do
    assert {:ok, _} = Billing.set_plan(owner.id, "trial")

    conn =
      conn
      |> authed(token, business.id, branch.id)
      |> get("/api/v1/crm/campaigns")

    assert json_response(conn, 403)["error"] == "plan_feature_locked"
  end

  test "ADM-FR-002 growth owner can access accounting and marketing APIs", %{
    owner: owner,
    business: business,
    branch: branch,
    token: token,
    conn: conn
  } do
    assert {:ok, _} = Billing.set_plan(owner.id, "growth")

    accounts =
      conn
      |> authed(token, business.id, branch.id)
      |> get("/api/v1/accounts")

    assert accounts.status == 200

    campaigns =
      build_conn()
      |> authed(token, business.id, branch.id)
      |> get("/api/v1/crm/campaigns")

    assert campaigns.status == 200
  end

  test "ADM-FR-005 subscription_inactive still blocks business create", %{
    owner: owner,
    conn: conn,
    token: token,
    business: business,
    branch: branch
  } do
    past = DateTime.add(DateTime.utc_now(), -86_400, :second) |> DateTime.truncate(:second)
    assert {:ok, _} = Billing.set_plan(owner.id, "trial", %{trial_ends_at: past, status: "active"})
    refute Billing.subscription_allows_writes?(owner.id)

    # Upgrade to starter so plan limits allow another business, then expire again
    assert {:ok, _} = Billing.set_plan(owner.id, "starter")
    past2 = DateTime.add(DateTime.utc_now(), -86_400, :second) |> DateTime.truncate(:second)

    assert {:ok, _} =
             Billing.set_plan(owner.id, "trial", %{trial_ends_at: past2, status: "active"})

    conn =
      conn
      |> authed(token, business.id, branch.id)
      |> post("/api/v1/businesses", %{name: "Blocked Biz"})

    assert json_response(conn, 402)["error"] == "subscription_inactive"
  end

  test "ADM-FR-002 enabling FBR on trial returns plan_feature_locked", %{
    owner: owner,
    business: business,
    branch: branch,
    token: token,
    conn: conn
  } do
    assert {:ok, _} = Billing.set_plan(owner.id, "trial")

    conn =
      conn
      |> authed(token, business.id, branch.id)
      |> patch("/api/v1/businesses/#{business.id}", %{fbr_tier1: true})

    assert json_response(conn, 403)["error"] == "plan_feature_locked"
  end
end
