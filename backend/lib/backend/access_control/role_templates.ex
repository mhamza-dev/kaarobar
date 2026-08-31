defmodule Kaarobar.AccessControl.RoleTemplates do
  @moduledoc """
  The system roles every organization starts with.

  These are seeded into the `roles` table with `is_system: true` so that a new
  business is usable the moment it is created, without an owner first having to
  design a permission model. Organizations may also create their own roles;
  system roles are not editable, but a custom role can be built from one.

  The set covers the shapes of staff that actually exist across these
  verticals — a barber is not a cashier, a kitchen screen operator is not a
  waiter, and a stockroom keeper should not be able to ring up a sale.

  ## Rank and privilege escalation

  Each template has a `rank`, lower being more powerful. A member may only
  assign roles ranked at or below their own most powerful role. Without that
  rule, `staff:assign_roles` would silently be `organization:*`: a manager
  could promote themselves to admin, then do anything. Custom roles inherit the
  rank of the least powerful role they were built from.
  """

  alias Kaarobar.AccessControl.Permissions

  # Read-only keys, derived rather than listed, so a new `*:view` permission is
  # automatically visible to the viewer role instead of being forgotten.
  @view_keys Enum.filter(Permissions.keys(), &String.ends_with?(&1, ":view"))
  @report_keys Permissions.keys_in(:reports)

  @templates [
    %{
      key: "owner",
      name: "Owner",
      description: "Full control of the organization, its businesses and its subscription.",
      rank: 0,
      permissions: :all
    },
    %{
      key: "admin",
      name: "Administrator",
      description: "Everything the owner can do, short of deleting the organization.",
      rank: 10,
      permissions: {:all_except, ["organization:delete"]}
    },
    %{
      key: "manager",
      name: "Manager",
      description:
        "Runs a business day to day: catalog, stock, purchasing, staff and reporting. " <>
          "Cannot change organization settings, billing or roles.",
      rank: 20,
      permissions:
        [
          :catalog,
          :pricing,
          :inventory,
          :purchasing,
          :sales,
          :register,
          :customers,
          :verticals,
          :workforce,
          :reports
        ] ++
          ~w(
            organization:view business:view branch:view branch:create branch:edit
            staff:view staff:invite staff:edit staff:deactivate staff:assign_roles
            expense:view expense:create expense:approve
            audit:view
          )
    },
    %{
      key: "supervisor",
      name: "Supervisor",
      description:
        "Floor or shift lead. Approves discounts, refunds and voids, and runs the counter.",
      rank: 30,
      permissions:
        [:sales, :register, :verticals] ++
          ~w(
            business:view branch:view staff:view
            product:view inventory:view stock:adjust stock:count stock:wastage stock:receive
            discount:apply discount:override
            customer:view customer:create customer:edit
            credit:view credit:sell credit:payment credit:allocate
            payment:view payment:charge payment:refund payment:reconcile
            customer_group:view customer_group:manage
            follow_up:view follow_up:manage
            loyalty:view loyalty:redeem gift_card:view gift_card:redeem
            store_credit:issue store_credit:redeem
            purchase_order:view purchase_order:create purchase_order:receive
            attendance:view attendance:record
            commission:view commission:manage commission:pay
            resource:view resource:manage queue:view queue:manage
            rental:view rental:manage quote:view quote:manage
            time_entry:view time_entry:record regulated:view
            report:sales
          )
    },
    %{
      key: "accountant",
      name: "Accountant",
      description:
        "Reads the books. Records supplier and customer payments and expenses, " <>
          "but does not sell, price or change stock.",
      rank: 30,
      permissions:
        [:reports] ++
          ~w(
            organization:view business:view branch:view
            sale:view sale:view_all shift:view_all
            product:view product:cost_view inventory:view valuation:view
            customer:view credit:view credit:payment credit:adjust credit:allocate
            customer_group:view follow_up:view loyalty:view gift_card:view
            supplier:view purchase_order:view supplier_bill:manage supplier_payment:record
            expense:view expense:create expense:approve bank_account:manage
            tax:manage fiscal:manage
            audit:view
          )
    },
    %{
      key: "stock_keeper",
      name: "Stock keeper",
      description: "Owns the stockroom: receiving, counts, transfers and purchase orders.",
      rank: 40,
      permissions:
        [:inventory, :purchasing] ++
          ~w(
            business:view branch:view
            product:view product:create product:edit product:cost_view product:import
            category:manage brand:manage variant:manage barcode:manage unit:manage
            report:inventory
          )
    },
    %{
      key: "cashier",
      name: "Cashier",
      description: "Works the counter: sells, takes payment, and manages their own shift.",
      rank: 50,
      permissions: ~w(
        branch:view
        product:view inventory:view discount:apply
        sales:checkout sale:view sale:refund_request sale:reprint
        order:view order:create order:edit
        register:view shift:open shift:close shift:view cash:movement cash:count
        customer:view customer:create customer:edit
        credit:view credit:sell credit:payment payment:view payment:charge
        customer_group:view follow_up:view
        loyalty:view loyalty:redeem gift_card:view gift_card:redeem gift_card:issue
        store_credit:redeem
        table:view kitchen:view
        appointment:view appointment:manage
        service_job:view service_job:create service_job:update service_job:deliver
        resource:view queue:view
        rental:view rental:manage time_entry:view time_entry:record
        delivery:view
      )
    },
    %{
      key: "stylist",
      name: "Stylist / therapist",
      description:
        "Salon, spa and barbershop staff. Owns their appointment book and the sales they serve.",
      rank: 50,
      permissions: ~w(
        branch:view product:view
        appointment:view appointment:manage appointment:cancel
        resource:view queue:view queue:manage
        sales:checkout sale:view sale:reprint discount:apply
        order:view order:create order:edit
        customer:view customer:create customer:edit
        commission:view attendance:record
      )
    },
    %{
      key: "technician",
      name: "Technician",
      description:
        "Laundry, tailoring, repair and workshop staff. Takes jobs in and hands them back.",
      rank: 50,
      permissions: ~w(
        branch:view product:view inventory:view
        service_job:view service_job:create service_job:update service_job:deliver
        vehicle:manage prescription:view
        order:view order:create order:edit
        customer:view customer:create customer:edit
        sale:view commission:view attendance:record
      )
    },
    %{
      key: "waiter",
      name: "Waiter",
      description:
        "Takes orders on the floor and sends them to the kitchen. Does not take payment.",
      rank: 60,
      permissions: ~w(
        branch:view product:view
        order:view order:create order:edit order:transfer order:split
        table:view table:manage kitchen:view
        sale:view customer:view
        attendance:record
      )
    },
    %{
      key: "kitchen",
      name: "Kitchen",
      description: "Works the kitchen display: sees what to cook and marks it ready.",
      rank: 70,
      permissions: ~w(branch:view product:view order:view kitchen:view kitchen:bump attendance:record)
    },
    %{
      key: "rider",
      name: "Delivery rider",
      description: "Carries deliveries and reports their status.",
      rank: 70,
      permissions: ~w(branch:view delivery:view delivery:update order:view sale:view attendance:record)
    },
    %{
      key: "viewer",
      name: "Viewer",
      description: "Read-only access. Useful for an accountant's assistant or a franchise auditor.",
      rank: 90,
      permissions: {:literal, @view_keys ++ @report_keys}
    }
  ]

  @type key :: String.t()

  @doc "Every system role template, in rank order."
  @spec all() :: [map()]
  def all do
    @templates
    |> Enum.map(fn template ->
      Map.put(template, :permissions, resolve(template.permissions))
    end)
    |> Enum.sort_by(& &1.rank)
  end

  @doc "The keys of every system role."
  @spec keys() :: [key()]
  def keys, do: Enum.map(@templates, & &1.key)

  @doc "True when the key names a system role."
  @spec system_role?(term()) :: boolean()
  def system_role?(key) when is_binary(key), do: key in keys()
  def system_role?(_key), do: false

  @doc "A single template, with its permissions expanded."
  @spec fetch(key()) :: {:ok, map()} | :error
  def fetch(key) do
    case Enum.find(@templates, &(&1.key == key)) do
      nil -> :error
      template -> {:ok, Map.put(template, :permissions, resolve(template.permissions))}
    end
  end

  @doc "The expanded permission keys for a system role."
  @spec permissions_for(key()) :: [Permissions.key()]
  def permissions_for(key) do
    case fetch(key) do
      {:ok, template} -> template.permissions
      :error -> []
    end
  end

  @doc """
  The rank of a system role. Unknown roles rank as the least powerful, so an
  unrecognised value can never be used to escalate.
  """
  @spec rank(key()) :: non_neg_integer()
  def rank(key) do
    case Enum.find(@templates, &(&1.key == key)) do
      nil -> 1_000
      template -> template.rank
    end
  end

  @doc """
  True when a member holding `holder_roles` may assign `target_role`.

  The owner is handled by `Kaarobar.Scope` and is not subject to this.
  """
  @spec can_assign?([key()], key()) :: boolean()
  def can_assign?([], _target_role), do: false

  def can_assign?(holder_roles, target_role) do
    holder_roles |> Enum.map(&rank/1) |> Enum.min() <= rank(target_role)
  end

  # --- Expansion --------------------------------------------------------------

  defp resolve(:all), do: Permissions.keys()

  defp resolve({:all_except, excluded}), do: Permissions.keys() -- excluded

  defp resolve({:literal, keys}), do: Enum.uniq(keys)

  defp resolve(entries) when is_list(entries), do: Permissions.expand(entries)
end
