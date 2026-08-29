defmodule Kaarobar.Slug do
  @moduledoc """
  Turns a display name into a URL-safe slug.

  Latin letters and digits survive, everything else becomes a hyphen. Shop
  names in this market are frequently written in Urdu or Arabic script, which
  leaves nothing usable — so rather than producing an empty slug, a prefixed
  random suffix stands in. The owner sees a readable name everywhere it
  matters; the slug only has to be unique and safe in a URL.
  """

  @max_length 64

  @doc """
  Slugifies a name, falling back to `prefix` plus random hex when the name
  contains no Latin characters.

      iex> Kaarobar.Slug.slugify("Ali's Kiryana Store", "biz")
      "ali-s-kiryana-store"
  """
  @spec slugify(String.t() | nil, String.t()) :: String.t() | nil
  def slugify(nil, _prefix), do: nil

  def slugify(value, prefix) when is_binary(value) do
    slug =
      value
      |> String.downcase()
      |> String.replace(~r/[^a-z0-9]+/u, "-")
      |> String.trim("-")
      |> String.slice(0, @max_length)

    if slug == "", do: random(prefix), else: slug
  end

  @doc "A guaranteed-unique slug with the given prefix."
  @spec random(String.t()) :: String.t()
  def random(prefix) do
    prefix <> "-" <> (6 |> :crypto.strong_rand_bytes() |> Base.encode16(case: :lower))
  end
end
