defmodule Kaarobar.Messaging.SmsAdapter do
  @moduledoc """
  Behaviour for SMS delivery (CRM-FR-003 / NOT-FR-002).
  """

  @callback send_sms(to :: String.t(), body :: String.t(), meta :: map()) ::
              :ok | {:ok, term()} | {:error, term()}
end

defmodule Kaarobar.Messaging.WhatsappAdapter do
  @moduledoc """
  Behaviour for WhatsApp Business API delivery (CRM-FR-004 / NOT-FR-002).
  """

  @callback send_whatsapp(to :: String.t(), body :: String.t(), meta :: map()) ::
              :ok | {:ok, term()} | {:error, term()}
end

defmodule Kaarobar.Messaging.Sms.Mock do
  @moduledoc "Dev/test SMS adapter — logs and succeeds."
  @behaviour Kaarobar.Messaging.SmsAdapter
  require Logger

  @impl true
  def send_sms(to, body, meta) do
    Logger.info("[sms.mock] to=#{to} body=#{String.slice(body, 0, 80)} meta=#{inspect(meta)}")
    :ok
  end
end

defmodule Kaarobar.Messaging.Whatsapp.Mock do
  @moduledoc "Dev/test WhatsApp adapter — logs and succeeds."
  @behaviour Kaarobar.Messaging.WhatsappAdapter
  require Logger

  @impl true
  def send_whatsapp(to, body, meta) do
    Logger.info("[whatsapp.mock] to=#{to} body=#{String.slice(body, 0, 80)} meta=#{inspect(meta)}")
    :ok
  end
end

defmodule Kaarobar.Messaging do
  @moduledoc "Resolves configured messaging adapters."

  def sms_adapter do
    Application.get_env(:kaarobar, :sms_adapter, Kaarobar.Messaging.Sms.Mock)
  end

  def whatsapp_adapter do
    Application.get_env(:kaarobar, :whatsapp_adapter, Kaarobar.Messaging.Whatsapp.Mock)
  end

  def send_sms(to, body, meta \\ %{}) when is_binary(to) and is_binary(body) do
    sms_adapter().send_sms(to, body, meta)
  end

  def send_whatsapp(to, body, meta \\ %{}) when is_binary(to) and is_binary(body) do
    whatsapp_adapter().send_whatsapp(to, body, meta)
  end
end
