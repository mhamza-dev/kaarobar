defmodule Kaarobar.Fiscal.Config do
  @moduledoc """
  A business's registration with a tax authority.

  ## `block_on_failure` is the one genuinely hard setting here

  Off, a sale completes even when the authority is unreachable and is reported
  when it comes back — the shop keeps trading. On, the till refuses to sell
  until the authority answers.

  Off is the default because a shop that cannot sell loses the day's takings,
  and every regime mandating real-time reporting allows a grace period for
  exactly this. But some regimes do require the block, and a shop that gets
  audited having sold unreported would rather have had the choice. So it is a
  setting with a documented default rather than a decision made for them.

  `credentials` is encrypted: a token that can file invoices in a taxpayer's
  name is worth stealing.
  """

  use Kaarobar.Schema

  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @adapters ~w(fbr generic none)
  @modes ~w(test live)

  schema "fiscal_configs" do
    field :adapter, :string
    field :mode, :string, default: "test"

    field :taxpayer_number, :string
    field :pos_id, :string
    field :endpoint_url, :string
    field :credentials, Kaarobar.Encrypted.Map

    field :is_active, :boolean, default: false
    field :block_on_failure, :boolean, default: false
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business

    timestamps()
  end

  @doc "The authorities the platform can file with."
  def adapters, do: @adapters

  @doc "Test and live are different registrations, not a flag."
  def modes, do: @modes

  def changeset(config, attrs) do
    config
    |> cast(attrs, [
      :adapter,
      :mode,
      :taxpayer_number,
      :pos_id,
      :endpoint_url,
      :credentials,
      :is_active,
      :block_on_failure
    ])
    |> validate_required([:adapter])
    |> validate_inclusion(:adapter, @adapters)
    |> validate_inclusion(:mode, @modes)
    |> validate_registration()
    |> unique_constraint(:business_id,
      name: :fiscal_configs_business_id_index,
      message: "already has a fiscal configuration"
    )
  end

  @doc "Soft-deletes the configuration. Past submissions keep their history."
  def soft_delete_changeset(config), do: change(config, deleted_at: DateTime.utc_now())

  @doc "True when sales should be reported."
  @spec reporting?(t() | nil) :: boolean()
  def reporting?(nil), do: false
  def reporting?(%__MODULE__{adapter: "none"}), do: false
  def reporting?(%__MODULE__{deleted_at: nil, is_active: true}), do: true
  def reporting?(%__MODULE__{}), do: false

  @doc """
  True when a sale must not complete without the authority accepting it.

  The strict reading of a real-time regime. Off by default because a till that
  cannot sell costs a shop more than reporting a minute late.
  """
  @spec blocking?(t() | nil) :: boolean()
  def blocking?(nil), do: false
  def blocking?(%__MODULE__{} = config), do: reporting?(config) and config.block_on_failure

  @doc "One credential, by key."
  @spec credential(t(), String.t()) :: String.t() | nil
  def credential(%__MODULE__{credentials: nil}, _key), do: nil
  def credential(%__MODULE__{credentials: creds}, key), do: Map.get(creds, key)

  # A configuration switched on without the details the authority needs will
  # fail on every submission, and it will fail after the sale rather than at
  # the point somebody could have fixed it.
  defp validate_registration(changeset) do
    active = get_field(changeset, :is_active)
    adapter = get_field(changeset, :adapter)

    if active and adapter in ["fbr", "generic"] do
      validate_required(changeset, [:taxpayer_number, :pos_id],
        message: "is required before fiscal reporting can be switched on"
      )
    else
      changeset
    end
  end
end
