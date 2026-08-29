defmodule Kaarobar.Catalog.OptionValue do
  @moduledoc """
  One point on an option axis: S, M, L, or a particular blue.

  `position` is what keeps sizes in size order. Sorting alphabetically puts
  large before medium before small, which is the sort of detail that makes a
  till screen feel broken without anyone being able to say why.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.OptionType

  schema "option_values" do
    field :value, :string
    field :hex_color, :string
    field :position, :integer, default: 0

    belongs_to :option_type, OptionType

    timestamps()
  end

  def changeset(option_value, attrs) do
    option_value
    |> cast(attrs, [:option_type_id, :value, :hex_color, :position])
    |> validate_required([:option_type_id, :value])
    |> update_change(:value, &String.trim/1)
    |> validate_length(:value, min: 1, max: 60)
    |> validate_format(:hex_color, ~r/^#[0-9a-fA-F]{6}$/,
      message: "must be a hex colour such as #2d6df6"
    )
    |> foreign_key_constraint(:option_type_id)
    |> unique_constraint([:option_type_id, :value],
      message: "is already defined for this option"
    )
  end
end
