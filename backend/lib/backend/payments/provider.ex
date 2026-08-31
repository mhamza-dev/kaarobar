defmodule Kaarobar.Payments.Provider do
  @moduledoc """
  A shop's account with a payment gateway.

  ## Credentials never leave here in the clear

  `credentials` and `webhook_secret` go through `Kaarobar.Encrypted.Map`, so a
  database dump, a read replica or a stray log line yields ciphertext. A
  payment secret is somebody else's money, and the webhook secret is worse:
  anyone holding it can forge a "payment succeeded" event.

  `public_config` is the deliberate other half — the publishable key, the
  merchant id, the return URL. Things a browser is meant to see, kept apart so
  serialising them is not a decision anybody has to get right twice.

  ## `mode` is not a boolean

  Test and live are different accounts with different keys, and a shop that
  takes a real payment against test keys has taken no payment at all. Naming
  the mode explicitly means the value shows up in every log line and every
  serialised response, where somebody will notice it.
  """

  use Kaarobar.Schema

  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @providers ~w(stripe jazzcash easypaisa manual)
  @modes ~w(test live)

  schema "payment_providers" do
    field :provider, :string
    field :display_name, :string
    field :mode, :string, default: "test"

    field :credentials, Kaarobar.Encrypted.Map
    field :public_config, :map, default: %{}
    field :webhook_secret, Kaarobar.Encrypted.Map
    field :webhook_url, :string

    field :is_active, :boolean, default: true
    field :is_default, :boolean, default: false
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business

    timestamps()
  end

  @doc "Every gateway the platform can talk to."
  def providers, do: @providers

  @doc "Test and live are different accounts, not a flag."
  def modes, do: @modes

  def changeset(provider, attrs) do
    provider
    |> cast(attrs, [
      :provider,
      :display_name,
      :mode,
      :credentials,
      :public_config,
      :webhook_secret,
      :webhook_url,
      :is_active,
      :is_default
    ])
    |> validate_required([:provider, :display_name])
    |> validate_inclusion(:provider, @providers)
    |> validate_inclusion(:mode, @modes)
    |> validate_credentials_present()
    |> unique_constraint(:provider,
      name: :payment_providers_business_id_provider_index,
      message: "is already configured for this business"
    )
    |> unique_constraint(:is_default,
      name: :payment_providers_single_default_index,
      message: "another provider is already the default"
    )
  end

  @doc "Soft-deletes the configuration. Past payments keep their history."
  def soft_delete_changeset(provider), do: change(provider, deleted_at: DateTime.utc_now())

  @doc "True when this provider may be used to take money."
  @spec usable?(t()) :: boolean()
  def usable?(%__MODULE__{deleted_at: nil, is_active: true}), do: true
  def usable?(%__MODULE__{}), do: false

  @doc "True when this is a real account taking real money."
  @spec live?(t()) :: boolean()
  def live?(%__MODULE__{mode: "live"}), do: true
  def live?(%__MODULE__{}), do: false

  @doc """
  One credential, by key.

  Reading through a function rather than the map directly keeps every access
  in a place that can be audited, and gives a single answer for a provider that
  has not been configured yet.
  """
  @spec credential(t(), String.t()) :: String.t() | nil
  def credential(%__MODULE__{credentials: nil}, _key), do: nil
  def credential(%__MODULE__{credentials: creds}, key), do: Map.get(creds, key)

  @doc "The secret a callback's signature is checked against."
  @spec signing_secret(t()) :: String.t() | nil
  def signing_secret(%__MODULE__{webhook_secret: nil}), do: nil
  def signing_secret(%__MODULE__{webhook_secret: secret}), do: Map.get(secret, "value")

  # A gateway with no credentials cannot take money, and a configuration that
  # looks complete but is not is worse than one that is obviously missing.
  # `manual` is exempt: there is no API to hold credentials for.
  defp validate_credentials_present(changeset) do
    provider = get_field(changeset, :provider)
    creds = get_field(changeset, :credentials)

    if provider in ["stripe", "jazzcash", "easypaisa"] and empty?(creds) do
      add_error(changeset, :credentials, "are required for #{provider}")
    else
      changeset
    end
  end

  defp empty?(nil), do: true
  defp empty?(map) when is_map(map), do: map_size(map) == 0
  defp empty?(_other), do: false
end
