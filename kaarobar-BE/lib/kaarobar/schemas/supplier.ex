defmodule Kaarobar.Schemas.Supplier do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @statuses ~w(active inactive blocked pending)
  @payment_methods ~w(bank_transfer cash cheque wallet credit)

  schema "suppliers" do
    field :name, :string
    field :legal_name, :string
    field :code, :string
    field :tax_id, :string
    field :strn, :string
    field :website, :string
    field :industry, :string
    field :status, :string, default: "active"
    field :notes, :string
    field :is_preferred, :boolean, default: false
    field :rating, :integer

    # Legacy flexible bag (kept for extras / backward compat)
    field :contact, :map, default: %{}

    field :contact_name, :string
    field :contact_role, :string
    field :contact_email, :string
    field :contact_phone, :string
    field :contact_mobile, :string
    field :contact_whatsapp, :string
    field :contact_cnic, :string

    field :address_line1, :string
    field :address_line2, :string
    field :city, :string
    field :province, :string
    field :postal_code, :string
    field :country, :string, default: "PK"

    field :payment_terms, :string
    field :payment_method, :string
    field :bank_name, :string
    field :bank_iban, :string
    field :bank_account_title, :string
    field :credit_limit, :decimal
    field :currency, :string, default: "PKR"
    field :lead_time_days, :integer
    field :minimum_order_amount, :decimal

    field :catalogs, {:array, :string}, default: []
    field :brands, {:array, :string}, default: []
    field :tags, {:array, :string}, default: []

    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :owner, Kaarobar.Schemas.User

    timestamps(type: :utc_datetime)
  end

  def statuses, do: @statuses
  def payment_methods, do: @payment_methods

  def changeset(supplier, attrs) do
    supplier
    |> cast(attrs, castable_fields())
    |> update_change(:code, &normalize_code/1)
    |> update_change(:catalogs, &normalize_string_list/1)
    |> update_change(:brands, &normalize_string_list/1)
    |> update_change(:tags, &normalize_string_list/1)
    |> validate_required([:name, :business_id, :owner_id])
    |> validate_length(:name, min: 2, max: 160)
    |> validate_length(:legal_name, max: 200)
    |> validate_length(:code, max: 40)
    |> validate_inclusion(:status, @statuses)
    |> validate_number(:rating, greater_than_or_equal_to: 1, less_than_or_equal_to: 5)
    |> validate_number(:lead_time_days, greater_than_or_equal_to: 0)
    |> validate_number(:credit_limit, greater_than_or_equal_to: 0)
    |> validate_number(:minimum_order_amount, greater_than_or_equal_to: 0)
    |> validate_optional_email(:contact_email)
    |> validate_optional_inclusion(:payment_method, @payment_methods)
    |> unique_constraint([:business_id, :code], name: :suppliers_business_code_unique)
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:owner_id)
    |> maybe_clear_blank_payment_method()
  end

  defp validate_optional_email(changeset, field) do
    case get_field(changeset, field) do
      nil -> changeset
      "" -> put_change(changeset, field, nil)
      email ->
        if Regex.match?(~r/^[^\s]+@[^\s]+$/, email) do
          changeset
        else
          add_error(changeset, field, "must be a valid email")
        end
    end
  end

  defp validate_optional_inclusion(changeset, field, values) do
    case get_field(changeset, field) do
      nil -> changeset
      "" -> put_change(changeset, field, nil)
      value ->
        if value in values do
          changeset
        else
          add_error(changeset, field, "is invalid")
        end
    end
  end

  defp castable_fields do
    [
      :name,
      :legal_name,
      :code,
      :tax_id,
      :strn,
      :website,
      :industry,
      :status,
      :notes,
      :is_preferred,
      :rating,
      :contact,
      :contact_name,
      :contact_role,
      :contact_email,
      :contact_phone,
      :contact_mobile,
      :contact_whatsapp,
      :contact_cnic,
      :address_line1,
      :address_line2,
      :city,
      :province,
      :postal_code,
      :country,
      :payment_terms,
      :payment_method,
      :bank_name,
      :bank_iban,
      :bank_account_title,
      :credit_limit,
      :currency,
      :lead_time_days,
      :minimum_order_amount,
      :catalogs,
      :brands,
      :tags,
      :business_id,
      :owner_id
    ]
  end

  defp normalize_code(nil), do: nil
  defp normalize_code(""), do: nil

  defp normalize_code(code) when is_binary(code) do
    code |> String.trim() |> String.upcase() |> then(fn c -> if c == "", do: nil, else: c end)
  end

  defp normalize_code(other), do: other

  defp normalize_string_list(nil), do: []

  defp normalize_string_list(list) when is_list(list) do
    list
    |> Enum.map(fn
      v when is_binary(v) -> String.trim(v)
      v -> to_string(v) |> String.trim()
    end)
    |> Enum.reject(&(&1 == ""))
    |> Enum.uniq()
  end

  defp normalize_string_list(csv) when is_binary(csv) do
    csv
    |> String.split([",", ";", "\n"], trim: true)
    |> normalize_string_list()
  end

  defp normalize_string_list(_), do: []

  defp maybe_clear_blank_payment_method(changeset) do
    case get_change(changeset, :payment_method) do
      "" -> put_change(changeset, :payment_method, nil)
      _ -> changeset
    end
  end
end
