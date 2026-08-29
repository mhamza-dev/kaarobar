defmodule KaarobarWeb.FallbackController do
  @moduledoc """
  Translates the error tuples returned by contexts into HTTP responses.

  Installed as `action_fallback` for every controller (see `KaarobarWeb`), so
  actions can be written as a straight-line `with` chain and never need to
  build an error response themselves:

      def create(conn, params) do
        with :ok <- Scope.authorize(conn.assigns.scope, "products:write"),
             {:ok, product} <- Catalog.create_product(conn.assigns.scope, params) do
          conn |> put_status(:created) |> render(:show, product: product)
        end
      end

  Any `{:error, _}` returned by that chain lands here.
  """

  use Phoenix.Controller, formats: [:json]

  alias KaarobarWeb.ErrorEnvelope

  def call(conn, {:error, %Ecto.Changeset{} = changeset}) do
    changeset |> ErrorEnvelope.for_changeset() |> respond(conn)
  end

  def call(conn, {:error, reason}) when is_atom(reason) do
    reason |> ErrorEnvelope.for_reason() |> respond(conn)
  end

  def call(conn, {:error, reason, details}) when is_atom(reason) and is_map(details) do
    {status, body} = ErrorEnvelope.for_reason(reason)
    respond({status, put_in(body, [:error, :details], details)}, conn)
  end

  def call(conn, {:error, reason, message}) when is_atom(reason) and is_binary(message) do
    {status, body} = ErrorEnvelope.for_reason(reason)
    respond({status, put_in(body, [:error, :message], message)}, conn)
  end

  def call(conn, nil), do: :not_found |> ErrorEnvelope.for_reason() |> respond(conn)
  def call(conn, :error), do: :unprocessable_entity |> ErrorEnvelope.for_reason() |> respond(conn)

  defp respond({status, body}, conn) do
    conn
    |> put_status(status)
    |> json(body)
  end
end
