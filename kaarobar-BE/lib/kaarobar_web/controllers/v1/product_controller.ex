defmodule KaarobarWeb.V1.ProductController do
  use KaarobarWeb, :controller

  alias Kaarobar.{Catalog, Inventory, Guardian, Repo}
  alias Kaarobar.Schemas.InventoryRecord

  def index(conn, _params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]

    if is_nil(business_id) do
      conn |> put_status(:bad_request) |> json(%{error: "x-business-id required"})
    else
      products = Catalog.list_products(business_id, conn.assigns.current_owner_id || user.id)
      branch_id = conn.assigns[:current_branch_id]
      data = Enum.map(products, &Catalog.serialize_product(&1, branch_id))
      json(conn, %{data: data})
    end
  end

  def show(conn, %{"id" => id}) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]
    owner_id = conn.assigns.current_owner_id || user.id

    case Catalog.get_product(id, business_id, owner_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      product ->
        json(conn, %{
          data: Catalog.serialize_product(product, conn.assigns[:current_branch_id])
        })
    end
  end

  def by_barcode(conn, %{"code" => code}) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]
    owner_id = conn.assigns.current_owner_id || user.id
    branch_id = conn.assigns[:current_branch_id]

    if is_nil(business_id) do
      conn |> put_status(:bad_request) |> json(%{error: "x-business-id required"})
    else
      case Catalog.find_by_barcode(business_id, owner_id, code) do
        {:ok, %{product: product, variant: variant}} ->
          data = Catalog.serialize_product(product, branch_id)

          data =
            if variant do
              Map.put(data, :matched_variant_id, variant.id)
            else
              data
            end

          json(conn, %{data: data})

        {:error, :not_found} ->
          conn |> put_status(:not_found) |> json(%{error: "not_found"})
      end
    end
  end

  def create(conn, params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]
    owner_id = conn.assigns[:current_owner_id] || user.id
    branch_id = conn.assigns[:current_branch_id]

    if is_nil(business_id) do
      conn |> put_status(:bad_request) |> json(%{error: "x-business-id required"})
    else
      with {:ok, product} <- Catalog.create_product(business_id, owner_id, params),
           :ok <- maybe_price(product, branch_id, owner_id, business_id, params["price"]),
           :ok <-
             maybe_stock(
               product,
               branch_id,
               owner_id,
               business_id,
               params["opening_qty"] || default_opening(product)
             ),
           {:ok, product} <- maybe_upload(conn, product, owner_id, params) do
        product = Catalog.get_product(product.id, business_id, owner_id)

        conn
        |> put_status(:created)
        |> json(%{data: Catalog.serialize_product(product, branch_id)})
      else
        {:error, reason} ->
          conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
      end
    end
  end

  def update(conn, %{"id" => id} = params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]
    owner_id = conn.assigns[:current_owner_id] || user.id
    branch_id = conn.assigns[:current_branch_id]

    case Catalog.get_product(id, business_id, owner_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      product ->
        with {:ok, updated} <- Catalog.update_product(product, params),
             :ok <- maybe_price(updated, branch_id, owner_id, business_id, params["price"]),
             {:ok, updated} <- maybe_upload(conn, updated, owner_id, params) do
          updated = Catalog.get_product(updated.id, business_id, owner_id)
          json(conn, %{data: Catalog.serialize_product(updated, branch_id)})
        else
          {:error, reason} ->
            conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
        end
    end
  end

  def create_variant(conn, %{"id" => product_id} = params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]
    owner_id = conn.assigns.current_owner_id || user.id

    case Catalog.get_product(product_id, business_id, owner_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      product ->
        case Catalog.create_variant(product, params) do
          {:ok, variant} ->
            conn
            |> put_status(:created)
            |> json(%{
              data: %{
                id: variant.id,
                name: variant.name,
                sku: variant.sku,
                barcode: variant.barcode,
                price_override:
                  variant.price_override && to_string(variant.price_override)
              }
            })

          {:error, reason} ->
            conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
        end
    end
  end

  def upload_image(conn, %{"id" => product_id} = params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]
    owner_id = conn.assigns.current_owner_id || user.id

    case Catalog.get_product(product_id, business_id, owner_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      product ->
        upload = params["image"] || params["file"]

        if match?(%Plug.Upload{}, upload) do
          case Catalog.upload_product_image(product, upload, owner_id, primary: true) do
            {:ok, image} ->
              conn
              |> put_status(:created)
              |> json(%{
                data: %{
                  id: image.id,
                  url: Kaarobar.Storage.url(image.storage_key),
                  is_primary: image.is_primary
                }
              })

            {:error, reason} ->
              conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
          end
        else
          conn |> put_status(:bad_request) |> json(%{error: "image file required"})
        end
    end
  end

  def delete_image(conn, %{"id" => product_id, "image_id" => image_id}) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]
    owner_id = conn.assigns.current_owner_id || user.id

    case Catalog.get_product(product_id, business_id, owner_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      _product ->
        case Catalog.delete_product_image(image_id, business_id, owner_id) do
          {:ok, _} -> json(conn, %{ok: true})
          {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: "not_found"})
          {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
        end
    end
  end

  def create_batch(conn, %{"id" => product_id} = params) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]
    owner_id = conn.assigns.current_owner_id || user.id
    branch_id = conn.assigns[:current_branch_id] || params["branch_id"]

    with %{} = product <- Catalog.get_product(product_id, business_id, owner_id),
         true <- not is_nil(branch_id) || {:error, :branch_required},
         {:ok, batch} <- Catalog.create_batch(product, branch_id, params) do
      conn
      |> put_status(:created)
      |> json(%{
        data: %{
          id: batch.id,
          lot_number: batch.lot_number,
          expires_on: batch.expires_on,
          quantity_on_hand: to_string(batch.quantity_on_hand),
          cost: to_string(batch.cost)
        }
      })
    else
      nil -> conn |> put_status(:not_found) |> json(%{error: "not_found"})
      {:error, :branch_required} -> conn |> put_status(:bad_request) |> json(%{error: "branch required"})
      {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def list_batches(conn, %{"id" => product_id}) do
    user = Guardian.Plug.current_resource(conn)
    business_id = conn.assigns[:current_business_id]
    owner_id = conn.assigns.current_owner_id || user.id
    branch_id = conn.assigns[:current_branch_id]

    case Catalog.get_product(product_id, business_id, owner_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      _product ->
        if is_nil(branch_id) do
          conn |> put_status(:bad_request) |> json(%{error: "x-branch-id required"})
        else
          data =
            Catalog.list_batches(product_id, branch_id)
            |> Enum.map(fn b ->
              %{
                id: b.id,
                lot_number: b.lot_number,
                expires_on: b.expires_on,
                quantity_on_hand: to_string(b.quantity_on_hand),
                cost: to_string(b.cost)
              }
            end)

          json(conn, %{data: data})
        end
    end
  end

  defp default_opening(%{track_inventory: false}), do: nil
  defp default_opening(%{product_kind: "service"}), do: nil
  defp default_opening(_), do: "100"

  defp maybe_upload(_conn, product, owner_id, params) do
    upload = params["image"] || params["file"]

    if match?(%Plug.Upload{}, upload) do
      case Catalog.upload_product_image(product, upload, owner_id, primary: true) do
        {:ok, _} -> {:ok, product}
        err -> err
      end
    else
      {:ok, product}
    end
  end

  defp maybe_price(_product, nil, _, _, _), do: :ok
  defp maybe_price(_product, _, _, _, nil), do: :ok
  defp maybe_price(_product, _, _, _, ""), do: :ok

  defp maybe_price(product, branch_id, owner_id, business_id, price) do
    case Inventory.set_branch_price(product.id, branch_id, owner_id, business_id, price) do
      {:ok, _} -> :ok
      error -> error
    end
  end

  defp maybe_stock(_product, nil, _, _, _), do: :ok
  defp maybe_stock(_product, _, _, _, nil), do: :ok
  defp maybe_stock(%{track_inventory: false}, _, _, _, _), do: :ok

  defp maybe_stock(product, branch_id, owner_id, business_id, qty) do
    %InventoryRecord{}
    |> InventoryRecord.changeset(%{
      product_id: product.id,
      branch_id: branch_id,
      owner_id: owner_id,
      business_id: business_id,
      quantity_on_hand: qty,
      avg_cost: "0"
    })
    |> Repo.insert()
    |> case do
      {:ok, _} -> :ok
      {:error, _} = err -> err
    end
  end
end
