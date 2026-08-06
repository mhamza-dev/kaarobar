defmodule Kaarobar.Accounts.Codes do
  @moduledoc """
  Shared code/slug helpers for invoice IDs and branch codes (IFRS-SME / global).
  """

  @filler MapSet.new(~w(the and of a an for at by with in))

  @doc """
  Latin initials from a shop/business name, e.g. \"Glow Studio Salon\" → \"GSS\".
  """
  def shop_initials(nil), do: "SH"
  def shop_initials(""), do: "SH"

  def shop_initials(name) when is_binary(name) do
    words =
      name
      |> String.trim()
      |> String.replace(~r/[^\p{L}\p{N}\s&'-]/u, " ")
      |> String.split(~r/[\s&'-]+/u, trim: true)

    significant =
      Enum.filter(words, fn w ->
        lower = String.downcase(w)

        if String.length(w) == 1 and String.match?(w, ~r/[A-Za-z]/) do
          true
        else
          not MapSet.member?(@filler, lower)
        end
      end)

    source = if significant == [], do: words, else: significant

    letters =
      source
      |> Enum.map(fn w ->
        case Regex.run(~r/[A-Za-z]/, w) do
          [c] -> String.upcase(c)
          _ -> nil
        end
      end)
      |> Enum.reject(&is_nil/1)

    cond do
      length(letters) >= 2 ->
        letters |> Enum.take(4) |> Enum.join()

      length(letters) == 1 ->
        word =
          source
          |> List.first()
          |> String.replace(~r/[^A-Za-z]/, "")
          |> String.upcase()

        (String.slice(word, 0, 3) || Enum.at(letters, 0))
        |> String.pad_trailing(2, "X")
        |> String.slice(0, 3)

      true ->
        "SH"
    end
  end

  @doc """
  Short branch code from name (2–6 A–Z0–9 chars).
  """
  def branch_code_from_name(nil), do: "MAIN"
  def branch_code_from_name(""), do: "MAIN"

  def branch_code_from_name(name) when is_binary(name) do
    initials = shop_initials(name)

    if String.length(initials) >= 2 do
      String.slice(initials, 0, 6)
    else
      name
      |> String.upcase()
      |> String.replace(~r/[^A-Z0-9]/, "")
      |> case do
        "" -> "MAIN"
        cleaned -> String.slice(cleaned, 0, 6) |> String.pad_trailing(2, "X")
      end
    end
  end
end
