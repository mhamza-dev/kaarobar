defmodule Kaarobar.BillingStripeStub do
  @moduledoc """
  Stands in for Kaarobar's own Stripe account.

  Wired in by `config/test.exs`, and answers from the **process dictionary**
  exactly as `Kaarobar.FiscalStub` does, so billing tests stay async:

      BillingStripeStub.respond(fn %{url: url} ->
        if url =~ "/checkout/sessions", do: {:ok, %{"id" => "cs_1", "url" => "https://…"}}
      end)
  """

  @response_key :billing_stripe_stub_response
  @requests_key :billing_stripe_stub_requests

  @doc false
  def post_form(_provider, url, body, headers),
    do: answer(%{method: :post, url: url, body: body, headers: headers})

  @doc false
  def get(_provider, url, headers),
    do: answer(%{method: :get, url: url, body: nil, headers: headers})

  @doc "Sets the answer. A 1-arity function is called with each request."
  def respond(response), do: Process.put(@response_key, response)

  @doc "Every request made in this process, oldest first."
  def requests, do: Process.get(@requests_key, [])

  @doc "The most recent request, or nil."
  def last_request, do: List.last(requests())

  defp answer(request) do
    Process.put(@requests_key, requests() ++ [request])

    case Process.get(@response_key) do
      nil -> {:error, :no_stub_response}
      fun when is_function(fun, 1) -> fun.(request)
      response -> response
    end
  end
end
