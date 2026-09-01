defmodule Kaarobar.Sequences do
  @moduledoc """
  Allocates the human-readable numbers a shop refers to out loud.

  `PO-0042` is what someone says on the phone to a supplier; a UUID is not.

  ## Gapless, and what that costs

  Allocation is an `UPDATE … RETURNING` inside the caller's transaction. The
  row lock is held until commit, so concurrent allocations on the same series
  queue — and a rollback puts the number back, leaving no hole.

  A Postgres `SEQUENCE` would be faster and is explicitly not gapless: a rolled
  back transaction consumes its number permanently. In most jurisdictions a tax
  document series may not have holes, and a missing invoice number is the first
  thing an auditor asks about. The lock is measured in microseconds; the
  conversation is not.

  ## Always call this inside a transaction

  A number allocated outside one is committed the moment it is taken, so if the
  document it was for then fails to save, the number is gone and the series has
  a hole — the exact thing this exists to prevent.
  """

  import Ecto.Query, warn: false

  alias Kaarobar.Repo
  alias Kaarobar.Scope

  # Reasonable defaults per document type: what it is called, and how often the
  # series restarts.
  @defaults %{
    "purchase_order" => %{prefix: "PO", reset: :yearly},
    "goods_receipt" => %{prefix: "GRN", reset: :yearly},
    "supplier_bill" => %{prefix: "BILL", reset: :yearly},
    "supplier_payment" => %{prefix: "PAY", reset: :yearly},
    "purchase_return" => %{prefix: "PRET", reset: :yearly},
    "stock_transfer" => %{prefix: "TRF", reset: :yearly},
    "stock_count" => %{prefix: "CNT", reset: :yearly},
    "sale" => %{prefix: "INV", reset: :yearly},
    "credit_note" => %{prefix: "CN", reset: :yearly},
    "sale_return" => %{prefix: "RET", reset: :yearly},
    "refund_request" => %{prefix: "RR", reset: :yearly},
    "customer_payment" => %{prefix: "RCPT", reset: :yearly},
    "store_credit" => %{prefix: "SC", reset: :yearly},
    # Tickets and shifts are working documents, not tax ones. They restart
    # monthly so the number stays short enough to read out across a counter.
    "order" => %{prefix: "ORD", reset: :monthly},
    "shift" => %{prefix: "SH", reset: :monthly},
    # A kitchen ticket number is read out across a noisy pass, so it resets
    # monthly to stay short. A delivery number is quoted to a customer on the
    # phone, so it does the same.
    "kitchen_ticket" => %{prefix: "KOT", reset: :monthly},
    "delivery" => %{prefix: "DEL", reset: :monthly},
    "appointment" => %{prefix: "APT", reset: :monthly},
    # A job number is written on a laundry tag and read back weeks later, so it
    # keeps the year: "SJ-2026-0104" survives being found in a coat pocket.
    "service_job" => %{prefix: "SJ", reset: :yearly},
    "rental_agreement" => %{prefix: "HIRE", reset: :yearly},
    "quote" => %{prefix: "QT", reset: :yearly},
    # A payment reference is quoted to a gateway and echoed back in every
    # callback it sends, so it stays unique for the whole year.
    "payment_intent" => %{prefix: "PAY", reset: :yearly},
    # An expense is filed with the year's paperwork and looked up by an
    # accountant months later, so the year is part of how it is found.
    "expense" => %{prefix: "EXP", reset: :yearly}
  }

  @doc """
  Takes the next number in a series, formatted.

  ## Options

    * `:branch_id` — number per branch rather than per business. Fiscal rules
      often require it, and it is what stops two shops issuing the same
      invoice number.
    * `:prefix` — overrides the default for the document type.
    * `:at` — the date deciding the period. Defaults to today.

  ## Example

      Sequences.next(scope, "purchase_order", branch_id: branch.id)
      #=> {:ok, "PO-2026-0042"}
  """
  @spec next(Scope.t(), String.t(), keyword()) :: {:ok, String.t()} | {:error, term()}
  def next(%Scope{} = scope, document_type, opts \\ []) do
    defaults = Map.get(@defaults, document_type, %{prefix: default_prefix(document_type), reset: :yearly})

    prefix = Keyword.get(opts, :prefix, defaults.prefix)
    period = period_for(defaults.reset, Keyword.get(opts, :at, Date.utc_today()))
    branch_id = Keyword.get(opts, :branch_id)

    with {:ok, sequence} <- ensure_sequence(scope, document_type, prefix, period, branch_id),
         {:ok, number} <- take(sequence.id) do
      {:ok, format(prefix, period, number, sequence.padding)}
    end
  end

  @doc """
  Peeks at the next number without consuming it.

  For showing a draft its likely number. Deliberately not a reservation: two
  drafts open at once will show the same number and only one will keep it,
  which is honest about how a gapless series behaves.
  """
  @spec peek(Scope.t(), String.t(), keyword()) :: String.t() | nil
  def peek(%Scope{} = scope, document_type, opts \\ []) do
    defaults = Map.get(@defaults, document_type, %{prefix: default_prefix(document_type), reset: :yearly})

    prefix = Keyword.get(opts, :prefix, defaults.prefix)
    period = period_for(defaults.reset, Keyword.get(opts, :at, Date.utc_today()))

    case find_sequence(scope, document_type, prefix, period, Keyword.get(opts, :branch_id)) do
      nil -> format(prefix, period, 1, 4)
      sequence -> format(sequence.prefix, period, sequence.next_number, sequence.padding)
    end
  end

  # --- Internal ---------------------------------------------------------------

  defp ensure_sequence(%Scope{} = scope, document_type, prefix, period, branch_id) do
    case find_sequence(scope, document_type, prefix, period, branch_id) do
      nil -> create_sequence(scope, document_type, prefix, period, branch_id)
      sequence -> {:ok, sequence}
    end
  end

  # The prefix is part of what identifies a series. Two tills issuing as `C1`
  # and `C2` must draw from two counters, or each of their series ends up with
  # the other's numbers missing from it.
  defp find_sequence(%Scope{} = scope, document_type, prefix, period, branch_id) do
    business_id = Scope.business_id(scope)

    query =
      from sequence in "document_sequences",
        where: sequence.business_id == type(^business_id, :binary_id),
        where: sequence.document_type == ^document_type,
        where: sequence.prefix == ^prefix,
        where: sequence.period == ^period,
        select: %{
          id: sequence.id,
          prefix: sequence.prefix,
          next_number: sequence.next_number,
          padding: sequence.padding
        }

    query
    |> scope_branch(branch_id)
    |> Repo.one()
  end

  defp scope_branch(query, nil), do: from(s in query, where: is_nil(s.branch_id))

  defp scope_branch(query, branch_id),
    do: from(s in query, where: s.branch_id == type(^branch_id, :binary_id))

  defp create_sequence(%Scope{} = scope, document_type, prefix, period, branch_id) do
    now = DateTime.utc_now() |> DateTime.truncate(:microsecond)

    entry = %{
      id: Kaarobar.Ecto.UUIDv7.bingenerate(),
      organization_id: uuid_dump(Scope.organization_id(scope)),
      business_id: uuid_dump(Scope.business_id(scope)),
      branch_id: uuid_dump(branch_id),
      document_type: document_type,
      prefix: prefix,
      period: period,
      next_number: 1,
      padding: 4,
      inserted_at: now,
      updated_at: now
    }

    # Two requests may reach here at once for a brand-new series; the unique
    # index arbitrates and the loser simply re-reads.
    Repo.insert_all("document_sequences", [entry], on_conflict: :nothing)

    case find_sequence(scope, document_type, prefix, period, branch_id) do
      nil -> {:error, :sequence_unavailable}
      sequence -> {:ok, sequence}
    end
  end

  # The lock. Held until the caller's transaction commits, which is what makes
  # a rollback return the number rather than burn it.
  defp take(sequence_id) do
    query =
      from sequence in "document_sequences",
        where: sequence.id == ^sequence_id,
        select: sequence.next_number

    case Repo.update_all(query, inc: [next_number: 1]) do
      {1, [number]} -> {:ok, number}
      _other -> {:error, :sequence_unavailable}
    end
  end

  # A `reset: :never` series — one unbroken run, no period in the number —
  # would add `defp period_for(:never, _date), do: ""` back here. It is not
  # carried unused: with every entry in @defaults resetting yearly or monthly,
  # the compiler proves the clause unreachable and fails the build on it.
  defp period_for(:yearly, date), do: Integer.to_string(date.year)

  defp period_for(:monthly, date),
    do: "#{date.year}-#{String.pad_leading(Integer.to_string(date.month), 2, "0")}"

  defp format(prefix, period, number, padding) do
    padded = number |> Integer.to_string() |> String.pad_leading(padding, "0")

    [prefix, period, padded]
    |> Enum.reject(&(&1 == "" or is_nil(&1)))
    |> Enum.join("-")
  end

  # "goods_receipt" becomes "GR" — initials of the words, which is what a shop
  # would abbreviate it to anyway.
  defp default_prefix(document_type) do
    document_type
    |> String.split("_")
    |> Enum.map_join(&String.upcase(String.first(&1) || ""))
  end

  defp uuid_dump(nil), do: nil

  defp uuid_dump(value) do
    case Ecto.UUID.dump(value) do
      {:ok, raw} -> raw
      :error -> nil
    end
  end
end
