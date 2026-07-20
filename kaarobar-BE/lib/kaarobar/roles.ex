defmodule Kaarobar.Roles do
  @moduledoc """
  Canonical roles for TEN-FR-003.
  """

  @roles ~w(
    owner
    branch_manager
    cashier
    inventory_manager
    accountant
    hr_manager
    employee
  )

  @mfa_default_roles ~w(owner accountant)

  def all, do: @roles

  def valid?(role) when is_binary(role), do: role in @roles
  def valid?(_), do: false

  def validate_roles(roles) when is_list(roles) do
    invalid = Enum.reject(roles, &valid?/1)

    if invalid == [] and roles != [] do
      :ok
    else
      {:error, {:invalid_roles, invalid}}
    end
  end

  def validate_roles(_), do: {:error, :invalid_roles}

  def mfa_default_roles, do: @mfa_default_roles

  def requires_mfa_by_default?(roles) when is_list(roles) do
    Enum.any?(roles, &(&1 in @mfa_default_roles))
  end

  def requires_mfa_by_default?(_), do: false

  # Permission bundles used by Authorize plug
  def bundle(:owner_manage), do: ~w(owner)
  def bundle(:pos), do: ~w(owner branch_manager cashier)
  def bundle(:pos_approve), do: ~w(owner branch_manager)
  def bundle(:inventory), do: ~w(owner branch_manager inventory_manager)
  def bundle(:accounting), do: ~w(owner accountant)
  def bundle(:hr), do: ~w(owner hr_manager)
  def bundle(:payroll_approve), do: ~w(owner accountant)
  def bundle(:reports), do: ~w(owner branch_manager accountant)
  def bundle(:employee_self), do: ~w(owner branch_manager hr_manager employee cashier inventory_manager accountant)
  def bundle(:any_staff), do: @roles
end
