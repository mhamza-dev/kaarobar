defmodule Kaarobar.Tenancy.Branch do
  @moduledoc """
  A physical place: a shop floor, a kitchen, a stockroom.

  Branches are where stock actually sits and where sales actually happen, so
  almost every operational table carries `branch_id`. Without it a two-branch
  owner cannot answer "how much do I have *here*", which is the reason they
  opened a second shop.

  `code` is short and human — `MAIN`, `LHR2` — because it is stamped into
  invoice numbers, where a UUID is useless to the person holding the receipt.
  """

  use Kaarobar.Schema

  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(active suspended archived)

  schema "branches" do
    field :name, :string
    field :code, :string

    field :address_line1, :string
    field :address_line2, :string
    field :city, :string
    field :state, :string
    field :postal_code, :string
    field :country_code, :string

    field :phone, :string
    field :email, :string

    field :latitude, :decimal
    field :longitude, :decimal

    field :timezone, :string

    field :is_main, :boolean, default: false
    field :is_warehouse, :boolean, default: false

    field :opening_hours, :map, default: %{}
    field :settings, :map, default: %{}

    field :status, :string, default: "active"
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business

    timestamps()
  end

  @doc "The statuses a branch may hold."
  def statuses, do: @statuses

  @doc """
  Changeset for creating a branch.

  `organization_id` and `business_id` are set by the context from the request
  scope, never cast from params.
  """
  def create_changeset(branch, attrs) do
    branch
    |> cast(attrs, fields() ++ [:code, :is_main])
    |> maybe_generate_code()
    |> validate_common()
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:organization_id)
  end

  @doc """
  Changeset for editing a branch.

  `is_main` is not set here. Promoting a branch has to demote the previous main
  in the same transaction — the database permits only one — so it goes through
  a dedicated context function rather than a general update.
  """
  def update_changeset(branch, attrs) do
    branch
    |> cast(attrs, fields() ++ [:code])
    |> validate_common()
  end

  @doc "Changeset for promoting or demoting the main branch."
  def main_changeset(branch, is_main) when is_boolean(is_main) do
    change(branch, is_main: is_main)
  end

  @doc "Changeset for an administrative status change."
  def status_changeset(branch, status) when status in @statuses do
    change(branch, status: status)
  end

  @doc "Soft-deletes the branch."
  def soft_delete_changeset(branch) do
    change(branch, deleted_at: DateTime.utc_now(), status: "archived")
  end

  @doc "True when the branch is open for business."
  def active?(%__MODULE__{deleted_at: nil, status: "active"}), do: true
  def active?(%__MODULE__{}), do: false

  @doc """
  True when sales may be rung up here.

  A warehouse holds stock but never sells; counting it as a selling location
  would distort every per-branch sales average.
  """
  def sells?(%__MODULE__{is_warehouse: true}), do: false
  def sells?(%__MODULE__{} = branch), do: active?(branch)

  @doc "The branch's own timezone, falling back to the business's."
  def timezone(%__MODULE__{timezone: timezone}) when is_binary(timezone), do: timezone
  def timezone(%__MODULE__{business: %Business{timezone: timezone}}), do: timezone
  def timezone(%__MODULE__{}), do: "UTC"

  defp fields do
    [
      :name,
      :address_line1,
      :address_line2,
      :city,
      :state,
      :postal_code,
      :country_code,
      :phone,
      :email,
      :latitude,
      :longitude,
      :timezone,
      :is_warehouse,
      :opening_hours,
      :settings
    ]
  end

  defp validate_common(changeset) do
    changeset
    |> validate_required([:name, :code])
    |> update_change(:name, &String.trim/1)
    |> validate_length(:name, min: 1, max: 160)
    |> update_change(:code, &normalize_code/1)
    |> validate_format(:code, ~r/^[A-Z0-9][A-Z0-9-]*$/,
      message: "may only contain uppercase letters, numbers and hyphens"
    )
    # Short enough to sit in an invoice number without dominating it.
    |> validate_length(:code, min: 1, max: 12)
    |> validate_length(:country_code, is: 2)
    |> validate_number(:latitude, greater_than_or_equal_to: -90, less_than_or_equal_to: 90)
    |> validate_number(:longitude, greater_than_or_equal_to: -180, less_than_or_equal_to: 180)
    |> validate_inclusion(:status, @statuses)
    |> unique_constraint([:business_id, :code],
      name: :branches_business_id_code_index,
      message: "is already used by another branch"
    )
    |> unique_constraint(:is_main,
      name: :branches_single_main_index,
      message: "another branch is already the main branch"
    )
  end

  defp maybe_generate_code(changeset) do
    case get_field(changeset, :code) do
      nil -> put_change(changeset, :code, derive_code(get_field(changeset, :name)))
      _code -> changeset
    end
  end

  defp derive_code(nil), do: "MAIN"

  defp derive_code(name) do
    derived =
      name
      |> String.upcase()
      |> String.replace(~r/[^A-Z0-9]/u, "")
      |> String.slice(0, 8)

    if derived == "", do: random_code(), else: derived
  end

  # Eight characters, so a generated code still fits inside an invoice number.
  defp random_code do
    "BR" <> (3 |> :crypto.strong_rand_bytes() |> Base.encode16(case: :upper))
  end

  defp normalize_code(code) do
    code |> String.trim() |> String.upcase()
  end
end
