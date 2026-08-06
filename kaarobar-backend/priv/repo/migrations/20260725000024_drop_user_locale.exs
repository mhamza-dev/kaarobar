defmodule Kaarobar.Repo.Migrations.DropUserLocale do
  use Ecto.Migration

  def change do
    drop_if_exists constraint(:users, :users_locale_allowed)

    alter table(:users) do
      remove :locale, :string, default: "en"
    end
  end
end
