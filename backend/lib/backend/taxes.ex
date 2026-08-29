defmodule Kaarobar.Taxes do
  @moduledoc """
  Tax rates, the groups products are assigned to, and the arithmetic between
  them.

  The calculation itself lives in `Kaarobar.Taxes.Calculation`; this context
  owns the records and the question every sale line asks: *which rates apply to
  this product?*

  Resolution is deliberately short. A product's own group, or the business
  default, or nothing. No inheritance from category, no fallback chain — a
  three-step lookup is one an owner can hold in their head when a figure looks
  wrong, and tax figures do get questioned.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Catalog.Product
  alias Kaarobar.Ecto.UUIDv7
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Scope
  alias Kaarobar.Taxes.Calculation
  alias Kaarobar.Taxes.Tax
  alias Kaarobar.Taxes.TaxGroup
  alias Kaarobar.Taxes.TaxGroupRate

  # ===========================================================================
  # Rates
  # ===========================================================================

  @doc "Lists the business's tax rates."
  @spec list_taxes(Scope.t()) :: [Tax.t()]
  def list_taxes(%Scope{} = scope) do
    Tax
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> order_by([tax], asc: tax.name)
    |> Repo.all()
  end

  @doc "Fetches a tax rate."
  @spec fetch_tax(Scope.t(), Ecto.UUID.t()) :: {:ok, Tax.t()} | {:error, :not_found}
  def fetch_tax(%Scope{} = scope, id) do
    if UUIDv7.valid?(id) do
      Tax
      |> Scoped.for_business(scope)
      |> Scoped.active()
      |> where([tax], tax.id == ^id)
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        tax -> {:ok, tax}
      end
    else
      {:error, :not_found}
    end
  end

  @doc "Creates a tax rate."
  @spec create_tax(Scope.t(), map()) :: {:ok, Tax.t()} | {:error, Ecto.Changeset.t()}
  def create_tax(%Scope{} = scope, attrs) do
    %Tax{
      organization_id: Scope.organization_id(scope),
      business_id: Scope.business_id(scope)
    }
    |> Tax.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates a tax rate.

  Changing a rate changes it for every future sale and no past one — historical
  sales store their tax lines, so an invoice printed last year still shows the
  rate that was charged.
  """
  @spec update_tax(Scope.t(), Tax.t(), map()) :: {:ok, Tax.t()} | {:error, Ecto.Changeset.t()}
  def update_tax(%Scope{}, %Tax{} = tax, attrs) do
    tax |> Tax.changeset(attrs) |> Repo.update()
  end

  @doc """
  Soft-deletes a tax rate.

  Refused while a group still contains it, because removing a rate out from
  under a group would silently change what every product in it is charged.
  """
  @spec delete_tax(Scope.t(), Tax.t()) :: {:ok, Tax.t()} | {:error, :conflict}
  def delete_tax(%Scope{}, %Tax{} = tax) do
    if Repo.exists?(from(rate in TaxGroupRate, where: rate.tax_id == ^tax.id)) do
      {:error, :conflict}
    else
      tax |> Tax.soft_delete_changeset() |> Repo.update()
    end
  end

  # ===========================================================================
  # Groups
  # ===========================================================================

  @doc "Lists the business's tax groups, with their rates."
  @spec list_tax_groups(Scope.t()) :: [TaxGroup.t()]
  def list_tax_groups(%Scope{} = scope) do
    TaxGroup
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> order_by([group], desc: group.is_default, asc: group.name)
    |> preload(tax_group_rates: :tax)
    |> Repo.all()
  end

  @doc "Fetches a tax group with its rates."
  @spec fetch_tax_group(Scope.t(), Ecto.UUID.t()) ::
          {:ok, TaxGroup.t()} | {:error, :not_found}
  def fetch_tax_group(%Scope{} = scope, id) do
    if UUIDv7.valid?(id) do
      TaxGroup
      |> Scoped.for_business(scope)
      |> Scoped.active()
      |> where([group], group.id == ^id)
      |> preload(tax_group_rates: :tax)
      |> Repo.one()
      |> case do
        nil -> {:error, :not_found}
        group -> {:ok, group}
      end
    else
      {:error, :not_found}
    end
  end

  @doc "The business's default tax group, if one is set."
  @spec default_tax_group(Scope.t()) :: TaxGroup.t() | nil
  def default_tax_group(%Scope{} = scope) do
    TaxGroup
    |> Scoped.for_business(scope)
    |> Scoped.active()
    |> where([group], group.is_default)
    |> preload(tax_group_rates: :tax)
    |> Repo.one()
  end

  @doc """
  Creates a tax group, optionally with its rates.

  Pass `"tax_ids"` to populate it in the same transaction — a group with no
  rates charges nothing, and creating one in two steps leaves a window where
  products assigned to it are silently untaxed.
  """
  @spec create_tax_group(Scope.t(), map()) ::
          {:ok, TaxGroup.t()} | {:error, Ecto.Changeset.t()}
  def create_tax_group(%Scope{} = scope, attrs) do
    Repo.transaction(fn ->
      case insert_tax_group(scope, attrs) do
        {:ok, group} -> group
        {:error, failed} -> Repo.rollback(failed)
      end
    end)
  end

  # The non-transactional core. Ecto has no nested transactions, so a rollback
  # from an inner one aborts whatever enclosing transaction called it — which is
  # exactly what seed_defaults/2 and the business-provisioning multi are.
  defp insert_tax_group(%Scope{} = scope, attrs) do
    attrs = stringify(attrs)

    changeset =
      %TaxGroup{
        organization_id: Scope.organization_id(scope),
        business_id: Scope.business_id(scope)
      }
      |> TaxGroup.changeset(attrs)

    case Repo.insert(changeset) do
      {:ok, group} ->
        replace_rates(group, Map.get(attrs, "tax_ids", []))
        {:ok, reload_group(group)}

      {:error, failed} ->
        {:error, failed}
    end
  end

  @doc "Updates a tax group, replacing its rates when `tax_ids` is supplied."
  @spec update_tax_group(Scope.t(), TaxGroup.t(), map()) ::
          {:ok, TaxGroup.t()} | {:error, Ecto.Changeset.t()}
  def update_tax_group(%Scope{}, %TaxGroup{} = group, attrs) do
    attrs = stringify(attrs)

    Repo.transaction(fn ->
      case group |> TaxGroup.changeset(attrs) |> Repo.update() do
        {:ok, updated} ->
          if Map.has_key?(attrs, "tax_ids") do
            replace_rates(updated, Map.get(attrs, "tax_ids", []))
          end

          reload_group(updated)

        {:error, failed} ->
          Repo.rollback(failed)
      end
    end)
  end

  @doc """
  Makes a group the business's default, demoting the previous one.

  One transaction, because the database permits only one default per business
  and doing it in two steps fails on the unique index.
  """
  @spec set_default_tax_group(Scope.t(), TaxGroup.t()) ::
          {:ok, TaxGroup.t()} | {:error, Ecto.Changeset.t()}
  def set_default_tax_group(%Scope{} = scope, %TaxGroup{} = group) do
    Repo.transaction(fn ->
      case promote_default(scope, group) do
        {:ok, promoted} -> promoted
        {:error, failed} -> Repo.rollback(failed)
      end
    end)
  end

  defp promote_default(%Scope{} = scope, %TaxGroup{} = group) do
    business_id = Scope.business_id(scope)

    from(other in TaxGroup,
      where: other.business_id == ^business_id,
      where: other.id != ^group.id,
      where: other.is_default
    )
    |> Repo.update_all(set: [is_default: false])

    case group |> TaxGroup.default_changeset(true) |> Repo.update() do
      {:ok, promoted} -> {:ok, reload_group(promoted)}
      {:error, failed} -> {:error, failed}
    end
  end

  @doc """
  Soft-deletes a tax group.

  Refused while products still point at it: those products would silently fall
  back to the default rate, which is a change to what customers are charged
  made by a delete button.
  """
  @spec delete_tax_group(Scope.t(), TaxGroup.t()) :: {:ok, TaxGroup.t()} | {:error, :conflict}
  def delete_tax_group(%Scope{}, %TaxGroup{} = group) do
    if Repo.exists?(from(p in Product, where: p.tax_group_id == ^group.id and is_nil(p.deleted_at))) do
      {:error, :conflict}
    else
      group |> TaxGroup.soft_delete_changeset() |> Repo.update()
    end
  end

  # ===========================================================================
  # Resolution and calculation
  # ===========================================================================

  @doc """
  The rates that apply to a product, in application order.

  The product's own group, or the business default, or none. Preloaded groups
  are used as they are; otherwise the default is fetched.
  """
  @spec rates_for(Scope.t(), Product.t()) :: [Tax.t()]
  def rates_for(%Scope{} = scope, %Product{} = product) do
    case product.tax_group do
      %TaxGroup{} = group -> TaxGroup.ordered_taxes(group)
      _not_loaded_or_nil -> fallback_rates(scope, product)
    end
  end

  defp fallback_rates(%Scope{} = scope, %Product{tax_group_id: nil}) do
    case default_tax_group(scope) do
      nil -> []
      group -> TaxGroup.ordered_taxes(group)
    end
  end

  defp fallback_rates(%Scope{} = scope, %Product{tax_group_id: group_id}) do
    case fetch_tax_group(scope, group_id) do
      {:ok, group} -> TaxGroup.ordered_taxes(group)
      {:error, :not_found} -> []
    end
  end

  @doc """
  Computes tax on an amount. See `Kaarobar.Taxes.Calculation` for the rules.
  """
  @spec compute(Decimal.t(), [Tax.t()], keyword()) :: Calculation.result()
  defdelegate compute(amount, taxes, opts \\ []), to: Calculation

  @doc """
  Seeds a business with a starting tax setup.

  A single group named after the rate, marked default. A new shop should be
  able to ring up a taxed sale without first designing a tax model, and a shop
  that needs more can build on it.
  """
  @spec seed_defaults(Scope.t(), keyword()) :: {:ok, TaxGroup.t()} | {:error, term()}
  def seed_defaults(%Scope{} = scope, opts \\ []) do
    name = Keyword.get(opts, :name, "Standard")
    rate = Keyword.get(opts, :rate, Decimal.new("0.00"))
    label = Keyword.get(opts, :label, "Tax")

    # No transaction of its own: this runs inside the multi that creates a
    # business, and an inner rollback would abort that rather than reporting a
    # failure the multi can handle.
    with {:ok, tax} <-
           create_tax(scope, %{
             "name" => name,
             "label" => label,
             "rate" => rate,
             "code" => "standard"
           }),
         {:ok, group} <-
           insert_tax_group(scope, %{
             "name" => name,
             "code" => "standard",
             "tax_ids" => [tax.id]
           }) do
      promote_default(scope, group)
    end
  end

  # ===========================================================================
  # Internal
  # ===========================================================================

  defp replace_rates(%TaxGroup{} = group, tax_ids) do
    Repo.delete_all(from(rate in TaxGroupRate, where: rate.tax_group_id == ^group.id))

    now = DateTime.utc_now() |> DateTime.truncate(:microsecond)

    entries =
      tax_ids
      |> List.wrap()
      |> Enum.filter(&UUIDv7.valid?/1)
      |> Enum.with_index()
      |> Enum.map(fn {tax_id, position} ->
        %{
          id: UUIDv7.generate(),
          tax_group_id: group.id,
          tax_id: tax_id,
          position: position,
          inserted_at: now
        }
      end)

    Repo.insert_all(TaxGroupRate, entries)
  end

  defp reload_group(%TaxGroup{} = group) do
    Repo.preload(group, [tax_group_rates: :tax], force: true)
  end

  defp stringify(attrs) when is_map(attrs) do
    Map.new(attrs, fn {key, value} -> {to_string(key), value} end)
  end

  defp stringify(_attrs), do: %{}
end
