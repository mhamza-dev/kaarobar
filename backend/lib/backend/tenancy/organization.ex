defmodule Kaarobar.Tenancy.Organization do
  @moduledoc """
  The tenant root: one owner's account, and the billing boundary.

  An owner running a clothing shop and a restaurant has one organization, one
  subscription, and consolidated reporting across both. Every tenant-owned row
  in the system carries this id, which is what both the query-scoping layer and
  the row-level security policies filter on.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Slug
  alias Kaarobar.Tenancy.Business

  @statuses ~w(active trialing past_due suspended cancelled)

  schema "organizations" do
    field :name, :string
    field :slug, :string

    field :country_code, :string
    field :default_currency, :string, default: "PKR"
    field :timezone, :string, default: "UTC"
    field :default_locale, :string, default: "en"

    field :status, :string, default: "active"
    field :settings, :map, default: %{}

    field :deleted_at, :utc_datetime_usec

    belongs_to :owner, User
    has_many :businesses, Business

    timestamps()
  end

  @doc "The statuses an organization may hold."
  def statuses, do: @statuses

  @doc """
  Changeset for creating an organization.

  `owner_id` is set explicitly by the context rather than cast from params —
  accepting it from the request body would let anyone create an organization
  owned by somebody else.
  """
  def create_changeset(organization, attrs) do
    organization
    |> cast(attrs, [
      :name,
      :slug,
      :country_code,
      :default_currency,
      :timezone,
      :default_locale,
      :settings
    ])
    |> maybe_generate_slug()
    |> validate_common()
    |> foreign_key_constraint(:owner_id)
  end

  @doc """
  Changeset for editing an organization.

  The slug is not editable. It appears in links that customers and staff have
  already saved, and renaming it silently breaks them.
  """
  def update_changeset(organization, attrs) do
    organization
    |> cast(attrs, [
      :name,
      :country_code,
      :default_currency,
      :timezone,
      :default_locale,
      :settings
    ])
    |> validate_common()
  end

  @doc "Changeset for a subscription or administrative status change."
  def status_changeset(organization, status) when status in @statuses do
    change(organization, status: status)
  end

  @doc "Changeset for transferring ownership to another user."
  def owner_changeset(organization, %User{} = owner) do
    change(organization, owner_id: owner.id)
  end

  @doc "Soft-deletes the organization."
  def soft_delete_changeset(organization) do
    change(organization, deleted_at: DateTime.utc_now(), status: "cancelled")
  end

  @doc "True when the organization may be used at all."
  def active?(%__MODULE__{deleted_at: nil, status: status}),
    do: status in ~w(active trialing past_due)

  def active?(%__MODULE__{}), do: false

  defp validate_common(changeset) do
    changeset
    |> validate_required([:name, :slug, :default_currency, :timezone])
    |> update_change(:name, &String.trim/1)
    |> validate_length(:name, min: 1, max: 160)
    |> validate_format(:slug, ~r/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      message: "may only contain lowercase letters, numbers and hyphens"
    )
    |> validate_length(:slug, min: 2, max: 64)
    |> validate_length(:default_currency, is: 3)
    |> validate_format(:default_currency, ~r/^[A-Z]{3}$/,
      message: "must be a three-letter ISO 4217 code"
    )
    |> validate_length(:country_code, is: 2)
    |> validate_inclusion(:status, @statuses)
    |> unique_constraint(:slug)
  end

  defp maybe_generate_slug(changeset) do
    case get_field(changeset, :slug) do
      nil -> put_change(changeset, :slug, Slug.slugify(get_field(changeset, :name), "org"))
      _slug -> update_change(changeset, :slug, &Slug.slugify(&1, "org"))
    end
  end
end
