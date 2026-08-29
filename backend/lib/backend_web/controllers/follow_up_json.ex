defmodule KaarobarWeb.FollowUpJSON do
  @moduledoc false

  alias KaarobarWeb.CrmSerializers

  def follow_ups(%{follow_ups: follow_ups}),
    do: %{data: Enum.map(follow_ups, &CrmSerializers.follow_up/1)}

  def follow_up(%{follow_up: follow_up}), do: %{data: CrmSerializers.follow_up(follow_up)}
end
