defmodule Kaarobar.AccessControl.Permission do
  @moduledoc """
  A row in the seeded permission catalogue.

  The key is the primary key. A uuid here would buy nothing and cost
  readability: `role_permissions` rows say `"sales:refund_approve"` rather than
  an opaque id, a typo is rejected by a foreign key, and an operator debugging
  a permissions problem in a database console can see what they are looking at.

  This is the one schema that does not `use Kaarobar.Schema` — that base gives
  every record a UUIDv7 primary key, which is exactly what this table does not
  want.

  The authoritative list is `Kaarobar.AccessControl.Permissions`; this table is
  its projection, refreshed by the seed.
  """

  use Ecto.Schema

  import Ecto.Changeset

  @type t :: %__MODULE__{}

  @primary_key {:key, :string, autogenerate: false}
  @derive {Phoenix.Param, key: :key}
  @timestamps_opts [type: :utc_datetime_usec]

  schema "permissions" do
    field :group, :string
    field :label, :string

    timestamps()
  end

  def changeset(permission, attrs) do
    permission
    |> cast(attrs, [:key, :group, :label])
    |> validate_required([:key, :group, :label])
    |> validate_format(:key, ~r/^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$/,
      message: "must be in resource:action form"
    )
    |> unique_constraint(:key, name: "permissions_pkey")
  end
end
