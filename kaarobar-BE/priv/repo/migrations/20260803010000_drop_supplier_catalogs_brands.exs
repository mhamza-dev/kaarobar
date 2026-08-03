defmodule Kaarobar.Repo.Migrations.DropSupplierCatalogsBrands do
  use Ecto.Migration

  def change do
    alter table(:suppliers) do
      remove :catalogs, {:array, :string}, default: []
      remove :brands, {:array, :string}, default: []
    end
  end
end
