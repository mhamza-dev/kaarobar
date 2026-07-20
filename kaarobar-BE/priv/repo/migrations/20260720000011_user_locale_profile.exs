defmodule Kaarobar.Repo.Migrations.AddUserLocaleAndProfile do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add :locale, :string, null: false, default: "en"
    end

    create constraint(:users, :users_locale_allowed, check: "locale in ('en', 'ur')")
  end
end
