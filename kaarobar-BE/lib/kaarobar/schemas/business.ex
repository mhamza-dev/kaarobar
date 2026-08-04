defmodule Kaarobar.Schemas.Business do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @industries ~w(retail restaurant salon pharmacy supermarket wholesale general)

  schema "businesses" do
    field :name, :string
    field :industry, :string
    field :tax_jurisdiction, :string, default: "PK"
    field :subscription_plan, :string, default: "trial"
    field :fbr_tier1, :boolean, default: false
    field :is_active, :boolean, default: true
    field :loyalty_earn_per_amount, :decimal, default: Decimal.new("100")
    field :loyalty_points_per_earn, :integer, default: 1
    field :loyalty_redeem_value, :decimal, default: Decimal.new("1.00")
    field :portal_self_register, :boolean, default: false
    field :portal_invite_from_sale, :boolean, default: true
    field :marketplace_enabled, :boolean, default: false
    field :marketplace_slug, :string
    field :messaging_wallet_balance, :decimal, default: Decimal.new("0")
    field :tagline, :string
    field :logo_key, :string
    field :primary_color, :string
    field :marketplace_description, :string
    field :appointments_enabled, :boolean, default: false

    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :online_branch, Kaarobar.Schemas.Branch
    has_many :branches, Kaarobar.Schemas.Branch
    has_many :products, Kaarobar.Schemas.Product
    has_many :chart_of_accounts, Kaarobar.Schemas.ChartOfAccount
    has_many :product_categories, Kaarobar.Schemas.ProductCategory

    timestamps(type: :utc_datetime)
  end

  def industries, do: @industries

  def changeset(business, attrs) do
    business
    |> cast(attrs, [
      :name,
      :industry,
      :tax_jurisdiction,
      :subscription_plan,
      :fbr_tier1,
      :is_active,
      :loyalty_earn_per_amount,
      :loyalty_points_per_earn,
      :loyalty_redeem_value,
      :portal_self_register,
      :portal_invite_from_sale,
      :marketplace_enabled,
      :marketplace_slug,
      :messaging_wallet_balance,
      :tagline,
      :logo_key,
      :primary_color,
      :marketplace_description,
      :appointments_enabled,
      :online_branch_id,
      :owner_id
    ])
    |> update_change(:marketplace_slug, &blank_to_nil/1)
    |> update_change(:tagline, &blank_to_nil_text/1)
    |> update_change(:marketplace_description, &blank_to_nil_text/1)
    |> update_change(:primary_color, &normalize_color/1)
    |> validate_required([:name, :owner_id])
    |> maybe_default_appointments_enabled()
    |> maybe_validate_industry()
    |> validate_primary_color()
    |> validate_length(:tagline, max: 160)
    |> validate_length(:marketplace_description, max: 2000)
    |> validate_number(:loyalty_earn_per_amount, greater_than: 0)
    |> validate_number(:loyalty_points_per_earn, greater_than: 0)
    |> validate_number(:loyalty_redeem_value, greater_than: 0)
    |> foreign_key_constraint(:owner_id)
    |> foreign_key_constraint(:online_branch_id)
    |> unique_constraint(:marketplace_slug, name: :businesses_marketplace_slug_uidx)
  end

  defp blank_to_nil(nil), do: nil
  defp blank_to_nil(""), do: nil

  defp blank_to_nil(v) when is_binary(v) do
    s = String.trim(v)
    if s == "", do: nil, else: String.downcase(s)
  end

  defp blank_to_nil(v), do: v

  defp blank_to_nil_text(nil), do: nil
  defp blank_to_nil_text(""), do: nil

  defp blank_to_nil_text(v) when is_binary(v) do
    s = String.trim(v)
    if s == "", do: nil, else: s
  end

  defp blank_to_nil_text(v), do: v

  defp normalize_color(nil), do: nil
  defp normalize_color(""), do: nil

  defp normalize_color(v) when is_binary(v) do
    s = String.trim(v)
    if s == "", do: nil, else: String.upcase(s)
  end

  defp normalize_color(v), do: v

  defp validate_primary_color(changeset) do
    case get_change(changeset, :primary_color) || get_field(changeset, :primary_color) do
      nil ->
        changeset

      color when is_binary(color) ->
        if Regex.match?(~r/^#([0-9A-F]{3}|[0-9A-F]{6})$/i, color) do
          changeset
        else
          add_error(changeset, :primary_color, "must be a hex color like #RGB or #RRGGBB")
        end

      _ ->
        add_error(changeset, :primary_color, "must be a hex color like #RGB or #RRGGBB")
    end
  end

  defp maybe_validate_industry(changeset) do
    case get_field(changeset, :industry) do
      nil -> changeset
      "" -> put_change(changeset, :industry, nil)
      _ -> validate_inclusion(changeset, :industry, @industries)
    end
  end

  defp maybe_default_appointments_enabled(changeset) do
    industry = get_field(changeset, :industry)
    explicit? = not is_nil(get_change(changeset, :appointments_enabled))

    cond do
      explicit? ->
        changeset

      industry in ~w(salon) and get_field(changeset, :appointments_enabled) != true ->
        put_change(changeset, :appointments_enabled, true)

      true ->
        changeset
    end
  end
end
