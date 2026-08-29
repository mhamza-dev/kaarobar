defmodule Kaarobar.Vault do
  @moduledoc """
  Application-wide encryption vault.

  Backs the `Kaarobar.Encrypted.*` Ecto types, which are used for data that
  must not be readable from a database dump: payment gateway credentials, TOTP
  secrets, and customer PII in regulated verticals.

  The key is supplied at runtime through `CLOAK_KEY` (see `config/runtime.exs`),
  which raises in production when absent.
  """

  use Cloak.Vault, otp_app: :backend
end
