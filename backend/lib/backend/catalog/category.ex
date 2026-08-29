defmodule Kaarobar.Catalog.Category do
  @moduledoc """
  A node in the catalog tree.

  Nesting is stored as a materialised `path` — `"/<root id>/<child id>/"` — so
  fetching a whole subtree is one indexed prefix match rather than a recursive
  query. The tree is read on every catalog and POS screen and rewritten almost
  never, so the cost belongs on the write.

  Depth is capped at five. Deeper trees are not a database problem, they are a
  usability one: nobody finds a product six taps down on a till screen.
  """

  use Kaarobar.Schema

  alias Kaarobar.Catalog.Category
  alias Kaarobar.Slug
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @max_depth 5

  schema "categories" do
    field :name, :string
    field :slug, :string
    field :description, :string
    field :image_url, :string

    field :path, :string, default: "/"
    field :depth, :integer, default: 0
    field :sort_order, :integer, default: 0

    field :is_active, :boolean, default: true
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :parent, Category

    has_many :children, Category, foreign_key: :parent_id

    timestamps()
  end

  @doc "The deepest a category tree may nest."
  def max_depth, do: @max_depth

  @doc """
  Changeset for a category.

  `path` and `depth` are derived from the parent rather than accepted from the
  client — they are an index, not user input, and a client that could write
  them could make a category appear inside somebody else's tree.
  """
  def changeset(category, attrs, parent \\ nil) do
    category
    |> cast(attrs, [:name, :slug, :description, :image_url, :sort_order, :is_active])
    |> maybe_generate_slug()
    |> put_placement(parent)
    |> validate_required([:name, :slug])
    |> update_change(:name, &String.trim/1)
    |> validate_length(:name, min: 1, max: 120)
    |> validate_length(:description, max: 1000)
    |> validate_format(:slug, ~r/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      message: "may only contain lowercase letters, numbers and hyphens"
    )
    |> validate_number(:depth, less_than_or_equal_to: @max_depth,
      message: "would nest categories more than #{@max_depth} levels deep"
    )
    |> unique_constraint(:slug,
      name: :categories_business_id_slug_index,
      message: "is already taken"
    )
    |> foreign_key_constraint(:parent_id)
  end

  @doc "Soft-deletes the category."
  def soft_delete_changeset(category), do: change(category, deleted_at: DateTime.utc_now())

  @doc """
  The path a child of this category would have.

  Paths are built from the parent's, so a category's ancestry is readable from
  the row itself without walking upward.
  """
  @spec child_path(t()) :: String.t()
  def child_path(%Category{} = category), do: category.path <> category.id <> "/"

  @doc "The ids of every ancestor, root first."
  @spec ancestor_ids(t()) :: [Ecto.UUID.t()]
  def ancestor_ids(%Category{path: path}), do: String.split(path, "/", trim: true)

  # The root's own path is "/"; a child's is its parent's path plus the
  # parent's id. Setting both here keeps them impossible to disagree.
  defp put_placement(changeset, nil) do
    changeset
    |> put_change(:parent_id, nil)
    |> put_change(:path, "/")
    |> put_change(:depth, 0)
  end

  defp put_placement(changeset, %Category{} = parent) do
    changeset
    |> put_change(:parent_id, parent.id)
    |> put_change(:path, child_path(parent))
    |> put_change(:depth, parent.depth + 1)
  end

  defp maybe_generate_slug(changeset) do
    case get_field(changeset, :slug) do
      nil -> put_change(changeset, :slug, Slug.slugify(get_field(changeset, :name), "category"))
      _slug -> update_change(changeset, :slug, &Slug.slugify(&1, "category"))
    end
  end
end
