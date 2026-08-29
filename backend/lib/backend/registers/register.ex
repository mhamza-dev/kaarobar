defmodule Kaarobar.Registers.Register do
  @moduledoc """
  A till.

  `invoice_prefix` gives a terminal its own invoice series, which many fiscal
  regimes require: two tills issuing from one series have to coordinate on
  every sale, and a shop with three counters would spend its busiest hour
  waiting on a lock.
  """

  use Kaarobar.Schema

  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  schema "registers" do
    field :name, :string
    field :code, :string
    field :invoice_prefix, :string
    field :receipt_settings, :map, default: %{}
    field :settings, :map, default: %{}
    field :is_active, :boolean, default: true
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch

    timestamps()
  end

  def changeset(register, attrs) do
    register
    |> cast(attrs, [
      :branch_id,
      :name,
      :code,
      :invoice_prefix,
      :receipt_settings,
      :settings,
      :is_active
    ])
    |> validate_required([:branch_id, :name])
    |> update_change(:name, &String.trim/1)
    |> validate_length(:name, min: 1, max: 80)
    |> validate_length(:code, max: 24)
    |> normalize_prefix()
    |> validate_format(:invoice_prefix, ~r/^[A-Z0-9-]+$/,
      message: "may only contain uppercase letters, numbers and hyphens"
    )
    |> validate_length(:invoice_prefix, max: 12)
    |> unique_constraint(:name,
      name: :registers_branch_id_name_index,
      message: "is already used by another register at this branch"
    )
    |> unique_constraint(:code,
      name: :registers_business_id_code_index,
      message: "is already used by another register"
    )
    |> unique_constraint(:invoice_prefix,
      name: :registers_business_id_invoice_prefix_index,
      message: "is already issuing invoices for another register"
    )
    |> foreign_key_constraint(:branch_id)
  end

  @doc "Soft-deletes the register."
  def soft_delete_changeset(register), do: change(register, deleted_at: DateTime.utc_now())

  @doc "True when the register may be opened."
  def active?(%__MODULE__{deleted_at: nil, is_active: true}), do: true
  def active?(%__MODULE__{}), do: false

  @doc "The invoice series this register issues into, falling back to the default."
  @spec invoice_series(t()) :: String.t()
  def invoice_series(%__MODULE__{invoice_prefix: prefix}) when is_binary(prefix) and prefix != "",
    do: prefix

  def invoice_series(%__MODULE__{}), do: "INV"

  defp normalize_prefix(changeset) do
    update_change(changeset, :invoice_prefix, fn
      nil -> nil
      value -> if String.trim(value) == "", do: nil, else: value |> String.trim() |> String.upcase()
    end)
  end
end
