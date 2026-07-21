defmodule Kaarobar.NotificationsTest do
  use Kaarobar.DataCase

  alias Kaarobar.{Accounts, Notifications}
  alias Kaarobar.Schemas.Notification
  alias Kaarobar.Workers.NotificationWorker

  setup do
    {:ok, owner} =
      Accounts.register(%{
        email: "owner-#{System.unique_integer()}@test.local",
        password: "password123",
        name: "Owner"
      })

    {:ok, user} =
      Accounts.register(%{
        email: "staff-#{System.unique_integer()}@test.local",
        password: "password123",
        name: "Staff"
      })

    %{owner: owner, user: user}
  end

  test "get_or_create_preferences defaults all channels on", %{user: user} do
    pref = Notifications.get_or_create_preferences(user.id)
    assert pref.email
    assert pref.in_app
    assert pref.push
    assert pref.muted_types == []
  end

  test "update_preferences persists channel toggles", %{user: user} do
    assert {:ok, pref} =
             Notifications.update_preferences(user.id, %{
               email: false,
               in_app: true,
               push: false,
               muted_types: ["leave_request"]
             })

    assert pref.email == false
    assert pref.push == false
    assert "leave_request" in pref.muted_types
  end

  test "notify fans out in_app + email when prefs allow", %{owner: owner, user: user} do
    assert {:ok, created} =
             Notifications.notify(user.id, owner.id, "leave_request", %{"message" => "Please review"},
               title: "Leave request",
               body: "Please review"
             )

    channels = created |> Enum.map(& &1.channel) |> Enum.sort()
    assert channels == ["email", "in_app"]

    inbox = Notifications.list_for_user(user.id)
    assert length(inbox) == 1
    assert hd(inbox).channel == "in_app"
  end

  test "notify skips disabled channels", %{owner: owner, user: user} do
    {:ok, _} =
      Notifications.update_preferences(user.id, %{
        email: false,
        in_app: true,
        push: false
      })

    assert {:ok, created} =
             Notifications.notify(user.id, owner.id, "payroll.approved", %{},
               title: "Payroll",
               body: "Approved"
             )

    assert Enum.map(created, & &1.channel) == ["in_app"]
  end

  test "notify respects muted_types", %{owner: owner, user: user} do
    {:ok, _} =
      Notifications.update_preferences(user.id, %{muted_types: ["billing.limit"]})

    assert {:ok, :muted} =
             Notifications.notify(user.id, owner.id, "billing.limit", %{}, title: "Billing")

    assert Notifications.list_for_user(user.id) == []
  end

  test "notify does not create push without device tokens", %{owner: owner, user: user} do
    {:ok, _} =
      Notifications.update_preferences(user.id, %{
        email: false,
        in_app: false,
        push: true
      })

    assert {:ok, []} =
             Notifications.notify(user.id, owner.id, "leave_request", %{}, title: "Leave")
  end

  test "notify creates push when push on and token present", %{owner: owner, user: user} do
    {:ok, _} =
      Notifications.upsert_device_token(user.id, "ios", "ExponentPushToken[test-token]")

    {:ok, _} =
      Notifications.update_preferences(user.id, %{
        email: false,
        in_app: false,
        push: true
      })

    assert {:ok, [push]} =
             Notifications.notify(user.id, owner.id, "leave_request", %{}, title: "Leave")

    assert push.channel == "push"
  end

  test "unread_count and mark_all_read", %{owner: owner, user: user} do
    {:ok, _} =
      Notifications.update_preferences(user.id, %{
        email: false,
        in_app: true,
        push: false
      })

    {:ok, _} = Notifications.notify(user.id, owner.id, "a", %{}, title: "A")
    {:ok, _} = Notifications.notify(user.id, owner.id, "b", %{}, title: "B")

    assert Notifications.unread_count(user.id) == 2
    assert {:ok, 2} = Notifications.mark_all_read(user.id)
    assert Notifications.unread_count(user.id) == 0
  end

  test "in_app worker marks sent without external deliver", %{owner: owner, user: user} do
    {:ok, _} =
      Notifications.update_preferences(user.id, %{
        email: false,
        in_app: true,
        push: false
      })

    {:ok, [n]} = Notifications.notify(user.id, owner.id, "leave_request", %{}, title: "Leave")

    assert :ok = NotificationWorker.perform(%Oban.Job{args: %{"notification_id" => n.id}})

    refreshed = Repo.get!(Notification, n.id)
    assert refreshed.status == "sent"
    assert refreshed.sent_at
  end

  test "push deliver succeeds with no devices (no-op)", %{owner: owner, user: user} do
    {:ok, n} =
      Notifications.enqueue(%{
        user_id: user.id,
        owner_id: owner.id,
        channel: "push",
        type: "leave_request",
        title: "Leave",
        body: "Hi",
        payload: %{}
      })

    assert {:ok, :no_devices} = Notifications.deliver(n)
  end
end
