defmodule Kaarobar.VerticalsTest do
  use ExUnit.Case, async: true

  alias Kaarobar.Verticals

  describe "registry integrity" do
    test "every business type declares only known modules" do
      known = MapSet.new(Verticals.modules())

      for type <- Verticals.business_types() do
        {:ok, definition} = Verticals.fetch(type)
        unknown = MapSet.difference(MapSet.new(definition.modules), known)

        assert MapSet.size(unknown) == 0,
               "#{type} declares unknown modules: #{inspect(MapSet.to_list(unknown))}"
      end
    end

    test "every business type declares only known product kinds" do
      known = MapSet.new(Verticals.product_kinds())

      for type <- Verticals.business_types() do
        unknown = MapSet.difference(MapSet.new(Verticals.product_kinds_for(type)), known)

        assert MapSet.size(unknown) == 0,
               "#{type} declares unknown product kinds: #{inspect(MapSet.to_list(unknown))}"
      end
    end

    test "every business type has a label and at least one product kind" do
      for type <- Verticals.business_types() do
        assert is_binary(Verticals.label(type))
        assert Verticals.product_kinds_for(type) != []
      end
    end

    test "the default type is a real type" do
      assert Verticals.known_type?(Verticals.default_type())
    end

    test "an unknown type is rejected rather than silently treated as retail" do
      refute Verticals.known_type?("crypto_mine")
      assert :error = Verticals.fetch("crypto_mine")
    end

    test "grouped/0 covers every type exactly once" do
      grouped_count =
        Verticals.grouped()
        |> Map.values()
        |> Enum.map(&length/1)
        |> Enum.sum()

      assert grouped_count == length(Verticals.business_types())
    end
  end

  describe "modules per vertical" do
    test "core modules are available to every business type" do
      for type <- Verticals.business_types(), module <- Verticals.core_modules() do
        assert Verticals.module_enabled?(type, module),
               "#{type} should always have the core module #{module}"
      end
    end

    test "a restaurant has dining tables and a kitchen; a salon has neither" do
      assert Verticals.module_enabled?("restaurant", "tables")
      assert Verticals.module_enabled?("restaurant", "kitchen")

      refute Verticals.module_enabled?("salon", "tables")
      refute Verticals.module_enabled?("salon", "kitchen")
    end

    test "a salon books appointments and pays commission; a hardware store does not" do
      assert Verticals.module_enabled?("salon", "appointments")
      assert Verticals.module_enabled?("salon", "commissions")

      refute Verticals.module_enabled?("hardware", "appointments")
    end

    test "job-based verticals take in work and track it to collection" do
      for type <- ~w(laundry tailoring repair_shop auto_workshop services) do
        assert Verticals.module_enabled?(type, "service_jobs"),
               "#{type} should be able to take in a job"
      end

      refute Verticals.module_enabled?("retail", "service_jobs")
    end

    test "clothing gets the size/colour variant matrix" do
      assert Verticals.module_enabled?("fashion", "variants")
    end

    test "verticals selling by weight get weighted pricing" do
      for type <- ~w(grocery butchery hardware agri_supplies jewellery) do
        assert Verticals.module_enabled?(type, "weighted"), "#{type} sells by weight"
      end
    end

    test "an unknown business type gets core modules only" do
      assert Verticals.modules_for("crypto_mine") == Verticals.core_modules()
      refute Verticals.module_enabled?("crypto_mine", "tables")
    end

    test "nil has no modules at all" do
      refute Verticals.module_enabled?(nil, "pos")
    end
  end

  describe "owner overrides" do
    test "an owner can switch a module off" do
      cafe = %{business_type: "cafe", enabled_modules: ["tables", "kitchen"]}

      assert Verticals.module_enabled?(cafe, "tables")
      refute Verticals.module_enabled?(cafe, "delivery")
    end

    test "an override cannot switch on a module the vertical does not have" do
      salon = %{business_type: "salon", enabled_modules: ["tables", "kitchen", "appointments"]}

      refute Verticals.module_enabled?(salon, "tables")
      assert Verticals.module_enabled?(salon, "appointments")
    end

    test "an override never removes a core module" do
      shop = %{business_type: "retail", enabled_modules: ["credit"]}

      for module <- Verticals.core_modules() do
        assert Verticals.module_enabled?(shop, module)
      end
    end

    test "an empty or absent override changes nothing" do
      assert Verticals.module_enabled?(%{business_type: "cafe", enabled_modules: []}, "delivery")
      assert Verticals.module_enabled?(%{business_type: "cafe"}, "delivery")
    end

    test "active_modules/1 reflects the override" do
      cafe = %{business_type: "cafe", enabled_modules: ["tables"]}

      refute "delivery" in Verticals.active_modules(cafe)
      assert "tables" in Verticals.active_modules(cafe)
      assert "pos" in Verticals.active_modules(cafe)
    end
  end

  describe "catalog rules" do
    test "a barbershop sells services and memberships, never a rental" do
      assert Verticals.product_kind_allowed?("barbershop", "service")
      assert Verticals.product_kind_allowed?("barbershop", "membership")
      refute Verticals.product_kind_allowed?("barbershop", "rental")
    end

    test "a butchery sells goods, not services" do
      assert Verticals.product_kind_allowed?("butchery", "item")
      refute Verticals.product_kind_allowed?("butchery", "service")
    end

    test "only physical goods track stock by default" do
      assert Verticals.default_tracks_stock?("item")

      for kind <- ~w(service bundle deal rental membership gift_card fee) do
        refute Verticals.default_tracks_stock?(kind), "#{kind} should not track stock by default"
      end
    end

    test "regulated verticals must record batch and expiry" do
      assert Verticals.requires_batch?("pharmacy")
      assert Verticals.requires_batch?("agri_supplies")

      refute Verticals.requires_batch?("fashion")
      refute Verticals.requires_batch?("salon")
    end
  end

  describe "required sale fields" do
    test "food sales must carry a service mode" do
      for type <- ~w(restaurant cafe fast_food) do
        assert Verticals.requires_service_mode?(type)
      end
    end

    test "service sales must name who served the customer" do
      for type <- ~w(salon spa barbershop) do
        assert Verticals.requires_served_by?(type)
      end
    end

    test "a shop counter requires neither" do
      refute Verticals.requires_service_mode?("retail")
      refute Verticals.requires_served_by?("retail")
    end

    test "an unknown type requires nothing" do
      assert Verticals.required_sale_fields("crypto_mine") == []
    end
  end
end
