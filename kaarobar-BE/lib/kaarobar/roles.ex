defmodule Kaarobar.Roles do
  @moduledoc """
  Canonical roles for TEN-FR-003.
  """

  @roles ~w(
    owner
    admin
    branch_manager
    cashier
    inventory_manager
    accountant
    hr_manager
    marketing
    employee
  )

  @role_aliases %{
    "manager" => "branch_manager",
    "inventory_clerk" => "inventory_manager",
    "hr" => "hr_manager",
    "marketer" => "marketing"
  }

  @mfa_default_roles ~w(owner accountant)

  @bundles ~w(
    owner_manage
    pos
    pos_approve
    inventory
    accounting
    customers
    hr
    leave_approve
    payroll_approve
    reports
    notifications
    settings
    marketing
    employee_self
    any_staff
  )a

  @bundle_defaults %{
    owner_manage: ~w(owner),
    pos: ~w(owner admin branch_manager cashier employee),
    pos_approve: ~w(owner admin),
    inventory: ~w(owner admin branch_manager inventory_manager employee),
    accounting: ~w(owner admin accountant),
    customers: ~w(owner admin accountant branch_manager cashier employee marketing),
    hr: ~w(owner admin hr_manager branch_manager),
    leave_approve: ~w(owner admin hr_manager),
    payroll_approve: ~w(owner admin accountant),
    reports: ~w(owner admin branch_manager accountant),
    notifications: @roles,
    settings: ~w(owner),
    marketing: ~w(owner admin hr_manager marketing),
    employee_self: ~w(admin employee cashier),
    any_staff: @roles
  }

  def all, do: @roles
  def bundles, do: @bundles
  def mfa_default_roles, do: @mfa_default_roles

  def valid?(role) when is_binary(role), do: normalize_role(role) in @roles
  def valid?(_), do: false

  def normalize_role(role) when is_binary(role), do: Map.get(@role_aliases, role, role)
  def normalize_role(role), do: role

  def validate_roles(roles) when is_list(roles) do
    normalized = Enum.map(roles, &normalize_role/1)
    invalid = Enum.reject(normalized, &valid?/1)

    if invalid == [] and normalized != [] do
      :ok
    else
      {:error, {:invalid_roles, invalid}}
    end
  end

  def validate_roles(_), do: {:error, :invalid_roles}

  def requires_mfa_by_default?(roles) when is_list(roles) do
    normalized = Enum.map(roles, &normalize_role/1)
    Enum.any?(normalized, &(&1 in @mfa_default_roles))
  end

  def requires_mfa_by_default?(_), do: false

  def bundle(bundle) when is_atom(bundle), do: Map.get(@bundle_defaults, bundle, [])

  def bundle_allowed?(bundle, role, overrides \\ %{})

  def bundle_allowed?(bundle, role, overrides) when is_atom(bundle) and is_binary(role) do
    normalized = normalize_role(role)
    default_allowed = normalized in bundle(bundle)
    override_for_role = get_in(overrides, [normalized, Atom.to_string(bundle)])

    case override_for_role do
      true -> true
      false -> false
      _ -> default_allowed
    end
  end

  def bundle_allowed?(_, _, _), do: false
end
