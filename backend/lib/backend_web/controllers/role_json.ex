defmodule KaarobarWeb.RoleJSON do
  @moduledoc false

  alias KaarobarWeb.Serializers

  def index(%{roles: roles}) do
    %{data: Enum.map(roles, &Serializers.role/1)}
  end

  def show(%{role: role}) do
    %{data: Serializers.role(role)}
  end
end
