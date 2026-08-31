defmodule Kaarobar.Payments.Adapters.Manual do
  @moduledoc """
  A card terminal with no API.

  ## This is the common case, not the fallback

  Most shops in this market take cards on a bank-supplied terminal that talks
  to nothing. The cashier taps, the terminal prints a slip, and somebody types
  the slip number in. Treating that as "no gateway" would push the majority of
  real shops outside the system entirely; treating it as an adapter means one
  code path serves everybody, and a shop that later integrates changes a
  setting rather than a workflow.

  ## Everything succeeds immediately, because it already has

  The money moved before this code ran — the terminal took it. There is nothing
  to authorise, nothing to poll and no webhook to wait for, so a charge is
  captured the moment it is recorded. The reference is the slip number, which
  is what a shop actually reconciles against its bank statement.

  ## Refunds are recorded, not performed

  Nothing here can move money back; the cashier does that on the terminal. The
  refund is written so the books agree with what happened, and the shop is
  responsible for the two matching. Pretending otherwise would have the system
  report a refund it never made.
  """

  @behaviour Kaarobar.Payments.Gateway

  alias Kaarobar.Payments.Provider

  @impl true
  def create_charge(%Provider{}, params) do
    {:ok,
     %{
       status: :captured,
       external_id: reference_of(params),
       amount: params.amount,
       provider_status: "manual",
       card_last_four: get(params, :card_last_four),
       card_scheme: get(params, :card_scheme),
       raw: %{"source" => "manual", "reference" => reference_of(params)}
     }}
  end

  @impl true
  def capture(%Provider{}, external_id, amount) do
    # Already captured by the terminal. Reporting it as a fresh capture keeps
    # the caller's flow uniform without claiming anything new happened.
    {:ok, %{status: :captured, external_id: external_id, amount: amount}}
  end

  @impl true
  def refund(%Provider{}, external_id, amount) do
    {:ok,
     %{
       status: :refunded,
       external_id: external_id,
       amount: amount,
       provider_status: "manual_refund",
       raw: %{"source" => "manual", "note" => "Recorded only; refund performed on the terminal"}
     }}
  end

  @impl true
  def void(%Provider{}, external_id),
    do: {:ok, %{status: :cancelled, external_id: external_id}}

  @impl true
  def fetch_status(%Provider{}, external_id),
    do: {:ok, %{status: :captured, external_id: external_id}}

  @impl true
  def verify_webhook(%Provider{}, _body, _headers), do: {:error, :not_supported}

  @impl true
  def parse_event(_event), do: {:ok, nil}

  @impl true
  def supports_capture?, do: false

  @impl true
  def supports_refund?, do: false

  # The slip number, when the cashier typed one. Falling back to the intent's
  # own reference keeps the row identifiable either way.
  defp reference_of(params), do: get(params, :external_reference) || params.reference

  defp get(params, key) do
    Map.get(params, key) || Map.get(params, to_string(key))
  end
end
