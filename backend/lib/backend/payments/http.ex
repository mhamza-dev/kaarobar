defmodule Kaarobar.Payments.HTTP do
  @moduledoc """
  The one place adapters reach the network from.

  Behind a single module so tests can replace it wholesale: no test should make
  a real request to Stripe, and an adapter that called `Req` directly would
  leave every test either mocking a library or hitting the internet.

  Configure a stub with:

      config :backend, Kaarobar.Payments.HTTP, client: MyStub

  The stub implements `post_form/4` and `get/3`, and the adapters cannot tell
  the difference.

  ## Failures are normalised

  A timeout, a refused connection and a 500 are all `{:error, reason}` with a
  reason worth logging. Adapters should not each invent their own vocabulary
  for "the gateway did not answer", because the caller has to handle all of
  them the same way: tell the cashier the payment is unconfirmed and let the
  reconciliation job settle it.
  """

  alias Kaarobar.Payments.Provider

  require Logger

  @timeout 15_000

  @doc "POSTs a form-encoded body and decodes the JSON response."
  @spec post_form(Provider.t(), String.t(), map(), list()) :: {:ok, map()} | {:error, term()}
  def post_form(%Provider{} = provider, url, body, headers) do
    client().post_form(provider, url, body, headers)
  end

  @doc "POSTs a JSON body and decodes the JSON response."
  @spec post_json(Provider.t(), String.t(), map(), list()) :: {:ok, map()} | {:error, term()}
  def post_json(%Provider{} = provider, url, body, headers) do
    client().post_json(provider, url, body, headers)
  end

  @doc "GETs and decodes the JSON response."
  @spec get(Provider.t(), String.t(), list()) :: {:ok, map()} | {:error, term()}
  def get(%Provider{} = provider, url, headers), do: client().get(provider, url, headers)

  defp client do
    :backend
    |> Application.get_env(__MODULE__, [])
    |> Keyword.get(:client, __MODULE__.Req)
  end

  defmodule Req do
    @moduledoc """
    The real transport.

    Every response is normalised to `{:ok, map}` or `{:error, reason}`. A
    gateway's 4xx body is returned as an error carrying the parsed payload,
    because the reason a card was declined is in that body and the cashier
    needs to be told it.
    """

    @timeout 15_000

    @doc false
    def post_form(_provider, url, body, headers) do
      url
      |> Elixir.Req.post(form: body, headers: headers, receive_timeout: @timeout)
      |> handle()
    end

    @doc false
    def post_json(_provider, url, body, headers) do
      url
      |> Elixir.Req.post(json: body, headers: headers, receive_timeout: @timeout)
      |> handle()
    end

    @doc false
    def get(_provider, url, headers) do
      url
      |> Elixir.Req.get(headers: headers, receive_timeout: @timeout)
      |> handle()
    end

    defp handle({:ok, %{status: status, body: body}}) when status in 200..299 do
      {:ok, normalise(body)}
    end

    defp handle({:ok, %{status: status, body: body}}) do
      # The gateway's own explanation is in the body, and it is the thing the
      # cashier has to be told — "declined: insufficient funds" is actionable,
      # "HTTP 402" is not.
      {:error, {:gateway_error, status, normalise(body)}}
    end

    defp handle({:error, reason}) do
      Logger.warning("payment gateway request failed: #{inspect(reason)}")
      {:error, {:transport_error, reason}}
    end

    defp normalise(body) when is_map(body), do: body
    defp normalise(body) when is_binary(body), do: decode(body)
    defp normalise(body), do: %{"body" => body}

    defp decode(body) do
      case Jason.decode(body) do
        {:ok, decoded} when is_map(decoded) -> decoded
        _other -> %{"body" => body}
      end
    end
  end
end
