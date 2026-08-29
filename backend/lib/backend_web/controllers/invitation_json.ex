defmodule KaarobarWeb.InvitationJSON do
  @moduledoc false

  alias KaarobarWeb.Serializers

  def index(%{invitations: invitations}) do
    %{data: Enum.map(invitations, &Serializers.invitation/1)}
  end

  def show(%{invitation: invitation}) do
    %{data: Serializers.invitation(invitation)}
  end
end
