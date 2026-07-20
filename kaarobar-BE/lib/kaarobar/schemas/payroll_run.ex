defmodule Kaarobar.Schemas.PayrollRun do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "payroll_runs" do
    field :period_start, :date
    field :period_end, :date
    field :status, :string, default: "Draft"

    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :approved_by, Kaarobar.Schemas.User
    belongs_to :journal_entry, Kaarobar.Schemas.JournalEntry

    has_many :payslips, Kaarobar.Schemas.Payslip

    timestamps(type: :utc_datetime)
  end

  def changeset(run, attrs) do
    run
    |> cast(attrs, [:period_start, :period_end, :status, :business_id, :owner_id, :approved_by_id, :journal_entry_id])
    |> validate_required([:period_start, :period_end, :business_id, :owner_id])
    |> validate_inclusion(:status, ["Draft", "PendingApproval", "Approved", "Rejected", "Posted", "Disbursed"])
    |> foreign_key_constraint(:business_id)
  end
end
