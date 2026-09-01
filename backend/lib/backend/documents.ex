defmodule Kaarobar.Documents do
  @moduledoc """
  Turning a sale into something that can be handed to a customer.

  Two renderings of one document: an HTML page any browser can print, and an
  ESC/POS byte stream a thermal printer understands. Both are built from the
  same `Kaarobar.Documents.Receipt`, so the printed copy and the emailed one
  cannot disagree about a total.

  ## The server renders, the client prints

  A browser cannot open a USB device, and a shop's printer is on the shop's
  network rather than ours. So the client fetches a payload and forwards it —
  which also means a layout fix ships to every till at once, without anybody
  updating anything.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Documents.EscPos
  alias Kaarobar.Documents.Html
  alias Kaarobar.Documents.Receipt
  alias Kaarobar.Repo
  alias Kaarobar.Repo.Scoped
  alias Kaarobar.Sales.Sale
  alias Kaarobar.Scope

  @doc """
  Builds the receipt document for a sale.

  Loads everything the renderers need in one query rather than letting them
  reach back for it — a renderer that quietly issues queries is one that gets
  slow inside a loop nobody remembers writing.
  """
  @spec receipt(Scope.t(), Ecto.UUID.t(), keyword()) ::
          {:ok, Receipt.t()} | {:error, :not_found}
  def receipt(%Scope{} = scope, sale_id, opts \\ []) do
    Sale
    |> Scoped.for_business(scope)
    |> where([s], s.id == ^sale_id)
    |> preload([
      :business,
      :branch,
      :customer,
      :cashier,
      :payments,
      items: :taxes
    ])
    |> Repo.one()
    |> case do
      nil -> {:error, :not_found}
      sale -> {:ok, Receipt.build(sale, opts)}
    end
  end

  @doc "The receipt as a printable HTML page."
  @spec receipt_html(Scope.t(), Ecto.UUID.t(), keyword()) ::
          {:ok, String.t()} | {:error, :not_found}
  def receipt_html(%Scope{} = scope, sale_id, opts \\ []) do
    with {:ok, document} <- receipt(scope, sale_id, opts) do
      {:ok, Html.render(document, opts)}
    end
  end

  @doc """
  The receipt as ESC/POS bytes.

  `{:error, :not_printable}` when the shop's language is one a print head has
  no glyphs for — Urdu, Arabic, Chinese. The caller should render the HTML and
  send it as an image instead of printing a page of `?`.
  """
  @spec receipt_escpos(Scope.t(), Ecto.UUID.t(), keyword()) ::
          {:ok, binary()} | {:error, :not_found | :not_printable}
  def receipt_escpos(%Scope{} = scope, sale_id, opts \\ []) do
    with {:ok, document} <- receipt(scope, sale_id, opts) do
      EscPos.render(document, opts)
    end
  end
end
