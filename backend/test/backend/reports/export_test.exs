defmodule Kaarobar.Reports.ExportTest do
  @moduledoc """
  What lands in the accountant's downloads folder.

  Nothing here touches the database. These are the parts that are wrong in a
  way no integration test would catch: a comma inside a product name that
  splits a row, and a cell that runs as a formula when the file is opened.
  """

  use ExUnit.Case, async: true

  alias Kaarobar.Reports.Export

  defp lines(csv) do
    csv
    |> String.replace_prefix("﻿", "")
    |> String.split("\r\n", trim: true)
  end

  describe "encoding" do
    test "writes a header from the columns, not from the first row" do
      csv = Export.to_csv([], [{:a, "Alpha"}, {:b, "Beta"}])

      # Derived from the first row instead, a report whose first row happens to
      # be missing an optional field would drop that column for everybody.
      assert [header] = lines(csv)
      assert header == "Alpha,Beta"
    end

    test "starts with a byte-order mark" do
      # Without it, Excel on Windows reads UTF-8 as the system codepage and
      # every Urdu product name arrives as mojibake.
      assert String.starts_with?(Export.to_csv([], [{:a, "A"}]), "﻿")
    end

    test "quotes a value containing a comma" do
      csv = Export.to_csv([%{name: "Bolt, 10mm"}], [{:name, "Name"}])

      assert [_header, row] = lines(csv)
      assert row == ~s("Bolt, 10mm")
    end

    test "doubles an embedded quote" do
      csv = Export.to_csv([%{name: ~s(10" pipe)}], [{:name, "Name"}])

      assert [_header, row] = lines(csv)
      assert row == ~s("10"" pipe")
    end

    test "keeps a newline inside its cell" do
      csv = Export.to_csv([%{note: "line one\nline two"}], [{:note, "Note"}])

      # Quoted, so the row does not split. Splitting on \\r\\n gives the header
      # and one row whose content spans the embedded newline.
      assert csv =~ ~s("line one\nline two")
    end

    test "renders a decimal at full precision, not as a float" do
      csv = Export.to_csv([%{total: Decimal.new("1234.5000")}], [{:total, "Total"}])

      assert [_header, row] = lines(csv)
      assert row == "1234.5000"
    end

    test "renders a date as ISO 8601" do
      csv = Export.to_csv([%{day: ~D[2026-03-15]}], [{:day, "Date"}])

      assert [_header, row] = lines(csv)
      assert row == "2026-03-15"
    end

    test "a missing key is an empty cell, not a crash" do
      csv = Export.to_csv([%{a: "x"}], [{:a, "A"}, {:b, "B"}])

      assert [_header, row] = lines(csv)
      assert row == "x,"
    end
  end

  # ===========================================================================
  # The one that matters
  # ===========================================================================

  describe "formula injection" do
    test "neutralises a cell that would run as a formula" do
      # Excel, Numbers and LibreOffice all execute a cell beginning with these.
      # A shop whose product is named by a supplier import is a shop whose
      # export runs on the accountant's machine.
      for leader <- ["=", "+", "-", "@"] do
        csv = Export.to_csv([%{name: leader <> "HYPERLINK(\"http://x\")"}], [{:name, "Name"}])

        assert [_header, row] = lines(csv)
        assert String.starts_with?(String.trim_leading(row, "\""), "'"),
               "#{leader} was not neutralised"
      end
    end

    test "the apostrophe is inside the quotes, so the cell still parses" do
      csv = Export.to_csv([%{name: "=1+1, really"}], [{:name, "Name"}])

      assert [_header, row] = lines(csv)
      assert row == ~s("'=1+1, really")
    end

    test "an ordinary value is left exactly as it was" do
      csv = Export.to_csv([%{name: "Widget"}], [{:name, "Name"}])

      # The mitigation must not touch data that was never dangerous — an
      # apostrophe in front of every product name would be its own bug.
      assert [_header, row] = lines(csv)
      assert row == "Widget"
    end

    test "an empty cell stays empty" do
      csv = Export.to_csv([%{name: ""}], [{:name, "Name"}])

      assert [_header | rest] = lines(csv)
      assert rest == []
    end
  end

  describe "column sets" do
    test "every exportable report has columns" do
      for report <- [
            :daily,
            :top_products,
            :by_tender,
            :by_cashier,
            :by_branch,
            :by_category,
            :tax,
            :expenses
          ] do
        columns = Export.columns(report)

        assert is_list(columns) and columns != [], "#{report} has no columns"
        assert Enum.all?(columns, fn {key, label} -> is_atom(key) and is_binary(label) end)
      end
    end

    test "an unknown report has none, so the endpoint can refuse it" do
      assert Export.columns(:nonsense) == nil
    end

    test "the filename says what and when" do
      name = Export.filename(:daily, ~D[2026-03-01], ~D[2026-03-31])

      assert name == "daily-2026-03-01-to-2026-03-31.csv"
    end
  end
end
