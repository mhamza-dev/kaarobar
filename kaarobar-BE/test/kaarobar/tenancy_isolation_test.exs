defmodule Kaarobar.TenancyIsolationTest do
  use Kaarobar.DataCase

  alias Kaarobar.{Accounts, Tenancy}

  test "owner cannot list another owner's businesses" do
    {:ok, owner_a} =
      Accounts.register(%{
        email: "owner-a-#{System.unique_integer()}@test.local",
        password: "password123",
        name: "Owner A"
      })

    {:ok, owner_b} =
      Accounts.register(%{
        email: "owner-b-#{System.unique_integer()}@test.local",
        password: "password123",
        name: "Owner B"
      })

    {:ok, _biz_a} = Tenancy.create_business(owner_a.id, %{name: "Business A"})
    {:ok, _biz_b} = Tenancy.create_business(owner_b.id, %{name: "Business B"})

    a_list = Tenancy.list_businesses_for_owner(owner_a.id)
    b_list = Tenancy.list_businesses_for_owner(owner_b.id)

    assert length(a_list) == 1
    assert length(b_list) == 1
    assert hd(a_list).name == "Business A"
    assert hd(b_list).name == "Business B"
    refute Enum.any?(a_list, &(&1.owner_id == owner_b.id))
    refute Tenancy.user_can_access_business?(owner_a, hd(b_list).id)
  end
end
