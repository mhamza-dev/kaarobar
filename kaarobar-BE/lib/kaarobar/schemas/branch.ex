defmodule Kaarobar.Schemas.Branch do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "branches" do
    field :name, :string
    field :code, :string
    field :address, :map
    field :timezone, :string, default: "Asia/Karachi"
    field :is_active, :boolean, default: true
    field :refund_auto_approve_limit, :decimal
    field :discount_auto_approve_limit, :decimal
    field :return_window_days, :integer, default: 14

    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :owner, Kaarobar.Schemas.User

    timestamps(type: :utc_datetime)
  end

  def changeset(branch, attrs) do
    branch
    |> cast(attrs, [
      :name,
      :code,
      :address,
      :timezone,
      :is_active,
      :refund_auto_approve_limit,
      :discount_auto_approve_limit,
      :return_window_days,
      :business_id,
      :owner_id
    ])
    |> validate_required([:name, :business_id, :owner_id])
    |> maybe_put_code()
    |> update_change(:code, &normalize_code/1)
    |> validate_length(:code, min: 2, max: 12)
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:owner_id)
    |> unique_constraint([:business_id, :code])
  end

  defp maybe_put_code(changeset) do
    code = get_field(changeset, :code)
    name = get_field(changeset, :name)

    cond do
      is_binary(code) and String.trim(code) != "" ->
        changeset

      is_binary(name) and name != "" ->
        put_change(changeset, :code, Kaarobar.Accounts.Codes.branch_code_from_name(name))

      true ->
        changeset
    end
  end

  defp normalize_code(nil), do: nil

  defp normalize_code(code) when is_binary(code) do
    code
    |> String.trim()
    |> String.upcase()
    |> String.replace(~r/[^A-Z0-9]/, "")
    |> case do
      "" -> nil
      cleaned -> String.slice(cleaned, 0, 12)
    end
  end
end
