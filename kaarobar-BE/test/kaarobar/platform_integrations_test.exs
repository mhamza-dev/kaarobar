defmodule Kaarobar.PlatformIntegrationsTest do
  use Kaarobar.DataCase

  alias Kaarobar.{
    Accounts,
    Billing,
    Integrations.Fbr,
    Notifications,
    Reporting,
    Sync,
    Tenancy
  }

  alias Kaarobar.Schemas.Sale
  alias Kaarobar.Repo

  setup do
    {:ok, owner} =
      Accounts.register(%{
        email: "owner-p6-#{System.unique_integer()}@test.local",
        password: "password123",
        name: "Owner"
      })

    {:ok, business} =
      Tenancy.create_business(owner.id, %{name: "Platform Co", fbr_tier1: true})

    {:ok, branch} = Tenancy.create_branch(business.id, owner, %{name: "Main"})

    %{owner: owner, business: business, branch: branch}
  end

  test "ADM-FR-002 usage summary and plan limits", %{owner: owner} do
    summary = Billing.usage_summary(owner.id)
    assert summary.subscription.plan in Billing.plans()
    assert summary.usage.businesses >= 1
    assert summary.limits.max_users > 0
    # Trial allows 1 business — already used by setup
    refute Billing.within_limits?(owner.id, :business)
    assert {:ok, _} = Billing.set_plan(owner.id, "starter")
    assert Billing.within_limits?(owner.id, :business)
  end

  test "ADM-FR-003 LemonSqueezy webhook updates plan", %{owner: owner} do
    payload = %{
      "meta" => %{"event_name" => "subscription_created"},
      "data" => %{
        "id" => "ls_sub_123",
        "attributes" => %{
          "variant_name" => "Growth Annual",
          "custom_data" => %{"owner_id" => owner.id},
          "renews_at" => "2026-12-01T00:00:00Z"
        }
      }
    }

    assert {:ok, %{handled: true}} = Billing.handle_lemonsqueezy_webhook(payload)
    sub = Billing.get_subscription(owner.id)
    assert sub.plan == "growth"
    assert sub.lemon_squeezy_id == "ls_sub_123"
    assert sub.status == "active"
  end

  test "webhook signature verification", %{} do
    Application.put_env(:kaarobar, :lemonsqueezy_webhook_secret, "test-secret")
    on_exit(fn -> Application.delete_env(:kaarobar, :lemonsqueezy_webhook_secret) end)

    body = ~s({"hello":"world"})
    sig =
      :crypto.mac(:hmac, :sha256, "test-secret", body)
      |> Base.encode16(case: :lower)

    assert :ok = Billing.verify_webhook_signature(body, sig)
    assert {:error, :invalid_signature} = Billing.verify_webhook_signature(body, "bad")
  end

  test "RPT-FR branch dashboard and sales-by-day", %{
    owner: owner,
    business: business,
    branch: branch
  } do
    dash = Reporting.branch_dashboard(owner.id, business.id, branch.id)
    assert dash.sales_today
    assert dash.low_stock_count >= 0

    rows =
      Reporting.sales_by_day(
        owner.id,
        business.id,
        Date.add(Date.utc_today(), -7),
        Date.utc_today(),
        branch_id: branch.id
      )

    assert is_list(rows)
  end

  test "FBR-FR mock report stores invoice and QR", %{
    owner: owner,
    business: business,
    branch: branch
  } do
    sale =
      %Sale{}
      |> Sale.changeset(%{
        invoice_number: "INV-TEST-1",
        client_txn_id: Ecto.UUID.generate(),
        status: "Completed",
        subtotal: "100",
        tax_amount: "18",
        total_amount: "118",
        branch_id: branch.id,
        owner_id: owner.id,
        business_id: business.id,
        cashier_id: owner.id
      })
      |> Repo.insert!()

    assert {:ok, fbr_no} = Fbr.queue_sale_report(sale.id)
    assert String.starts_with?(fbr_no, "FBR-")

    {:ok, status} = Fbr.get_status(sale.id)
    assert status.reported
    assert status.fbr_qr_payload
    assert String.contains?(status.fbr_qr_payload, fbr_no)
  end

  test "NOT-FR enqueue delivers via mailer in test", %{owner: owner} do
    assert {:ok, n} =
             Notifications.enqueue_email(owner.id, owner.id, "leave_request", %{leave_id: "x"},
               body: "Leave filed"
             )

    assert n.status == "pending"
    assert %{success: 1} = Oban.drain_queue(queue: :notifications)

    updated = Repo.get!(Kaarobar.Schemas.Notification, n.id)
    assert updated.status == "sent"
  end

  test "OFF-FR sync catalog and inventory delta", %{
    owner: owner,
    business: business,
    branch: branch
  } do
    catalog = Sync.catalog(business.id, owner.id, branch.id)
    assert is_list(catalog)

    delta = Sync.inventory_delta(business.id, owner.id, branch.id, nil)
    assert is_list(delta)
  end
end
