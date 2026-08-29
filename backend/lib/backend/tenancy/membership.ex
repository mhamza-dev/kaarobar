defmodule Kaarobar.Tenancy.Membership do
  @moduledoc """
  Binds a person to a tenant, and says where they may work.

  `business_id` being nullable is the crux of the multi-business model:

    * `nil` — an organization-wide member. The owner, an administrator, the
      accountant who does the books for everything.
    * set — a member of one business only. The cashier at the clothes shop
      cannot see the restaurant next door, even though one person owns both.

  Branch scoping narrows it again. A membership with no `membership_branches`
  rows covers every branch of its business; with rows, only those. That is how
  a supervisor is given three shops out of five.

  ## The register PIN

  Staff sharing a till switch users between customers. Typing an email and
  password each time is unworkable, so a membership may carry a short PIN.

  A PIN is not a credential on its own — it only unlocks a switch on a device
  that already holds a valid bearer token for the business. Four digits would
  otherwise be brute-forceable in seconds. It is hashed with Argon2 all the
  same, because a leaked PIN would still let someone at the counter act as the
  supervisor who can approve refunds.
  """

  use Kaarobar.Schema

  alias Kaarobar.AccessControl.MembershipRole
  alias Kaarobar.AccessControl.PermissionGrant
  alias Kaarobar.Accounts.User
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.MembershipBranch
  alias Kaarobar.Tenancy.Organization

  @statuses ~w(invited active suspended ended)

  @pin_length 4..8

  schema "memberships" do
    field :employee_code, :string
    field :job_title, :string

    field :pin_hash, :string, redact: true
    field :pin, :string, virtual: true, redact: true

    field :status, :string, default: "active"
    field :started_on, :date
    field :ended_on, :date

    field :settings, :map, default: %{}
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :user, User
    belongs_to :business, Business

    has_many :membership_branches, MembershipBranch
    has_many :branches, through: [:membership_branches, :branch]
    has_many :membership_roles, MembershipRole
    has_many :roles, through: [:membership_roles, :role]
    has_many :permission_grants, PermissionGrant

    timestamps()
  end

  @doc "The statuses a membership may hold."
  def statuses, do: @statuses

  @doc """
  Changeset for creating a membership.

  `organization_id`, `user_id` and `business_id` are set by the context, never
  cast from params — accepting them from a request body would let a caller
  attach a person to a tenant they have no authority over.
  """
  def create_changeset(membership, attrs) do
    membership
    |> cast(attrs, [:employee_code, :job_title, :status, :started_on, :ended_on, :settings])
    |> validate_common()
    |> foreign_key_constraint(:organization_id)
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:business_id)
  end

  @doc "Changeset for editing employment details."
  def update_changeset(membership, attrs) do
    membership
    |> cast(attrs, [:employee_code, :job_title, :started_on, :ended_on, :settings])
    |> validate_common()
  end

  @doc "Changeset for suspending, reinstating or ending a membership."
  def status_changeset(membership, status) when status in @statuses do
    membership
    |> change(status: status)
    |> maybe_set_ended_on(status)
  end

  @doc """
  Changeset for setting or clearing the register PIN.

  Passing `nil` clears it, which is how a shop removes a departed employee's
  ability to switch onto a shared till.
  """
  def pin_changeset(membership, nil), do: change(membership, pin_hash: nil)

  def pin_changeset(membership, pin) when is_binary(pin) do
    membership
    |> cast(%{pin: pin}, [:pin])
    |> validate_required([:pin])
    |> validate_format(:pin, ~r/^\d+$/, message: "must be digits only")
    |> validate_length(:pin, min: Enum.min(@pin_length), max: Enum.max(@pin_length))
    |> validate_pin_not_trivial()
    |> hash_pin()
  end

  @doc "Soft-deletes the membership."
  def soft_delete_changeset(membership) do
    change(membership, deleted_at: DateTime.utc_now(), status: "ended")
  end

  # --- Predicates -------------------------------------------------------------

  @doc "True when the membership currently grants access."
  def active?(%__MODULE__{deleted_at: nil, status: "active"} = membership) do
    not ended?(membership)
  end

  def active?(%__MODULE__{}), do: false

  @doc "True when the employment period has passed."
  def ended?(%__MODULE__{ended_on: nil}), do: false

  def ended?(%__MODULE__{ended_on: ended_on}) do
    Date.compare(ended_on, Date.utc_today()) == :lt
  end

  @doc "True when the membership spans the whole organization rather than one business."
  def organization_wide?(%__MODULE__{business_id: nil}), do: true
  def organization_wide?(%__MODULE__{}), do: false

  @doc "Verifies a register PIN, with a constant-time dummy check when unset."
  def valid_pin?(%__MODULE__{pin_hash: pin_hash}, pin)
      when is_binary(pin_hash) and is_binary(pin) and byte_size(pin) > 0 do
    Argon2.verify_pass(pin, pin_hash)
  end

  def valid_pin?(_membership, _pin) do
    Argon2.no_user_verify()
    false
  end

  @doc """
  The branch ids this membership may act on.

  Returns `:all` when unrestricted, which `Kaarobar.Scope` and
  `Kaarobar.Repo.Scoped` both understand.
  """
  def branch_scope(%__MODULE__{membership_branches: %Ecto.Association.NotLoaded{}}), do: :all
  def branch_scope(%__MODULE__{membership_branches: []}), do: :all

  def branch_scope(%__MODULE__{membership_branches: membership_branches}) do
    MapSet.new(membership_branches, & &1.branch_id)
  end

  # --- Validation -------------------------------------------------------------

  defp validate_common(changeset) do
    changeset
    |> validate_inclusion(:status, @statuses)
    |> validate_length(:employee_code, max: 32)
    |> validate_length(:job_title, max: 120)
    |> validate_dates()
    |> unique_constraint([:organization_id, :user_id],
      name: :memberships_org_wide_unique_index,
      message: "is already a member of this organization"
    )
    |> unique_constraint([:organization_id, :user_id, :business_id],
      name: :memberships_business_unique_index,
      message: "is already a member of this business"
    )
    |> unique_constraint([:business_id, :employee_code],
      name: :memberships_business_id_employee_code_index,
      message: "is already used by another staff member"
    )
  end

  defp validate_dates(changeset) do
    started_on = get_field(changeset, :started_on)
    ended_on = get_field(changeset, :ended_on)

    if started_on && ended_on && Date.compare(ended_on, started_on) == :lt do
      add_error(changeset, :ended_on, "must be on or after the start date")
    else
      changeset
    end
  end

  # "1234" and "0000" are the first things anyone tries at a counter.
  defp validate_pin_not_trivial(changeset) do
    validate_change(changeset, :pin, fn :pin, pin ->
      cond do
        repeated_digits?(pin) -> [pin: "must not be the same digit repeated"]
        sequential_digits?(pin) -> [pin: "must not be a run of consecutive digits"]
        true -> []
      end
    end)
  end

  defp repeated_digits?(pin) do
    pin |> String.graphemes() |> Enum.uniq() |> length() == 1
  end

  defp sequential_digits?(pin) do
    digits = pin |> String.graphemes() |> Enum.map(&String.to_integer/1)

    ascending? = consecutive?(digits, 1)
    descending? = consecutive?(digits, -1)

    ascending? or descending?
  end

  defp consecutive?(digits, step) do
    digits
    |> Enum.chunk_every(2, 1, :discard)
    |> Enum.all?(fn [a, b] -> b - a == step end)
  end

  defp hash_pin(changeset) do
    case get_change(changeset, :pin) do
      nil ->
        changeset

      pin ->
        if changeset.valid? do
          changeset
          |> put_change(:pin_hash, Argon2.hash_pwd_salt(pin))
          |> delete_change(:pin)
        else
          changeset
        end
    end
  end

  defp maybe_set_ended_on(changeset, "ended") do
    case get_field(changeset, :ended_on) do
      nil -> put_change(changeset, :ended_on, Date.utc_today())
      _date -> changeset
    end
  end

  defp maybe_set_ended_on(changeset, _status), do: changeset
end
