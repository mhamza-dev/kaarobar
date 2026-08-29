defmodule Kaarobar.Factory do
  @moduledoc """
  Test data builders.

  The `*_factory` functions build isolated records. The composed helpers below
  them — `owner_scope/1`, `staff_scope/2` — build a *working tenant*, because
  almost every test needs one and assembling it by hand in each test is how
  fixtures drift out of step with the real signup path.

  Passwords use a constant. Argon2 is deliberately slow; test config already
  turns its cost parameters down, and a shared constant means the hash is
  computed once per record rather than per unique string.
  """

  use ExMachina.Ecto, repo: Kaarobar.Repo

  alias Kaarobar.AccessControl
  alias Kaarobar.AccessControl.MembershipRole
  alias Kaarobar.Accounts.User
  alias Kaarobar.Repo
  alias Kaarobar.Scopes
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Membership
  alias Kaarobar.Tenancy.Organization

  @valid_password "correct-horse-battery"

  @doc "The password every factory-built user has."
  def valid_password, do: @valid_password

  # --- Raw factories ----------------------------------------------------------

  def user_factory do
    %User{
      email: sequence(:email, &"user#{&1}@kaarobar.test"),
      name: sequence(:name, &"Test User #{&1}"),
      hashed_password: Argon2.hash_pwd_salt(@valid_password),
      locale: "en",
      timezone: "Asia/Karachi",
      status: "active",
      confirmed_at: DateTime.utc_now()
    }
  end

  def organization_factory do
    %Organization{
      name: sequence(:organization_name, &"Test Org #{&1}"),
      slug: sequence(:organization_slug, &"test-org-#{&1}"),
      country_code: "PK",
      default_currency: "PKR",
      timezone: "Asia/Karachi",
      default_locale: "en",
      status: "active",
      owner: build(:user)
    }
  end

  def business_factory do
    organization = build(:organization)

    %Business{
      organization: organization,
      name: sequence(:business_name, &"Test Shop #{&1}"),
      slug: sequence(:business_slug, &"test-shop-#{&1}"),
      business_type: "retail",
      currency: "PKR",
      timezone: "Asia/Karachi",
      default_locale: "en",
      status: "active"
    }
  end

  def branch_factory do
    business = build(:business)

    %Branch{
      business: business,
      organization: business.organization,
      name: sequence(:branch_name, &"Branch #{&1}"),
      code: sequence(:branch_code, &"BR#{&1}"),
      timezone: "Asia/Karachi",
      is_main: false,
      status: "active"
    }
  end

  def membership_factory do
    %Membership{
      organization: build(:organization),
      user: build(:user),
      status: "active",
      job_title: "Staff"
    }
  end

  # --- Composed helpers -------------------------------------------------------

  @doc """
  A complete tenant: owner, organization, business, main branch, and a resolved
  scope. The default shape of almost every test.

  ## Options

    * `:business_type` — the vertical, default `"retail"`
    * `:branches` — extra branch names beyond the main one
  """
  @spec owner_scope(keyword()) :: %{
          scope: Kaarobar.Scope.t(),
          user: User.t(),
          organization: Organization.t(),
          business: Business.t(),
          branch: Branch.t()
        }
  def owner_scope(opts \\ []) do
    owner = insert(:user)
    organization = insert(:organization, owner: owner)
    membership = insert(:membership, organization: organization, user: owner)
    assign_role(membership, "owner")

    business =
      insert(:business,
        organization: organization,
        business_type: Keyword.get(opts, :business_type, "retail")
      )

    branch = insert(:branch, organization: organization, business: business, is_main: true)

    for name <- Keyword.get(opts, :branches, []) do
      insert(:branch, organization: organization, business: business, name: name)
    end

    {:ok, scope} = Scopes.build(owner, %{business_id: business.id})

    %{
      scope: scope,
      user: owner,
      organization: organization,
      business: business,
      branch: branch,
      membership: membership
    }
  end

  @doc """
  Adds a staff member with a system role to an existing tenant, and returns
  their scope.

      %{scope: owner} = owner_scope()
      %{scope: cashier} = staff_scope(owner, "cashier")

  ## Options

    * `:branch_ids` — restrict them to particular branches
    * `:organization_wide` — attach to the organization rather than one business
  """
  @spec staff_scope(Kaarobar.Scope.t(), String.t(), keyword()) :: map()
  def staff_scope(%Kaarobar.Scope{} = owner_scope, role_key, opts \\ []) do
    user = insert(:user)

    business_id =
      if Keyword.get(opts, :organization_wide, false) do
        nil
      else
        owner_scope.business.id
      end

    membership =
      insert(:membership,
        organization: owner_scope.organization,
        user: user,
        business_id: business_id
      )

    assign_role(membership, role_key)

    for branch_id <- Keyword.get(opts, :branch_ids, []) do
      Repo.insert!(%Kaarobar.Tenancy.MembershipBranch{
        membership_id: membership.id,
        branch_id: branch_id
      })
    end

    selection =
      if business_id,
        do: %{business_id: business_id},
        else: %{organization_id: owner_scope.organization.id}

    {:ok, scope} = Scopes.build(user, selection)

    %{scope: scope, user: user, membership: membership}
  end

  @doc "Assigns a system role to a membership."
  def assign_role(%Membership{} = membership, role_key) do
    {:ok, role} = AccessControl.fetch_system_role(role_key)

    Repo.insert!(
      MembershipRole.changeset(%MembershipRole{}, %{
        membership_id: membership.id,
        role_id: role.id
      })
    )

    role
  end

  # --- Catalog helpers --------------------------------------------------------

  @doc """
  Creates a product through the context, so its default variant exists.

  Tests never insert products directly: the whole catalog rests on every
  product having a variant, and a fixture that skips that would let a broken
  invariant pass.
  """
  def product_fixture(scope, attrs \\ %{}) do
    defaults = %{
      "name" => sequence(:product_name, &"Product #{&1}"),
      "price" => "100.00",
      "kind" => "item"
    }

    {:ok, product} =
      Kaarobar.Catalog.create_product(scope, Map.merge(defaults, stringify_keys(attrs)))

    product
  end

  @doc "The default variant of a freshly created product."
  def variant_fixture(scope, attrs \\ %{}) do
    scope |> product_fixture(attrs) |> Kaarobar.Catalog.Product.default_variant()
  end

  @doc "A tax rate, expressed as a fraction: 0.17 for 17%."
  def tax_fixture(scope, attrs \\ %{}) do
    defaults = %{
      "name" => sequence(:tax_name, &"Tax #{&1}"),
      "rate" => "0.17",
      "label" => "GST"
    }

    {:ok, tax} = Kaarobar.Taxes.create_tax(scope, Map.merge(defaults, stringify_keys(attrs)))
    tax
  end

  @doc "A tax group holding the given rates, made the business default."
  def tax_group_fixture(scope, taxes, attrs \\ %{}) do
    defaults = %{
      "name" => sequence(:tax_group_name, &"Group #{&1}"),
      "tax_ids" => Enum.map(List.wrap(taxes), & &1.id)
    }

    {:ok, group} =
      Kaarobar.Taxes.create_tax_group(scope, Map.merge(defaults, stringify_keys(attrs)))

    group
  end

  @doc "A category, optionally under a parent."
  def category_fixture(scope, attrs \\ %{}) do
    defaults = %{"name" => sequence(:category_name, &"Category #{&1}")}

    {:ok, category} =
      Kaarobar.Catalog.create_category(scope, Map.merge(defaults, stringify_keys(attrs)))

    category
  end

  @doc "An option type with its values, for building a variant matrix."
  def option_type_fixture(scope, name, values) do
    {:ok, option_type} =
      Kaarobar.Catalog.create_option_type(scope, %{"name" => name, "values" => values})

    option_type
  end

  @doc "A promotion."
  def price_rule_fixture(scope, attrs) do
    defaults = %{
      "name" => sequence(:rule_name, &"Promotion #{&1}"),
      "kind" => "percent_off",
      "scope" => "all",
      "value" => "10"
    }

    {:ok, rule} =
      Kaarobar.Pricing.create_rule(scope, Map.merge(defaults, stringify_keys(attrs)))

    rule
  end

  @doc "A price list with the given variant prices."
  def price_list_fixture(scope, attrs \\ %{}, prices \\ []) do
    defaults = %{"name" => sequence(:price_list_name, &"List #{&1}"), "kind" => "custom"}

    {:ok, list} =
      Kaarobar.Pricing.create_price_list(scope, Map.merge(defaults, stringify_keys(attrs)))

    Enum.each(prices, fn price ->
      {:ok, _item} = Kaarobar.Pricing.put_price(scope, list, stringify_keys(price))
    end)

    {:ok, reloaded} = Kaarobar.Pricing.fetch_price_list(scope, list.id)
    reloaded
  end

  defp stringify_keys(attrs) when is_map(attrs) do
    Map.new(attrs, fn {key, value} -> {to_string(key), value} end)
  end

  @doc "A bearer token for a user, ready to put in an Authorization header."
  def bearer_token(%User{} = user) do
    {plaintext, _token} = Kaarobar.Accounts.create_bearer_token(user, device_name: "test")
    plaintext
  end
end
