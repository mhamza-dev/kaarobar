defmodule Kaarobar.Schemas.CrmMessageTemplate do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  @channels ~w(email in_app sms whatsapp)

  schema "crm_message_templates" do
    field :name, :string
    field :channel, :string, default: "email"
    field :title_template, :string
    field :body_template, :string
    field :variables, :map, default: %{}

    belongs_to :business, Kaarobar.Schemas.Business

    timestamps(type: :utc_datetime)
  end

  def channels, do: @channels

  def changeset(template, attrs) do
    template
    |> cast(attrs, [
      :name,
      :channel,
      :title_template,
      :body_template,
      :variables,
      :business_id
    ])
    |> validate_required([:name, :channel, :title_template, :body_template, :business_id])
    |> validate_inclusion(:channel, @channels)
    |> foreign_key_constraint(:business_id)
  end
end
