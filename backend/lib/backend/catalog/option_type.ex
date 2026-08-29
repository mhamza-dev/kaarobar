defmodule Kaarobar.Catalog.OptionType do
  @moduledoc """
  An axis a product varies along: Size, Colour, Flavour.

  Business-scoped and reusable, so "Size" is defined once and attached to every
  garment. Modelling options as rows rather than as fixed `option1/2/3` columns
  means a shop that sizes shoes by width as well as length is a data change,
  not a migration.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.OptionValue
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @presentations ~w(select swatch button)

  schema "option_types" do
    field :name, :string
    field :presentation, :string, default: "select"
    field :position, :integer, default: 0
    field :is_active, :boolean, default: true
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business

    has_many :option_values, OptionValue, preload_order: [asc: :position]

    timestamps()
  end

  @doc "How an option type may be rendered."
  def presentations, do: @presentations

  def changeset(option_type, attrs) do
    option_type
    |> cast(attrs, [:name, :presentation, :position, :is_active])
    |> validate_required([:name])
    |> update_change(:name, &String.trim/1)
    |> validate_length(:name, min: 1, max: 60)
    |> validate_inclusion(:presentation, @presentations)
    |> unique_constraint([:business_id, :name],
      name: :option_types_business_id_name_index,
      message: "is already defined"
    )
  end

  @doc "Soft-deletes the option type."
  def soft_delete_changeset(option_type),
    do: change(option_type, deleted_at: DateTime.utc_now())
end
