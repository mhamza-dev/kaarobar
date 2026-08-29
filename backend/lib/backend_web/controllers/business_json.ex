defmodule KaarobarWeb.BusinessJSON do
  @moduledoc false

  alias KaarobarWeb.Serializers

  def index(%{businesses: businesses}) do
    %{data: Enum.map(businesses, &Serializers.business/1)}
  end

  def show(%{business: business}) do
    %{data: Serializers.business(business)}
  end

  def created(%{business: business, branch: branch}) do
    %{
      data:
        business
        |> Serializers.business()
        |> Map.put(:branches, [Serializers.branch(branch)])
    }
  end
end
