defmodule Kaarobar.Catalog.Brand do
  @moduledoc """
  A manufacturer or label.

  Separate from category because they answer different questions: a category is
  where a shopper looks, a brand is who made it. A pesticide dealer reports by
  brand for the manufacturer and by category for the customer, and collapsing
  the two loses one of those reports.
  """

  use Kaarobar.Schema

  alias Kaarobar.Slug
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  schema "brands" do
    field :name, :string
    field :slug, :string
    field :logo_url, :string
    field :is_active, :boolean, default: true
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business

    timestamps()
  end

  def changeset(brand, attrs) do
    brand
    |> cast(attrs, [:name, :slug, :logo_url, :is_active])
    |> maybe_generate_slug()
    |> validate_required([:name, :slug])
    |> update_change(:name, &String.trim/1)
    |> validate_length(:name, min: 1, max: 120)
    |> validate_length(:logo_url, max: 2048)
    |> validate_format(:slug, ~r/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      message: "may only contain lowercase letters, numbers and hyphens"
    )
    |> unique_constraint(:slug,
      name: :brands_business_id_slug_index,
      message: "is already taken"
    )
  end

  @doc "Soft-deletes the brand."
  def soft_delete_changeset(brand), do: change(brand, deleted_at: DateTime.utc_now())

  defp maybe_generate_slug(changeset) do
    case get_field(changeset, :slug) do
      nil -> put_change(changeset, :slug, Slug.slugify(get_field(changeset, :name), "brand"))
      _slug -> update_change(changeset, :slug, &Slug.slugify(&1, "brand"))
    end
  end
end
