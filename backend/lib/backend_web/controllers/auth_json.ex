defmodule KaarobarWeb.AuthJSON do
  @moduledoc """
  Sign-in and registration responses.
  """

  alias KaarobarWeb.Serializers

  @doc """
  A newly issued session.

  Returns the token together with everything needed to draw the first screen —
  the user, and, when registration created them, the organization, business and
  branch. A client that has just signed in should not need three more round
  trips before it can render.
  """
  def session(%{user: user, token: token} = assigns) do
    %{
      data:
        %{
          token: token,
          token_type: "Bearer",
          user: Serializers.user(user)
        }
        |> Map.merge(created_records(assigns[:result]))
    }
  end

  defp created_records(nil), do: %{}

  defp created_records(result) do
    %{}
    |> put_if(result[:organization], :organization, &Serializers.organization/1)
    |> put_if(result[:business], :business, &Serializers.business/1)
    |> put_if(result[:branch], :branch, &Serializers.branch/1)
  end

  defp put_if(map, nil, _key, _fun), do: map
  defp put_if(map, value, key, fun), do: Map.put(map, key, fun.(value))
end
