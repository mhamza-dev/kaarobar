defmodule Kaarobar.Loyalty do
  @moduledoc """
  Per-business loyalty earn/redeem helpers and named tiers (CRM-FR-007).
  """

  import Ecto.Query

  alias Kaarobar.Schemas.{Business, Customer, LoyaltyTier}
  alias Kaarobar.Repo
  alias Kaarobar.Audit

  def rates(%Business{} = b), do: rates(b, nil)

  def rates(business_id) when is_binary(business_id) do
    case Repo.get(Business, business_id) do
      nil ->
        %{
          earn_per_amount: Decimal.new("100"),
          points_per_earn: 1,
          redeem_value: Decimal.new("1.00")
        }

      b ->
        rates(b, nil)
    end
  end

  def rates(%Business{} = b, customer) do
    base = %{
      earn_per_amount: to_dec(b.loyalty_earn_per_amount || "100"),
      points_per_earn: b.loyalty_points_per_earn || 1,
      redeem_value: to_dec(b.loyalty_redeem_value || "1.00")
    }

    case tier_for(customer, b.id) do
      nil ->
        base

      tier ->
        %{
          base
          | points_per_earn: max(round(base.points_per_earn * to_float(tier.earn_rate)), 1),
            redeem_value:
              Decimal.mult(base.redeem_value, to_dec(tier.redeem_rate)) |> Decimal.round(4)
        }
    end
  end

  def list_tiers(business_id, owner_id) do
    from(t in LoyaltyTier,
      where: t.business_id == ^business_id and t.owner_id == ^owner_id,
      order_by: [asc: t.min_points]
    )
    |> Repo.all()
  end

  def get_tier(id, business_id, owner_id) do
    Repo.get_by(LoyaltyTier, id: id, business_id: business_id, owner_id: owner_id)
  end

  def create_tier(business_id, owner_id, attrs) do
    %LoyaltyTier{}
    |> LoyaltyTier.changeset(
      Map.merge(stringify_keys(attrs), %{
        "business_id" => business_id,
        "owner_id" => owner_id
      })
    )
    |> Repo.insert()
  end

  def update_tier(id, business_id, owner_id, attrs) do
    case get_tier(id, business_id, owner_id) do
      nil -> {:error, :not_found}
      tier -> tier |> LoyaltyTier.changeset(stringify_keys(attrs)) |> Repo.update()
    end
  end

  def delete_tier(id, business_id, owner_id) do
    case get_tier(id, business_id, owner_id) do
      nil -> {:error, :not_found}
      tier -> Repo.delete(tier)
    end
  end

  def earn_points(%Business{} = business, %Decimal{} = sale_total),
    do: earn_points(business, sale_total, nil)

  def earn_points(%Business{} = business, %Decimal{} = sale_total, customer) do
    r = rates(business, customer)

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

  def redeem_discount(points, %Business{} = business)
      when is_integer(points) and points > 0 do
    redeem_discount(points, business, nil)
  end

  def redeem_discount(_, %Business{}), do: Decimal.new("0.00")

  def redeem_discount(points, %Business{} = business, customer)
      when is_integer(points) and points > 0 do
    r = rates(business, customer)
    Decimal.mult(Decimal.new(points), r.redeem_value) |> Decimal.round(2)
  end

  def redeem_discount(_, _, _), do: Decimal.new("0.00")

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
            updated = maybe_recompute_tier(updated, business_id, owner_id)

            Audit.log(%{
              owner_id: owner_id,
              user_id: actor_id,
              action: "customer.loyalty_adjust",
              entity_type: "customer",
              entity_id: customer.id,
              metadata: %{
                delta: delta,
                reason: reason,
                points: updated.loyalty_points,
                loyalty_tier_id: updated.loyalty_tier_id
              }
            })

            {:ok, updated}

          error ->
            error
        end
    end
  end

  def maybe_recompute_tier(%Customer{} = customer, business_id, owner_id) do
    tier =
      from(t in LoyaltyTier,
        where: t.business_id == ^business_id and t.owner_id == ^owner_id,
        where: t.min_points <= ^(customer.loyalty_points || 0),
        order_by: [desc: t.min_points],
        limit: 1
      )
      |> Repo.one()

    tier_id = tier && tier.id

    if customer.loyalty_tier_id == tier_id do
      customer
    else
      case customer
           |> Customer.changeset(%{loyalty_tier_id: tier_id})
           |> Repo.update() do
        {:ok, updated} -> updated
        _ -> customer
      end
    end
  end

  defp tier_for(nil, _), do: nil
  defp tier_for(%Customer{loyalty_tier_id: nil}, _), do: nil

  defp tier_for(%Customer{loyalty_tier_id: id}, business_id) when is_binary(id) do
    Repo.get_by(LoyaltyTier, id: id, business_id: business_id)
  end

  defp tier_for(_, _), do: nil

  defp to_float(%Decimal{} = d), do: Decimal.to_float(d)
  defp to_float(n) when is_number(n), do: n * 1.0
  defp to_float(_), do: 1.0

  defp to_dec(%Decimal{} = d), do: d
  defp to_dec(nil), do: Decimal.new(0)
  defp to_dec(v), do: Decimal.new("#{v}")

  defp stringify_keys(attrs) when is_map(attrs) do
    Map.new(attrs, fn
      {k, v} when is_atom(k) -> {Atom.to_string(k), v}
      {k, v} -> {k, v}
    end)
  end
end
