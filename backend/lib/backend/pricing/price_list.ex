defmodule Kaarobar.Pricing.PriceList do
  @moduledoc """
  The same item at a different price for a different audience.

  The variant's own `price` is the shelf price and always exists; a price list
  overrides it for a reason the shop can name — a branch in a costlier part of
  town, a trade customer, an online channel, next month's prices loaded early
  and effective-dated to take over on their own.

  Lists are ordered by `priority` and the **first match wins**. Deliberately not
  cumulative: a trade customer buying at a branch during a promotion should get
  one price they can be told the reason for, not three overlapping discounts
  multiplied together and discovered at month end.
  """

  use Kaarobar.Schema

  alias Kaarobar.Pricing.PriceListItem
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @kinds ~w(base branch customer_group channel promotion custom)
  @channels ~w(pos online phone wholesale)

  schema "price_lists" do
    field :name, :string
    field :code, :string
    field :currency, :string
    field :kind, :string, default: "custom"
    field :channel, :string
    field :priority, :integer, default: 100
    field :starts_at, :utc_datetime_usec
    field :ends_at, :utc_datetime_usec
    field :is_active, :boolean, default: true
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch

    has_many :items, PriceListItem

    timestamps()
  end

  @doc "The kinds of price list."
  def kinds, do: @kinds

  @doc "The sales channels a list may be restricted to."
  def channels, do: @channels

  def changeset(price_list, attrs) do
    price_list
    |> cast(attrs, [
      :name,
      :code,
      :currency,
      :kind,
      :branch_id,
      :channel,
      :priority,
      :starts_at,
      :ends_at,
      :is_active
    ])
    |> validate_required([:name, :currency, :kind])
    |> update_change(:name, &String.trim/1)
    |> validate_length(:name, min: 1, max: 120)
    |> validate_inclusion(:kind, @kinds)
    |> validate_inclusion(:channel, @channels)
    |> validate_format(:currency, ~r/^[A-Z]{3}$/,
      message: "must be a three-letter ISO 4217 code"
    )
    |> validate_number(:priority, greater_than_or_equal_to: 0)
    |> validate_window()
    |> foreign_key_constraint(:branch_id)
    |> unique_constraint([:business_id, :code],
      name: :price_lists_business_id_code_index,
      message: "is already used by another price list"
    )
  end

  @doc "Soft-deletes the list."
  def soft_delete_changeset(price_list),
    do: change(price_list, deleted_at: DateTime.utc_now())

  @doc """
  True when the list applies right now, at this branch, on this channel.

  Evaluated in Elixir rather than SQL because it is called once per line
  against a handful of already-loaded lists, and the window comparison is
  clearer read as code than as three `OR IS NULL` clauses.
  """
  @spec applies?(t(), keyword()) :: boolean()
  def applies?(%__MODULE__{} = list, opts \\ []) do
    at = Keyword.get(opts, :at, DateTime.utc_now())
    branch_id = Keyword.get(opts, :branch_id)
    channel = Keyword.get(opts, :channel)

    active?(list) and within_window?(list, at) and matches_branch?(list, branch_id) and
      matches_channel?(list, channel)
  end

  defp active?(%__MODULE__{is_active: true, deleted_at: nil}), do: true
  defp active?(%__MODULE__{}), do: false

  defp within_window?(%__MODULE__{starts_at: starts_at, ends_at: ends_at}, at) do
    after_start? = is_nil(starts_at) or DateTime.compare(at, starts_at) != :lt
    before_end? = is_nil(ends_at) or DateTime.compare(at, ends_at) == :lt

    after_start? and before_end?
  end

  # A list with no branch applies everywhere.
  defp matches_branch?(%__MODULE__{branch_id: nil}, _branch_id), do: true
  defp matches_branch?(%__MODULE__{branch_id: branch_id}, branch_id), do: true
  defp matches_branch?(%__MODULE__{}, _branch_id), do: false

  # A list with no channel applies to all of them.
  defp matches_channel?(%__MODULE__{channel: nil}, _channel), do: true
  defp matches_channel?(%__MODULE__{channel: channel}, channel), do: true
  defp matches_channel?(%__MODULE__{}, _channel), do: false

  defp validate_window(changeset) do
    starts_at = get_field(changeset, :starts_at)
    ends_at = get_field(changeset, :ends_at)

    if starts_at && ends_at && DateTime.compare(ends_at, starts_at) != :gt do
      add_error(changeset, :ends_at, "must be after the start")
    else
      changeset
    end
  end
end
