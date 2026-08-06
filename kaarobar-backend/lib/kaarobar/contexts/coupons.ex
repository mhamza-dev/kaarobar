defmodule Kaarobar.Coupons do
  @moduledoc """
  Promo coupons and POS redemption (CRM-FR-005/014, POS-FR-019).
  """

  import Ecto.Query

  alias Kaarobar.Repo
  alias Kaarobar.Schemas.{Coupon, CouponRedemption}

  def list(business_id, owner_id) do
    from(c in Coupon,
      where: c.business_id == ^business_id and c.owner_id == ^owner_id,
      order_by: [desc: c.inserted_at]
    )
    |> Repo.all()
  end

  def get(id, business_id, owner_id) do
    Repo.get_by(Coupon, id: id, business_id: business_id, owner_id: owner_id)
  end

  def get_by_code(code, business_id, owner_id) when is_binary(code) do
    code = code |> String.trim() |> String.upcase()
    Repo.get_by(Coupon, code: code, business_id: business_id, owner_id: owner_id)
  end

  def create(business_id, owner_id, attrs) do
    %Coupon{}
    |> Coupon.changeset(
      Map.merge(stringify_keys(attrs), %{
        "business_id" => business_id,
        "owner_id" => owner_id
      })
    )
    |> Repo.insert()
  end

  def update(id, business_id, owner_id, attrs) do
    case get(id, business_id, owner_id) do
      nil -> {:error, :not_found}
      coupon -> coupon |> Coupon.changeset(stringify_keys(attrs)) |> Repo.update()
    end
  end

  @doc """
  Validate coupon and return discount amount for a cart total.
  Returns `{:ok, coupon, discount}` or `{:error, reason}`.
  """
  def validate_and_quote(code, business_id, owner_id, cart_total, opts \\ []) do
    stackable_ok? = Keyword.get(opts, :allow_with_other_discounts, true)
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    cart = to_dec(cart_total)

    with %Coupon{} = coupon <- get_by_code(code, business_id, owner_id) || {:error, :not_found},
         :ok <- active?(coupon),
         :ok <- within_window?(coupon, now),
         :ok <- usage_ok?(coupon),
         :ok <- min_cart_ok?(coupon, cart),
         :ok <- stackable_ok?(coupon, stackable_ok?) do
      discount = compute_discount(coupon, cart)
      {:ok, coupon, discount}
    else
      {:error, reason} -> {:error, reason}
      nil -> {:error, :not_found}
    end
  end

  def record_redemption(coupon, sale_id, customer_id, discount_amount) do
    Repo.transaction(fn ->
      coupon =
        from(c in Coupon, where: c.id == ^coupon.id, lock: "FOR UPDATE")
        |> Repo.one!()

      case usage_ok?(coupon) do
        :ok -> :ok
        {:error, reason} -> Repo.rollback(reason)
      end

      {:ok, redemption} =
        %CouponRedemption{}
        |> CouponRedemption.changeset(%{
          coupon_id: coupon.id,
          sale_id: sale_id,
          customer_id: customer_id,
          campaign_id: coupon.campaign_id,
          discount_amount: discount_amount
        })
        |> Repo.insert()

      {:ok, _} =
        coupon
        |> Coupon.changeset(%{usage_count: (coupon.usage_count || 0) + 1})
        |> Repo.update()

      redemption
    end)
  end

  defp active?(%{active: true}), do: :ok
  defp active?(_), do: {:error, :inactive}

  defp within_window?(coupon, now) do
    from_ok =
      is_nil(coupon.valid_from) or DateTime.compare(now, coupon.valid_from) != :lt

    to_ok = is_nil(coupon.valid_to) or DateTime.compare(now, coupon.valid_to) != :gt

    if from_ok and to_ok, do: :ok, else: {:error, :outside_validity}
  end

  defp usage_ok?(%{usage_limit: nil}), do: :ok

  defp usage_ok?(%{usage_limit: limit, usage_count: count}) when is_integer(limit) do
    if (count || 0) < limit, do: :ok, else: {:error, :usage_limit_reached}
  end

  defp min_cart_ok?(%{min_cart: nil}, _), do: :ok

  defp min_cart_ok?(%{min_cart: min}, cart) do
    if Decimal.compare(cart, min) != :lt, do: :ok, else: {:error, :below_min_cart}
  end

  defp stackable_ok?(%{stackable: true}, _), do: :ok
  defp stackable_ok?(%{stackable: false}, true), do: :ok
  defp stackable_ok?(%{stackable: false}, false), do: {:error, :not_stackable}

  defp compute_discount(%{discount_type: "percent", discount_value: value}, cart) do
    cart
    |> Decimal.mult(value)
    |> Decimal.div(Decimal.new(100))
    |> Decimal.round(2)
    |> Decimal.min(cart)
  end

  defp compute_discount(%{discount_type: "fixed", discount_value: value}, cart) do
    Decimal.min(value, cart) |> Decimal.round(2)
  end

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
