defmodule Kaarobar.Repo.Migrations.CreateSuppliers do
  use Ecto.Migration

  @moduledoc """
  Who the shop buys from, at what price, and what it currently owes them.

  ## supplier_products

  The same tin of paint has a different code and a different price from each
  supplier. Holding that here rather than on the variant is what makes "who is
  cheapest for this" answerable, and what lets a purchase order be raised with
  the right codes on it for the supplier to read.

  `lead_time_days` and `minimum_order_quantity` are what turn a low-stock alert
  into a useful one: reordering three units from a supplier with a fifty-unit
  minimum and a three-week lead time is not a suggestion anyone can act on.

  ## supplier_ledger_entries

  The mirror of the customer ledger: a running record of what is owed and what
  has been paid. `balance_after` is snapshotted per row for the same reason it
  is on stock moves — a statement that does not add up should show where it
  stopped adding up.
  """

  def change do
    create table(:suppliers, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :name, :string, null: false
      add :code, :string
      add :contact_name, :string
      add :phone, :string
      add :email, :string
      add :website, :string

      add :address_line1, :string
      add :address_line2, :string
      add :city, :string
      add :state, :string
      add :postal_code, :string
      add :country_code, :string, size: 2

      add :tax_number, :string
      add :currency, :string, size: 3

      # Net terms: how many days after a bill it falls due.
      add :payment_terms_days, :integer, null: false, default: 0
      add :credit_limit, :decimal, precision: 16, scale: 4

      # What the shop owes right now. A projection of the ledger, maintained in
      # the same transaction as the entries that change it.
      add :balance, :decimal, precision: 16, scale: 4, null: false, default: 0

      add :notes, :text
      add :is_active, :boolean, null: false, default: true
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create index(:suppliers, [:business_id])
    create unique_index(:suppliers, [:business_id, :code], where: "code IS NOT NULL AND deleted_at IS NULL")
    create index(:suppliers, [:business_id, :name])

    create constraint(:suppliers, :suppliers_payment_terms_check,
             check: "payment_terms_days >= 0"
           )

    # -------------------------------------------------------- supplier prices
    create table(:supplier_products, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :supplier_id, references(:suppliers, type: :binary_id, on_delete: :delete_all),
        null: false

      add :variant_id,
          references(:product_variants, type: :binary_id, on_delete: :delete_all),
          null: false

      # The supplier's own code for it, which is what goes on the order.
      add :supplier_sku, :string
      add :supplier_name, :string

      add :unit_cost, :decimal, precision: 16, scale: 4, null: false
      add :currency, :string, size: 3

      add :minimum_order_quantity, :decimal, precision: 16, scale: 4
      # How many units come in one case, so an order can be placed in cases.
      add :pack_size, :decimal, precision: 16, scale: 4
      add :lead_time_days, :integer

      # Which supplier a reorder suggestion should name.
      add :is_preferred, :boolean, null: false, default: false
      add :last_purchased_at, :utc_datetime_usec

      add :is_active, :boolean, null: false, default: true

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:supplier_products, [:supplier_id, :variant_id])
    create index(:supplier_products, [:variant_id])
    create index(:supplier_products, [:business_id])

    # One preferred supplier per variant, so a reorder has an unambiguous answer.
    create unique_index(:supplier_products, [:variant_id],
             where: "is_preferred AND is_active",
             name: :supplier_products_single_preferred_index
           )

    create constraint(:supplier_products, :supplier_products_cost_check,
             check: "unit_cost >= 0"
           )

    # ------------------------------------------------------- supplier ledger
    create table(:supplier_ledger_entries, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :supplier_id, references(:suppliers, type: :binary_id, on_delete: :restrict),
        null: false

      add :kind, :string, null: false

      # Signed: positive increases what is owed, negative reduces it.
      add :amount, :decimal, precision: 16, scale: 4, null: false
      add :balance_after, :decimal, precision: 16, scale: 4, null: false

      add :reference_type, :string
      add :reference_id, :binary_id

      add :note, :text
      add :occurred_at, :utc_datetime_usec, null: false

      add :actor_user_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      add :actor_label, :string

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create index(:supplier_ledger_entries, [:supplier_id, :occurred_at])
    create index(:supplier_ledger_entries, [:business_id, :occurred_at])
    create index(:supplier_ledger_entries, [:reference_type, :reference_id])

    create constraint(:supplier_ledger_entries, :supplier_ledger_kind_check,
             check: "kind IN ('opening','bill','payment','credit_note','adjustment')"
           )

    create constraint(:supplier_ledger_entries, :supplier_ledger_amount_check,
             check: "amount <> 0"
           )
  end
end
