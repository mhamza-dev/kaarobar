defmodule KaarobarWeb.ErrorEnvelopeTest do
  use ExUnit.Case, async: true

  import Ecto.Changeset

  alias KaarobarWeb.ErrorEnvelope

  describe "for_reason/1" do
    test "maps each known reason to the right status" do
      assert {:unauthorized, _body} = ErrorEnvelope.for_reason(:unauthorized)
      assert {:forbidden, _body} = ErrorEnvelope.for_reason(:forbidden)
      assert {:not_found, _body} = ErrorEnvelope.for_reason(:not_found)
      assert {:conflict, _body} = ErrorEnvelope.for_reason(:conflict)
      assert {:too_many_requests, _body} = ErrorEnvelope.for_reason(:rate_limited)
    end

    test "distinguishes a plan limit from a permission denial" do
      assert {:payment_required, %{error: %{code: "payment_required"}}} =
               ErrorEnvelope.for_reason(:payment_required)

      assert {:forbidden, %{error: %{code: "forbidden"}}} = ErrorEnvelope.for_reason(:forbidden)
    end

    test "a business type that has no such feature is not a billing problem" do
      assert {:forbidden, %{error: %{code: "module_disabled"}}} =
               ErrorEnvelope.for_reason(:module_disabled)
    end

    test "an unrecognised reason degrades to a readable 422" do
      assert {:unprocessable_entity, %{error: %{code: "stock_unavailable", message: message}}} =
               ErrorEnvelope.for_reason(:stock_unavailable)

      assert message == "Stock unavailable"
    end
  end

  describe "for_changeset/1" do
    test "reports per-field messages under details" do
      changeset =
        {%{}, %{email: :string, name: :string}}
        |> cast(%{}, [:email, :name])
        |> validate_required([:email, :name])

      assert {:unprocessable_entity, body} = ErrorEnvelope.for_changeset(changeset)
      assert body.error.code == "validation_failed"
      assert body.error.details.email == ["can't be blank"]
      assert body.error.details.name == ["can't be blank"]
    end

    test "interpolates validation options into the message" do
      changeset =
        {%{}, %{name: :string}}
        |> cast(%{"name" => "ab"}, [:name])
        |> validate_length(:name, min: 3)

      assert {_status, body} = ErrorEnvelope.for_changeset(changeset)
      assert body.error.details.name == ["should be at least 3 character(s)"]
    end
  end

  describe "build/3" do
    test "omits details when there are none" do
      assert ErrorEnvelope.build("nope", "Nope") == %{error: %{code: "nope", message: "Nope"}}
    end

    test "includes details when given" do
      assert %{error: %{details: %{field: ["bad"]}}} =
               ErrorEnvelope.build("nope", "Nope", %{field: ["bad"]})
    end
  end
end
