# The subscription catalogue.
#
# Idempotent: run it again after changing a price or a feature list and the
# existing plans are updated in place, so the shops already on them keep their
# subscription rather than being orphaned onto a plan that no longer exists.
#
# Feature keys are the module keys from `Kaarobar.Verticals` plus limit keys
# (`max_businesses`, `max_branches`, `max_users`). A limit of `nil` is
# unlimited; absent is also unlimited. Zero would mean none, and nothing here
# means none of anything.

require Logger

alias Kaarobar.Billing
alias Kaarobar.Verticals

core = Verticals.core_modules()

# Everything a small shop needs and nothing that assumes a second location.
starter_modules = core ++ ~w(credit variants purchasing suppliers)

# The middle plan, and the one most businesses land on: the verticals are
# unlocked, so a café and a salon can both use it without a bespoke package.
standard_modules =
  starter_modules ++
    ~w(
      appointments batches commissions delivery gift_cards kitchen loyalty
      modifiers queue recipes served_by service_jobs service_modes tables
      weighted
    )

# Everything, including the modules only a few businesses ever want.
premium_modules =
  standard_modules ++
    ~w(memberships prescriptions quotes rentals serials time_entries vehicles)

plans = [
  %{
    attrs: %{
      "code" => "starter",
      "name" => "Starter",
      "description" => "One shop, one counter. Everything needed to sell and count stock.",
      "interval" => "month",
      "currency" => "PKR",
      "amount" => "2500.00",
      "trial_days" => 14,
      "position" => 10
    },
    features:
      Enum.map(starter_modules, &{&1, true}) ++
        [{"billing", true}, {"export", true}] ++
        # One business, one branch, five people. Not a crippled product — a
        # correctly sized one: a single shop with five staff is most of the
        # market this plan is for.
        [{"max_businesses", 1}, {"max_branches", 1}, {"max_users", 5}]
  },
  %{
    attrs: %{
      "code" => "standard",
      "name" => "Standard",
      "description" => "Several branches, the vertical modules, and staff roles.",
      "interval" => "month",
      "currency" => "PKR",
      "amount" => "6500.00",
      "trial_days" => 14,
      "position" => 20
    },
    features:
      Enum.map(standard_modules, &{&1, true}) ++
        [{"billing", true}, {"export", true}] ++
        [{"max_businesses", 3}, {"max_branches", 10}, {"max_users", 40}]
  },
  %{
    attrs: %{
      "code" => "premium",
      "name" => "Premium",
      "description" => "Every module, no limits, and fiscal reporting.",
      "interval" => "month",
      "currency" => "PKR",
      "amount" => "14500.00",
      "trial_days" => 14,
      "position" => 30
    },
    # No limit keys at all, which is how "unlimited" is expressed. A limit of
    # zero would mean none.
    features: Enum.map(premium_modules, &{&1, true}) ++ [{"billing", true}, {"export", true}]
  }
]

Enum.each(plans, fn %{attrs: attrs, features: features} ->
  plan =
    case Billing.fetch_plan(attrs["code"]) do
      {:ok, existing} ->
        {:ok, updated} = Billing.update_plan(existing, attrs)
        updated

      {:error, :not_found} ->
        {:ok, created} = Billing.create_plan(attrs)
        created
    end

  {:ok, _plan} = Billing.set_plan_features(plan, features)
end)

Logger.info("Seeded #{length(plans)} subscription plans.")
