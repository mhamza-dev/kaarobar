defmodule Kaarobar.Workers.SmsCampaignWorker do
  use Oban.Worker, queue: :notifications, max_attempts: 3

  alias Kaarobar.Messaging
  alias Kaarobar.Repo
  alias Kaarobar.Schemas.Customer

  @impl Oban.Worker
  def perform(%Oban.Job{args: args}) do
    phone = args["phone"]
    message = args["message"] || ""
    customer_id = args["customer_id"]

    with true <- is_binary(phone) and phone != "",
         %Customer{} = customer <- Repo.get(Customer, customer_id),
         true <- customer.marketing_opt_in_sms == true do
      Messaging.send_sms(phone, message, %{
        campaign_id: args["campaign_id"],
        customer_id: customer_id
      })
    else
      nil -> {:error, :customer_not_found}
      false -> :ok
      _ -> :ok
    end
  end
end

defmodule Kaarobar.Workers.WhatsappCampaignWorker do
  use Oban.Worker, queue: :notifications, max_attempts: 3

  alias Kaarobar.Messaging
  alias Kaarobar.Repo
  alias Kaarobar.Schemas.Customer

  @impl Oban.Worker
  def perform(%Oban.Job{args: args}) do
    phone = args["phone"]
    message = args["message"] || ""
    customer_id = args["customer_id"]

    with true <- is_binary(phone) and phone != "",
         %Customer{} = customer <- Repo.get(Customer, customer_id),
         true <- customer.marketing_opt_in_whatsapp == true do
      Messaging.send_whatsapp(phone, message, %{
        campaign_id: args["campaign_id"],
        customer_id: customer_id
      })
    else
      nil -> {:error, :customer_not_found}
      false -> :ok
      _ -> :ok
    end
  end
end
