defmodule Kaarobar.Schemas.MessagingWalletLedger do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  @kinds ~w(top_up campaign_spend adjustment)

  schema "messaging_wallet_ledger" do
    field :amount, :decimal
    field :kind, :string
    field :note, :string

    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :campaign, Kaarobar.Schemas.CrmCampaign

    timestamps(type: :utc_datetime)
  end

  def changeset(entry, attrs) do
    entry
    |> cast(attrs, [:amount, :kind, :note, :business_id, :owner_id, :campaign_id])
    |> validate_required([:amount, :kind, :business_id, :owner_id])
    |> validate_inclusion(:kind, @kinds)
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:owner_id)
  end
end
