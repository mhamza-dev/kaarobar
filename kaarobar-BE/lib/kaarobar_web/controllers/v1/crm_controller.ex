defmodule KaarobarWeb.V1.CrmController do
  use KaarobarWeb, :controller

  alias Kaarobar.Crm
  alias Kaarobar.Guardian

  def index(conn, _params) do
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]

    data =
      Crm.list_campaigns(business_id, owner_id)
      |> Enum.map(&serialize_campaign/1)

    json(conn, %{data: data})
  end

  def create(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]

    case Crm.create_campaign(business_id, owner_id, user.id, params) do
      {:ok, c} ->
        conn |> put_status(:created) |> json(%{data: serialize_campaign(c)})

      {:error, cs} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(cs.errors)})
    end
  end

  def show(conn, %{"id" => id}) do
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]

    case Crm.get_campaign(id, business_id, owner_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      c ->
        json(conn, %{data: serialize_campaign(c, true)})
    end
  end

  def send(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:business_id]
    owner_id = conn.assigns[:owner_id]

    case Crm.send_campaign(id, business_id, owner_id, user.id) do
      {:ok, c} ->
        summary = delivery_summary(c)
        json(conn, %{data: Map.merge(serialize_campaign(c, true), %{delivery: summary})})

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      {:error, :already_sent} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "already_sent"})

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  defp serialize_campaign(c, with_recipients \\ false) do
    recipients = loaded_recipients(c)

    base = %{
      id: c.id,
      name: c.name,
      title: c.title,
      message: c.message,
      audience: c.audience,
      min_points: c.min_points,
      status: c.status,
      sent_at: c.sent_at,
      recipient_count: length(recipients),
      delivery: delivery_summary(c)
    }

    if with_recipients do
      Map.put(
        base,
        :recipients,
        Enum.map(recipients, fn r ->
          %{
            id: r.id,
            customer_id: r.customer_id,
            customer_name: r.customer && r.customer.name,
            user_id: r.user_id,
            channel_status: r.channel_status,
            delivered_at: r.delivered_at
          }
        end)
      )
    else
      base
    end
  end

  defp loaded_recipients(%{recipients: %Ecto.Association.NotLoaded{}}), do: []
  defp loaded_recipients(%{recipients: list}) when is_list(list), do: list
  defp loaded_recipients(_), do: []

  defp delivery_summary(c) do
    recipients = loaded_recipients(c)

    %{
      notified: Enum.count(recipients, &(&1.channel_status == "notified")),
      email_only: Enum.count(recipients, &(&1.channel_status == "email_only")),
      skipped: Enum.count(recipients, &(&1.channel_status == "skipped_no_user")),
      total: length(recipients)
    }
  end
end
