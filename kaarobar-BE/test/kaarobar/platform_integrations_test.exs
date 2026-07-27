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
    assert is_list(summary.plans)
    assert length(summary.plans) >= 4
    assert is_list(summary.entitled_bundles)
    assert "pos" in summary.entitled_bundles

    by_code = Map.new(summary.plans, &{&1.code, &1})
    assert by_code["trial"].max_businesses == 1
    assert by_code["trial"].max_branches == 2
    assert "accounting" not in by_code["trial"].entitled_bundles
    assert "marketing" in by_code["growth"].entitled_bundles
    assert by_code["starter"].max_businesses == 3
    assert by_code["starter"].max_branches == 10
    assert by_code["starter"].price_pkr == 4999
    assert by_code["growth"].max_businesses == 10
    assert by_code["growth"].max_branches == 50
    assert by_code["growth"].price_pkr == 12_999
    assert is_list(by_code["growth"].features)
    assert length(by_code["growth"].features) > 0
    assert by_code["enterprise"].price_pkr == nil
    assert is_binary(by_code["enterprise"].tagline)

    # Trial allows 1 business — already used by setup
    refute Billing.within_limits?(owner.id, :business)
    assert {:ok, _} = Billing.set_plan(owner.id, "starter")
    assert Billing.within_limits?(owner.id, :business)
  end

  test "ADM-FR-005 expired trial blocks writes", %{owner: owner} do
    past = DateTime.add(DateTime.utc_now(), -86_400, :second) |> DateTime.truncate(:second)
    assert {:ok, _} = Billing.set_plan(owner.id, "trial", %{trial_ends_at: past, status: "active"})
    refute Billing.subscription_allows_writes?(owner.id)
    refute Billing.within_limits?(owner.id, :branch)
  end

  test "ADM-FR-003 Safepay webhook updates plan", %{owner: owner} do
    reference =
      Kaarobar.Billing.Safepay.encode_reference(%{
        "owner_id" => owner.id,
        "type" => "subscription",
        "plan" => "growth"
      })

    payload = %{
      "type" => "subscription.created",
      "data" => %{
        "token" => "sub_sfpy_123",
        "reference" => reference,
        "status" => "ACTIVE",
        "current_period_end_date" => "2026-12-01T00:00:00Z"
      }
    }

    assert {:ok, %{handled: true}} = Billing.handle_safepay_webhook(payload)
    sub = Billing.get_subscription(owner.id)
    assert sub.plan == "growth"
    assert sub.lemon_squeezy_id == "sub_sfpy_123"
    assert sub.status == "active"
  end

  test "ADM-FR-003 trial checkout is blocked", %{owner: owner} do
    assert {:error, :invalid_plan} = Billing.create_plan_checkout(owner.id, "trial")
  end

  test "ADM-FR-003 checkout falls back without Safepay keys", %{owner: owner} do
    System.put_env("SAFEPAY_CHECKOUT_URL", "https://example.test/safepay-fallback")
    on_exit(fn -> System.delete_env("SAFEPAY_CHECKOUT_URL") end)

    assert {:ok, %{checkout_url: url, dev_fallback: true}} =
             Billing.create_plan_checkout(owner.id, "starter")

    assert url == "https://example.test/safepay-fallback"
  end

  test "webhook signature verification", %{} do
    Application.put_env(:kaarobar, :safepay_webhook_secret, "test-secret")
    on_exit(fn -> Application.delete_env(:kaarobar, :safepay_webhook_secret) end)

    data = %{"token" => "trk_1", "status" => "COMPLETED"}
    body = Jason.encode!(%{"type" => "payment.completed", "data" => data})

    sig =
      :crypto.mac(:hmac, :sha512, "test-secret", Jason.encode!(data))
      |> Base.encode16(case: :lower)

    assert :ok = Billing.verify_webhook_signature(body, sig, %{data: data})
    assert {:error, :invalid_signature} = Billing.verify_webhook_signature(body, "bad", %{data: data})
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
    assert {:ok, _} = Billing.set_plan(owner.id, "growth")

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
    assert {:ok, created} =
             Notifications.enqueue_email(owner.id, owner.id, "leave_request", %{leave_id: "x"},
               body: "Leave filed"
             )

    email = Enum.find(created, &(&1.channel == "email"))
    assert email
    assert email.status == "pending"

    drained = Oban.drain_queue(queue: :notifications)
    assert drained.success >= 1

    updated = Repo.get!(Kaarobar.Schemas.Notification, email.id)
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
