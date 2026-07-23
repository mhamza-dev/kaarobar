defmodule Kaarobar.Profiles do
  @moduledoc """
  Profile picture upload/clear for users, customers, employees, and business logos.
  Reuses Storage (local disk or S3).
  """

  import Ecto.Changeset

  alias Kaarobar.Repo
  alias Kaarobar.Storage
  alias Kaarobar.Schemas.{Business, Customer, Employee, User}

  @max_bytes 2_000_000
  @allowed_types ~w(image/jpeg image/jpg image/png image/webp image/gif)

  def profile_pic_url(%{profile_pic_key: key}) when is_binary(key) and key != "",
    do: Storage.url(key)

  def profile_pic_url(_), do: nil

  def logo_url(%{logo_key: key}) when is_binary(key) and key != "", do: Storage.url(key)
  def logo_url(_), do: nil

  def upload_user_pic(%User{} = user, upload),
    do: upload_pic(user, upload, "profiles/users/#{user.id}", :profile_pic_key)

  def clear_user_pic(%User{} = user), do: clear_pic(user, :profile_pic_key)

  def upload_customer_pic(%Customer{} = customer, upload),
    do:
      upload_pic(
        customer,
        upload,
        "profiles/customers/#{customer.business_id}/#{customer.id}",
        :profile_pic_key
      )

  def clear_customer_pic(%Customer{} = customer), do: clear_pic(customer, :profile_pic_key)

  def upload_employee_pic(%Employee{} = employee, upload),
    do:
      upload_pic(
        employee,
        upload,
        "profiles/employees/#{employee.business_id}/#{employee.id}",
        :profile_pic_key
      )

  def clear_employee_pic(%Employee{} = employee), do: clear_pic(employee, :profile_pic_key)

  def upload_business_logo(%Business{} = business, upload),
    do: upload_pic(business, upload, "profiles/businesses/#{business.id}", :logo_key)

  def clear_business_logo(%Business{} = business), do: clear_pic(business, :logo_key)

  defp upload_pic(record, %Plug.Upload{} = upload, prefix, field) do
    with {:ok, binary, content_type} <- read_upload(upload),
         key = Storage.build_key(prefix, upload.filename || "avatar.jpg"),
         {:ok, ^key} <- Storage.put(key, binary, content_type: content_type),
         :ok <- delete_old(Map.get(record, field)),
         {:ok, updated} <-
           record
           |> change(%{field => key})
           |> Repo.update() do
      {:ok, updated}
    end
  end

  defp upload_pic(_record, _upload, _prefix, _field), do: {:error, :invalid_upload}

  defp clear_pic(record, field) do
    key = Map.get(record, field)
    _ = delete_old(key)

    record
    |> change(%{field => nil})
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
