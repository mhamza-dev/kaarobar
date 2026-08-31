defmodule KaarobarWeb.CommissionJSON do
  @moduledoc false

  alias KaarobarWeb.VerticalSerializers, as: S

  def rules(%{rules: rules}), do: %{data: Enum.map(rules, &S.commission_rule/1)}
  def rule(%{rule: rule}), do: %{data: S.commission_rule(rule)}

  def statement(%{statement: statement}), do: %{data: S.commission_statement(statement)}
  def summary(%{rows: rows}), do: %{data: Enum.map(rows, &S.commission_summary/1)}
end
