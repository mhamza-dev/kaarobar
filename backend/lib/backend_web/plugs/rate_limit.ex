defmodule KaarobarWeb.Plugs.RateLimit do
  @moduledoc """
  Throttles a pipeline or a single action.

      plug KaarobarWeb.Plugs.RateLimit, limit: 10, window: :timer.minutes(1), by: :ip, bucket: "login"

  ## Options

    * `:limit`  — requests permitted per window. Required in practice; defaults to 120.
    * `:window` — window length in milliseconds. Defaults to one minute.
    * `:by`     — `:ip` (default), `:user`, or `:organization`.
    * `:bucket` — a name isolating this limit from others. Defaults to the request path.

  Limits are deliberately generous on the selling path. A busy counter can ring
  a sale every few seconds and a barcode scanner fires bursts; throttling
  checkout would be worse than the abuse it prevents. The tight limits belong
  on authentication, invitations and exports.

  Responses always carry `x-ratelimit-*` headers so clients can back off before
  they are rejected, and a rejection carries `retry-after`.
  """

  @behaviour Plug

  import Plug.Conn

  alias Kaarobar.RateLimiter
  alias Kaarobar.Scope
  alias KaarobarWeb.ErrorEnvelope

  @default_limit 120
  @default_window :timer.minutes(1)

  @impl Plug
  def init(opts), do: opts

  @impl Plug
  def call(conn, opts) do
    if enabled?() do
      throttle(conn, opts)
    else
      conn
    end
  end

  @doc """
  Whether throttling is active.

  Off by default in test. Every request there arrives from `127.0.0.1`, so a
  single shared bucket would couple otherwise-independent async tests and make
  them fail in whatever order happened to run last. The behaviour itself is
  covered by tests that switch it on deliberately.
  """
  @spec enabled?() :: boolean()
  def enabled? do
    Application.get_env(:backend, :rate_limiting, true)
  end

  defp throttle(conn, opts) do
    limit = Keyword.get(opts, :limit, @default_limit)
    window = Keyword.get(opts, :window, @default_window)

    case RateLimiter.hit(bucket_key(conn, opts), window, limit) do
      {:allow, count} ->
        put_limit_headers(conn, limit, limit - count)

      {:deny, retry_after_ms} ->
        reject(conn, limit, retry_after_ms)
    end
  end

  defp bucket_key(conn, opts) do
    bucket = Keyword.get(opts, :bucket) || conn.request_path
    "#{bucket}:#{subject(conn, Keyword.get(opts, :by, :ip))}"
  end

  defp subject(conn, :ip), do: conn.assigns[:remote_ip] || "unknown"

  defp subject(conn, :user) do
    case conn.assigns[:scope] do
      %Scope{} = scope -> Scope.user_id(scope) || subject(conn, :ip)
      _other -> subject(conn, :ip)
    end
  end

  defp subject(conn, :organization) do
    case conn.assigns[:scope] do
      %Scope{} = scope -> Scope.organization_id(scope) || subject(conn, :ip)
      _other -> subject(conn, :ip)
    end
  end

  defp put_limit_headers(conn, limit, remaining) do
    conn
    |> put_resp_header("x-ratelimit-limit", Integer.to_string(limit))
    |> put_resp_header("x-ratelimit-remaining", Integer.to_string(max(remaining, 0)))
  end

  defp reject(conn, limit, retry_after_ms) do
    retry_after_seconds = retry_after_ms |> div(1000) |> max(1)
    {status, body} = ErrorEnvelope.for_reason(:rate_limited)

    conn
    |> put_limit_headers(limit, 0)
    |> put_resp_header("retry-after", Integer.to_string(retry_after_seconds))
    |> put_resp_content_type("application/json")
    |> send_resp(Plug.Conn.Status.code(status), Jason.encode_to_iodata!(body))
    |> halt()
  end
end
