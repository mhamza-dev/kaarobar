defmodule Kaarobar.Profiles do
  @moduledoc """
  Profile picture upload/clear for users, customers, and employees.
  Reuses Storage (local disk or S3).
  """

  import Ecto.Changeset

  alias Kaarobar.Repo
  alias Kaarobar.Storage
  alias Kaarobar.Schemas.{Customer, Employee, User}

  @max_bytes 2_000_000
  @allowed_types ~w(image/jpeg image/jpg image/png image/webp image/gif)

  def profile_pic_url(%{profile_pic_key: key}) when is_binary(key) and key != "" do
    Storage.url(key)
  end

  def profile_pic_url(_), do: nil

  def upload_user_pic(%User{} = user, upload), do: upload_pic(user, upload, "profiles/users/#{user.id}")

  def clear_user_pic(%User{} = user), do: clear_pic(user)

  def upload_customer_pic(%Customer{} = customer, upload),
    do: upload_pic(customer, upload, "profiles/customers/#{customer.business_id}/#{customer.id}")

  def clear_customer_pic(%Customer{} = customer), do: clear_pic(customer)

  def upload_employee_pic(%Employee{} = employee, upload),
    do: upload_pic(employee, upload, "profiles/employees/#{employee.business_id}/#{employee.id}")

  def clear_employee_pic(%Employee{} = employee), do: clear_pic(employee)

  defp upload_pic(record, %Plug.Upload{} = upload, prefix) do
    with {:ok, binary, content_type} <- read_upload(upload),
         key = Storage.build_key(prefix, upload.filename || "avatar.jpg"),
         {:ok, ^key} <- Storage.put(key, binary, content_type: content_type),
         :ok <- delete_old(Map.get(record, :profile_pic_key)),
         {:ok, updated} <-
           record
           |> change(%{profile_pic_key: key})
           |> Repo.update() do
      {:ok, updated}
    end
  end

  defp upload_pic(_record, _upload, _prefix), do: {:error, :invalid_upload}

  defp clear_pic(record) do
    key = Map.get(record, :profile_pic_key)
    _ = delete_old(key)

    record
    |> change(%{profile_pic_key: nil})
    |> Repo.update()
  end

  defp read_upload(%Plug.Upload{path: path} = upload) when is_binary(path) do
    content_type = normalize_content_type(upload.content_type)

    cond do
      content_type not in @allowed_types ->
        {:error, :unsupported_type}

      true ->
        case File.read(path) do
          {:ok, binary} when byte_size(binary) > @max_bytes ->
            {:error, :too_large}

          {:ok, binary} when byte_size(binary) == 0 ->
            {:error, :empty}

          {:ok, binary} ->
            {:ok, binary, content_type}

          {:error, reason} ->
            {:error, reason}
        end
    end
  end

  defp read_upload(_), do: {:error, :invalid_upload}

  defp normalize_content_type(nil), do: "image/jpeg"
  defp normalize_content_type(""), do: "image/jpeg"
  defp normalize_content_type(type), do: String.downcase(type)

  defp delete_old(nil), do: :ok
  defp delete_old(""), do: :ok

  defp delete_old(key) when is_binary(key) do
    _ = Storage.delete(key)
    :ok
  end
end
