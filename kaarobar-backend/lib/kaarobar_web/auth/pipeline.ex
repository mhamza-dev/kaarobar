defmodule KaarobarWeb.Auth.Pipeline do
  use Guardian.Plug.Pipeline,
    otp_app: :kaarobar,
    module: Kaarobar.Guardian,
    error_handler: KaarobarWeb.Auth.ErrorHandler

  plug Guardian.Plug.VerifyHeader, scheme: "Bearer"
  plug Guardian.Plug.EnsureAuthenticated
  plug Guardian.Plug.LoadResource
end
