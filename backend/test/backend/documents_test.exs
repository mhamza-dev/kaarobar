defmodule Kaarobar.DocumentsTest do
  @moduledoc """
  What comes out of the printer.

  The parts worth breaking the build over are the ones nobody notices until a
  customer is holding the paper: an escaped product name, a receipt in a script
  the print head cannot spell, and the two renderers disagreeing about a total.
  """

  use Kaarobar.DataCase, async: true

  alias Kaarobar.Documents
  alias Kaarobar.Documents.EscPos
  alias Kaarobar.Documents.Html
  alias Kaarobar.Documents.Labels
  alias Kaarobar.Documents.Receipt

  setup do
    %{scope: scope} = owner_scope()
    variant = variant_fixture(scope, %{"name" => "Widget", "price" => "100.00"})
    stock_fixture(scope, variant, "50", unit_cost: "60.00")
    %{register: register} = open_till(scope)

    %{scope: scope, variant: variant, register: register}
  end

  defp document(scope, variant, opts \\ []) do
    sale = sale_fixture(scope, variant, Keyword.take(opts, [:quantity, :amount, :customer_id]))
    {:ok, receipt} = Documents.receipt(scope, sale.id, Keyword.take(opts, [:language]))
    receipt
  end

  # ===========================================================================
  # Languages
  # ===========================================================================

  describe "languages" do
    test "every language the platform ships has a full label set" do
      for language <- Labels.languages() do
        labels = Labels.sale(language)

        # A missing key would render as an empty heading on a real receipt, so
        # this asserts the shape rather than any particular wording.
        for key <- Map.keys(Labels.sale(:en)) do
          assert is_binary(Map.get(labels, key)), "#{language} is missing #{key}"
          refute Map.get(labels, key) == ""
        end
      end
    end

    test "a locale string resolves to a language we print" do
      assert Labels.normalize("ur-PK") == :ur
      assert Labels.normalize("UR") == :ur
      assert Labels.normalize("en_GB") == :en
    end

    test "an unknown locale falls back to English rather than failing" do
      # A receipt in the wrong language can still be read. One that did not
      # print cannot.
      assert Labels.normalize("qq") == :en
      assert Labels.normalize(nil) == :en
      assert Labels.normalize(%{}) == :en
    end

    test "only the right-to-left scripts are right to left" do
      assert Labels.rtl?(:ur)
      assert Labels.rtl?(:ar)
      refute Labels.rtl?(:en)
      refute Labels.rtl?(:de)
    end

    test "an RTL document names fonts that can render the script" do
      stack = Labels.font_stack(:ur)

      # Named explicitly rather than left to the browser: implicit fallback is
      # what produces text on one machine and empty boxes on the next.
      assert stack =~ "Nastaliq"
      assert stack =~ "Geeza Pro"
    end
  end

  # ===========================================================================
  # The document
  # ===========================================================================

  describe "building the receipt" do
    test "carries what the sale recorded, not today's catalogue", ctx do
      receipt = document(ctx.scope, ctx.variant, quantity: "2", amount: "200.00")

      assert receipt.number
      assert [line] = receipt.lines
      assert line.name == "Widget"
      assert Decimal.equal?(line.quantity, Decimal.new("2"))
      assert Decimal.equal?(receipt.totals.total, Decimal.new("200.00"))
    end

    test "names the customer when there is one", ctx do
      customer = customer_fixture(ctx.scope, %{"name" => "Ayesha"})
      receipt = document(ctx.scope, ctx.variant, customer_id: customer.id)

      assert receipt.customer_name == "Ayesha"
    end

    test "a walk-in has no customer line", ctx do
      assert document(ctx.scope, ctx.variant).customer_name == nil
    end

    test "the heading says which kind of receipt this is", ctx do
      receipt = document(ctx.scope, ctx.variant)

      # A credit receipt and a cash receipt are different pieces of paper as
      # far as the customer is concerned.
      assert receipt.title == Labels.sale(:en).cash_receipt
    end

    test "the language can be overridden per document", ctx do
      receipt = document(ctx.scope, ctx.variant, language: "ur")

      assert receipt.language == :ur
      assert receipt.direction == "rtl"
      assert receipt.title == Labels.sale(:ur).cash_receipt
    end

    test "a sale that does not exist is not found", ctx do
      assert {:error, :not_found} = Documents.receipt(ctx.scope, Ecto.UUID.generate())
    end

    test "one business cannot print another's receipt", ctx do
      sale = sale_fixture(ctx.scope, ctx.variant)
      %{scope: other} = owner_scope()

      assert {:error, :not_found} = Documents.receipt(other, sale.id)
    end
  end

  # ===========================================================================
  # HTML
  # ===========================================================================

  describe "the HTML receipt" do
    test "is a complete document with the right direction", ctx do
      html = Html.render(document(ctx.scope, ctx.variant, language: "ur"))

      assert html =~ "<!doctype html>"
      assert html =~ ~s(dir="rtl")
      assert html =~ ~s(lang="ur")
      assert html =~ "charset=\"utf-8\"" or html =~ "charset=utf-8"
    end

    test "prints Urdu as Urdu, not as question marks", ctx do
      html = Html.render(document(ctx.scope, ctx.variant, language: "ur"))

      # The whole point of the HTML path: a browser has fonts and shaping, so
      # the script survives where a print head's code page would not.
      assert html =~ Labels.sale(:ur).total
      refute html =~ "????"
    end

    test "escapes what a shopkeeper can type", ctx do
      variant = variant_fixture(ctx.scope, %{"name" => ~s(Bolt & Nut <10mm>), "price" => "5.00"})
      stock_fixture(ctx.scope, variant, "10", unit_cost: "2.00")

      html = Html.render(document(ctx.scope, variant))

      # `Bolt & Nut <10mm>` is ordinary stock. A receipt is not where anybody
      # should discover that a product name can close a tag.
      assert html =~ "Bolt &amp; Nut &lt;10mm&gt;"
      refute html =~ "<10mm>"
    end

    test "carries no external stylesheet or font", ctx do
      html = Html.render(document(ctx.scope, ctx.variant))

      # A shop's connection drops. A document that waits on a CDN font either
      # prints in the wrong face or does not print at all.
      refute html =~ "<link"
      refute html =~ "http://"
      refute html =~ "https://"
    end

    test "a sheet layout is not a roll layout", ctx do
      receipt = document(ctx.scope, ctx.variant)

      assert Html.render(receipt, paper: "58mm") =~ "width: 58mm"
      assert Html.render(receipt, paper: "A4") =~ "width: 100%"
    end
  end

  # ===========================================================================
  # ESC/POS
  # ===========================================================================

  describe "the ESC/POS receipt" do
    test "starts with an initialise and ends with a cut", ctx do
      {:ok, bytes} = EscPos.render(document(ctx.scope, ctx.variant))

      assert <<0x1B, 0x40, _rest::binary>> = bytes
      # GS V — the cut command, without which the receipt stays attached to the
      # roll and the next one prints onto it.
      assert :binary.match(bytes, <<0x1D, 0x56>>) != :nomatch
    end

    test "contains the numbers a customer would check", ctx do
      {:ok, bytes} = EscPos.render(document(ctx.scope, ctx.variant, amount: "100.00"))

      assert bytes =~ "Widget"
      assert bytes =~ "100.00"
    end

    test "refuses a script the print head cannot spell", ctx do
      # Rather than emitting a page of '?'. The caller rasters it or tells the
      # user why — both beat unreadable paper.
      assert {:error, :not_printable} =
               EscPos.render(document(ctx.scope, ctx.variant, language: "ur"))
    end

    test "refuses when the shop's own data is not Latin", ctx do
      variant = variant_fixture(ctx.scope, %{"name" => "قمیض", "price" => "50.00"})
      stock_fixture(ctx.scope, variant, "10", unit_cost: "20.00")

      # The labels are English here; it is the product name that cannot print.
      assert {:error, :not_printable} = EscPos.render(document(ctx.scope, variant))
    end

    test "the roll width decides the column count" do
      assert EscPos.columns("58mm") == 32
      assert EscPos.columns("80mm") == 48
      # An unknown roll gets the common width rather than crashing the print.
      assert EscPos.columns("something") == 48
    end

    test "lines are padded to the roll width, not past it", ctx do
      {:ok, bytes} = EscPos.render(document(ctx.scope, ctx.variant), paper: "58mm")

      widest =
        bytes
        |> String.split("\n")
        |> Enum.map(&String.length(strip_control(&1)))
        |> Enum.max()

      # A line longer than the roll wraps in the middle of a figure, which is
      # how a total ends up unreadable on a 58mm receipt.
      assert widest <= 32
    end
  end

  # ===========================================================================
  # The two renderers agree
  # ===========================================================================

  describe "both renderings" do
    test "state the same total", ctx do
      receipt = document(ctx.scope, ctx.variant, quantity: "3", amount: "300.00")
      {:ok, bytes} = EscPos.render(receipt)
      html = Html.render(receipt)

      # Built from one model precisely so they cannot drift. A customer holding
      # the printed copy and the emailed one is who finds out otherwise.
      assert bytes =~ "300.00"
      assert html =~ "300.00"
    end

    test "agree on whether the document is right to left", ctx do
      receipt = document(ctx.scope, ctx.variant, language: "ar")

      assert Receipt.rtl?(receipt)
      assert Receipt.needs_raster?(receipt)
      assert Html.render(receipt) =~ ~s(dir="rtl")
    end
  end

  defp strip_control(line) do
    String.replace(line, ~r/[\x00-\x1F]/, "")
  end
end
