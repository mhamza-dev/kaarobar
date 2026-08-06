defmodule Kaarobar.Repo.Migrations.RenameNotificationPreferenceChannels do
  use Ecto.Migration

  def up do
    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'notification_preferences' AND column_name = 'email_enabled'
      ) THEN
        ALTER TABLE notification_preferences RENAME COLUMN email_enabled TO email;
        ALTER TABLE notification_preferences RENAME COLUMN in_app_enabled TO in_app;
        ALTER TABLE notification_preferences RENAME COLUMN out_app_enabled TO push;
      END IF;
    END $$;
    """)
  end

  def down do
    execute("""
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'notification_preferences' AND column_name = 'email'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'notification_preferences' AND column_name = 'push'
      ) THEN
        ALTER TABLE notification_preferences RENAME COLUMN email TO email_enabled;
        ALTER TABLE notification_preferences RENAME COLUMN in_app TO in_app_enabled;
        ALTER TABLE notification_preferences RENAME COLUMN push TO out_app_enabled;
      END IF;
    END $$;
    """)
  end
end
