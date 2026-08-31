defmodule Kaarobar.Tenancy.Business do
  @moduledoc """
  One trading entity: a shop, a restaurant, a salon.

  `business_type` is the key into `Kaarobar.Verticals`, and it is the single
  most consequential field in the system. It decides which modules the business
  can reach, which product kinds its catalog may hold, and which fields its
  sales must carry. It is validated against the registry in code rather than by
  a database constraint, so adding a vertical never requires a migration.

  `enabled_modules` is the owner's narrowing of that set — a café that never
  does delivery switches the module off. It can only remove, never add: a salon
  cannot grant itself dining tables by editing a field.
  """

  use Kaarobar.Schema

  alias Kaarobar.Slug
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Organization
  alias Kaarobar.Verticals

  @statuses ~w(active suspended archived)

  schema "businesses" do
    field :name, :string
    field :slug, :string
    field :business_type, :string

    field :currency, :string
    field :timezone, :string, default: "UTC"
    field :default_locale, :string, default: "en"

    field :legal_name, :string
    field :tax_number, :string
    field :license_number, :string
    # Who issued it and when it lapses — a register has to name both.
    field :license_authority, :string
    field :license_expires_on, :date

    field :phone, :string
    field :email, :string
    field :website, :string
    field :logo_url, :string
    field :brand_color, :string

    field :enabled_modules, {:array, :string}
    field :prices_include_tax, :boolean, default: false

    # How stock is valued, and whether it may go below zero. Both are read by
    # `Kaarobar.Inventory.Ledger` on every movement.
    field :costing_method, :string, default: "weighted_average"
    field :allow_negative_stock, :boolean, default: false
    field :default_stock_branch_id, Kaarobar.Ecto.UUIDv7

    # The smallest coin the shop can actually hand over. Where it is larger
    # than the smallest unit of account — no 1-rupee coins in circulation — a
    # cash total has to be rounded to something payable, and the difference
    # recorded rather than absorbed.
    field :cash_rounding_increment, :decimal

    field :settings, :map, default: %{}
    field :receipt_settings, :map, default: %{}
    field :social, :map, default: %{}

    field :status, :string, default: "active"
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    has_many :branches, Branch

    timestamps()
  end

  @doc "The statuses a business may hold."
  def statuses, do: @statuses

  @doc """
  Changeset for creating a business.

  `organization_id` is set by the context from the request scope, never cast
  from params.
  """
  def create_changeset(business, attrs) do
    business
    |> cast(attrs, create_fields())
    |> maybe_generate_slug()
    |> validate_business_type()
    |> validate_common()
    |> foreign_key_constraint(:organization_id)
  end

  @doc """
  Changeset for editing a business.

  Neither `slug` nor `business_type` may change. The slug is in saved links.
  The type is load-bearing in a way that is easy to underestimate: switching a
  restaurant to a salon would orphan its tables, invalidate the service mode on
  every historical sale, and permit product kinds its catalog was never built
  for. Changing vertical means creating a new business.
  """
  def update_changeset(business, attrs) do
    business
    |> cast(attrs, update_fields())
    |> validate_enabled_modules()
    |> validate_common()
  end

  @doc "Changeset for an administrative status change."
  def status_changeset(business, status) when status in @statuses do
    change(business, status: status)
  end

  @doc "Soft-deletes the business."
  def soft_delete_changeset(business) do
    change(business, deleted_at: DateTime.utc_now(), status: "archived")
  end

  @doc "True when the business may be traded through."
  def active?(%__MODULE__{deleted_at: nil, status: "active"}), do: true
  def active?(%__MODULE__{}), do: false

  @doc "Delegates to the vertical registry, honouring this business's overrides."
  def module_enabled?(%__MODULE__{} = business, module),
    do: Verticals.module_enabled?(business, module)

  defp create_fields do
    [
      :name,
      :slug,
      :business_type,
      :currency,
      :timezone,
      :default_locale,
      :legal_name,
      :tax_number,
      :license_number,
      :license_authority,
      :license_expires_on,
      :phone,
      :email,
      :website,
      :logo_url,
      :brand_color,
      :prices_include_tax,
      :costing_method,
      :allow_negative_stock,
      :default_stock_branch_id,
      :cash_rounding_increment,
      :settings,
      :receipt_settings,
      :social
    ]
  end

  defp update_fields do
    (create_fields() -- [:slug, :business_type]) ++ [:enabled_modules]
  end

  defp validate_common(changeset) do
    changeset
    |> validate_required([:name, :slug, :business_type, :currency, :timezone])
    |> update_change(:name, &String.trim/1)
    |> validate_length(:name, min: 1, max: 160)
    |> validate_format(:slug, ~r/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      message: "may only contain lowercase letters, numbers and hyphens"
    )
    |> validate_length(:slug, min: 2, max: 64)
    |> validate_format(:currency, ~r/^[A-Z]{3}$/,
      message: "must be a three-letter ISO 4217 code"
    )
    |> validate_format(:brand_color, ~r/^#[0-9a-fA-F]{6}$/,
      message: "must be a hex colour such as #2d6df6"
    )
    |> validate_length(:website, max: 2048)
    |> validate_length(:logo_url, max: 2048)
    |> validate_inclusion(:status, @statuses)
    |> validate_inclusion(:costing_method, ~w(weighted_average fifo))
    |> validate_number(:cash_rounding_increment, greater_than: 0)
    |> unique_constraint(:slug,
      name: :businesses_organization_id_slug_index,
      message: "is already taken in this organization"
    )
  end

  defp validate_business_type(changeset) do
    validate_change(changeset, :business_type, fn :business_type, type ->
      if Verticals.known_type?(type) do
        []
      else
        [business_type: "is not a supported kind of business"]
      end
    end)
  end

  # An override may only narrow. Anything the vertical does not offer is
  # dropped rather than rejected, so a client sending a stale module list gets
  # a sensible result instead of a validation error it cannot act on.
  defp validate_enabled_modules(changeset) do
    case get_change(changeset, :enabled_modules) do
      nil ->
        changeset

      modules ->
        allowed =
          changeset
          |> get_field(:business_type)
          |> Verticals.modules_for()

        put_change(changeset, :enabled_modules, Enum.filter(modules, &(&1 in allowed)))
    end
  end

  defp maybe_generate_slug(changeset) do
    case get_field(changeset, :slug) do
      nil -> put_change(changeset, :slug, Slug.slugify(get_field(changeset, :name), "biz"))
      _slug -> update_change(changeset, :slug, &Slug.slugify(&1, "biz"))
    end
  end
end
