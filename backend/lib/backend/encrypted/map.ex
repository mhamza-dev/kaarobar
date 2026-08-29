defmodule Kaarobar.Encrypted.Map do
  @moduledoc """
  An encrypted JSON map field, used for provider credential bundles.
  """

  use Cloak.Ecto.Map, vault: Kaarobar.Vault
end
