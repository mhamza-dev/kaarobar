defmodule Kaarobar.DataCase do
  @moduledoc """
  Setup for tests that touch the data layer.

  Reference data — permissions and system roles — is already committed to the
  test database by `test_helper.exs`, so the sandbox transaction here wraps only
  the data a test creates for itself.
  """

  use ExUnit.CaseTemplate

  using do
    quote do
      alias Kaarobar.Repo

      import Ecto
      import Ecto.Changeset
      import Ecto.Query
      import Kaarobar.DataCase
      import Kaarobar.Factory
    end
  end

  setup tags do
    Kaarobar.DataCase.setup_sandbox(tags)
    :ok
  end

  @doc """
  Sets up the sandbox based on the test tags.
  """
  def setup_sandbox(tags) do
    pid = Ecto.Adapters.SQL.Sandbox.start_owner!(Kaarobar.Repo, shared: not tags[:async])
    on_exit(fn -> Ecto.Adapters.SQL.Sandbox.stop_owner(pid) end)
  end

  @doc """
  A helper that transforms changeset errors into a map of messages.

      assert {:error, changeset} = Accounts.create_user(%{password: "short"})
      assert "password is too short" in errors_on(changeset).password
      assert %{password: ["password is too short"]} = errors_on(changeset)

  """
  def errors_on(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {message, opts} ->
      Regex.replace(~r"%{(\w+)}", message, fn _whole, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end
end
