defmodule KaarobarWeb.V1.JournalController do
  use KaarobarWeb, :controller

  alias Kaarobar.Accounting
  alias Kaarobar.Guardian

  def index(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id

    data =
      Accounting.list_journals(business_id, owner_id)
      |> Enum.map(&serialize/1)

    json(conn, %{data: data})
  end

  def show(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Accounting.get_journal(id, owner_id) do
      nil -> conn |> put_status(:not_found) |> json(%{error: "not_found"})
      entry -> json(conn, %{data: serialize(entry)})
    end
  end

  def create(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id] || user.id

    lines =
      Enum.map(params["lines"] || [], fn line ->
        %{
          account_id: line["account_id"],
          debit: line["debit"] || 0,
          credit: line["credit"] || 0,
          memo: line["memo"]
        }
      end)

    attrs = %{
      description: params["description"],
      date: params["date"],
      source_type: "manual",
      branch_id: params["branch_id"] || conn.assigns[:branch_id],
      lines: lines
    }

    case Accounting.create_manual_journal(business_id, owner_id, user.id, attrs) do
      {:ok, entry} -> conn |> put_status(:created) |> json(%{data: serialize(entry)})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def reverse(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)
    owner_id = conn.assigns[:owner_id] || user.id

    case Accounting.reverse_journal(id, owner_id, user.id) do
      {:ok, entry} -> conn |> put_status(:created) |> json(%{data: serialize(entry)})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  defp serialize(entry) do
    entry = Kaarobar.Repo.preload(entry, lines: :account)

    %{
      id: entry.id,
      date: entry.date,
      description: entry.description,
      source_type: entry.source_type,
      source_id: entry.source_id,
      is_locked: entry.is_locked,
      reversed_entry_id: entry.reversed_entry_id,
      branch_id: entry.branch_id,
      lines:
        Enum.map(entry.lines || [], fn l ->
          %{
            account_id: l.account_id,
            account_code: l.account && l.account.code,
            account_name: l.account && l.account.name,
            debit: to_string(l.debit || 0),
            credit: to_string(l.credit || 0),
            memo: l.memo
          }
        end)
    }
  end
end
