defmodule KaarobarWeb.BranchJSON do
  @moduledoc false

  alias KaarobarWeb.Serializers

  def index(%{branches: branches}) do
    %{data: Enum.map(branches, &Serializers.branch/1)}
  end

  def show(%{branch: branch}) do
    %{data: Serializers.branch(branch)}
  end
end
