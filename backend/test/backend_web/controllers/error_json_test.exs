defmodule KaarobarWeb.ErrorJSONTest do
  use ExUnit.Case, async: true

  alias KaarobarWeb.ErrorJSON

  test "renders 404 in the standard envelope" do
    assert ErrorJSON.render("404.json", %{}) ==
             %{error: %{code: "not_found", message: "Not Found"}}
  end

  test "renders 500 in the standard envelope" do
    assert ErrorJSON.render("500.json", %{}) ==
             %{error: %{code: "internal_server_error", message: "Internal Server Error"}}
  end

  test "derives a machine-readable code for any status" do
    assert %{error: %{code: "unsupported_media_type"}} = ErrorJSON.render("415.json", %{})
    assert %{error: %{code: "unauthorized"}} = ErrorJSON.render("401.json", %{})
  end
end
