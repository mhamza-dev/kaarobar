defmodule Kaarobar.Storage.Local do
  @behaviour Kaarobar.Storage

  @impl true
  def put(key, binary, _opts \\ []) do
    path = Path.join(root(), key)
    File.mkdir_p!(Path.dirname(path))

    case File.write(path, binary) do
      :ok -> {:ok, key}
      {:error, reason} -> {:error, reason}
    end
  end

  @impl true
  def url(key) do
    base = Application.get_env(:kaarobar, :public_base_url, "http://localhost:4000")
    String.trim_trailing(base, "/") <> "/uploads/" <> key
  end

  @impl true
  def delete(key) do
    path = Path.join(root(), key)

    case File.rm(path) do
      :ok -> :ok
      {:error, :enoent} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  def root do
    Application.get_env(:kaarobar, :upload_dir) ||
      Path.join([:code.priv_dir(:kaarobar), "static", "uploads"])
  end
end
