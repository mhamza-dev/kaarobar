defmodule Kaarobar.AccessControl.Permissions do
  @moduledoc """
  The catalogue of everything a person can be allowed to do.

  Permission keys are `resource:action` strings. They are the vocabulary the
  whole authorization layer speaks: roles are bundles of these keys, a
  membership's direct grants allow or deny individual keys, controllers declare
  the key a route needs, and `Kaarobar.Scope` resolves the lot into one set
  before the action runs.

  The catalogue lives in code rather than only in the database. Code is where
  the keys are referenced, so keeping the list here means a typo in a
  controller (`"sales:checkuot"`) is caught by a test that walks every declared
  permission, instead of becoming an endpoint that nobody can ever reach. The
  `permissions` table is seeded from this list and exists so custom roles can
  reference the keys with a foreign key.

  ## Granularity

  Keys are split wherever a real shop draws a line between two people:

    * `sale:refund_request` and `sale:refund_approve` are separate because the
      cashier who made the mistake should not be the one who approves undoing it
    * `sale:view` and `sale:view_all` are separate so a cashier can find their
      own receipt without reading the whole day's takings
    * `discount:apply` and `discount:override` are separate so a supervisor can
      authorise the discount that exceeds the counter's limit
    * `stock:transfer` and `stock:transfer_approve` are separate so stock cannot
      leave a branch on one person's say-so

  This generalises the 17-action role matrix in `desktop/local`'s
  `shared/auth/permissions.ts`, which had a single fixed role per user.
  """

  @catalogue [
    # --- Organization ---------------------------------------------------------
    {:organization, "organization:view", "View organization details"},
    {:organization, "organization:edit", "Edit organization details"},
    {:organization, "organization:billing", "View and manage the subscription"},
    {:organization, "organization:delete", "Delete the organization"},

    # --- Businesses & branches ------------------------------------------------
    {:business, "business:view", "View businesses"},
    {:business, "business:create", "Create a business"},
    {:business, "business:edit", "Edit business details"},
    {:business, "business:settings", "Change branding, receipts and tax setup"},
    {:business, "business:archive", "Archive a business"},
    {:business, "branch:view", "View branches"},
    {:business, "branch:create", "Create a branch"},
    {:business, "branch:edit", "Edit branch details"},
    {:business, "branch:archive", "Archive a branch"},

    # --- Staff & access control -----------------------------------------------
    {:staff, "staff:view", "View staff"},
    {:staff, "staff:invite", "Invite a staff member"},
    {:staff, "staff:edit", "Edit a staff member"},
    {:staff, "staff:deactivate", "Deactivate a staff member"},
    {:staff, "staff:assign_roles", "Assign roles and branches to staff"},
    {:staff, "role:view", "View roles"},
    {:staff, "role:create", "Create a custom role"},
    {:staff, "role:edit", "Edit a custom role"},
    {:staff, "role:delete", "Delete a custom role"},
    {:staff, "permission:grant", "Grant or deny individual permissions"},

    # --- Catalog --------------------------------------------------------------
    {:catalog, "product:view", "View products"},
    {:catalog, "product:create", "Create products"},
    {:catalog, "product:edit", "Edit products"},
    {:catalog, "product:archive", "Archive products"},
    {:catalog, "product:delete", "Delete products"},
    {:catalog, "product:import", "Bulk import products"},
    {:catalog, "product:cost_view", "See cost prices and margins"},
    {:catalog, "category:manage", "Manage categories"},
    {:catalog, "brand:manage", "Manage brands"},
    {:catalog, "variant:manage", "Manage variants and options"},
    {:catalog, "barcode:manage", "Manage barcodes"},
    {:catalog, "modifier:manage", "Manage modifiers and add-ons"},
    {:catalog, "recipe:manage", "Manage recipes and bills of materials"},
    {:catalog, "unit:manage", "Manage units of measure"},

    # --- Pricing & tax --------------------------------------------------------
    {:pricing, "price:edit", "Change selling prices"},
    {:pricing, "price_list:manage", "Manage price lists"},
    {:pricing, "price_rule:manage", "Manage promotions and happy hour rules"},
    {:pricing, "discount:apply", "Apply a discount within the allowed limit"},
    {:pricing, "discount:override", "Approve a discount beyond the allowed limit"},
    {:pricing, "tax:manage", "Manage taxes and tax groups"},

    # --- Inventory ------------------------------------------------------------
    {:inventory, "inventory:view", "View stock levels"},
    {:inventory, "stock:adjust", "Adjust stock"},
    {:inventory, "stock:count", "Perform a stock count"},
    {:inventory, "stock:count_approve", "Approve stock count variances"},
    {:inventory, "stock:transfer", "Request a branch transfer"},
    {:inventory, "stock:transfer_approve", "Approve and dispatch a branch transfer"},
    {:inventory, "stock:receive", "Receive an incoming transfer"},
    {:inventory, "stock:wastage", "Record wastage and breakage"},
    {:inventory, "batch:manage", "Manage batches and expiry dates"},
    {:inventory, "serial:manage", "Manage serial numbers"},
    {:inventory, "valuation:view", "View stock valuation"},
    {:inventory, "reorder:manage", "Manage reorder rules"},

    # --- Purchasing -----------------------------------------------------------
    {:purchasing, "supplier:view", "View suppliers"},
    {:purchasing, "supplier:create", "Create suppliers"},
    {:purchasing, "supplier:edit", "Edit suppliers"},
    {:purchasing, "supplier:archive", "Archive suppliers"},
    {:purchasing, "purchase_order:view", "View purchase orders"},
    {:purchasing, "purchase_order:create", "Create purchase orders"},
    {:purchasing, "purchase_order:edit", "Edit purchase orders"},
    {:purchasing, "purchase_order:approve", "Approve and send purchase orders"},
    {:purchasing, "purchase_order:receive", "Receive goods against a purchase order"},
    {:purchasing, "purchase_order:cancel", "Cancel a purchase order"},
    {:purchasing, "supplier_bill:manage", "Manage supplier bills"},
    {:purchasing, "supplier_payment:record", "Record payments to suppliers"},
    {:purchasing, "purchase_return:manage", "Return goods to a supplier"},

    # --- Selling --------------------------------------------------------------
    {:sales, "sales:checkout", "Complete a sale"},
    {:sales, "sale:view", "View own sales"},
    {:sales, "sale:view_all", "View every sale in the branch"},
    {:sales, "sale:void", "Void a sale"},
    {:sales, "sale:refund_request", "Request a refund"},
    {:sales, "sale:refund_approve", "Approve a refund"},
    {:sales, "sale:reprint", "Reprint a receipt"},
    {:sales, "sale:price_override", "Sell at a manually entered price"},
    {:sales, "sale:backdate", "Record a sale with a past date"},
    {:sales, "order:view", "View open orders and tickets"},
    {:sales, "order:create", "Open an order or ticket"},
    {:sales, "order:edit", "Change an open order"},
    {:sales, "order:cancel", "Cancel an open order"},
    {:sales, "order:transfer", "Move an order to another table or staff member"},
    {:sales, "order:split", "Split an order or bill"},

    # --- Registers & cash -----------------------------------------------------
    {:register, "register:view", "View registers"},
    {:register, "register:manage", "Create and configure registers"},
    {:register, "shift:open", "Open a shift"},
    {:register, "shift:close", "Close a shift"},
    {:register, "shift:view", "View own shifts"},
    {:register, "shift:view_all", "View every shift in the branch"},
    {:register, "cash:movement", "Record a cash pay-in, pay-out or drop"},
    {:register, "cash:count", "Count and declare the drawer"},

    # --- Customers & credit ---------------------------------------------------
    {:customers, "customer:view", "View customers"},
    {:customers, "customer:create", "Create customers"},
    {:customers, "customer:edit", "Edit customers"},
    {:customers, "customer:archive", "Archive customers"},
    {:customers, "customer:export", "Export customer data"},
    {:customers, "credit:view", "View customer balances and ledgers"},
    {:customers, "credit:sell", "Sell on credit"},
    {:customers, "credit:limit_edit", "Set customer credit limits"},
    {:customers, "credit:payment", "Record a payment against a balance"},
    {:customers, "credit:adjust", "Adjust a customer balance"},
    {:customers, "credit:allocate", "Apply a payment to particular invoices"},
    {:customers, "customer_group:view", "View customer groups"},
    {:customers, "customer_group:manage", "Manage customer groups and their terms"},
    {:customers, "follow_up:view", "View customer follow-ups"},
    {:customers, "follow_up:manage", "Raise and close customer follow-ups"},
    {:customers, "loyalty:manage", "Manage loyalty programmes"},
    {:customers, "loyalty:view", "View loyalty balances"},
    {:customers, "loyalty:redeem", "Redeem loyalty points"},
    {:customers, "loyalty:adjust", "Adjust a points balance by hand"},
    {:customers, "gift_card:view", "Look up a gift card"},
    {:customers, "gift_card:issue", "Issue a gift card"},
    {:customers, "gift_card:redeem", "Redeem a gift card"},
    {:customers, "store_credit:issue", "Issue store credit"},
    {:customers, "store_credit:redeem", "Redeem store credit"},

    # --- Vertical modules -----------------------------------------------------
    {:verticals, "table:view", "View dining tables"},
    {:verticals, "table:manage", "Manage floors and dining tables"},
    {:verticals, "kitchen:view", "View the kitchen display"},
    {:verticals, "kitchen:bump", "Fire and bump kitchen items"},
    {:verticals, "appointment:view", "View appointments"},
    {:verticals, "appointment:manage", "Book and reschedule appointments"},
    {:verticals, "appointment:cancel", "Cancel an appointment"},
    {:verticals, "resource:manage", "Manage bookable resources"},
    {:verticals, "service_job:view", "View service jobs"},
    {:verticals, "service_job:create", "Take in a service job"},
    {:verticals, "service_job:update", "Update a service job"},
    {:verticals, "service_job:deliver", "Hand a completed job back"},
    {:verticals, "delivery:view", "View deliveries"},
    {:verticals, "delivery:assign", "Assign a rider"},
    {:verticals, "delivery:update", "Update delivery status"},
    {:verticals, "rental:manage", "Manage rental agreements"},
    {:verticals, "prescription:view", "View prescriptions"},
    {:verticals, "prescription:manage", "Record prescriptions"},
    {:verticals, "vehicle:manage", "Manage customer vehicles"},

    # --- Staff operations -----------------------------------------------------
    {:workforce, "attendance:view", "View attendance"},
    {:workforce, "attendance:record", "Clock staff in and out"},
    {:workforce, "commission:view", "View commissions"},
    {:workforce, "commission:manage", "Manage commission rules"},
    {:workforce, "timesheet:manage", "Manage timesheets"},

    # --- Money ----------------------------------------------------------------
    {:finance, "expense:view", "View expenses"},
    {:finance, "expense:create", "Record an expense"},
    {:finance, "expense:approve", "Approve an expense"},
    {:finance, "bank_account:manage", "Manage bank accounts"},
    {:finance, "payment_provider:manage", "Configure payment providers"},
    {:finance, "fiscal:manage", "Configure fiscal and e-invoicing"},

    # --- Reporting ------------------------------------------------------------
    {:reports, "report:sales", "Sales reports"},
    {:reports, "report:inventory", "Inventory reports"},
    {:reports, "report:financial", "Financial reports and profit"},
    {:reports, "report:staff", "Staff performance reports"},
    {:reports, "report:tax", "Tax reports"},
    {:reports, "report:customer", "Customer reports"},
    {:reports, "report:export", "Export report data"},

    # --- System ---------------------------------------------------------------
    {:system, "audit:view", "View the audit trail"},
    {:system, "webhook:manage", "Manage webhooks"},
    {:system, "integration:manage", "Manage integrations"},
    {:system, "data:export", "Export organization data"},
    {:system, "data:erase", "Erase personal data on request"}
  ]

  @keys Enum.map(@catalogue, fn {_group, key, _label} -> key end)
  @key_set MapSet.new(@keys)
  @groups @catalogue |> Enum.map(fn {group, _key, _label} -> group end) |> Enum.uniq()

  @type key :: String.t()
  @type group :: atom()

  @doc "Every permission key."
  @spec keys() :: [key()]
  def keys, do: @keys

  @doc "Every permission, as `%{key:, group:, label:}` maps. Used to seed the table."
  @spec all() :: [%{key: key(), group: group(), label: String.t()}]
  def all do
    Enum.map(@catalogue, fn {group, key, label} ->
      %{key: key, group: group, label: label}
    end)
  end

  @doc "The permission groups, in catalogue order."
  @spec groups() :: [group()]
  def groups, do: @groups

  @doc "Permissions grouped by module, for a role editor UI."
  @spec by_group() :: %{group() => [%{key: key(), label: String.t()}]}
  def by_group do
    Enum.group_by(
      all(),
      & &1.group,
      &Map.take(&1, [:key, :label])
    )
  end

  @doc """
  True when the key is in the catalogue.

  Every route declaration and role definition is checked against this, so a
  mistyped key fails a test rather than quietly denying everyone forever.
  """
  @spec known?(term()) :: boolean()
  def known?(key) when is_binary(key), do: MapSet.member?(@key_set, key)
  def known?(_key), do: false

  @doc "The catalogue entry for a key."
  @spec fetch(key()) :: {:ok, %{key: key(), group: group(), label: String.t()}} | :error
  def fetch(key) do
    case Enum.find(all(), &(&1.key == key)) do
      nil -> :error
      permission -> {:ok, permission}
    end
  end

  @doc "Every key belonging to a group."
  @spec keys_in(group()) :: [key()]
  def keys_in(group) do
    for {^group, key, _label} <- @catalogue, do: key
  end

  @doc """
  Expands a list that may contain group atoms into concrete keys.

      expand([:reports, "sales:checkout"])
      #=> ["report:sales", "report:inventory", ..., "sales:checkout"]
  """
  @spec expand([key() | group()]) :: [key()]
  def expand(entries) do
    entries
    |> Enum.flat_map(fn
      entry when is_atom(entry) -> keys_in(entry)
      entry when is_binary(entry) -> [entry]
    end)
    |> Enum.uniq()
  end
end
