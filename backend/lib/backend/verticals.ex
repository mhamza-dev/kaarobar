defmodule Kaarobar.Verticals do
  @moduledoc """
  The registry that lets one schema serve every kind of business.

  A business picks a `business_type` once. That type decides three things:

    * which **modules** the business can reach — dining tables, appointments,
      batch tracking, service job intake, rentals…
    * which **product kinds** its catalog may contain — a barber does not sell
      serialised electronics, a hardware store does not sell memberships
    * which **sale fields are required** — a restaurant sale needs a service
      mode, a salon sale needs the staff member who served the customer

  Everything here is data. Adding a vertical is an entry in `@business_types`,
  not a migration and not a new table: the pesticide shop and the barbershop
  read from the same `products`, `sales` and `stock_moves` tables, and differ
  only in which parts of them are switched on.

  This generalises the four-nature model in `desktop/local`'s
  `shared/businessNature.ts` (retail, food, salon, services) to the full range
  of businesses the cloud product serves.

  ## Owner overrides

  A type grants a *maximum* set of modules. An owner may switch off ones they
  do not want — a café that never does delivery — by setting
  `business.enabled_modules`. An override can only narrow the type's set, never
  widen it, so a salon can never enable dining tables by editing a field.
  """

  # --- Modules ---------------------------------------------------------------

  @core_modules ~w(pos catalog inventory sales customers reports staff settings)

  @optional_modules ~w(
    appointments batches commissions credit delivery gift_cards kitchen
    loyalty memberships modifiers prescriptions purchasing quotes queue
    recipes rentals serials served_by service_jobs service_modes suppliers
    tables time_entries variants vehicles weighted
  )

  @modules @core_modules ++ @optional_modules

  # --- Product kinds ---------------------------------------------------------

  @product_kinds ~w(item service bundle deal rental membership gift_card fee)

  # --- Business types --------------------------------------------------------

  @retail_base ~w(purchasing suppliers credit variants loyalty gift_cards)
  @food_base ~w(tables kitchen service_modes delivery modifiers recipes purchasing suppliers credit)
  @appointment_base ~w(appointments served_by commissions queue credit loyalty)
  @job_base ~w(service_jobs served_by credit delivery queue)

  @business_types %{
    # --- Retail ---------------------------------------------------------------
    "retail" => %{
      label: "General retail shop",
      group: :retail,
      modules: @retail_base,
      product_kinds: ~w(item bundle deal gift_card fee),
      required_sale_fields: []
    },
    "grocery" => %{
      label: "Grocery / kiryana store",
      group: :retail,
      modules: @retail_base ++ ~w(weighted batches),
      product_kinds: ~w(item bundle deal fee),
      required_sale_fields: []
    },
    "fashion" => %{
      label: "Clothing & apparel",
      group: :retail,
      modules: @retail_base ++ ~w(variants),
      product_kinds: ~w(item bundle deal gift_card fee),
      required_sale_fields: []
    },
    "electronics" => %{
      label: "Electronics & mobile",
      group: :retail,
      modules: @retail_base ++ ~w(serials service_jobs),
      product_kinds: ~w(item service bundle deal fee),
      required_sale_fields: []
    },
    "hardware" => %{
      label: "Hardware & building materials",
      group: :retail,
      modules: @retail_base ++ ~w(weighted delivery),
      product_kinds: ~w(item service bundle deal fee),
      required_sale_fields: []
    },
    "jewellery" => %{
      label: "Jewellery",
      group: :retail,
      modules: @retail_base ++ ~w(weighted serials service_jobs),
      product_kinds: ~w(item service fee),
      required_sale_fields: []
    },
    "bookstore" => %{
      label: "Books & stationery",
      group: :retail,
      modules: @retail_base,
      product_kinds: ~w(item bundle deal gift_card fee),
      required_sale_fields: []
    },
    "florist" => %{
      label: "Florist",
      group: :retail,
      modules: @retail_base ++ ~w(delivery),
      product_kinds: ~w(item service bundle deal fee),
      required_sale_fields: []
    },

    # --- Regulated retail -----------------------------------------------------
    "pharmacy" => %{
      label: "Pharmacy",
      group: :regulated,
      modules: @retail_base ++ ~w(batches prescriptions),
      product_kinds: ~w(item service fee),
      required_sale_fields: [],
      requires_batch: true
    },
    "agri_supplies" => %{
      label: "Pesticides, fertiliser & agri supplies",
      group: :regulated,
      modules: @retail_base ++ ~w(batches weighted delivery),
      product_kinds: ~w(item service bundle deal fee),
      required_sale_fields: [],
      requires_batch: true
    },
    "optical" => %{
      label: "Optical",
      group: :regulated,
      modules: @retail_base ++ ~w(prescriptions appointments service_jobs),
      product_kinds: ~w(item service bundle fee),
      required_sale_fields: []
    },

    # --- Food -----------------------------------------------------------------
    "restaurant" => %{
      label: "Restaurant",
      group: :food,
      modules: @food_base ++ ~w(batches),
      product_kinds: ~w(item deal bundle fee),
      required_sale_fields: [:service_mode]
    },
    "cafe" => %{
      label: "Café / tea shop",
      group: :food,
      modules: @food_base,
      product_kinds: ~w(item deal bundle gift_card fee),
      required_sale_fields: [:service_mode]
    },
    "fast_food" => %{
      label: "Fast food / takeaway",
      group: :food,
      modules: @food_base -- ~w(tables),
      product_kinds: ~w(item deal bundle fee),
      required_sale_fields: [:service_mode]
    },
    "bakery" => %{
      label: "Bakery & sweets",
      group: :food,
      modules: @retail_base ++ ~w(recipes weighted batches delivery modifiers),
      product_kinds: ~w(item deal bundle fee),
      required_sale_fields: []
    },
    "butchery" => %{
      label: "Butchery & meat shop",
      group: :food,
      modules: @retail_base ++ ~w(weighted batches delivery),
      product_kinds: ~w(item fee),
      required_sale_fields: []
    },

    # --- Appointment-led services --------------------------------------------
    "salon" => %{
      label: "Salon",
      group: :services,
      modules: @appointment_base ++ ~w(recipes memberships gift_cards purchasing suppliers),
      product_kinds: ~w(service item bundle deal membership gift_card fee),
      required_sale_fields: [:served_by]
    },
    "spa" => %{
      label: "Spa & wellness",
      group: :services,
      modules: @appointment_base ++ ~w(memberships gift_cards purchasing suppliers),
      product_kinds: ~w(service item bundle membership gift_card fee),
      required_sale_fields: [:served_by]
    },
    "barbershop" => %{
      label: "Barbershop",
      group: :services,
      modules: @appointment_base ++ ~w(memberships),
      product_kinds: ~w(service item bundle deal membership fee),
      required_sale_fields: [:served_by]
    },
    "clinic" => %{
      label: "Clinic & diagnostics",
      group: :services,
      modules: @appointment_base ++ ~w(prescriptions batches),
      product_kinds: ~w(service item bundle fee),
      required_sale_fields: [:served_by]
    },
    "gym" => %{
      label: "Gym & fitness studio",
      group: :services,
      modules: @appointment_base ++ ~w(memberships),
      product_kinds: ~w(membership service item bundle fee),
      required_sale_fields: []
    },
    "education" => %{
      label: "Academy & training centre",
      group: :services,
      modules: ~w(appointments memberships credit time_entries quotes),
      product_kinds: ~w(service membership bundle fee),
      required_sale_fields: []
    },
    "pet_care" => %{
      label: "Pet care & grooming",
      group: :services,
      modules: @appointment_base ++ ~w(purchasing suppliers),
      product_kinds: ~w(service item bundle deal fee),
      required_sale_fields: [:served_by]
    },

    # --- Job-led services -----------------------------------------------------
    "laundry" => %{
      label: "Laundry & ironing",
      group: :jobs,
      modules: @job_base ++ ~w(loyalty memberships),
      product_kinds: ~w(service bundle deal membership fee),
      required_sale_fields: []
    },
    "tailoring" => %{
      label: "Tailoring & alterations",
      group: :jobs,
      modules: @job_base ++ ~w(purchasing suppliers variants),
      product_kinds: ~w(service item bundle fee),
      required_sale_fields: [:served_by]
    },
    "repair_shop" => %{
      label: "Repair shop",
      group: :jobs,
      modules: @job_base ++ ~w(serials purchasing suppliers quotes),
      product_kinds: ~w(service item bundle fee),
      required_sale_fields: []
    },
    "auto_workshop" => %{
      label: "Auto workshop",
      group: :jobs,
      modules: @job_base ++ ~w(vehicles serials purchasing suppliers quotes time_entries),
      product_kinds: ~w(service item bundle fee),
      required_sale_fields: []
    },
    "services" => %{
      label: "General service provider",
      group: :jobs,
      modules: @job_base ++ ~w(appointments commissions quotes time_entries),
      product_kinds: ~w(service item bundle deal membership fee),
      required_sale_fields: [:served_by]
    },
    "professional_services" => %{
      label: "Professional services & consultancy",
      group: :jobs,
      modules: ~w(quotes time_entries credit appointments),
      product_kinds: ~w(service bundle fee),
      required_sale_fields: []
    },

    # --- Rental ---------------------------------------------------------------
    "rental" => %{
      label: "Rental business",
      group: :rental,
      modules: ~w(rentals serials credit delivery purchasing suppliers appointments),
      product_kinds: ~w(rental service item fee),
      required_sale_fields: []
    }
  }

  @type business_type :: String.t()
  @type module_key :: String.t()

  @default_type "retail"

  # --- Introspection ---------------------------------------------------------

  @doc "Every known business type key."
  @spec business_types() :: [business_type()]
  def business_types, do: @business_types |> Map.keys() |> Enum.sort()

  @doc "Every known module key, core and optional."
  @spec modules() :: [module_key()]
  def modules, do: @modules

  @doc "Modules every business gets regardless of type."
  @spec core_modules() :: [module_key()]
  def core_modules, do: @core_modules

  @doc "Every product kind the platform understands."
  @spec product_kinds() :: [String.t()]
  def product_kinds, do: @product_kinds

  @doc "The type assigned when none is chosen."
  @spec default_type() :: business_type()
  def default_type, do: @default_type

  @doc "True when the string names a business type this platform supports."
  @spec known_type?(term()) :: boolean()
  def known_type?(type) when is_binary(type), do: Map.has_key?(@business_types, type)
  def known_type?(_type), do: false

  @doc """
  The full definition for a business type.

  Returns `:error` for an unknown type rather than falling back to retail —
  silently treating an unrecognised vertical as a shop would hide a bad value
  until a cashier hit a missing screen.
  """
  @spec fetch(business_type()) :: {:ok, map()} | :error
  def fetch(type) when is_binary(type), do: Map.fetch(@business_types, type)
  def fetch(_type), do: :error

  @doc "Business types grouped for a setup screen: retail, food, services, jobs, regulated, rental."
  @spec grouped() :: %{atom() => [%{type: business_type(), label: String.t()}]}
  def grouped do
    @business_types
    |> Enum.map(fn {type, definition} ->
      %{type: type, label: definition.label, group: definition.group}
    end)
    |> Enum.sort_by(& &1.label)
    |> Enum.group_by(& &1.group, &Map.take(&1, [:type, :label]))
  end

  @doc "The human label for a business type."
  @spec label(business_type()) :: String.t() | nil
  def label(type) do
    case fetch(type) do
      {:ok, definition} -> definition.label
      :error -> nil
    end
  end

  # --- Modules ---------------------------------------------------------------

  @doc """
  Every module available to a business type — core plus type-specific.
  """
  @spec modules_for(business_type()) :: [module_key()]
  def modules_for(type) do
    case fetch(type) do
      {:ok, definition} -> Enum.sort(@core_modules ++ definition.modules)
      :error -> @core_modules
    end
  end

  @doc """
  True when a business may use a module.

  Accepts a business struct (reading its `business_type` and any
  `enabled_modules` override) or a bare type string.
  """
  @spec module_enabled?(struct() | map() | business_type() | nil, module_key()) :: boolean()
  def module_enabled?(nil, _module), do: false

  def module_enabled?(type, module) when is_binary(type) do
    module in modules_for(type)
  end

  def module_enabled?(business, module) when is_map(business) do
    type = Map.get(business, :business_type)

    module_enabled?(type, module) and not disabled_by_owner?(business, module)
  end

  @doc """
  The modules actually active for a business: its type's set, narrowed by any
  owner override, with core modules always retained.
  """
  @spec active_modules(struct() | map()) :: [module_key()]
  def active_modules(business) when is_map(business) do
    business
    |> Map.get(:business_type)
    |> modules_for()
    |> Enum.reject(&disabled_by_owner?(business, &1))
  end

  defp disabled_by_owner?(business, module) do
    case Map.get(business, :enabled_modules) do
      nil -> false
      [] -> false
      enabled when is_list(enabled) -> module not in @core_modules and module not in enabled
      _other -> false
    end
  end

  # --- Catalog ---------------------------------------------------------------

  @doc "The product kinds a business type's catalog may contain."
  @spec product_kinds_for(business_type()) :: [String.t()]
  def product_kinds_for(type) do
    case fetch(type) do
      {:ok, definition} -> definition.product_kinds
      :error -> ~w(item)
    end
  end

  @doc "True when a business type may sell a given product kind."
  @spec product_kind_allowed?(business_type(), String.t()) :: boolean()
  def product_kind_allowed?(type, kind), do: kind in product_kinds_for(type)

  @doc """
  Whether a product kind tracks stock by default.

  Only physical goods do. A haircut, a gym membership and a delivery fee have
  no stock level, and forcing one on them produces meaningless low-stock alerts
  — the mistake the desktop product's `tracks_stock` flag exists to avoid.
  """
  @spec default_tracks_stock?(String.t()) :: boolean()
  def default_tracks_stock?(kind), do: kind in ~w(item)

  @doc """
  True when this vertical must record a batch/lot and expiry for stocked goods.

  Pesticides and medicines are recalled by lot and are illegal to sell past
  expiry, so the platform enforces it rather than leaving it to a checkbox.
  """
  @spec requires_batch?(business_type()) :: boolean()
  def requires_batch?(type) do
    case fetch(type) do
      {:ok, definition} -> Map.get(definition, :requires_batch, false)
      :error -> false
    end
  end

  # --- Sales -----------------------------------------------------------------

  @doc """
  Fields a sale must carry for this vertical.

  `:service_mode` — dine-in, takeaway or delivery (food).
  `:served_by` — the staff member who performed the service (salon, services).
  """
  @spec required_sale_fields(business_type()) :: [atom()]
  def required_sale_fields(type) do
    case fetch(type) do
      {:ok, definition} -> definition.required_sale_fields
      :error -> []
    end
  end

  @doc "True when a sale in this vertical must name the staff member who served."
  @spec requires_served_by?(business_type()) :: boolean()
  def requires_served_by?(type), do: :served_by in required_sale_fields(type)

  @doc "True when a sale in this vertical must carry a service mode."
  @spec requires_service_mode?(business_type()) :: boolean()
  def requires_service_mode?(type), do: :service_mode in required_sale_fields(type)
end
