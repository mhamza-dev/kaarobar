defmodule Kaarobar.CrmTemplateVariablesTest do
  use Kaarobar.DataCase, async: true

  alias Kaarobar.{Accounts, Crm, Tenancy}

  # CRM-FR-002 — template placeholder catalog for campaign messages
  test "list_template_variables returns canonical flat placeholders" do
    {:ok, owner} =
      Accounts.register(%{
        email: "tpl-vars-#{System.unique_integer()}@test.local",
        password: "password123",
        name: "Tpl Owner"
      })

    {:ok, biz} =
      Tenancy.create_business(owner.id, %{
        name: "Demo Mart",
        tagline: "Fresh daily",
        marketplace_description: "Neighborhood store"
      })

    %{variables: vars, sample_values: samples} = Crm.list_template_variables(biz.id)

    keys = Enum.map(vars, & &1["key"])
    assert keys == ["business", "tagline", "description", "name", "points"]

    assert Enum.find(vars, &(&1["key"] == "business"))["example"] == "Demo Mart"
    assert Enum.find(vars, &(&1["key"] == "name"))["placeholder"] == "{{name}}"
    assert samples["business"] == "Demo Mart"
    assert samples["name"] == "Ayesha"
    assert samples["points"] == "120"
  end

  test "render_template substitutes flat keys only" do
    rendered =
      Crm.render_template(
        "{{business}} for {{name}}",
        "You have {{points}} pts. {{missing}}",
        %{"business" => "Shop", "name" => "Ali", "points" => "50"}
      )

    assert rendered.title == "Shop for Ali"
    assert rendered.message == "You have 50 pts. {{missing}}"
  end
end
