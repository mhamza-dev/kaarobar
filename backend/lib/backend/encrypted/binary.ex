defmodule Kaarobar.Encrypted.Binary do
  @moduledoc """
  An encrypted string field. Stored as `:binary`, transparently decrypted on load.
  """

  use Cloak.Ecto.Binary, vault: Kaarobar.Vault
end
