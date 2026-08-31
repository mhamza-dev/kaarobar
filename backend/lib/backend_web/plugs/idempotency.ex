defmodule KaarobarWeb.Plugs.Idempotency do
  @moduledoc """
  Honours the `Idempotency-Key` header on write requests.

  Sits after `LoadScope`, because a key is scoped to an organization — two
  tenants generating the same uuid must not collide, and one must never be
  handed the other's stored response.

  The header is optional. A client that does not send one gets ordinary
  behaviour; a client that does gets exactly-once semantics for that request.
  Sending one is strongly recommended for anything that moves money or stock,
  and the POS clients send one on every write.

  Success responses (2xx) are stored and replayed. Failures are not: a `422`
  from bad input should not pin the client to that failure forever, and a `500`
  from a transient database error should be retryable.
  """

  @behaviour Plug

  import Plug.Conn

  alias Kaarobar.Idempotency
  alias Kaarobar.Scope
  alias KaarobarWeb.ErrorEnvelope

  @write_methods ~w(POST PUT PATCH DELETE)

  @impl Plug
  def init(opts), do: opts

  @impl Plug
  def call(conn, _opts) do
    with true <- conn.method in @write_methods,
         key when is_binary(key) <- request_key(conn),
         %Scope{organization: organization} when not is_nil(organization) <- conn.assigns[:scope] do
      apply_key(conn, key)
    else
      _other -> conn
    end
  end

  defp apply_key(conn, key) do
    scope = conn.assigns.scope

    claim = %{
      organization_id: Scope.organization_id(scope),
      user_id: Scope.user_id(scope),
      key: key,
      request_method: conn.method,
      request_path: conn.request_path,
      body: conn.body_params
    }

    case Idempotency.claim(claim) do
      {:ok, claimed} ->
        register_before_send(conn, &store_response(&1, claimed))

      {:replay, status, body} ->
        conn
        |> put_resp_header("idempotent-replay", "true")
        |> put_resp_content_type("application/json")
        |> send_resp(status, Jason.encode_to_iodata!(body))
        |> halt()

      {:error, :in_progress} ->
        halt_with(
          conn,
          :conflict,
          "An identical request is still being processed. Retry in a moment."
        )

      {:error, :conflict} ->
        halt_with(
          conn,
          :conflict,
          "This idempotency key was already used for a different request."
        )

      # The key itself was unusable — too short to be worth anything as a
      # guard. Told apart from a conflict deliberately: a caller sent a bad
      # header, and "already used" would send them hunting for a duplicate
      # request they never made.
      {:error, %Ecto.Changeset{}} ->
        halt_with(
          conn,
          :bad_request,
          "The Idempotency-Key header must be at least 8 characters."
        )
    end
  end

  defp store_response(conn, claimed) do
    if conn.status in 200..299 do
      Idempotency.complete(claimed, conn.status, decode_body(conn.resp_body))
    else
      Idempotency.fail(claimed)
    end

    conn
  end

  # `conn.resp_body` is iodata — Phoenix renders JSON through
  # `Jason.encode_to_iodata!`, which returns a list. Matching only on a binary
  # stored an empty body for every response, so a replayed request came back
  # `{}` and the client saw its retry succeed with nothing in it.
  defp decode_body(body) when is_binary(body) or is_list(body) do
    case body |> IO.iodata_to_binary() |> Jason.decode() do
      {:ok, decoded} when is_map(decoded) -> decoded
      _other -> %{}
    end
  rescue
    ArgumentError -> %{}
  end

  defp decode_body(_body), do: %{}

  defp request_key(conn) do
    case get_req_header(conn, "idempotency-key") do
      [value | _rest] -> normalize(value)
      [] -> nil
    end
  end

  defp normalize(value) do
    case String.trim(value) do
      "" -> nil
      trimmed -> String.slice(trimmed, 0, 255)
    end
  end

  defp halt_with(conn, reason, message) do
    {status, body} = ErrorEnvelope.for_reason(reason)
    body = put_in(body, [:error, :message], message)

    conn
    |> put_resp_content_type("application/json")
    |> send_resp(Plug.Conn.Status.code(status), Jason.encode_to_iodata!(body))
    |> halt()
  end
end
