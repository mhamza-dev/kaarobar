defmodule Kaarobar.Loyalty do
  @moduledoc """
  Per-business loyalty earn/redeem helpers.
  """

  alias Kaarobar.Schemas.{Business, Customer}
  alias Kaarobar.Repo
  alias Kaarobar.Audit

  def rates(%Business{} = b) do
    %{
      earn_per_amount: to_dec(b.loyalty_earn_per_amount || "100"),
      points_per_earn: b.loyalty_points_per_earn || 1,
      redeem_value: to_dec(b.loyalty_redeem_value || "1.00")
    }
  end

  def rates(business_id) when is_binary(business_id) do
    case Repo.get(Business, business_id) do
      nil ->
        %{
          earn_per_amount: Decimal.new("100"),
          points_per_earn: 1,
          redeem_value: Decimal.new("1.00")
        }

      b ->
        rates(b)
    end
  end

  def earn_points(%Business{} = business, %Decimal{} = sale_total) do
    r = rates(business)

    if Decimal.compare(r.earn_per_amount, 0) != :gt or Decimal.compare(sale_total, 0) != :gt do
      0
    else
      units =
        sale_total
        |> Decimal.div(r.earn_per_amount)
        |> Decimal.round(0, :floor)
        |> Decimal.to_integer()

      max(units * r.points_per_earn, 0)
    end
  end

  def redeem_discount(points, %Business{} = business) when is_integer(points) and points > 0 do
    r = rates(business)
    Decimal.mult(Decimal.new(points), r.redeem_value) |> Decimal.round(2)
  end

  def redeem_discount(_, _), do: Decimal.new("0.00")

  def adjust_points(customer_id, business_id, owner_id, actor_id, delta, reason \\ nil)
      when is_integer(delta) do
    case Repo.get_by(Customer, id: customer_id, business_id: business_id, owner_id: owner_id) do
      nil ->
        {:error, :not_found}

      customer ->
        new_points = max((customer.loyalty_points || 0) + delta, 0)

        case customer
             |> Customer.changeset(%{loyalty_points: new_points})
             |> Repo.update() do
          {:ok, updated} ->
            Audit.log(%{
              owner_id: owner_id,
              user_id: actor_id,
              action: "customer.loyalty_adjust",
              entity_type: "customer",
              entity_id: customer.id,
              metadata: %{delta: delta, reason: reason, points: updated.loyalty_points}
            })

            {:ok, updated}

          error ->
            error
        end
    end
  end

  defp to_dec(%Decimal{} = d), do: d
  defp to_dec(nil), do: Decimal.new(0)
  defp to_dec(v), do: Decimal.new("#{v}")
end
