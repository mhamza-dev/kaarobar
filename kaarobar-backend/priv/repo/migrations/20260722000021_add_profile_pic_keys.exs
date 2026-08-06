defmodule Kaarobar.Repo.Migrations.AddProfilePicKeys do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add :profile_pic_key, :string
    end

    alter table(:customers) do
      add :profile_pic_key, :string
    end

    alter table(:employees) do
      add :profile_pic_key, :string
    end
  end
end
