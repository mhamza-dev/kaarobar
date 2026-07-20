defmodule Kaarobar.Repo do
  use Ecto.Repo,
    otp_app: :kaarobar,
    adapter: Ecto.Adapters.Postgres
end
