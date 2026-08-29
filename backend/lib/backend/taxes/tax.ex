defmodule Kaarobar.Taxes.Tax do
  @moduledoc """
  One tax rate.

  `rate` is a fraction: 17% is `0.170000`. Six decimal places, because rates
  like 0.0825 exist and because a rate held as a float drifts by a fraction of
  a paisa on every line, which becomes a reconciliation problem long before
  anyone notices it as a rounding problem.

  `is_compound` decides whether this rate is charged on the net amount or on
  the running total including the rates before it. Both arrangements exist in
  the real world and they give different answers, so it is recorded rather than
  assumed.
  """

  use Kaarobar.Schema

  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @kinds ~w(percentage fixed)

  schema "taxes" do
    field :name, :string
    field :code, :string
    field :label, :string
    field :kind, :string, default: "percentage"
    field :rate, :decimal
    field :jurisdiction, :string
    field :is_compound, :boolean, default: false
    field :is_active, :boolean, default: true
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business

    timestamps()
  end

  @doc "The kinds of tax this supports."
  def kinds, do: @kinds

  def changeset(tax, attrs) do
    tax
    |> cast(attrs, [
      :name,
      :code,
      :label,
      :kind,
      :rate,
      :jurisdiction,
      :is_compound,
      :is_active
    ])
    |> validate_required([:name, :kind, :rate])
    |> update_change(:name, &String.trim/1)
    |> validate_length(:name, min: 1, max: 80)
    |> validate_length(:label, max: 24)
    |> validate_inclusion(:kind, @kinds)
    |> validate_number(:rate, greater_than_or_equal_to: 0)
    |> validate_percentage_bounds()
    |> unique_constraint([:business_id, :code],
      name: :taxes_business_id_code_index,
      message: "is already used by another tax"
    )
  end

  @doc "Soft-deletes the tax."
  def soft_delete_changeset(tax), do: change(tax, deleted_at: DateTime.utc_now())

  @doc "The label shown on a printed invoice, falling back to the name."
  @spec display_label(t()) :: String.t()
  def display_label(%__MODULE__{label: label}) when is_binary(label) and label != "", do: label
  def display_label(%__MODULE__{name: name}), do: name

  # A percentage over 1 is almost always someone entering 17 instead of 0.17,
  # and the resulting invoice is wrong by a factor of a hundred.
  defp validate_percentage_bounds(changeset) do
    if get_field(changeset, :kind) == "percentage" do
      validate_number(changeset, :rate,
        less_than_or_equal_to: 1,
        message: "must be a fraction — enter 0.17 for 17%"
      )
    else
      changeset
    end
  end
end
