defmodule Kaarobar.FiscalStub do
  @moduledoc """
  Stands in for a tax authority.

  Wired in permanently by `config/test.exs`, so no test has to reach for
  `Application.put_env` — which would make every fiscal test serial, because
  application env is global and two async tests would overwrite each other's
  authority.

  What it answers with lives in the **process dictionary** instead. Each test
  runs in its own process, so each one gets its own authority and they can all
  run at once:

      FiscalStub.respond({:ok, %{"Code" => "100", "InvoiceNumber" => "1234"}})

  A function may be given instead, to answer differently per call — which is
  how "fails twice, then succeeds" is written without a mocking library.
  """

  @response_key :fiscal_stub_response
  @requests_key :fiscal_stub_requests

  @doc "The transport callback. Records the request, then answers."
  def post_json(url, body, headers) do
    request = %{url: url, body: body, headers: headers}
    Process.put(@requests_key, requests() ++ [request])

    case Process.get(@response_key) do
      nil -> {:ok, %{}}
      fun when is_function(fun, 1) -> fun.(request)
      response -> response
    end
  end

  @doc "Sets what the authority says next. A 1-arity function is called per request."
  def respond(response), do: Process.put(@response_key, response)

  @doc """
  Answers with the given responses in order, repeating the last one.

  For "the endpoint was down and then it was not", which is the sequence the
  whole retry design exists for.
  """
  def respond_in_sequence(responses) when is_list(responses) do
    counter = :counters.new(1, [])

    respond(fn _request ->
      :counters.add(counter, 1, 1)
      index = :counters.get(counter, 1) - 1
      Enum.at(responses, index, List.last(responses))
    end)
  end

  @doc "Every request made in this process, oldest first."
  def requests, do: Process.get(@requests_key, [])

  @doc "The most recent request, or nil."
  def last_request, do: List.last(requests())

  @doc "Forgets what has been asked and what to answer."
  def reset do
    Process.delete(@response_key)
    Process.delete(@requests_key)
    :ok
  end
end
