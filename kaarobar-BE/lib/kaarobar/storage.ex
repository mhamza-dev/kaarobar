defmodule Kaarobar.Storage do
  @moduledoc """
  File storage behaviour. Local disk in dev/test; S3-compatible in prod.
  """

  @callback put(key :: String.t(), binary :: binary(), opts :: keyword()) ::
              {:ok, String.t()} | {:error, term()}
  @callback url(key :: String.t()) :: String.t()
  @callback delete(key :: String.t()) :: :ok | {:error, term()}

  def put(key, binary, opts \\ []) do
    adapter().put(key, binary, opts)
  end

  def url(key) when is_binary(key) and key != "" do
    adapter().url(key)
  end

  def url(_), do: nil

  def delete(key) do
    adapter().delete(key)
  end

  def adapter do
    Application.get_env(:kaarobar, :storage_adapter, Kaarobar.Storage.Local)
  end

  def build_key(prefix, filename) do
    ext =
      filename
      |> to_string()
      |> Path.extname()
      |> String.downcase()

    ext = if ext in [".jpg", ".jpeg", ".png", ".webp", ".gif"], do: ext, else: ".jpg"
    "#{prefix}/#{Ecto.UUID.generate()}#{ext}"
  end
end
