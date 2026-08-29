defmodule KaarobarWeb.OrganizationJSON do
  @moduledoc false

  alias KaarobarWeb.Serializers

  def index(%{organizations: organizations}) do
    %{data: Enum.map(organizations, &Serializers.organization/1)}
  end

  def show(%{organization: organization}) do
    %{data: Serializers.organization(organization)}
  end
end
