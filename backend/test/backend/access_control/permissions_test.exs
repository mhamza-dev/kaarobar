defmodule Kaarobar.AccessControl.PermissionsTest do
  use ExUnit.Case, async: true

  alias Kaarobar.AccessControl.Permissions

  describe "catalogue integrity" do
    test "keys are unique" do
      keys = Permissions.keys()

      assert length(keys) == length(Enum.uniq(keys))
    end

    test "every key is in resource:action form" do
      for key <- Permissions.keys() do
        assert key =~ ~r/^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$/, "#{key} is not resource:action"
      end
    end

    test "every permission carries a group and a human label" do
      for permission <- Permissions.all() do
        assert is_atom(permission.group)
        assert is_binary(permission.label) and permission.label != ""
      end
    end

    test "the catalogue is large enough to be meaningful" do
      # A guard against someone collapsing the model back to a handful of
      # coarse roles: the whole point is that a shop can draw its own lines.
      assert length(Permissions.keys()) > 100
    end
  end

  describe "known?/1" do
    test "accepts catalogued keys" do
      assert Permissions.known?("sales:checkout")
      assert Permissions.known?("stock:transfer_approve")
    end

    test "rejects anything else, including near misses" do
      refute Permissions.known?("sales:checkuot")
      refute Permissions.known?("sales:*")
      refute Permissions.known?("")
      refute Permissions.known?(:"sales:checkout")
      refute Permissions.known?(nil)
    end
  end

  describe "separation of duties" do
    test "requesting a refund is a different permission from approving one" do
      assert Permissions.known?("sale:refund_request")
      assert Permissions.known?("sale:refund_approve")
    end

    test "seeing your own sales is a different permission from seeing everyone's" do
      assert Permissions.known?("sale:view")
      assert Permissions.known?("sale:view_all")
    end

    test "applying a discount is a different permission from overriding the limit" do
      assert Permissions.known?("discount:apply")
      assert Permissions.known?("discount:override")
    end

    test "moving stock between branches needs a second person" do
      assert Permissions.known?("stock:transfer")
      assert Permissions.known?("stock:transfer_approve")
    end
  end

  describe "grouping" do
    test "by_group/0 accounts for every permission exactly once" do
      grouped = Permissions.by_group()

      total = grouped |> Map.values() |> Enum.map(&length/1) |> Enum.sum()

      assert total == length(Permissions.keys())
      assert Map.keys(grouped) |> Enum.sort() == Enum.sort(Permissions.groups())
    end

    test "keys_in/1 returns only that group's keys" do
      report_keys = Permissions.keys_in(:reports)

      assert "report:sales" in report_keys
      refute "sales:checkout" in report_keys
    end

    test "keys_in/1 is empty for an unknown group" do
      assert Permissions.keys_in(:nonexistent) == []
    end
  end

  describe "expand/1" do
    test "turns group atoms into their keys and passes strings through" do
      expanded = Permissions.expand([:reports, "sales:checkout"])

      assert "report:sales" in expanded
      assert "sales:checkout" in expanded
    end

    test "removes duplicates" do
      expanded = Permissions.expand([:reports, "report:sales", "report:sales"])

      assert Enum.count(expanded, &(&1 == "report:sales")) == 1
    end
  end

  describe "fetch/1" do
    test "returns the catalogue entry" do
      assert {:ok, %{key: "sales:checkout", group: :sales, label: label}} =
               Permissions.fetch("sales:checkout")

      assert is_binary(label)
    end

    test "returns :error for an unknown key" do
      assert :error = Permissions.fetch("sales:teleport")
    end
  end
end
