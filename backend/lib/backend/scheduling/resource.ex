defmodule Kaarobar.Scheduling.Resource do
  @moduledoc """
  Anything there is only one of, that a booking can hold.

  A stylist, a chair, a treatment room, a massage bed, a repair bay. One table
  for all of them because the booking rule is identical — two appointments
  cannot hold the same one at the same time — and because a salon needs both
  kinds at once: a colour needs Ayesha *and* a basin, and either being busy
  makes the slot unbookable.

  `working_hours` is nullable and falls back to the branch's opening hours.
  Most staff work the shop's hours, and making every one of them restate that
  is how a rota goes stale.
  """

  use Kaarobar.Schema

  alias Kaarobar.Accounts.User
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Organization

  @kinds ~w(staff chair room equipment bay other)

  schema "resources" do
    field :name, :string
    field :kind, :string, default: "staff"
    field :colour, :string
    field :position, :integer, default: 0

    # Keyed by weekday: %{"mon" => [%{"from" => "09:00", "to" => "18:00"}]}.
    field :working_hours, :map

    field :is_bookable, :boolean, default: true
    field :is_active, :boolean, default: true
    field :deleted_at, :utc_datetime_usec

    belongs_to :organization, Organization
    belongs_to :business, Business
    belongs_to :branch, Branch
    belongs_to :user, User

    timestamps()
  end

  @doc "The kinds of thing that can be booked."
  def kinds, do: @kinds

  def changeset(resource, attrs) do
    resource
    |> cast(attrs, [
      :branch_id,
      :name,
      :kind,
      :user_id,
      :colour,
      :position,
      :working_hours,
      :is_bookable,
      :is_active
    ])
    |> validate_required([:branch_id, :name])
    |> update_change(:name, &String.trim/1)
    |> validate_length(:name, min: 1, max: 80)
    |> validate_inclusion(:kind, @kinds)
    |> unique_constraint(:name,
      name: :resources_branch_id_name_index,
      message: "is already used by another resource"
    )
    |> foreign_key_constraint(:branch_id)
    |> foreign_key_constraint(:user_id)
  end

  @doc "Soft-deletes the resource, keeping its bookings readable."
  def soft_delete_changeset(resource), do: change(resource, deleted_at: DateTime.utc_now())

  @doc "True when a booking may be made against this."
  @spec bookable?(t()) :: boolean()
  def bookable?(%__MODULE__{deleted_at: nil, is_active: true, is_bookable: true}), do: true
  def bookable?(%__MODULE__{}), do: false

  @doc "True when this resource is a person rather than a thing."
  @spec staff?(t()) :: boolean()
  def staff?(%__MODULE__{kind: "staff"}), do: true
  def staff?(%__MODULE__{}), do: false

  @doc """
  The windows this resource works on a given weekday.

  Returns `:default` when it keeps the branch's hours, so the caller can fall
  back rather than treating an unset rota as "never available".
  """
  @spec hours_on(t(), Date.t()) :: [%{from: Time.t(), to: Time.t()}] | :default
  def hours_on(%__MODULE__{working_hours: nil}, _date), do: :default
  def hours_on(%__MODULE__{working_hours: hours}, _date) when map_size(hours) == 0, do: :default

  def hours_on(%__MODULE__{working_hours: hours}, date) do
    case Map.get(hours, weekday_key(date)) do
      nil -> []
      windows -> windows |> List.wrap() |> Enum.flat_map(&parse_window/1)
    end
  end

  defp weekday_key(date) do
    ~w(mon tue wed thu fri sat sun) |> Enum.at(Date.day_of_week(date) - 1)
  end

  defp parse_window(%{"from" => from, "to" => to}) do
    with {:ok, from_time} <- Time.from_iso8601(pad(from)),
         {:ok, to_time} <- Time.from_iso8601(pad(to)) do
      [%{from: from_time, to: to_time}]
    else
      _invalid -> []
    end
  end

  defp parse_window(_window), do: []

  # People write "09:00"; Time.from_iso8601 wants seconds.
  defp pad(value) when is_binary(value) do
    if String.length(value) == 5, do: value <> ":00", else: value
  end

  defp pad(value), do: value
end
