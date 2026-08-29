defmodule Kaarobar.Catalog.Unit do
  @moduledoc """
  A unit of measure.

  `dimension` plus `factor_to_base` is what makes conversion arithmetic rather
  than a lookup: within a dimension, converting is a ratio of factors. The base
  of each dimension is the smallest sensible one — grams, millilitres,
  millimetres — so factors are whole numbers and never lose precision.

  `precision` is how many decimals the unit is *sold* in, which is a property of
  the unit and not of the product: nobody sells 2.5 eggs, and everybody sells
  1.250 kg of mince.
  """

  use Kaarobar.Schema

  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @dimensions ~w(count weight volume length time)

  @doc """
  The units every new business starts with.

  A shop should be able to sell something the minute it is created, and
  "add a unit called pieces" is not a setup step anyone should have to think
  about.
  """
  @default_units [
    %{code: "pcs", name: "Piece", dimension: "count", factor_to_base: 1, precision: 0, is_base: true},
    %{code: "dozen", name: "Dozen", dimension: "count", factor_to_base: 12, precision: 0},
    %{code: "g", name: "Gram", dimension: "weight", factor_to_base: 1, precision: 0, is_base: true},
    %{code: "kg", name: "Kilogram", dimension: "weight", factor_to_base: 1000, precision: 3},
    %{code: "ml", name: "Millilitre", dimension: "volume", factor_to_base: 1, precision: 0, is_base: true},
    %{code: "l", name: "Litre", dimension: "volume", factor_to_base: 1000, precision: 3},
    %{code: "m", name: "Metre", dimension: "length", factor_to_base: 1000, precision: 2, is_base: false},
    %{code: "mm", name: "Millimetre", dimension: "length", factor_to_base: 1, precision: 0, is_base: true},
    %{code: "hr", name: "Hour", dimension: "time", factor_to_base: 60, precision: 2},
    %{code: "min", name: "Minute", dimension: "time", factor_to_base: 1, precision: 0, is_base: true}
  ]

  schema "units" do
    field :code, :string
    field :name, :string
    field :dimension, :string
    field :factor_to_base, :decimal, default: Decimal.new(1)
    field :precision, :integer, default: 0
    field :is_base, :boolean, default: false
    field :is_active, :boolean, default: true
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business

    timestamps()
  end

  @doc "The dimensions a unit may belong to."
  def dimensions, do: @dimensions

  @doc "The starter set seeded for every new business."
  def default_units, do: @default_units

  def changeset(unit, attrs) do
    unit
    |> cast(attrs, [
      :code,
      :name,
      :dimension,
      :factor_to_base,
      :precision,
      :is_base,
      :is_active
    ])
    |> validate_required([:code, :name, :dimension, :factor_to_base])
    |> update_change(:code, &normalize_code/1)
    |> validate_format(:code, ~r/^[a-z][a-z0-9_]*$/,
      message: "may only contain lowercase letters, numbers and underscores"
    )
    |> validate_length(:code, min: 1, max: 16)
    |> validate_length(:name, min: 1, max: 60)
    |> validate_inclusion(:dimension, @dimensions)
    |> validate_number(:factor_to_base, greater_than: 0)
    |> validate_number(:precision, greater_than_or_equal_to: 0, less_than_or_equal_to: 6)
    |> unique_constraint(:code,
      name: :units_business_id_code_index,
      message: "is already used by another unit"
    )
    |> foreign_key_constraint(:business_id)
  end

  @doc "Soft-deletes the unit."
  def soft_delete_changeset(unit), do: change(unit, deleted_at: DateTime.utc_now())

  @doc """
  Converts a quantity between two units of the same dimension.

  Returns `:error` across dimensions — kilograms into litres is not a rounding
  question, it is a mistake, and a silently wrong answer here becomes a wrong
  stock level.
  """
  @spec convert(Decimal.t(), t(), t()) :: {:ok, Decimal.t()} | :error
  def convert(%Decimal{} = quantity, %__MODULE__{} = from, %__MODULE__{} = to) do
    if from.dimension == to.dimension do
      {:ok, quantity |> Decimal.mult(from.factor_to_base) |> Decimal.div(to.factor_to_base)}
    else
      :error
    end
  end

  @doc "Rounds a quantity to the decimals this unit is sold in."
  @spec round_quantity(Decimal.t(), t()) :: Decimal.t()
  def round_quantity(%Decimal{} = quantity, %__MODULE__{precision: precision}) do
    Decimal.round(quantity, precision)
  end

  defp normalize_code(code), do: code |> String.trim() |> String.downcase()
end
