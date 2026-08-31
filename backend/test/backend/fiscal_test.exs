defmodule Kaarobar.FiscalTest do
  @moduledoc """
  The phase gate: an invoice queues, retries and stamps the sale.

  The four things worth breaking the build over are all here — a sale never
  waits on the authority, an accepted submission puts its number on the
  invoice, a rejection is terminal, and a failure is not.
  """

  use Kaarobar.DataCase, async: true

  alias Kaarobar.Fiscal
  alias Kaarobar.Fiscal.Submission
  alias Kaarobar.FiscalStub
  alias Kaarobar.Repo

  @accepted {:ok, %{"Code" => "100", "InvoiceNumber" => "FBR-0001", "Response" => "OK"}}
  @rejected {:ok, %{"Code" => "102", "Response" => "Invalid NTN"}}

  setup do
    FiscalStub.reset()

    %{scope: scope, branch: branch} = owner_scope()
    variant = variant_fixture(scope, %{"name" => "Widget", "price" => "100.00"})
    stock_fixture(scope, variant, "50", unit_cost: "60.00")
    %{register: register, shift: shift} = open_till(scope)

    %{scope: scope, branch: branch, variant: variant, register: register, shift: shift}
  end

  defp configure(scope, attrs \\ %{}) do
    defaults = %{
      "adapter" => "fbr",
      "mode" => "test",
      "taxpayer_number" => "1234567-8",
      "pos_id" => "POS-1",
      "credentials" => %{"token" => "secret"},
      "is_active" => true
    }

    {:ok, config} = Fiscal.upsert_config(scope, Map.merge(defaults, attrs))
    config
  end

  defp submission_for(sale) do
    Repo.get_by!(Submission, sale_id: sale.id, kind: "invoice")
  end

  # ===========================================================================
  # Configuration
  # ===========================================================================

  describe "configuration" do
    test "a business starts with none", %{scope: scope} do
      assert Fiscal.config(scope) == nil
    end

    test "saving twice replaces rather than duplicates", %{scope: scope} do
      configure(scope)
      configure(scope, %{"pos_id" => "POS-2"})

      assert Fiscal.config(scope).pos_id == "POS-2"
      assert Repo.aggregate(Fiscal.Config, :count) == 1
    end

    test "credentials are stored encrypted", %{scope: scope} do
      configure(scope)

      # Read past Ecto so what is actually on disk is what gets asserted about.
      # A field that only looks encrypted through its own type is not
      # encrypted at all.
      {:ok, %{rows: [[stored]]}} =
        Repo.query("SELECT credentials FROM fiscal_configs LIMIT 1", [])

      # Matched bytewise: the ciphertext is not valid UTF-8, so a string
      # comparison would be asserting about the wrong thing.
      assert :binary.match(stored, "secret") == :nomatch
    end

    test "disabling stops reporting but keeps the history", %{scope: scope, variant: variant} do
      configure(scope)
      FiscalStub.respond(@accepted)
      sale = sale_fixture(scope, variant)

      {:ok, _config} = Fiscal.disable_config(scope)

      assert Fiscal.config(scope) == nil
      assert Repo.get_by(Submission, sale_id: sale.id)
    end
  end

  # ===========================================================================
  # Queueing
  # ===========================================================================

  describe "queueing a sale" do
    test "a business that does not file queues nothing", %{scope: scope, variant: variant} do
      sale = sale_fixture(scope, variant)

      assert Repo.get_by(Submission, sale_id: sale.id) == nil
      assert sale.fiscal_status == nil
    end

    test "a sale is queued in the same transaction that writes it", %{
      scope: scope,
      variant: variant
    } do
      configure(scope)
      # The authority never answers, so nothing after the transaction can be
      # what created the row.
      FiscalStub.respond({:error, :timeout})

      sale = sale_fixture(scope, variant)

      assert submission = submission_for(sale)
      assert submission.business_id == sale.business_id
      assert submission.adapter == "fbr"
    end

    test "an unreachable authority does not stop the sale", %{scope: scope, variant: variant} do
      # The single most important behaviour in this module. A till that stops
      # selling when somebody else's endpoint is down is worse than useless.
      configure(scope)
      FiscalStub.respond({:error, :timeout})

      sale = sale_fixture(scope, variant)

      assert sale.total
      assert Kaarobar.Sales.Sale |> Repo.get(sale.id)
    end

    test "one sale is never reported twice", %{scope: scope, variant: variant} do
      configure(scope)
      FiscalStub.respond(@accepted)
      sale = sale_fixture(scope, variant)

      # Declaring the same turnover twice is what the authority bills for.
      assert {:error, changeset} =
               Fiscal.queue_sale_within(scope, sale, kind: "invoice")

      assert %{sale_id: [_message]} = errors_on(changeset)
    end
  end

  # ===========================================================================
  # Submitting
  # ===========================================================================

  describe "an accepted submission" do
    setup %{scope: scope} do
      configure(scope)
      :ok
    end

    test "stamps the sale with the authority's number", %{scope: scope, variant: variant} do
      FiscalStub.respond(@accepted)

      sale = sale_fixture(scope, variant)
      stored = Repo.get!(Kaarobar.Sales.Sale, sale.id)

      assert stored.fiscal_number == "FBR-0001"
      assert stored.fiscal_qr_payload == "FBR-0001"
      assert stored.fiscal_status == "accepted"
    end

    test "comes back on the sale the till was handed", %{scope: scope, variant: variant} do
      # The receipt prints from this, not from a second read. A stamp that only
      # arrives on the next request is a receipt printed without it.
      FiscalStub.respond(@accepted)

      sale = sale_fixture(scope, variant)

      assert sale.fiscal_number == "FBR-0001"
    end

    test "records what was sent, for when it is disputed", %{scope: scope, variant: variant} do
      FiscalStub.respond(@accepted)

      sale = sale_fixture(scope, variant)
      submission = submission_for(sale)

      assert submission.request_payload["USIN"] == sale.number
      assert submission.response_payload["Code"] == "100"
      assert submission.attempts == 1
      assert submission.accepted_at
    end

    test "is not picked up again", %{scope: scope, variant: variant} do
      FiscalStub.respond(@accepted)
      sale_fixture(scope, variant)

      assert %{ok: 0, error: 0} = Fiscal.process_due(10)
    end

    test "cannot be retried by hand", %{scope: scope, variant: variant} do
      FiscalStub.respond(@accepted)
      sale = sale_fixture(scope, variant)

      assert {:error, :already_accepted} = Fiscal.retry(scope, submission_for(sale).id)
    end
  end

  describe "a rejected submission" do
    setup %{scope: scope} do
      configure(scope)
      FiscalStub.respond(@rejected)
      :ok
    end

    test "keeps the authority's own message", %{scope: scope, variant: variant} do
      sale = sale_fixture(scope, variant)
      submission = submission_for(sale)

      assert submission.status == "rejected"
      assert submission.error_code == "102"
      assert submission.last_error == "Invalid NTN"
    end

    test "is terminal — retrying it forever changes nothing", %{
      scope: scope,
      variant: variant
    } do
      sale_fixture(scope, variant)

      assert %{ok: 0, error: 0} = Fiscal.process_due(10)
      assert FiscalStub.requests() |> length() == 1
    end

    test "leaves the sale unstamped and says so", %{scope: scope, variant: variant} do
      sale = sale_fixture(scope, variant)
      stored = Repo.get!(Kaarobar.Sales.Sale, sale.id)

      assert stored.fiscal_number == nil
      assert stored.fiscal_status == "rejected"
    end

    test "can be put back in the queue once somebody has fixed the details", %{
      scope: scope,
      variant: variant
    } do
      sale = sale_fixture(scope, variant)

      {:ok, requeued} = Fiscal.retry(scope, submission_for(sale).id)

      assert requeued.status == "queued"
      # The old backoff was earned by data that has since changed.
      assert requeued.attempts == 0

      FiscalStub.respond(@accepted)
      assert %{ok: 1} = Fiscal.process_due(10)
      assert Repo.get!(Kaarobar.Sales.Sale, sale.id).fiscal_number == "FBR-0001"
    end
  end

  describe "a failed submission" do
    setup %{scope: scope} do
      configure(scope)
      :ok
    end

    test "is scheduled rather than abandoned", %{scope: scope, variant: variant} do
      FiscalStub.respond({:error, :timeout})

      sale = sale_fixture(scope, variant)
      submission = submission_for(sale)

      assert submission.status == "retrying"
      assert submission.retry_after
      assert DateTime.compare(submission.retry_after, DateTime.utc_now()) == :gt
    end

    test "is not sent again before it is due", %{scope: scope, variant: variant} do
      FiscalStub.respond({:error, :timeout})
      sale_fixture(scope, variant)

      before = length(FiscalStub.requests())
      Fiscal.process_due(10)

      assert length(FiscalStub.requests()) == before
    end

    test "lands once the authority comes back", %{scope: scope, variant: variant} do
      FiscalStub.respond({:error, :timeout})
      sale = sale_fixture(scope, variant)

      # The retry job runs on time; the wait is the part being skipped, not the
      # scheduling.
      submission = submission_for(sale)

      submission
      |> Ecto.Changeset.change(retry_after: DateTime.add(DateTime.utc_now(), -1, :second))
      |> Repo.update!()

      FiscalStub.respond(@accepted)

      assert %{ok: 1, error: 0} = Fiscal.process_due(10)
      assert Repo.get!(Kaarobar.Sales.Sale, sale.id).fiscal_status == "accepted"
    end

    test "is parked for a person once its attempts are spent", %{
      scope: scope,
      variant: variant
    } do
      FiscalStub.respond({:error, :timeout})
      sale = sale_fixture(scope, variant)
      submission = submission_for(sale)

      final =
        Enum.reduce(1..Kaarobar.Fiscal.Adapter.max_attempts(), submission, fn _attempt, current ->
          current
          |> Ecto.Changeset.change(retry_after: nil)
          |> Repo.update!()
          |> then(fn due -> elem(Fiscal.submit(due), 1) end)
        end)

      assert final.status == "failed"
      assert final.retry_after == nil
      assert Repo.get!(Kaarobar.Sales.Sale, sale.id).fiscal_status == "failed"
    end
  end

  # ===========================================================================
  # Blocking
  # ===========================================================================

  describe "block_on_failure" do
    test "is off by default, so a backlog does not close the till", %{
      scope: scope,
      variant: variant
    } do
      configure(scope)
      FiscalStub.respond({:error, :timeout})

      sale_fixture(scope, variant)

      assert Fiscal.guard_sale(scope) == :ok
      assert sale_fixture(scope, variant)
    end

    test "stops new sales while earlier ones are unreported", %{
      scope: scope,
      variant: variant
    } do
      configure(scope, %{"block_on_failure" => true})
      FiscalStub.respond({:error, :timeout})

      sale_fixture(scope, variant)

      assert {:error, {:fiscal_backlog, count}} = Fiscal.guard_sale(scope)
      assert count > 0
    end

    test "the till reopens once the backlog clears", %{scope: scope, variant: variant} do
      configure(scope, %{"block_on_failure" => true})
      FiscalStub.respond({:error, :timeout})
      sale = sale_fixture(scope, variant)

      submission_for(sale)
      |> Ecto.Changeset.change(retry_after: nil)
      |> Repo.update!()

      FiscalStub.respond(@accepted)
      Fiscal.process_due(10)

      assert Fiscal.guard_sale(scope) == :ok
    end

    test "a business that does not file is never blocked", %{scope: scope} do
      assert Fiscal.guard_sale(scope) == :ok
    end
  end

  # ===========================================================================
  # Reading
  # ===========================================================================

  describe "listing" do
    test "shows only what needs attention when asked", %{scope: scope, variant: variant} do
      configure(scope)

      FiscalStub.respond(@accepted)
      sale_fixture(scope, variant)

      FiscalStub.respond(@rejected)
      rejected = sale_fixture(scope, variant)

      assert [only] = Fiscal.list_submissions(scope, needs_attention: true)
      assert only.sale_id == rejected.id
    end

    test "counts the backlog without counting the accepted", %{scope: scope, variant: variant} do
      configure(scope)

      FiscalStub.respond(@accepted)
      sale_fixture(scope, variant)

      assert Fiscal.backlog_count(scope) == 0

      FiscalStub.respond({:error, :timeout})
      sale_fixture(scope, variant)

      assert Fiscal.backlog_count(scope) == 1
    end

    test "one business cannot see another's submissions", %{scope: scope, variant: variant} do
      configure(scope)
      FiscalStub.respond(@accepted)
      sale_fixture(scope, variant)

      %{scope: other} = owner_scope()

      assert Fiscal.list_submissions(other) == []
      assert Fiscal.backlog_count(other) == 0
    end
  end

  # ===========================================================================
  # The document
  # ===========================================================================

  describe "the reported document" do
    test "is built from the sale's own snapshots", %{scope: scope, variant: variant} do
      configure(scope)
      FiscalStub.respond(@accepted)
      sale = sale_fixture(scope, variant, quantity: "2", amount: "200.00")

      document = Fiscal.build_document(submission_for(sale))

      assert document.number == sale.number
      assert Decimal.equal?(document.total, sale.total)
      assert [line] = document.lines
      assert line.name == "Widget"
      assert Decimal.equal?(line.quantity, Decimal.new("2"))
    end

    test "names the customer when there is one", %{scope: scope, variant: variant} do
      configure(scope)
      FiscalStub.respond(@accepted)
      customer = customer_fixture(scope, %{"name" => "Ayesha", "tax_number" => "999"})

      sale = sale_fixture(scope, variant, customer_id: customer.id)
      document = Fiscal.build_document(submission_for(sale))

      assert document.buyer.name == "Ayesha"
      assert document.buyer.tax_number == "999"
    end

    test "a walk-in has no buyer at all", %{scope: scope, variant: variant} do
      configure(scope)
      FiscalStub.respond(@accepted)
      sale = sale_fixture(scope, variant)

      assert Fiscal.build_document(submission_for(sale)).buyer == nil
    end
  end
end
