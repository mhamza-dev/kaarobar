defmodule KaarobarWeb.ModifierGroupJSON do
  @moduledoc false

  alias KaarobarWeb.CatalogSerializers

  def index(%{modifier_groups: groups}),
    do: %{data: Enum.map(groups, &CatalogSerializers.modifier_group/1)}

  def show(%{modifier_group: group}),
    do: %{data: CatalogSerializers.modifier_group(group)}
end
