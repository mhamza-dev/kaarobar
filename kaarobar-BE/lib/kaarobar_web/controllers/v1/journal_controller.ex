defmodule KaarobarWeb.V1.JournalController do
  use KaarobarWeb, :controller
  alias Kaarobar.Accounting
  alias Kaarobar.Guardian

  def create(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]
    owner_id = conn.assigns[:current_owner_id] || user.id

    lines =
      Enum.map(params["lines"] || [], fn line ->
        %{
          account_id: line["account_id"],
          debit: Decimal.new("#{line["debit"] || 0}"),
          credit: Decimal.new("#{line["credit"] || 0}"),
          memo: line["memo"]
        }
      end)

    attrs = %{
      description: params["description"],
      date: params["date"],
      source_type: "manual",
      lines: lines
    }

    case Accounting.create_manual_journal(business_id, owner_id, user.id, attrs) do
      {:ok, entry} -> conn |> put_status(:created) |> json(%{data: entry})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end
end
