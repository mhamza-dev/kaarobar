defmodule Kaarobar.Accounts.CodesTest do
  use ExUnit.Case, async: true

  alias Kaarobar.Accounts.Codes

  test "shop_initials from multi-word name" do
    assert Codes.shop_initials("Glow Studio Salon") == "GSS"
  end

  test "branch_code_from_name" do
    assert Codes.branch_code_from_name("Main Branch") == "MB"
    assert Codes.branch_code_from_name("") == "MAIN"
  end
end
