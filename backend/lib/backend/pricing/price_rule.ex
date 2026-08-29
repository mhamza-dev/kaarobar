defmodule Kaarobar.Pricing.PriceRule do
  @moduledoc """
  A promotion: happy hour, buy-one-get-one, a category sale, a coupon code.

  This generalises the `happy_hour_price_rules` table in `desktop/local`, which
  handled a single case — a time window on a product or category. The same
  shape covers every promotion a shop actually runs, because they all answer
  four questions:

    * **when** — `weekdays_mask`, `start_time`/`end_time`, `valid_from`/`valid_to`
    * **what** — `scope` and `target_id`
    * **how much** — `kind` and `value`
    * **who triggers it** — a `code` the customer quotes, or nothing at all for
      an automatic rule

  ## Stacking is opt-in

  `stackable` defaults to false, and rules apply in `priority` order. A shop
  running a 20% category sale and a 50-off coupon in the same week almost never
  means 70% off, and the version that silently does is discovered at month end
  when the margin is gone.

  ## Weekdays as a bitmask

  Monday is bit 0, Sunday bit 6; 127 is every day. A promotion that runs
  Thursday to Saturday becomes one integer comparison rather than a join
  against a calendar table, which matters because this runs per line, per sale.
  """

  use Kaarobar.Schema

  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @kinds ~w(percent_off amount_off override_price bogo tiered free_item)
  @scopes ~w(all product variant category brand)
  @channels ~w(pos online phone wholesale)

  @all_weekdays 127

  schema "price_rules" do
    field :name, :string
    field :description, :string
    field :code, :string

    field :kind, :string
    field :scope, :string, default: "all"
    field :target_id, Kaarobar.Ecto.UUIDv7

    field :value, :decimal

    field :buy_quantity, :decimal
    field :get_quantity, :decimal
    field :get_discount_percent, :decimal

    field :min_quantity, :decimal
    field :min_subtotal, :decimal
    field :max_discount_amount, :decimal

    field :weekdays_mask, :integer, default: @all_weekdays
    field :start_time, :time
    field :end_time, :time

    field :valid_from, :utc_datetime_usec
    field :valid_to, :utc_datetime_usec

    field :branch_ids, {:array, Kaarobar.Ecto.UUIDv7}, default: []
    field :channel, :string

    field :priority, :integer, default: 100
    field :stackable, :boolean, default: false

    field :usage_limit, :integer
    field :usage_limit_per_customer, :integer
    field :used_count, :integer, default: 0

    field :is_active, :boolean, default: true
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business

    timestamps()
  end

  @doc "The kinds of promotion supported."
  def kinds, do: @kinds

  @doc "What a rule may target."
  def scopes, do: @scopes

  @doc "The bitmask meaning every day of the week."
  def all_weekdays, do: @all_weekdays

  def changeset(rule, attrs) do
    rule
    |> cast(attrs, [
      :name,
      :description,
      :code,
      :kind,
      :scope,
      :target_id,
      :value,
      :buy_quantity,
      :get_quantity,
      :get_discount_percent,
      :min_quantity,
      :min_subtotal,
      :max_discount_amount,
      :weekdays_mask,
      :start_time,
      :end_time,
      :valid_from,
      :valid_to,
      :branch_ids,
      :channel,
      :priority,
      :stackable,
      :usage_limit,
      :usage_limit_per_customer,
      :is_active
    ])
    |> validate_required([:name, :kind, :scope])
    |> update_change(:name, &String.trim/1)
    |> normalize_code()
    |> validate_length(:name, min: 1, max: 120)
    |> validate_length(:description, max: 300)
    |> validate_inclusion(:kind, @kinds)
    |> validate_inclusion(:scope, @scopes)
    |> validate_inclusion(:channel, @channels)
    |> validate_target()
    |> validate_kind_fields()
    |> validate_number(:weekdays_mask,
      greater_than_or_equal_to: 0,
      less_than_or_equal_to: @all_weekdays
    )
    |> validate_time_window()
    |> validate_date_window()
    |> validate_number(:priority, greater_than_or_equal_to: 0)
    |> unique_constraint([:business_id, :code],
      name: :price_rules_business_id_code_index,
      message: "is already used by another promotion"
    )
  end

  @doc "Soft-deletes the rule."
  def soft_delete_changeset(rule), do: change(rule, deleted_at: DateTime.utc_now())

  @doc """
  True when the rule is live at the given moment, branch and channel.

  Every clause here is a reason a shop would give for a promotion not applying,
  and they are checked in the cheapest-first order because this runs on every
  line of every sale.
  """
  @spec applies?(t(), keyword()) :: boolean()
  def applies?(%__MODULE__{} = rule, opts \\ []) do
    at = Keyword.get(opts, :at, DateTime.utc_now())
    branch_id = Keyword.get(opts, :branch_id)
    channel = Keyword.get(opts, :channel)

    live?(rule) and not exhausted?(rule) and within_dates?(rule, at) and
      on_weekday?(rule, at) and within_time?(rule, at) and matches_branch?(rule, branch_id) and
      matches_channel?(rule, channel)
  end

  @doc "True when the rule is switched on and not deleted."
  def live?(%__MODULE__{is_active: true, deleted_at: nil}), do: true
  def live?(%__MODULE__{}), do: false

  @doc "True when a usage-limited rule has been used up."
  def exhausted?(%__MODULE__{usage_limit: nil}), do: false

  def exhausted?(%__MODULE__{usage_limit: limit, used_count: used}), do: used >= limit

  @doc "True when the rule needs a coupon code to trigger."
  def requires_code?(%__MODULE__{code: nil}), do: false
  def requires_code?(%__MODULE__{code: ""}), do: false
  def requires_code?(%__MODULE__{}), do: true

  @doc """
  True when this rule targets the given product or variant.

  `category_ids` should include the product's whole ancestry, so a rule on
  "Beverages" also catches things filed under "Beverages / Hot".
  """
  @spec targets?(t(), keyword()) :: boolean()
  def targets?(%__MODULE__{scope: "all"}, _context), do: true

  def targets?(%__MODULE__{scope: "variant", target_id: target}, context),
    do: target == Keyword.get(context, :variant_id)

  def targets?(%__MODULE__{scope: "product", target_id: target}, context),
    do: target == Keyword.get(context, :product_id)

  def targets?(%__MODULE__{scope: "brand", target_id: target}, context),
    do: target == Keyword.get(context, :brand_id)

  def targets?(%__MODULE__{scope: "category", target_id: target}, context),
    do: target in Keyword.get(context, :category_ids, [])

  def targets?(%__MODULE__{}, _context), do: false

  @doc "The weekday bit for a date. Monday is 0."
  @spec weekday_bit(Date.t()) :: non_neg_integer()
  def weekday_bit(date), do: Date.day_of_week(date) - 1

  # --- Internal ---------------------------------------------------------------

  defp within_dates?(%__MODULE__{valid_from: from, valid_to: to}, at) do
    after_start? = is_nil(from) or DateTime.compare(at, from) != :lt
    before_end? = is_nil(to) or DateTime.compare(at, to) == :lt

    after_start? and before_end?
  end

  defp on_weekday?(%__MODULE__{weekdays_mask: @all_weekdays}, _at), do: true

  defp on_weekday?(%__MODULE__{weekdays_mask: mask}, at) do
    import Bitwise

    bit = at |> DateTime.to_date() |> weekday_bit()

    (mask >>> bit &&& 1) == 1
  end

  # A window that ends before it starts crosses midnight — a happy hour running
  # 22:00 to 02:00 is one a real bar runs, and reading it as an empty window
  # would silently switch the promotion off.
  defp within_time?(%__MODULE__{start_time: nil}, _at), do: true
  defp within_time?(%__MODULE__{end_time: nil}, _at), do: true

  defp within_time?(%__MODULE__{start_time: start_time, end_time: end_time}, at) do
    now = DateTime.to_time(at)

    if Time.compare(end_time, start_time) == :lt do
      Time.compare(now, start_time) != :lt or Time.compare(now, end_time) == :lt
    else
      Time.compare(now, start_time) != :lt and Time.compare(now, end_time) == :lt
    end
  end

  defp matches_branch?(%__MODULE__{branch_ids: []}, _branch_id), do: true
  defp matches_branch?(%__MODULE__{}, nil), do: false
  defp matches_branch?(%__MODULE__{branch_ids: ids}, branch_id), do: branch_id in ids

  defp matches_channel?(%__MODULE__{channel: nil}, _channel), do: true
  defp matches_channel?(%__MODULE__{channel: channel}, channel), do: true
  defp matches_channel?(%__MODULE__{}, _channel), do: false

  defp normalize_code(changeset) do
    update_change(changeset, :code, fn
      nil -> nil
      code -> if String.trim(code) == "", do: nil, else: code |> String.trim() |> String.upcase()
    end)
  end

  defp validate_target(changeset) do
    if get_field(changeset, :scope) != "all" and is_nil(get_field(changeset, :target_id)) do
      add_error(changeset, :target_id, "is required when the promotion targets something specific")
    else
      changeset
    end
  end

  defp validate_kind_fields(changeset) do
    case get_field(changeset, :kind) do
      "percent_off" ->
        changeset
        |> validate_required([:value])
        |> validate_number(:value,
          greater_than: 0,
          less_than_or_equal_to: 100,
          message: "must be a percentage between 0 and 100"
        )

      kind when kind in ["amount_off", "override_price"] ->
        changeset
        |> validate_required([:value])
        |> validate_number(:value, greater_than_or_equal_to: 0)

      "bogo" ->
        changeset
        |> validate_required([:buy_quantity, :get_quantity])
        |> validate_number(:buy_quantity, greater_than: 0)
        |> validate_number(:get_quantity, greater_than: 0)
        |> put_default_get_discount()

      _other ->
        changeset
    end
  end

  # A bare "buy two get one" means the free one is 100% off. Saying so
  # explicitly lets "buy two get one half price" use the same machinery.
  defp put_default_get_discount(changeset) do
    case get_field(changeset, :get_discount_percent) do
      nil -> put_change(changeset, :get_discount_percent, Decimal.new(100))
      _percent -> changeset
    end
  end

  defp validate_time_window(changeset) do
    start_time = get_field(changeset, :start_time)
    end_time = get_field(changeset, :end_time)

    cond do
      is_nil(start_time) and is_nil(end_time) -> changeset
      is_nil(end_time) -> add_error(changeset, :end_time, "is required with a start time")
      is_nil(start_time) -> add_error(changeset, :start_time, "is required with an end time")
      true -> changeset
    end
  end

  defp validate_date_window(changeset) do
    from = get_field(changeset, :valid_from)
    to = get_field(changeset, :valid_to)

    if from && to && DateTime.compare(to, from) != :gt do
      add_error(changeset, :valid_to, "must be after the start")
    else
      changeset
    end
  end
end
