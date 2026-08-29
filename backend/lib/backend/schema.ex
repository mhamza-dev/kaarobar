defmodule Kaarobar.Schema do
  @moduledoc """
  Base schema used by every persisted struct in the application.

  Establishes the conventions the whole data layer relies on:

    * time-ordered UUID primary and foreign keys (`Kaarobar.Ecto.UUIDv7`)
    * microsecond UTC timestamps, so an audit trail can order two writes that
      land in the same millisecond
    * a `t/0` type, which `Ecto.Schema` deliberately does not generate, so that
      context typespecs can say `Business.t()` and Dialyzer can check them

  Use it in place of `Ecto.Schema`:

      defmodule Kaarobar.Tenancy.Business do
        use Kaarobar.Schema

        schema "businesses" do
          field :name, :string
          timestamps()
        end
      end
  """

  defmacro __using__(_opts) do
    quote do
      use Ecto.Schema

      import Ecto.Changeset

      @primary_key {:id, Kaarobar.Ecto.UUIDv7, autogenerate: true}
      @foreign_key_type Kaarobar.Ecto.UUIDv7
      @timestamps_opts [type: :utc_datetime_usec]
      @derive {Phoenix.Param, key: :id}

      @typedoc "A #{inspect(__MODULE__)} record."
      @type t :: %__MODULE__{}
    end
  end
end
