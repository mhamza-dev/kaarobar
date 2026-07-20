defmodule Kaarobar.Schemas.AuditLog do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "audit_logs" do
    field :action, :string
    field :entity_type, :string
    field :entity_id, :binary_id
    field :metadata, :map
    field :ip_address, :string

    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :user, Kaarobar.Schemas.User

    field :inserted_at, :utc_datetime
  end

  def changeset(audit_log, attrs) do
    audit_log
    |> cast(attrs, [:action, :entity_type, :entity_id, :metadata, :ip_address, :owner_id, :user_id])
    |> validate_required([:action, :entity_type, :owner_id])
    |> put_change(:inserted_at, DateTime.utc_now())
  end
end
