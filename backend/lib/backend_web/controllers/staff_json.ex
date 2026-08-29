defmodule KaarobarWeb.StaffJSON do
  @moduledoc false

  alias KaarobarWeb.Serializers

  def index(%{memberships: memberships}) do
    %{data: Enum.map(memberships, &Serializers.membership/1)}
  end

  def show(%{membership: membership} = assigns) do
    %{
      data:
        membership
        |> Serializers.membership()
        |> Map.put(:permission_grants, Enum.map(assigns[:grants] || [], &Serializers.grant/1))
    }
  end

  def grant(%{grant: grant}) do
    %{data: Serializers.grant(grant)}
  end
end
