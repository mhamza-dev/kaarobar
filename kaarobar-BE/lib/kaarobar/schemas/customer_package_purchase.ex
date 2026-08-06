defmodule Kaarobar.Schemas.CustomerPackagePurchase do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @statuses ~w(active exhausted cancelled)

  schema "customer_package_purchases" do
    field :remaining_sessions, :integer
    field :used_sessions, :integer, default: 0
    field :status, :string, default: "active"

    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :customer, Kaarobar.Schemas.Customer
    belongs_to :package, Kaarobar.Schemas.ServicePackage
    belongs_to :sale, Kaarobar.Schemas.Sale

    timestamps(type: :utc_datetime)
  end

  def statuses, do: @statuses

  def changeset(purchase, attrs) do
    purchase
    |> cast(attrs, [
      :remaining_sessions,
      :used_sessions,
      :status,
      :owner_id,
      :business_id,
      :customer_id,
      :package_id,
      :sale_id
    ])
    |> validate_required([
      :remaining_sessions,
      :used_sessions,
      :status,
      :owner_id,
      :business_id,
      :customer_id,
      :package_id
    ])
    |> validate_inclusion(:status, @statuses)
    |> validate_number(:remaining_sessions, greater_than_or_equal_to: 0)
    |> validate_number(:used_sessions, greater_than_or_equal_to: 0)
    |> foreign_key_constraint(:owner_id)
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:customer_id)
    |> foreign_key_constraint(:package_id)
    |> foreign_key_constraint(:sale_id)
  end
end
