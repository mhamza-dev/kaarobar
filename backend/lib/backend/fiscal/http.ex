defmodule Kaarobar.Fiscal.HTTP do
  @moduledoc """
  The one place fiscal adapters reach the network from.

  Separate from `Kaarobar.Payments.HTTP` because that one is keyed on a payment
  provider, and a tax authority is not one. Same shape and same reason for
  existing: no test should post an invoice to a revenue authority, and an
  adapter calling `Req` directly would leave every test either mocking a
  library or filing real returns.

  Configure a stub with:

      config :backend, Kaarobar.Fiscal.HTTP, client: MyStub

  The stub implements `post_json/3`, and the adapters cannot tell the
  difference.

  ## Everything unanswered is `{:error, reason}`

  A timeout, a refused connection and a 502 all come back the same way, because
  the caller treats them identically: queue it and try again. What must *not*
  be flattened into that is the authority answering with a rejection — that is
  a successful HTTP call carrying a "no", and the adapter reads it from the
  body.
  """

  @doc "POSTs a JSON body and decodes the JSON response."
  @spec post_json(String.t(), map(), list()) :: {:ok, map()} | {:error, term()}
  def post_json(url, body, headers), do: client().post_json(url, body, headers)

  defp client do
    :backend
    |> Application.get_env(__MODULE__, [])
    |> Keyword.get(:client, __MODULE__.Req)
  end

  defmodule Req do
    @moduledoc """
    The real transport.

    A 4xx body is returned as `{:ok, body}` rather than an error, because tax
    authorities routinely answer "this invoice is wrong" with a 400 and the
    body is the only place the reason lives. Deciding whether that means
    rejected or failed is the adapter's job, not the socket's.
    """

    require Logger

    @timeout 20_000

    @doc "POSTs JSON. 2xx and 4xx both return their decoded body."
    def post_json(url, body, headers) do
      [url: url, json: body, headers: headers, receive_timeout: @timeout, retry: false]
      |> Elixir.Req.new()
      |> Elixir.Req.post()
      |> handle()
    end

    defp handle({:ok, %{status: status, body: body}}) when status in 200..299,
      do: {:ok, normalise(body)}

    defp handle({:ok, %{status: status, body: body}}) when status in 400..499,
      do: {:ok, normalise(body)}

    defp handle({:ok, %{status: status, body: body}}) do
      Logger.warning("fiscal authority returned #{status}: #{inspect(body)}")
      {:error, {:http_status, status}}
    end

    defp handle({:error, reason}) do
      Logger.warning("fiscal authority unreachable: #{inspect(reason)}")
      {:error, reason}
    end

    # An authority that answers with a bare string or a list still answered.
    defp normalise(body) when is_map(body), do: body
    defp normalise(body), do: %{"body" => body}
  end
end
