defmodule Kaarobar.Payments.SignatureTest do
  @moduledoc """
  The signature and amount conversions each adapter lives or dies by.

  These are the only parts of a gateway adapter that can be tested without a
  live account, and they are also the parts most likely to be wrong: a hash
  built in the wrong order fails with an error message that explains nothing,
  and an amount converted wrongly shows up as the wrong number on somebody's
  bank statement weeks later.
  """

  use ExUnit.Case, async: true

  alias Kaarobar.Payments.Adapters.Easypaisa
  alias Kaarobar.Payments.Adapters.JazzCash
  alias Kaarobar.Payments.Adapters.Stripe
  alias Kaarobar.Payments.Provider

  # Stripe signs `timestamp.body`. Building the header the same way the gateway
  # does is what makes these tests prove anything.
  defp stripe_header(secret, body, timestamp) do
    signature =
      :hmac
      |> :crypto.mac(:sha256, secret, "#{timestamp}.#{body}")
      |> Base.encode16(case: :lower)

    "t=#{timestamp},v1=#{signature}"
  end

  defp provider(attrs) do
    struct(
      %Provider{provider: "manual", display_name: "Test", mode: "test"},
      attrs
    )
  end

  describe "JazzCash secure hash" do
    setup do
      %{provider: provider(%{provider: "jazzcash", credentials: %{"integrity_salt" => "SALT123"}})}
    end

    test "sorts by key and joins the values with the salt in front", ctx do
      fields = %{"pp_Amount" => "10000", "pp_MerchantID" => "M1", "pp_TxnRefNo" => "T1"}

      expected =
        :hmac
        |> :crypto.mac(:sha256, "SALT123", "SALT123&10000&M1&T1")
        |> Base.encode16(case: :upper)

      assert JazzCash.secure_hash(ctx.provider, fields) == expected
    end

    test "the order the fields were written in makes no difference", ctx do
      one = %{"pp_Amount" => "10000", "pp_MerchantID" => "M1", "pp_TxnRefNo" => "T1"}
      other = %{"pp_TxnRefNo" => "T1", "pp_Amount" => "10000", "pp_MerchantID" => "M1"}

      assert JazzCash.secure_hash(ctx.provider, one) ==
               JazzCash.secure_hash(ctx.provider, other)
    end

    test "empty values are left out, because JazzCash leaves them out", ctx do
      with_blank = %{"pp_Amount" => "10000", "pp_MobileNumber" => "", "pp_TxnRefNo" => "T1"}
      without = %{"pp_Amount" => "10000", "pp_TxnRefNo" => "T1"}

      assert JazzCash.secure_hash(ctx.provider, with_blank) ==
               JazzCash.secure_hash(ctx.provider, without)
    end

    test "the hash field itself is never part of what is hashed", ctx do
      fields = %{"pp_Amount" => "10000", "pp_TxnRefNo" => "T1"}
      with_hash = Map.put(fields, "pp_SecureHash", "PREVIOUS")

      assert JazzCash.secure_hash(ctx.provider, with_hash) ==
               JazzCash.secure_hash(ctx.provider, fields)
    end

    test "a different salt gives a different hash", ctx do
      fields = %{"pp_Amount" => "10000"}
      other = provider(%{provider: "jazzcash", credentials: %{"integrity_salt" => "OTHER"}})

      refute JazzCash.secure_hash(ctx.provider, fields) == JazzCash.secure_hash(other, fields)
    end

    test "rupees become integer paisa" do
      assert JazzCash.to_paisa(Decimal.new("100.00")) == "10000"
      assert JazzCash.to_paisa(Decimal.new("1250.50")) == "125050"
      assert JazzCash.to_paisa(Decimal.new("0.01")) == "1"
    end
  end

  describe "JazzCash webhook verification" do
    setup do
      %{provider: provider(%{provider: "jazzcash", credentials: %{"integrity_salt" => "SALT123"}})}
    end

    test "accepts a payload whose hash recomputes", ctx do
      payload = %{"pp_TxnRefNo" => "T1", "pp_ResponseCode" => "000"}
      signed = Map.put(payload, "pp_SecureHash", JazzCash.secure_hash(ctx.provider, payload))

      assert {:ok, verified} = JazzCash.verify_webhook(ctx.provider, Jason.encode!(signed), %{})
      assert verified["pp_TxnRefNo"] == "T1"
    end

    test "refuses a payload somebody tampered with", ctx do
      payload = %{"pp_TxnRefNo" => "T1", "pp_ResponseCode" => "999"}
      signed = Map.put(payload, "pp_SecureHash", JazzCash.secure_hash(ctx.provider, payload))

      # The classic forgery: keep the signature, change the outcome to success.
      tampered = Map.put(signed, "pp_ResponseCode", "000")

      assert {:error, :signature_invalid} =
               JazzCash.verify_webhook(ctx.provider, Jason.encode!(tampered), %{})
    end

    test "refuses a payload with no signature at all", ctx do
      body = Jason.encode!(%{"pp_TxnRefNo" => "T1"})
      assert {:error, :signature_missing} = JazzCash.verify_webhook(ctx.provider, body, %{})
    end
  end

  describe "Stripe webhook verification" do
    setup do
      %{provider: provider(%{provider: "stripe", webhook_secret: %{"value" => "whsec_test"}})}
    end

    test "accepts a correctly signed body", ctx do
      body = Jason.encode!(%{"id" => "evt_1", "type" => "payment_intent.succeeded"})
      now = System.system_time(:second)

      headers = %{"stripe-signature" => stripe_header("whsec_test", body, now)}

      assert {:ok, event} = Stripe.verify_webhook(ctx.provider, body, headers)
      assert event["id"] == "evt_1"
    end

    test "refuses a body that was changed after signing", ctx do
      body = Jason.encode!(%{"id" => "evt_1", "type" => "payment_intent.payment_failed"})
      now = System.system_time(:second)
      headers = %{"stripe-signature" => stripe_header("whsec_test", body, now)}

      changed = Jason.encode!(%{"id" => "evt_1", "type" => "payment_intent.succeeded"})

      assert {:error, :signature_invalid} = Stripe.verify_webhook(ctx.provider, changed, headers)
    end

    test "refuses a signature made with the wrong secret", ctx do
      body = Jason.encode!(%{"id" => "evt_1"})
      now = System.system_time(:second)
      headers = %{"stripe-signature" => stripe_header("whsec_wrong", body, now)}

      assert {:error, :signature_invalid} = Stripe.verify_webhook(ctx.provider, body, headers)
    end

    test "refuses a valid signature replayed later", ctx do
      body = Jason.encode!(%{"id" => "evt_1"})
      # Signed an hour ago: the signature is genuine, and it is still a stranger
      # telling the shop it was paid.
      stale = System.system_time(:second) - 3600
      headers = %{"stripe-signature" => stripe_header("whsec_test", body, stale)}

      assert {:error, :signature_expired} = Stripe.verify_webhook(ctx.provider, body, headers)
    end

    test "accepts one of several signatures, as during a secret rotation", ctx do
      body = Jason.encode!(%{"id" => "evt_1"})
      now = System.system_time(:second)

      good =
        :hmac
        |> :crypto.mac(:sha256, "whsec_test", "#{now}.#{body}")
        |> Base.encode16(case: :lower)

      headers = %{"stripe-signature" => "t=#{now},v1=deadbeef,v1=#{good}"}

      assert {:ok, _event} = Stripe.verify_webhook(ctx.provider, body, headers)
    end

    test "refuses when no secret is configured" do
      bare = provider(%{provider: "stripe"})
      assert {:error, :webhook_secret_missing} = Stripe.verify_webhook(bare, "{}", %{})
    end

    test "refuses a malformed signature header", ctx do
      assert {:error, :signature_malformed} =
               Stripe.verify_webhook(ctx.provider, "{}", %{"stripe-signature" => "nonsense"})
    end
  end

  describe "Stripe event parsing" do
    test "maps the events a POS cares about" do
      assert {:ok, %{result: %{status: :captured}}} =
               Stripe.parse_event(%{
                 "id" => "evt_1",
                 "type" => "payment_intent.succeeded",
                 "data" => %{"object" => %{"id" => "pi_1", "status" => "succeeded"}}
               })

      assert {:ok, %{result: %{status: :failed}}} =
               Stripe.parse_event(%{
                 "id" => "evt_2",
                 "type" => "payment_intent.payment_failed",
                 "data" => %{"object" => %{"id" => "pi_1"}}
               })
    end

    test "says nothing for events it does not handle" do
      # Stripe sends a great deal a POS does not care about. Treating that as an
      # error would fill the retry queue with noise.
      assert {:ok, nil} =
               Stripe.parse_event(%{
                 "id" => "evt_3",
                 "type" => "customer.subscription.trial_will_end",
                 "data" => %{"object" => %{}}
               })
    end
  end

  describe "Easypaisa signature" do
    setup do
      %{provider: provider(%{provider: "easypaisa", credentials: %{"hash_key" => "KEY"}})}
    end

    test "signs a fixed field order, not a sorted one", ctx do
      fields = %{
        "amount" => "100.00",
        "orderId" => "O1",
        "storeId" => "S1",
        "mobileAccountNo" => "03001234567",
        "emailAddress" => ""
      }

      expected =
        :hmac
        |> :crypto.mac(:sha256, "KEY", "100.00&O1&S1&03001234567&")
        |> Base.encode64()

      assert Easypaisa.signature(ctx.provider, fields) == expected
    end

    test "a missing field is signed as empty rather than skipped", ctx do
      # Skipping it would shift every later field and silently produce a
      # different hash from the one Easypaisa computes.
      sparse = %{"amount" => "100.00", "orderId" => "O1", "storeId" => "S1"}

      expected =
        :hmac
        |> :crypto.mac(:sha256, "KEY", "100.00&O1&S1&&")
        |> Base.encode64()

      assert Easypaisa.signature(ctx.provider, sparse) == expected
    end

    test "rupees keep two decimal places" do
      assert Easypaisa.to_rupees(Decimal.new("100")) == "100.00"
      assert Easypaisa.to_rupees(Decimal.new("1250.5")) == "1250.50"
    end
  end
end
