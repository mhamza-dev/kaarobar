defmodule KaarobarWeb.MeJSON do
  @moduledoc """
  The caller's own account, context and devices.
  """

  alias KaarobarWeb.Serializers

  def show(%{scope: scope, organizations: organizations}) do
    %{
      data:
        scope
        |> Serializers.scope()
        |> Map.put(:organizations, Enum.map(organizations, &Serializers.organization/1))
    }
  end

  def profile(%{user: user}) do
    %{data: Serializers.user(user)}
  end

  def devices(%{devices: devices, current_token_id: current_token_id}) do
    %{
      data:
        Enum.map(devices, fn device ->
          device
          |> Serializers.device()
          |> Map.put(:current, device.id == current_token_id)
        end)
    }
  end
end
