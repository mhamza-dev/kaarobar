defmodule Kaarobar.Repo.Migrations.CreateCustomerCrm do
  use Ecto.Migration

  @moduledoc """
  The rest of the customer record: who they are, how to reach them, what was
  agreed with them, and what someone promised to do next.

  ## Groups are how a shop sells at two prices

  Almost every business in the brief has a second price for someone: trade
  buyers at an agri-chemical depot, salon regulars on a package, a restaurant's
  staff meal. Modelling that as a discount typed at the till loses the reason
  and lets any cashier grant it. A group carries the price list, the standing
  discount, the credit terms and the limit, so "wholesale" is a decision made
  once by the owner rather than a judgement made hourly at the counter.

  `payment_terms_days` on the group and the customer is what makes an ageing
  report mean anything: an invoice is not overdue because it is thirty days
  old, it is overdue because it is older than what was agreed with *that*
  customer. The supplier side has worked this way since the purchasing phase;
  this is the mirror of it.

  ## Notes and follow-ups are separate

  A note is what happened. A follow-up is what has to happen, and it has an
  owner and a date — which is the whole difference between a CRM and a diary.
  """

  def change do
    # ------------------------------------------------------------------ groups
    create table(:customer_groups, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :name, :string, null: false
      add :code, :string
      add :description, :text

      # The group's own pricing. Null means the shop's ordinary prices.
      add :price_list_id, references(:price_lists, type: :binary_id, on_delete: :nilify_all)
      # A standing percentage off, for groups that do not warrant a whole list.
      add :discount_percent, :decimal, precision: 9, scale: 6

      # Defaults inherited by members who set none of their own.
      add :payment_terms_days, :integer, null: false, default: 0
      add :credit_limit, :decimal, precision: 16, scale: 4
      add :credit_allowed, :boolean, null: false, default: false

      # Points multiplier for the loyalty programme — a trade group might earn
      # nothing, a members' group double.
      add :loyalty_multiplier, :decimal, precision: 9, scale: 4, null: false, default: 1

      add :is_default, :boolean, null: false, default: false
      add :is_active, :boolean, null: false, default: true
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:customer_groups, [:business_id, :name], where: "deleted_at IS NULL")

    create unique_index(:customer_groups, [:business_id, :code],
             where: "code IS NOT NULL AND deleted_at IS NULL"
           )

    # One group new customers land in, at most.
    create unique_index(:customer_groups, [:business_id],
             where: "is_default AND deleted_at IS NULL",
             name: :customer_groups_single_default_index
           )

    create constraint(:customer_groups, :customer_groups_discount_check,
             check: "discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 1)"
           )

    create constraint(:customer_groups, :customer_groups_terms_check,
             check: "payment_terms_days >= 0"
           )

    # -------------------------------------------------- customers, extended
    alter table(:customers) do
      add :customer_group_id,
          references(:customer_groups, type: :binary_id, on_delete: :nilify_all)

      # Null means "whatever the group says". Set here, it overrides the group,
      # because a shop always ends up with one customer on different terms.
      add :payment_terms_days, :integer
      add :is_tax_exempt, :boolean, null: false, default: false
      add :tags, {:array, :string}, null: false, default: []
    end

    create index(:customers, [:customer_group_id])

    create constraint(:customers, :customers_terms_check,
             check: "payment_terms_days IS NULL OR payment_terms_days >= 0"
           )

    # --------------------------------------------------------------- addresses
    create table(:customer_addresses, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :customer_id, references(:customers, type: :binary_id, on_delete: :delete_all),
        null: false

      # What the customer calls it: "home", "shop", "farm gate".
      add :label, :string
      add :kind, :string, null: false, default: "both"

      add :line1, :string, null: false
      add :line2, :string
      add :city, :string
      add :state, :string
      add :postal_code, :string
      add :country_code, :string, size: 2

      add :latitude, :decimal, precision: 10, scale: 7
      add :longitude, :decimal, precision: 10, scale: 7
      # Directions a rider needs that an address line cannot hold.
      add :delivery_notes, :text

      add :is_default, :boolean, null: false, default: false

      timestamps(type: :utc_datetime_usec)
    end

    create index(:customer_addresses, [:customer_id])

    create unique_index(:customer_addresses, [:customer_id],
             where: "is_default",
             name: :customer_addresses_single_default_index
           )

    create constraint(:customer_addresses, :customer_addresses_kind_check,
             check: "kind IN ('billing','shipping','both')"
           )

    # ---------------------------------------------------------------- contacts
    create table(:customer_contacts, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :customer_id, references(:customers, type: :binary_id, on_delete: :delete_all),
        null: false

      add :name, :string, null: false
      # Who to ring about what: the buyer, or the person who pays the bills.
      add :role, :string
      add :phone, :string
      add :email, :string
      add :notes, :text

      add :is_primary, :boolean, null: false, default: false

      timestamps(type: :utc_datetime_usec)
    end

    create index(:customer_contacts, [:customer_id])

    create unique_index(:customer_contacts, [:customer_id],
             where: "is_primary",
             name: :customer_contacts_single_primary_index
           )

    # ------------------------------------------------------------------- notes
    create table(:customer_notes, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :customer_id, references(:customers, type: :binary_id, on_delete: :delete_all),
        null: false

      add :body, :text, null: false
      # Pinned notes show at the till — an allergy, a dispute, "cash only".
      add :is_pinned, :boolean, null: false, default: false

      add :author_user_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :author_label, :string

      timestamps(type: :utc_datetime_usec)
    end

    create index(:customer_notes, [:customer_id, :inserted_at])
    create index(:customer_notes, [:business_id], where: "is_pinned")

    # -------------------------------------------------------------- follow-ups
    create table(:customer_follow_ups, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :customer_id, references(:customers, type: :binary_id, on_delete: :delete_all),
        null: false

      add :title, :string, null: false
      add :body, :text
      add :kind, :string, null: false, default: "task"
      add :status, :string, null: false, default: "open"

      add :due_on, :date, null: false
      # An unassigned follow-up is one nobody has agreed to do.
      add :assigned_to_id, references(:users, type: :binary_id, on_delete: :nilify_all)

      add :completed_at, :utc_datetime_usec
      add :completed_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :outcome, :text

      add :created_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)

      timestamps(type: :utc_datetime_usec)
    end

    create index(:customer_follow_ups, [:customer_id])
    # The query a morning starts with: what is due, for me, still open.
    create index(:customer_follow_ups, [:business_id, :status, :due_on])
    create index(:customer_follow_ups, [:assigned_to_id, :status, :due_on])

    create constraint(:customer_follow_ups, :customer_follow_ups_kind_check,
             check: "kind IN ('task','call','visit','payment_chase','delivery','other')"
           )

    create constraint(:customer_follow_ups, :customer_follow_ups_status_check,
             check: "status IN ('open','done','cancelled')"
           )

    create constraint(:customer_follow_ups, :customer_follow_ups_done_check,
             check: "status <> 'done' OR completed_at IS NOT NULL"
           )
  end
end
