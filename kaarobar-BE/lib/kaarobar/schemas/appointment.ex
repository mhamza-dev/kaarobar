defmodule Kaarobar.Schemas.Appointment do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @statuses ~w(Booked CheckedIn InProgress Completed Cancelled NoShow)
  @booked_by ~w(staff customer)
  @deposit_statuses ~w(none due paid applied forfeited)

  schema "appointments" do
    field :starts_at, :utc_datetime
    field :ends_at, :utc_datetime
    field :status, :string, default: "Booked"
    field :notes, :string
    field :booked_by, :string, default: "staff"
    field :buffer_before_minutes, :integer, default: 0
    field :buffer_after_minutes, :integer, default: 0
    field :deposit_amount, :decimal
    field :deposit_status, :string, default: "none"
    field :package_session_index, :integer

    belongs_to :owner, Kaarobar.Schemas.User
    belongs_to :business, Kaarobar.Schemas.Business
    belongs_to :branch, Kaarobar.Schemas.Branch
    belongs_to :customer, Kaarobar.Schemas.Customer
    belongs_to :product, Kaarobar.Schemas.Product
    belongs_to :staff, Kaarobar.Schemas.Employee
    belongs_to :sale, Kaarobar.Schemas.Sale
    belongs_to :deposit_sale, Kaarobar.Schemas.Sale, foreign_key: :deposit_sale_id

    belongs_to :package_purchase, Kaarobar.Schemas.CustomerPackagePurchase,
      foreign_key: :package_purchase_id

    has_many :appointment_resources, Kaarobar.Schemas.AppointmentResource

    timestamps(type: :utc_datetime)
  end

  def statuses, do: @statuses
  def booked_by_values, do: @booked_by
  def deposit_statuses, do: @deposit_statuses

  def changeset(appointment, attrs) do
    appointment
    |> cast(attrs, [
      :starts_at,
      :ends_at,
      :status,
      :notes,
      :booked_by,
      :buffer_before_minutes,
      :buffer_after_minutes,
      :deposit_amount,
      :deposit_status,
      :package_session_index,
      :owner_id,
      :business_id,
      :branch_id,
      :customer_id,
      :product_id,
      :staff_id,
      :sale_id,
      :deposit_sale_id,
      :package_purchase_id
    ])
    |> validate_required([
      :starts_at,
      :ends_at,
      :status,
      :booked_by,
      :owner_id,
      :business_id,
      :branch_id,
      :product_id,
      :staff_id
    ])
    |> validate_inclusion(:status, @statuses)
    |> validate_inclusion(:booked_by, @booked_by)
    |> validate_inclusion(:deposit_status, @deposit_statuses)
    |> validate_number(:buffer_before_minutes, greater_than_or_equal_to: 0)
    |> validate_number(:buffer_after_minutes, greater_than_or_equal_to: 0)
    |> validate_time_range()
    |> foreign_key_constraint(:owner_id)
    |> foreign_key_constraint(:business_id)
    |> foreign_key_constraint(:branch_id)
    |> foreign_key_constraint(:customer_id)
    |> foreign_key_constraint(:product_id)
    |> foreign_key_constraint(:staff_id)
    |> foreign_key_constraint(:sale_id)
    |> foreign_key_constraint(:deposit_sale_id)
    |> foreign_key_constraint(:package_purchase_id)
  end

  defp validate_time_range(changeset) do
    starts_at = get_field(changeset, :starts_at)
    ends_at = get_field(changeset, :ends_at)

    cond do
      is_nil(starts_at) or is_nil(ends_at) ->
        changeset

      DateTime.compare(ends_at, starts_at) != :gt ->
        add_error(changeset, :ends_at, "must be after starts_at")

      true ->
        changeset
    end
  end
end
