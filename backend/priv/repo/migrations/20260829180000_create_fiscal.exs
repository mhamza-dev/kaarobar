defmodule Kaarobar.Repo.Migrations.CreateFiscal do
  use Ecto.Migration

  @moduledoc """
  Reporting invoices to a tax authority, and stamping them with what came back.

  ## The sale must not wait for the authority

  A revenue authority's endpoint is somebody else's uptime. A till that blocked
  on it would stop selling every time the service went down, which is the one
  failure a shop cannot tolerate — so submission is queued and retried, and the
  sale completes regardless.

  That is a deliberate trade: for a short while, a legal sale exists that the
  authority has not been told about. Every regime that mandates real-time
  reporting also allows a grace period for exactly this reason, and a shop that
  cannot sell is worse off than one that reports a minute late.

  ## The stamp goes on the invoice, not in a log

  `fiscal_number` and `qr_payload` are what the receipt has to print — in most
  regimes the invoice is not valid without them. They live on the submission
  and are copied onto the sale, because a receipt reprinted in two years must
  show the same stamp it showed on the day.

  ## Retries are bounded and the failure is visible

  An endpoint that has refused the same invoice nine times will refuse it a
  tenth. After the attempts are spent the submission is parked as `failed` with
  the authority's own message on it, where a person can see it — rather than
  retrying quietly forever while the shop believes it is compliant.
  """

  def change do
    create table(:fiscal_configs, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :delete_all),
          null: false

      add :adapter, :string, null: false
      add :mode, :string, null: false, default: "test"

      # Registration with the authority. The POS id in particular is stamped
      # onto every invoice and is what identifies the terminal to them.
      add :taxpayer_number, :string
      add :pos_id, :string
      add :endpoint_url, :string

      # Encrypted: a token that can file invoices in a taxpayer's name is worth
      # stealing, and a database dump should not hand it over.
      add :credentials, :binary

      # Whether a sale must be reported at all. A shop below the threshold, or
      # in a regime that does not mandate it, keeps the machinery switched off.
      add :is_active, :boolean, null: false, default: false
      # Refuse to sell when the authority is unreachable. Off by default,
      # because a till that cannot sell is worse than one reporting late — but
      # some regimes require it, so it has to be expressible.
      add :block_on_failure, :boolean, null: false, default: false

      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:fiscal_configs, [:business_id], where: "deleted_at IS NULL")

    create constraint(:fiscal_configs, :fiscal_configs_adapter_check,
             check: "adapter IN ('fbr','generic','none')"
           )

    create constraint(:fiscal_configs, :fiscal_configs_mode_check,
             check: "mode IN ('test','live')"
           )

    # ----------------------------------------------------------- submissions
    create table(:fiscal_submissions, primary_key: false) do
      add :id, :binary_id, primary_key: true, default: fragment("gen_random_uuid()")

      add :organization_id,
          references(:organizations, type: :binary_id, on_delete: :restrict),
          null: false

      add :business_id,
          references(:businesses, type: :binary_id, on_delete: :restrict),
          null: false

      add :branch_id, references(:branches, type: :binary_id, on_delete: :nilify_all)

      add :sale_id, references(:sales, type: :binary_id, on_delete: :restrict), null: false
      # A void or a refund is reported too: an authority told about a sale that
      # was then reversed has to be told about the reversal, or the shop's
      # declared turnover is wrong.
      add :sale_return_id, :binary_id

      add :adapter, :string, null: false
      add :kind, :string, null: false, default: "invoice"
      add :status, :string, null: false, default: "queued"

      # What the authority gave back. The receipt is not valid without it in
      # most regimes, so it is copied onto the sale as well.
      add :fiscal_number, :string
      add :qr_payload, :text
      add :authority_reference, :string

      # What was sent, kept whole. When a submission is disputed months later,
      # the question is what the shop actually declared.
      add :request_payload, :map
      add :response_payload, :map

      add :attempts, :integer, null: false, default: 0
      add :last_error, :text
      add :error_code, :string

      add :submitted_at, :utc_datetime_usec
      add :accepted_at, :utc_datetime_usec
      add :failed_at, :utc_datetime_usec
      # When the next attempt is due. Read by the retry job.
      add :retry_after, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    # One submission per sale per kind: an invoice reported twice is turnover
    # declared twice, and the authority will bill for it.
    create unique_index(:fiscal_submissions, [:sale_id, :kind])
    create index(:fiscal_submissions, [:business_id, :status, :inserted_at])
    # The retry job's query.
    create index(:fiscal_submissions, [:status, :retry_after],
             where: "status IN ('queued','retrying')",
             name: :fiscal_submissions_due_index
           )

    create constraint(:fiscal_submissions, :fiscal_submissions_status_check,
             check: "status IN ('queued','submitting','retrying','accepted','rejected','failed','skipped')"
           )

    create constraint(:fiscal_submissions, :fiscal_submissions_kind_check,
             check: "kind IN ('invoice','void','refund','credit_note')"
           )

    create constraint(:fiscal_submissions, :fiscal_submissions_accepted_check,
             check: "status <> 'accepted' OR fiscal_number IS NOT NULL"
           )

    # The stamp, on the sale where a reprinted receipt can find it.
    alter table(:sales) do
      add :fiscal_number, :string
      add :fiscal_qr_payload, :text
      add :fiscal_status, :string
    end

    create index(:sales, [:business_id, :fiscal_status],
             where: "fiscal_status IS NOT NULL",
             name: :sales_fiscal_status_index
           )
  end
end
