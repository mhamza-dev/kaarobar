defmodule Kaarobar.Inventory.ExpiryAlertWorker do
  @moduledoc """
  Emails an organization's owner when stock is close to expiring.

  Runs once a day, not per business: `Kaarobar.Inventory.expiring_batches/2`
  is cheap, and a shop that files it once a day is enough warning for a stock
  that turns over in weeks. Only businesses whose vertical is batch-tracked at
  all are checked — `Kaarobar.Verticals.requires_batch?/1` is the same gate
  that puts the batch fields on a product in the first place.
  """

  use Oban.Worker,
    queue: :notifications,
    max_attempts: 3,
    unique: [period: 3600, states: [:available, :scheduled, :executing]]

  import Ecto.Query, warn: false
  import Swoosh.Email, except: [from: 2]

  alias Kaarobar.Inventory
  alias Kaarobar.Mailer
  alias Kaarobar.Repo
  alias Kaarobar.Scope
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Verticals

  require Logger

  @lookahead_days 7

  @impl Oban.Worker
  def perform(%Oban.Job{args: args}) do
    days = Map.get(args, "days", @lookahead_days)

    businesses()
    |> Enum.each(fn business ->
      batches =
        Repo.with_tenant_context(business.organization_id, fn ->
          scope = %Scope{organization: business.organization, business: business}
          Inventory.expiring_batches(scope, days)
        end)

      if batches != [] do
        notify(business, batches, days)
      end
    end)

    :ok
  end

  defp businesses do
    Business
    |> where([b], is_nil(b.deleted_at))
    |> preload(:organization)
    |> Repo.all()
    |> Enum.filter(&Verticals.requires_batch?(&1.business_type))
  end

  defp notify(%Business{} = business, batches, days) do
    owner = Repo.get(Kaarobar.Accounts.User, business.organization.owner_id)

    if owner do
      lines =
        Enum.map(batches, fn batch ->
          "  - #{batch.variant.product.name} (batch #{batch.batch_number}): " <>
            "#{batch.remaining_quantity} left, expires #{batch.expires_on}"
        end)

      email =
        new()
        |> to({owner.name, owner.email})
        |> Swoosh.Email.from({sender_name(), sender_address()})
        |> subject("#{business.name}: #{length(batches)} batch(es) expiring soon")
        |> text_body("""
        #{business.name} has stock expiring within #{days} days:

        #{Enum.join(lines, "\n")}
        """)

      Mailer.deliver(email)
      Logger.info("expiry alert: #{business.name} has #{length(batches)} batch(es) due")
    end
  end

  defp sender_name, do: Application.get_env(:backend, :mail_from_name, "Kaarobar")

  defp sender_address,
    do: Application.get_env(:backend, :mail_from_address, "no-reply@kaarobar.app")
end
