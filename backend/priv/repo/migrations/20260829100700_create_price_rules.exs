defmodule Kaarobar.Repo.Migrations.CreatePriceRules do
  use Ecto.Migration

  @moduledoc """
  Promotions: happy hour, buy-one-get-one, category sales, coupon codes.

  This generalises the `happy_hour_price_rules` table in `desktop/local`, which
  handled one case — a time window on a product or category. The same shape
  covers the rest, because every promotion answers the same four questions:

    * **when** — `weekdays_mask`, `start_time`/`end_time`, `valid_from`/`valid_to`
    * **what** — `scope` and `target_id`: everything, one product, one variant,
      a category, a brand
    * **how much** — `kind` and `value`
    * **who may trigger it** — a coupon `code`, or nothing for an automatic rule

  ## Why stacking is opt-in

  `stackable` defaults to false and rules are applied in `priority` order.
  A shop running a 20% category sale and a 50-off coupon in the same week
  almost never means "70% off", and the version that silently does is
  discovered at the end of the month.

  `weekdays_mask` is a 7-bit integer, Monday as bit 0. A happy hour that runs
  Thursday to Saturday is one comparison rather than a join against a calendar.
  """

  def change do
    create table(:price_rules, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :name, :string, null: false
      add :description, :string
      # Present means the customer must quote it; absent means automatic.
      add :code, :citext

      add :kind, :string, null: false
      add :scope, :string, null: false, default: "all"
      # Which product, variant, category or brand — read according to `scope`.
      # Deliberately not a foreign key: one column cannot reference four tables,
      # and the alternative is four mostly-null columns.
      add :target_id, :binary_id

      # Percentage as a fraction for percent_off, an amount for the rest.
      add :value, :decimal, precision: 16, scale: 4

      # Buy-one-get-one and its relatives.
      add :buy_quantity, :decimal, precision: 16, scale: 4
      add :get_quantity, :decimal, precision: 16, scale: 4
      add :get_discount_percent, :decimal, precision: 7, scale: 4

      # Thresholds.
      add :min_quantity, :decimal, precision: 16, scale: 4
      add :min_subtotal, :decimal, precision: 16, scale: 4
      # Caps a percentage discount in absolute terms.
      add :max_discount_amount, :decimal, precision: 16, scale: 4

      # Monday is bit 0. 127 is every day.
      add :weekdays_mask, :integer, null: false, default: 127
      add :start_time, :time
      add :end_time, :time

      add :valid_from, :utc_datetime_usec
      add :valid_to, :utc_datetime_usec

      # Empty means every branch.
      add :branch_ids, {:array, :binary_id}, null: false, default: []
      add :channel, :string

      add :priority, :integer, null: false, default: 100
      add :stackable, :boolean, null: false, default: false

      add :usage_limit, :integer
      add :usage_limit_per_customer, :integer
      add :used_count, :integer, null: false, default: 0

      add :is_active, :boolean, null: false, default: true
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create index(:price_rules, [:business_id])
    create index(:price_rules, [:business_id, :is_active, :priority])
    create index(:price_rules, [:scope, :target_id])

    create unique_index(:price_rules, [:business_id, :code],
             where: "code IS NOT NULL AND deleted_at IS NULL"
           )

    create constraint(:price_rules, :price_rules_kind_check,
             check:
               "kind IN ('percent_off','amount_off','override_price','bogo','tiered','free_item')"
           )

    create constraint(:price_rules, :price_rules_scope_check,
             check: "scope IN ('all','product','variant','category','brand')"
           )

    # Anything but "all" has to say what it applies to.
    create constraint(:price_rules, :price_rules_target_check,
             check: "scope = 'all' OR target_id IS NOT NULL"
           )

    # The value-carrying kinds need a value; bogo carries its own fields.
    create constraint(:price_rules, :price_rules_value_check,
             check:
               "kind NOT IN ('percent_off','amount_off','override_price') OR value IS NOT NULL"
           )

    create constraint(:price_rules, :price_rules_bogo_check,
             check:
               "kind <> 'bogo' OR (buy_quantity > 0 AND get_quantity > 0)"
           )

    create constraint(:price_rules, :price_rules_weekdays_check,
             check: "weekdays_mask >= 0 AND weekdays_mask <= 127"
           )

    create constraint(:price_rules, :price_rules_time_window_check,
             check:
               "(start_time IS NULL AND end_time IS NULL) OR " <>
                 "(start_time IS NOT NULL AND end_time IS NOT NULL)"
           )

    create constraint(:price_rules, :price_rules_date_window_check,
             check: "valid_to IS NULL OR valid_from IS NULL OR valid_to > valid_from"
           )

    create constraint(:price_rules, :price_rules_used_count_check, check: "used_count >= 0")
  end
end
