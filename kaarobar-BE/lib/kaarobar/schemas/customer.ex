defmodule Kaarobar.Schemas.Customer do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "customers" do
    field :name, :string
    field :phone, :string
    field :email, :string
    field :address, :string
    field :notes, :string
    field :credit_limit, :decimal
    field :cnic, :string
    field :ntn, :string
    field :company_name, :string
    field :loyalty_points, :integer, default: 0
    field :khata_enabled, :boolean, default: false
    field :marketing_opt_in_email, :boolean, default: false
    field :marketing_opt_in_sms, :boolean, default: false
    field :marketing_opt_in_whatsapp, :boolean, default: false
    field :portal_enabled, :boolean, default: false
    field :profile_pic_key, :string

    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :user, Kaarobar.Schemas.User
    belongs_to :loyalty_tier, Kaarobar.Schemas.LoyaltyTier

    timestamps(type: :utc_datetime)
  end

  def changeset(customer, attrs) do
    customer
    |> cast(attrs, [
      :name,
      :phone,
      :email,
      :address,
      :notes,
      :credit_limit,
      :cnic,
      :ntn,
      :company_name,
      :loyalty_points,
      :khata_enabled,
      :marketing_opt_in_email,
      :marketing_opt_in_sms,
      :marketing_opt_in_whatsapp,
      :portal_enabled,
      :loyalty_tier_id,
      :business_id,
      :owner_id,
      :user_id
    ])
    |> update_change(:phone, &blank_to_nil/1)
    |> update_change(:email, &blank_to_nil/1)
    |> update_change(:address, &blank_to_nil/1)
    |> update_change(:notes, &blank_to_nil/1)
    |> update_change(:cnic, &blank_to_nil/1)
    |> update_change(:ntn, &blank_to_nil/1)
    |> update_change(:company_name, &blank_to_nil/1)
    |> validate_required([:name, :business_id, :owner_id])
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:owner_id)
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:loyalty_tier_id)
    |> unique_constraint([:business_id, :phone], name: :customers_business_id_phone_index)
  end

  defp blank_to_nil(nil), do: nil
  defp blank_to_nil(""), do: nil
  defp blank_to_nil(v) when is_binary(v), do: String.trim(v) |> then(fn s -> if s == "", do: nil, else: s end)
  defp blank_to_nil(v), do: v
end
