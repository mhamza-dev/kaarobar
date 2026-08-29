defmodule KaarobarWeb.ErrorJSON do
  @moduledoc """
  Renders the errors Phoenix raises on our behalf — no matching route, an
  unhandled exception, a malformed request body.

  Application-level failures come through `KaarobarWeb.FallbackController`
  instead. Both use `KaarobarWeb.ErrorEnvelope`, so a client sees one error
  shape no matter where the failure originated.
  """

  alias KaarobarWeb.ErrorEnvelope

  def render(template, _assigns) do
    message = Phoenix.Controller.status_message_from_template(template)
    ErrorEnvelope.build(code_from(message), message)
  end

  defp code_from(message) do
    message
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9]+/, "_")
    |> String.trim("_")
  end
end
