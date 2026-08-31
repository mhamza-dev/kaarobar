defmodule KaarobarWeb.FiscalJSON do
  @moduledoc """
  Serialising the tax authority connection and what it has said.

  Credentials are absent by construction rather than filtered out at the end.
  A field that is never written cannot be forgotten about when somebody adds
  the next one.
  """

  alias Kaarobar.Fiscal.Config
  alias Kaarobar.Fiscal.Submission

  def config(%{config: nil}), do: %{data: nil}
  def config(%{config: config}), do: %{data: serialise_config(config)}

  def submissions(%{submissions: submissions}),
    do: %{data: Enum.map(submissions, &serialise_submission/1)}

  def submission(%{submission: submission}), do: %{data: serialise_submission(submission)}

  def queued(%{queued: _queued}), do: %{data: %{queued: true}}

  def status(%{config: config, backlog: backlog}) do
    %{
      data: %{
        reporting: Config.reporting?(config),
        blocking: Config.blocking?(config),
        adapter: config && config.adapter,
        mode: config && config.mode,
        backlog: backlog,
        # What the till needs to decide whether it may open at all — computed
        # here rather than left to each client to infer from the two flags and
        # a count, because three clients inferring it would get it three ways.
        selling_blocked: Config.blocking?(config) and backlog > 0
      }
    }
  end

  defp serialise_config(%Config{} = config) do
    %{
      id: config.id,
      adapter: config.adapter,
      mode: config.mode,
      taxpayer_number: config.taxpayer_number,
      pos_id: config.pos_id,
      endpoint_url: config.endpoint_url,
      is_active: config.is_active,
      block_on_failure: config.block_on_failure,
      reporting: Config.reporting?(config),
      # Whether a token is set, never the token. A shop needs to know it has
      # one; nobody needs to read it back.
      has_credentials: config.credentials not in [nil, %{}],
      disabled_at: config.deleted_at,
      inserted_at: config.inserted_at,
      updated_at: config.updated_at
    }
  end

  defp serialise_submission(%Submission{} = submission) do
    %{
      id: submission.id,
      sale_id: submission.sale_id,
      branch_id: submission.branch_id,
      adapter: submission.adapter,
      kind: submission.kind,
      status: submission.status,
      fiscal_number: submission.fiscal_number,
      qr_payload: submission.qr_payload,
      authority_reference: submission.authority_reference,
      attempts: submission.attempts,
      # The authority's own words, not a paraphrase. It is what tells the
      # shopkeeper which field to correct.
      error_code: submission.error_code,
      last_error: submission.last_error,
      stamped: Submission.stamped?(submission),
      needs_attention: Submission.needs_attention?(submission),
      submitted_at: submission.submitted_at,
      accepted_at: submission.accepted_at,
      failed_at: submission.failed_at,
      retry_after: submission.retry_after,
      inserted_at: submission.inserted_at
    }
  end
end
