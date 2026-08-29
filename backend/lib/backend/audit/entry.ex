defmodule Kaarobar.Audit.Entry do
  @moduledoc """
  One immutable line in the audit trail.

  There is no update changeset and there never will be — the database refuses
  `UPDATE` on this table. The schema holds plain uuids rather than
  `belongs_to` associations because an audit entry is a statement about the
  past and must survive the deletion of whatever it describes.
  """

  use Kaarobar.Schema

  @actor_types ~w(user system api_client)

  schema "audit_logs" do
    field :organization_id, Kaarobar.Ecto.UUIDv7
    field :business_id, Kaarobar.Ecto.UUIDv7
    field :branch_id, Kaarobar.Ecto.UUIDv7

    field :actor_user_id, Kaarobar.Ecto.UUIDv7
    field :actor_label, :string
    field :actor_type, :string, default: "user"

    field :action, :string
    field :entity_type, :string
    field :entity_id, Kaarobar.Ecto.UUIDv7
    field :entity_label, :string

    field :summary, :string
    field :changes, :map
    field :metadata, :map

    field :ip_address, :string
    field :user_agent, :string
    field :request_id, :string

    timestamps(updated_at: false)
  end

  @doc "The kinds of actor an entry may attribute an action to."
  def actor_types, do: @actor_types

  def changeset(entry, attrs) do
    entry
    |> cast(attrs, [
      :organization_id,
      :business_id,
      :branch_id,
      :actor_user_id,
      :actor_label,
      :actor_type,
      :action,
      :entity_type,
      :entity_id,
      :entity_label,
      :summary,
      :changes,
      :metadata,
      :ip_address,
      :user_agent,
      :request_id
    ])
    |> validate_required([:action, :entity_type])
    |> validate_inclusion(:actor_type, @actor_types)
    |> validate_format(:action, ~r/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/,
      message: "must look like entity.action, for example sale.voided"
    )
    |> validate_length(:summary, max: 1000)
    |> validate_length(:user_agent, max: 500)
  end
end
