defmodule KaarobarWeb.CustomerGroupJSON do
  @moduledoc false

  alias KaarobarWeb.CrmSerializers

  def groups(%{groups: groups}), do: %{data: Enum.map(groups, &CrmSerializers.group/1)}

  def group(%{group: group}), do: %{data: CrmSerializers.group(group)}
end
