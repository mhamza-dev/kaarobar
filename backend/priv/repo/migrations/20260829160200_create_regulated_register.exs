defmodule Kaarobar.Repo.Migrations.CreateRegulatedRegister do
  use Ecto.Migration

  @moduledoc """
  The register a pesticide dealer or a pharmacy has to keep, and the licence
  numbers that have to appear on their invoices.

  ## This is a legal record, not a report

  An inspector asks who bought a restricted product, when, how much, and under
  whose licence. A shop that answers by filtering its sales list is trusting
  that nobody ever deleted a line. The register is written at the point of sale
  and is append-only, so the answer is the same one the inspector would get
  from the paper book the law expects.

  ## Enforcement lives on the product

  `requires_licence` and `is_restricted` are on the product because the rule
  belongs to the substance, not to the sale. A shop cannot forget to fill in
  the register for a restricted item, because checkout refuses the line
  without it.

  ## The batch is the whole point

  A recall names a batch. A register entry without one is a row that cannot
  answer the only question a recall asks — who has the affected stock — so for
  a batch-tracked product it is required.
  """

  def change do
    # Regulatory flags on the product itself: the rule belongs to the
    # substance, and putting it here means checkout can enforce it without
    # every caller remembering to.
    alter table(:products) do
      add :is_restricted, :boolean, null: false, default: false
      add :requires_licence, :boolean, null: false, default: false
      # What the register has to name: the active ingredient, the schedule, the
      # hazard class. Free-form because every jurisdiction words it differently.
      add :regulatory_class, :string
      add :active_ingredient, :string
      add :max_quantity_per_sale, :decimal, precision: 16, scale: 4
    end

    create index(:products, [:business_id], where: "is_restricted", name: :products_restricted_index)

    # The shop's own licence, stamped onto invoices for regulated goods.
    # `license_number` already exists from the tenancy phase; these are the two
    # things a register needs alongside it. The American spelling is kept to
    # match the existing column rather than leaving the table with both.
    alter table(:businesses) do
      add :license_authority, :string
      add :license_expires_on, :date
    end

    create table(:regulated_sales, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :restrict), null: false

      add :sale_id, references(:sales, type: :binary_id, on_delete: :restrict), null: false
      add :sale_item_id, references(:sale_items, type: :binary_id, on_delete: :restrict),
        null: false

      add :product_id, references(:products, type: :binary_id, on_delete: :restrict), null: false
      add :batch_id, references(:batches, type: :binary_id, on_delete: :restrict)

      # Snapshotted: a register entry has to keep meaning what it meant even
      # after the product is renamed or delisted.
      add :product_name_snapshot, :string, null: false
      add :regulatory_class, :string
      add :active_ingredient, :string
      add :batch_number_snapshot, :string
      add :quantity, :decimal, precision: 16, scale: 4, null: false
      add :unit_snapshot, :string

      # Who bought it. A restricted sale to an unidentified walk-in is exactly
      # what the register exists to prevent, so a name is required.
      add :customer_id, references(:customers, type: :binary_id, on_delete: :restrict)
      add :buyer_name, :string, null: false
      add :buyer_id_type, :string
      add :buyer_id_number, :string
      add :buyer_licence_number, :string
      add :buyer_address, :text

      # Under whose authority it was sold.
      add :sold_by_id, references(:users, type: :binary_id, on_delete: :restrict)
      add :sold_by_label, :string
      add :business_licence_snapshot, :string

      # For a pharmacy: who prescribed it.
      add :prescriber_name, :string
      add :prescription_reference, :string

      add :purpose, :string
      add :notes, :text
      add :occurred_at, :utc_datetime_usec, null: false

      timestamps(type: :utc_datetime_usec, updated_at: false)
    end

    create index(:regulated_sales, [:business_id, :occurred_at])
    create index(:regulated_sales, [:product_id, :occurred_at])
    create index(:regulated_sales, [:batch_id])
    create index(:regulated_sales, [:customer_id])
    create unique_index(:regulated_sales, [:sale_item_id])

    create constraint(:regulated_sales, :regulated_sales_quantity_check, check: "quantity > 0")

    # Append-only, enforced rather than trusted. A register an inspector can be
    # shown is worth nothing if the shop could have edited it last night.
    execute """
            CREATE OR REPLACE FUNCTION regulated_sales_reject_change()
            RETURNS trigger AS $$
            BEGIN
              RAISE EXCEPTION 'regulated_sales is append-only';
            END;
            $$ LANGUAGE plpgsql;
            """,
            "DROP FUNCTION IF EXISTS regulated_sales_reject_change()"

    execute """
            CREATE TRIGGER regulated_sales_no_change
            BEFORE UPDATE OR DELETE ON regulated_sales
            FOR EACH ROW EXECUTE FUNCTION regulated_sales_reject_change();
            """,
            "DROP TRIGGER IF EXISTS regulated_sales_no_change ON regulated_sales"
  end
end
