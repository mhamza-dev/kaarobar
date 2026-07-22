defmodule Kaarobar.CustomerPortal do
  @moduledoc """
  Customer Portal identity and self-service (TEN-FR-014, CUS-FR-*).
  Separate from staff `users` — never grants staff roles.
  """

  import Ecto.Query

  alias Kaarobar.{Audit, Mailer, Repo}
  alias Kaarobar.Schemas.{
    ArInvoice,
    Business,
    Customer,
    CustomerAccount,
    CustomerSession,
    Sale
  }

  ## —— Auth (CUS-FR-001/002/009/010) ——————————————————————————

  def register(business_id, attrs) do
    attrs = stringify_keys(attrs)
    email = attrs["email"] |> to_string() |> String.trim() |> String.downcase()
    password = attrs["password"]
    name = attrs["name"] || email

    business = Repo.get(Business, business_id)

    cond do
      is_nil(business) ->
        {:error, :business_not_found}

      business.portal_self_register != true ->
        {:error, :self_register_disabled}

      true ->
        owner_id = business.owner_id

        Repo.transaction(fn ->
          customer =
            case find_customer_by_email(business_id, owner_id, email) do
              %Customer{} = c ->
                c

              nil ->
                {:ok, c} =
                  %Customer{}
                  |> Customer.changeset(%{
                    name: name,
                    email: email,
                    business_id: business_id,
                    owner_id: owner_id,
                    portal_enabled: true
                  })
                  |> Repo.insert()

                c
            end

          token = random_token()
          token_hash = hash_token(token)

          case %CustomerAccount{}
               |> CustomerAccount.registration_changeset(%{
                 email: email,
                 password: password,
                 customer_id: customer.id,
                 owner_id: owner_id,
                 business_id: business_id,
                 email_verified: false,
                 email_verify_token_hash: token_hash
               })
               |> Repo.insert() do
            {:ok, account} ->
              _ =
                customer
                |> Customer.changeset(%{portal_enabled: true})
                |> Repo.update()

              _ = deliver_verify_email(account, token)
              account

            {:error, cs} ->
              Repo.rollback(cs)
          end
        end)
    end
  end

  def invite_from_customer(customer_id, business_id, owner_id, password \\ nil) do
    business = Repo.get_by(Business, id: business_id, owner_id: owner_id)

    cond do
      is_nil(business) ->
        {:error, :not_found}

      business.portal_invite_from_sale == false ->
        {:error, :invite_disabled}

      true ->
        case Repo.get_by(Customer, id: customer_id, business_id: business_id, owner_id: owner_id) do
          nil ->
            {:error, :not_found}

          %Customer{email: email} when not is_binary(email) or email == "" ->
            {:error, :email_required}

          %Customer{} = customer ->
            case Repo.get_by(CustomerAccount, customer_id: customer.id) do
              %CustomerAccount{} ->
                {:error, :already_registered}

              nil ->
                password = password || random_password()

                case staff_provision_login(customer, %{
                       "portal_password" => password,
                       "portal_enabled" => true
                     }) do
                  {:ok, _customer, pwd} ->
                    account = Repo.get_by!(CustomerAccount, customer_id: customer.id)
                    token = random_token()

                    _ =
                      account
                      |> CustomerAccount.changeset(%{
                        email_verified: false,
                        email_verify_token_hash: hash_token(token)
                      })
                      |> Repo.update()

                    _ = deliver_verify_email(account, token)
                    {:ok, account, pwd}

                  error ->
                    error
                end
            end
        end
    end
  end

  @doc """
  Staff creates or updates a customer portal login (separate from staff users).

  - Requires customer email
  - `portal_password` creates a new account or resets an existing password
  - `portal_enabled: false` disables portal access without deleting the account
  """
  def staff_provision_login(%Customer{} = customer, attrs) do
    attrs = stringify_keys(attrs)
    password = blank_to_nil(attrs["portal_password"] || attrs["password"])
    enable? = parse_bool(attrs["portal_enabled"], default: !is_nil(password))

    account = Repo.get_by(CustomerAccount, customer_id: customer.id)
    email = customer.email && String.trim(customer.email)

    cond do
      enable? == false and is_nil(password) ->
        case customer |> Customer.changeset(%{portal_enabled: false}) |> Repo.update() do
          {:ok, updated} -> {:ok, updated, nil}
          error -> error
        end

      not is_binary(email) or email == "" ->
        {:error, :email_required}

      is_nil(account) and is_nil(password) ->
        {:error, :password_required}

      is_nil(account) ->
        case %CustomerAccount{}
             |> CustomerAccount.registration_changeset(%{
               email: String.downcase(email),
               password: password,
               customer_id: customer.id,
               owner_id: customer.owner_id,
               business_id: customer.business_id,
               email_verified: true,
               status: "active"
             })
             |> Repo.insert() do
          {:ok, _account} ->
            {:ok, updated} =
              customer |> Customer.changeset(%{portal_enabled: true}) |> Repo.update()

            {:ok, updated, password}

          {:error, %Ecto.Changeset{} = cs} ->
            if email_taken?(cs), do: {:error, :already_registered}, else: {:error, cs}

          error ->
            error
        end

      is_binary(password) ->
        status = if enable? == false, do: "disabled", else: "active"

        case account
             |> CustomerAccount.password_changeset(%{password: password})
             |> then(fn cs ->
               cs
               |> Ecto.Changeset.put_change(:status, status)
             end)
             |> Repo.update() do
          {:ok, _account} ->
            {:ok, updated} =
              customer
              |> Customer.changeset(%{portal_enabled: enable? != false})
              |> Repo.update()

            {:ok, updated, password}

          error ->
            error
        end

      true ->
        status = if enable?, do: "active", else: "disabled"

        _ =
          account
          |> CustomerAccount.changeset(%{status: status})
          |> Repo.update()

        case customer
             |> Customer.changeset(%{portal_enabled: enable? == true})
             |> Repo.update() do
          {:ok, updated} -> {:ok, updated, nil}
          error -> error
        end
    end
  end

  defp blank_to_nil(nil), do: nil
  defp blank_to_nil(""), do: nil
  defp blank_to_nil(v) when is_binary(v), do: if(String.trim(v) == "", do: nil, else: v)
  defp blank_to_nil(_), do: nil

  defp parse_bool(nil, default: default), do: default
  defp parse_bool(true, _), do: true
  defp parse_bool(false, _), do: false
  defp parse_bool("true", _), do: true
  defp parse_bool("false", _), do: false
  defp parse_bool(1, _), do: true
  defp parse_bool(0, _), do: false
  defp parse_bool(_, default: default), do: default

  defp email_taken?(%Ecto.Changeset{errors: errors}) do
    Enum.any?(errors, fn
      {:email, {_, opts}} -> opts[:constraint] == :unique
      {:customer_id, {_, opts}} -> opts[:constraint] == :unique
      _ -> false
    end)
  end

  def authenticate(business_id, email, password) do
    email = email |> to_string() |> String.trim() |> String.downcase()

    account =
      from(a in CustomerAccount,
        where: a.business_id == ^business_id and a.email == ^email,
        preload: [:customer]
      )
      |> Repo.one()

    cond do
      is_nil(account) ->
        Argon2.no_user_verify()
        {:error, :invalid_credentials}

      account.status != "active" ->
        {:error, :inactive}

      CustomerAccount.verify_password(account, password) ->
        now = DateTime.utc_now() |> DateTime.truncate(:second)
        {:ok, account} = account |> CustomerAccount.changeset(%{last_login_at: now}) |> Repo.update()
        {:ok, Repo.preload(account, :customer)}

      true ->
        {:error, :invalid_credentials}
    end
  end

  def create_session(%CustomerAccount{} = account, user_agent \\ nil) do
    raw = random_token()
    expires = DateTime.utc_now() |> DateTime.add(14 * 86_400, :second) |> DateTime.truncate(:second)

    case %CustomerSession{}
         |> CustomerSession.changeset(%{
           customer_account_id: account.id,
           token_hash: hash_token(raw),
           expires_at: expires,
           user_agent: user_agent
         })
         |> Repo.insert() do
      {:ok, session} -> {:ok, session, raw}
      error -> error
    end
  end

  def get_account_by_session_token(raw_token) when is_binary(raw_token) do
    hash = hash_token(raw_token)
    now = DateTime.utc_now()

    from(s in CustomerSession,
      join: a in assoc(s, :customer_account),
      where: s.token_hash == ^hash,
      where: is_nil(s.revoked_at),
      where: s.expires_at > ^now,
      where: a.status == "active",
      preload: [customer_account: [:customer]]
    )
    |> Repo.one()
    |> case do
      nil -> nil
      session -> session.customer_account
    end
  end

  def revoke_session(raw_token) when is_binary(raw_token) do
    hash = hash_token(raw_token)
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    case Repo.get_by(CustomerSession, token_hash: hash) do
      nil ->
        {:error, :not_found}

      session ->
        session
        |> CustomerSession.changeset(%{revoked_at: now})
        |> Repo.update()
    end
  end

  def revoke_all_sessions(%CustomerAccount{} = account, actor \\ :customer) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    {count, _} =
      from(s in CustomerSession,
        where: s.customer_account_id == ^account.id and is_nil(s.revoked_at)
      )
      |> Repo.update_all(set: [revoked_at: now])

    if actor == :owner do
      Audit.log(%{
        owner_id: account.owner_id,
        user_id: nil,
        action: "portal.sessions_revoke",
        entity_type: "customer_account",
        entity_id: account.id,
        metadata: %{count: count}
      })
    end

    {:ok, count}
  end

  def verify_email(raw_token) when is_binary(raw_token) do
    hash = hash_token(raw_token)

    case Repo.get_by(CustomerAccount, email_verify_token_hash: hash) do
      nil ->
        {:error, :invalid_token}

      account ->
        account
        |> CustomerAccount.changeset(%{
          email_verified: true,
          email_verify_token_hash: nil
        })
        |> Repo.update()
    end
  end

  def request_password_reset(business_id, email) do
    email = email |> to_string() |> String.trim() |> String.downcase()
    account = Repo.get_by(CustomerAccount, business_id: business_id, email: email)

    if account do
      token = random_token()
      now = DateTime.utc_now() |> DateTime.truncate(:second)

      {:ok, _} =
        account
        |> CustomerAccount.changeset(%{
          password_reset_token_hash: hash_token(token),
          password_reset_sent_at: now
        })
        |> Repo.update()

      _ = deliver_reset_email(account, token)
    end

    :ok
  end

  def reset_password(raw_token, new_password) when is_binary(raw_token) do
    hash = hash_token(raw_token)

    case Repo.get_by(CustomerAccount, password_reset_token_hash: hash) do
      nil ->
        {:error, :invalid_token}

      account ->
        case account
             |> CustomerAccount.password_changeset(%{
               password: new_password,
               password_reset_token_hash: nil,
               password_reset_sent_at: nil
             })
             |> Repo.update() do
          {:ok, updated} ->
            _ = revoke_all_sessions(updated, :customer)
            {:ok, updated}

          error ->
            error
        end
    end
  end

  ## —— Self-service (CUS-FR-003/004/006/007) ——————————————————

  def list_orders(%CustomerAccount{} = account) do
    from(s in Sale,
      where:
        s.customer_id == ^account.customer_id and s.business_id == ^account.business_id and
          s.owner_id == ^account.owner_id,
      order_by: [desc: s.inserted_at],
      preload: [:items, :payments],
      limit: 100
    )
    |> Repo.all()
  end

  def get_order(%CustomerAccount{} = account, sale_id) do
    from(s in Sale,
      where:
        s.id == ^sale_id and s.customer_id == ^account.customer_id and
          s.business_id == ^account.business_id,
      preload: [:items, :payments]
    )
    |> Repo.one()
  end

  def loyalty_summary(%CustomerAccount{} = account) do
    customer = Repo.get!(Customer, account.customer_id) |> Repo.preload(:loyalty_tier)
    business = Repo.get!(Business, account.business_id)
    rates = Kaarobar.Loyalty.rates(business, customer)

    %{
      points: customer.loyalty_points || 0,
      tier: customer.loyalty_tier && %{id: customer.loyalty_tier.id, name: customer.loyalty_tier.name},
      rates: %{
        earn_per_amount: to_string(rates.earn_per_amount),
        points_per_earn: rates.points_per_earn,
        redeem_value: to_string(rates.redeem_value)
      }
    }
  end

  def ar_balance(%CustomerAccount{} = account) do
    Kaarobar.Accounting.customer_balance(account.customer_id, account.business_id, account.owner_id)
  end

  def list_open_ar(%CustomerAccount{} = account) do
    from(i in ArInvoice,
      where:
        i.customer_id == ^account.customer_id and i.business_id == ^account.business_id and
          i.status in ["open", "partial", "Open", "Partial"],
      order_by: [desc: i.inserted_at]
    )
    |> Repo.all()
  end

  def pay_ar(%CustomerAccount{} = account, attrs) do
    attrs = stringify_keys(attrs)
    amount = Decimal.new("#{attrs["amount"]}")
    invoice_id = attrs["invoice_id"]
    method = attrs["method"] || "card"
    method = if method in ~w(cash card wallet bank), do: method, else: "card"

    if not is_binary(invoice_id) or invoice_id == "" do
      {:error, :invoice_required}
    else
      case Repo.get_by(ArInvoice,
             id: invoice_id,
             customer_id: account.customer_id,
             business_id: account.business_id,
             owner_id: account.owner_id
           ) do
        nil ->
          {:error, :not_found}

        invoice ->
          Kaarobar.Accounting.record_ar_payment(invoice.id, account.owner_id, account.owner_id, %{
            "amount" => amount,
            "method" => method,
            "reference" => "portal"
          })
      end
    end
  end

  def update_profile(%CustomerAccount{} = account, attrs) do
    attrs = stringify_keys(attrs)
    customer = Repo.get!(Customer, account.customer_id)

    customer_attrs =
      %{}
      |> maybe_put(attrs, "name")
      |> maybe_put(attrs, "phone")
      |> maybe_put(attrs, "address")
      |> maybe_put_bool(attrs, "marketing_opt_in_email")
      |> maybe_put_bool(attrs, "marketing_opt_in_sms")
      |> maybe_put_bool(attrs, "marketing_opt_in_whatsapp")

    customer
    |> Customer.changeset(customer_attrs)
    |> Repo.update()
  end

  def get_profile(%CustomerAccount{} = account) do
    Repo.get!(Customer, account.customer_id) |> Repo.preload(:loyalty_tier)
  end

  defp find_customer_by_email(business_id, owner_id, email) do
    from(c in Customer,
      where: c.business_id == ^business_id and c.owner_id == ^owner_id,
      where: fragment("lower(?)", c.email) == ^email
    )
    |> Repo.one()
  end

  defp deliver_verify_email(account, token) do
    email =
      Swoosh.Email.new()
      |> Swoosh.Email.to(account.email)
      |> Swoosh.Email.from({"Kaarobar", "noreply@kaarobar.local"})
      |> Swoosh.Email.subject("Verify your Kaarobar account")
      |> Swoosh.Email.text_body("Your verification token: #{token}")

    Mailer.deliver(email)
  rescue
    _ -> :ok
  end

  defp deliver_reset_email(account, token) do
    email =
      Swoosh.Email.new()
      |> Swoosh.Email.to(account.email)
      |> Swoosh.Email.from({"Kaarobar", "noreply@kaarobar.local"})
      |> Swoosh.Email.subject("Reset your Kaarobar password")
      |> Swoosh.Email.text_body("Your password reset token: #{token}")

    Mailer.deliver(email)
  rescue
    _ -> :ok
  end

  defp random_token do
    :crypto.strong_rand_bytes(32) |> Base.url_encode64(padding: false)
  end

  defp random_password do
    :crypto.strong_rand_bytes(12) |> Base.url_encode64(padding: false)
  end

  defp hash_token(token), do: :crypto.hash(:sha256, token) |> Base.encode16(case: :lower)

  defp maybe_put(map, attrs, key) do
    case Map.fetch(attrs, key) do
      {:ok, value} -> Map.put(map, key, value)
      :error -> map
    end
  end

  defp maybe_put_bool(map, attrs, key) do
    case Map.fetch(attrs, key) do
      {:ok, true} -> Map.put(map, key, true)
      {:ok, false} -> Map.put(map, key, false)
      {:ok, "true"} -> Map.put(map, key, true)
      {:ok, "false"} -> Map.put(map, key, false)
      _ -> map
    end
  end

  defp stringify_keys(attrs) when is_map(attrs) do
    Map.new(attrs, fn
      {k, v} when is_atom(k) -> {Atom.to_string(k), v}
      {k, v} -> {k, v}
    end)
  end
end
