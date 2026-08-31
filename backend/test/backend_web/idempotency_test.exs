defmodule KaarobarWeb.IdempotencyTest do
  @moduledoc """
  A till on a weak connection sends a write, times out, and sends it again.
  These tests are the difference between that being harmless and it being a
  duplicate charge.
  """

  use KaarobarWeb.ConnCase, async: true

  alias Kaarobar.Idempotency
  alias Kaarobar.Tenancy

  setup do
    %{scope: owner, user: user, business: business} = owner_scope()
    %{owner: owner, user: user, business: business, key: Ecto.UUID.generate()}
  end

  defp create_branch(conn, user, business, key, name) do
    conn
    |> sign_in(user, business)
    |> with_idempotency_key(key)
    |> post(~p"/api/v1/branches", %{"name" => name, "code" => "IDEM"})
  end

  describe "a repeated request" do
    test "is performed once and replayed thereafter", %{
      conn: conn,
      user: user,
      business: business,
      owner: owner,
      key: key
    } do
      first = create_branch(conn, user, business, key, "Second branch")
      assert %{"id" => id} = json_data(first, 201)

      second = create_branch(build_conn(), user, business, key, "Second branch")

      assert %{"id" => ^id} = json_data(second, 201)
      assert get_resp_header(second, "idempotent-replay") == ["true"]

      # One branch created, not two — and crucially the unique code constraint
      # was never even reached, because the work did not run again.
      names = owner |> Tenancy.list_branches() |> Enum.map(& &1.name)
      assert Enum.count(names, &(&1 == "Second branch")) == 1
    end

    test "with the same key but a different body is refused", %{
      conn: conn,
      user: user,
      business: business,
      key: key
    } do
      create_branch(conn, user, business, key, "Second branch")

      changed = create_branch(build_conn(), user, business, key, "A different branch")

      assert %{"code" => "conflict"} = json_error(changed, 409)
    end

    test "without a key runs every time", %{conn: conn, user: user, business: business} do
      first =
        conn
        |> sign_in(user, business)
        |> post(~p"/api/v1/branches", %{"name" => "One", "code" => "AAA"})

      second =
        build_conn()
        |> sign_in(user, business)
        |> post(~p"/api/v1/branches", %{"name" => "Two", "code" => "BBB"})

      assert json_data(first, 201)["id"] != json_data(second, 201)["id"]
    end
  end

  describe "failures" do
    test "are not replayed, so the client can fix the input and retry", %{
      conn: conn,
      user: user,
      business: business,
      key: key
    } do
      # Missing name — a validation failure.
      rejected =
        conn
        |> sign_in(user, business)
        |> with_idempotency_key(key)
        |> post(~p"/api/v1/branches", %{"code" => "AAA"})

      assert json_error(rejected, 422)

      stored = Idempotency.fetch(business.organization_id, key)
      assert stored.status == "failed"
    end
  end

  describe "scoping" do
    test "a key is scoped to its organization", %{
      conn: conn,
      user: user,
      business: business,
      key: key
    } do
      create_branch(conn, user, business, key, "Ours")

      # Another tenant reusing the same key must not receive our response.
      %{user: other_user, business: other_business} = owner_scope()

      theirs = create_branch(build_conn(), other_user, other_business, key, "Theirs")

      assert %{"name" => "Theirs"} = json_data(theirs, 201)
      assert get_resp_header(theirs, "idempotent-replay") == []
    end
  end

  describe "GET requests" do
    test "are never keyed, since they change nothing", %{
      conn: conn,
      user: user,
      business: business,
      key: key
    } do
      conn
      |> sign_in(user, business)
      |> with_idempotency_key(key)
      |> get(~p"/api/v1/branches")
      |> json_data(200)

      assert is_nil(Idempotency.fetch(business.organization_id, key))
    end
  end

  describe "the context directly" do
    test "reports an in-flight request rather than racing it", %{business: business} do
      attrs = %{
        organization_id: business.organization_id,
        key: "shared-key-value",
        request_method: "POST",
        request_path: "/api/v1/sales",
        body: %{"total" => "100"}
      }

      assert {:ok, _claimed} = Idempotency.claim(attrs)
      assert {:error, :in_progress} = Idempotency.claim(attrs)
    end

    test "replays a completed response", %{business: business} do
      attrs = %{
        organization_id: business.organization_id,
        key: "completed-key",
        request_method: "POST",
        request_path: "/api/v1/sales",
        body: %{"total" => "100"}
      }

      {:ok, claimed} = Idempotency.claim(attrs)
      :ok = Idempotency.complete(claimed, 201, %{"data" => %{"id" => "abc"}})

      assert {:replay, 201, %{"data" => %{"id" => "abc"}}} = Idempotency.claim(attrs)
    end

    test "releases a failed key so the client may retry", %{business: business} do
      attrs = %{
        organization_id: business.organization_id,
        key: "failed-key",
        request_method: "POST",
        request_path: "/api/v1/sales",
        body: %{"total" => "100"}
      }

      {:ok, claimed} = Idempotency.claim(attrs)
      :ok = Idempotency.fail(claimed)

      assert {:ok, _reopened} = Idempotency.claim(attrs)
    end

    test "prunes expired keys", %{business: business} do
      {:ok, claimed} =
        Idempotency.claim(%{
          organization_id: business.organization_id,
          key: "old-key-0001",
          request_method: "POST",
          request_path: "/api/v1/sales",
          body: %{}
        })

      claimed
      |> Ecto.Changeset.change(expires_at: DateTime.add(DateTime.utc_now(), -60, :second))
      |> Repo.update!()

      assert {1, nil} = Idempotency.prune_expired()
    end
  end
end
