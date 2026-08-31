defmodule Kaarobar.Fiscal.Submission do
  @moduledoc """
  One attempt to tell a tax authority about a document.

  ## Rejected and failed are separate states

  Rejected means the authority read it and said no — a bad tax number, a total
  that does not add up. Retrying changes nothing; somebody has to fix the data.
  Failed means the authority did not answer, which the next attempt very likely
  fixes.

  Keeping them apart is what stops the system either hammering a permanently
  broken invoice or giving up on one a minute's patience would have completed.

  ## The stamp is the point

  `fiscal_number` and `qr_payload` are what the receipt must print; in most
  regimes the invoice is not valid without them. The database enforces that an
  accepted submission has a number, because an "accepted" row with nothing to
  print is a receipt the shop cannot legally issue.
  """

  use Kaarobar.Schema

  alias Kaarobar.Fiscal.Adapter
  alias Kaarobar.Sales.Sale
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(queued submitting retrying accepted rejected failed skipped)
  @kinds ~w(invoice void refund credit_note)
  # States the retry job picks up.
  @due_statuses ~w(queued retrying)

  schema "fiscal_submissions" do
    field :adapter, :string
    field :kind, :string, default: "invoice"
    field :status, :string, default: "queued"

    field :fiscal_number, :string
    field :qr_payload, :string
    field :authority_reference, :string

    field :request_payload, :map
    field :response_payload, :map

    field :attempts, :integer, default: 0
    field :last_error, :string
    field :error_code, :string

    field :submitted_at, :utc_datetime_usec
    field :accepted_at, :utc_datetime_usec
    field :failed_at, :utc_datetime_usec
    field :retry_after, :utc_datetime_usec

    field :sale_return_id, Kaarobar.Ecto.UUIDv7

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :sale, Sale

    timestamps()
  end

  @doc "Every state a submission can be in."
  def statuses, do: @statuses

  @doc "The kinds of document reported."
  def kinds, do: @kinds

  @doc "The states the retry job picks up."
  def due_statuses, do: @due_statuses

  def changeset(submission, attrs) do
    submission
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :branch_id,
      :sale_id,
      :sale_return_id,
      :adapter,
      :kind,
      :request_payload
    ])
    |> validate_required([:organization_id, :business_id, :sale_id, :adapter])
    |> validate_inclusion(:kind, @kinds)
    |> unique_constraint(:sale_id,
      name: :fiscal_submissions_sale_id_kind_index,
      message: "has already been reported"
    )
    |> foreign_key_constraint(:sale_id)
  end

  @doc """
  About to be sent, with the payload that is about to go.

  The payload is recorded before the call rather than after it, so an attempt
  that times out still leaves a record of what the shop declared. Written after
  the fact, the one case where it matters most is the one case it would miss.
  """
  def submitting_changeset(submission, payload) do
    change(submission, %{
      status: "submitting",
      attempts: submission.attempts + 1,
      request_payload: payload,
      submitted_at: DateTime.utc_now()
    })
  end

  @doc "The authority took it. This is the row the receipt reads its stamp from."
  def accepted_changeset(submission, result) do
    submission
    |> change(%{
      status: "accepted",
      fiscal_number: result.fiscal_number,
      qr_payload: Map.get(result, :qr_payload),
      authority_reference: Map.get(result, :authority_reference),
      response_payload: Map.get(result, :raw),
      accepted_at: DateTime.utc_now(),
      retry_after: nil,
      last_error: nil,
      error_code: nil
    })
    |> validate_required([:fiscal_number],
      message: "is required before a submission can be accepted"
    )
  end

  @doc """
  The authority read it and said no.

  Terminal: retrying identical data gets an identical answer. Their own message
  is kept because it is what tells the shopkeeper which field to correct.
  """
  def rejected_changeset(submission, rejection) do
    change(submission, %{
      status: "rejected",
      error_code: Map.get(rejection, :code),
      last_error: Map.get(rejection, :message),
      response_payload: Map.get(rejection, :raw),
      failed_at: DateTime.utc_now(),
      retry_after: nil
    })
  end

  @doc """
  The authority did not answer.

  Schedules another attempt, or parks it once the attempts are spent — because
  retrying forever lets a shop believe it is compliant when it is not.
  """
  def failed_changeset(submission, reason) do
    if submission.attempts >= Adapter.max_attempts() do
      change(submission, %{
        status: "failed",
        last_error: describe(reason),
        failed_at: DateTime.utc_now(),
        retry_after: nil
      })
    else
      wait = Adapter.backoff_seconds(submission.attempts)

      change(submission, %{
        status: "retrying",
        last_error: describe(reason),
        retry_after: DateTime.add(DateTime.utc_now(), wait, :second)
      })
    end
  end

  @doc "Nothing to report — the business does not file, or the kind is not reported."
  def skipped_changeset(submission),
    do: change(submission, status: "skipped", retry_after: nil)

  @doc "True when this still needs sending."
  @spec pending?(t()) :: boolean()
  def pending?(%__MODULE__{status: status}), do: status in @due_statuses

  @doc "True when the authority has it and the receipt can be printed."
  @spec stamped?(t()) :: boolean()
  def stamped?(%__MODULE__{status: "accepted", fiscal_number: number}), do: is_binary(number)
  def stamped?(%__MODULE__{}), do: false

  @doc "True when a person needs to look at this."
  @spec needs_attention?(t()) :: boolean()
  def needs_attention?(%__MODULE__{status: status}), do: status in ["rejected", "failed"]

  defp describe(reason) when is_binary(reason), do: reason
  defp describe(reason), do: inspect(reason)
end
