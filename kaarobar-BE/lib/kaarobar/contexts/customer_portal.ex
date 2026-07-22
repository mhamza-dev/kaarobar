defmodule Kaarobar.CustomerPortal do
  @moduledoc """
  Customer Portal identity and self-service (TEN-FR-014, CUS-FR-*).
  Platform-wide `customer_accounts` with per-business `customers` memberships.
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

  ## —— Auth ————————————————————————————————————————————————

  def register(attrs) do
    attrs = stringify_keys(attrs)
    email = attrs["email"] |> to_string() |> String.trim() |> String.downcase()
    password = attrs["password"]
    name = blank_to_nil(attrs["name"]) || email
    phone = blank_to_nil(attrs["phone"])
    business_id = blank_to_nil(attrs["business_id"])

    token = random_token()

    Repo.transaction(fn ->
      case %CustomerAccount{}
           |> CustomerAccount.registration_changeset(%{
             email: email,
             password: password,
             name: name,
             phone: phone,
             email_verified: false,
             email_verify_token_hash: hash_token(token),
             status: "active"
           })
           |> Repo.insert() do
        {:ok, account} ->
          _ = deliver_verify_email(account, token)

          if is_binary(business_id) do
            case ensure_membership(account, business_id) do
              {:ok, _} -> account
              {:error, reason} -> Repo.rollback(reason)
            end
          else
            account
          end

        {:error, cs} ->
          Repo.rollback(cs)
      end
    end)
  end

  def authenticate(email, password) do
    email = email |> to_string() |> String.trim() |> String.downcase()

    account =
      from(a in CustomerAccount, where: a.email == ^email)
      |> Repo.one()

    cond do
      is_nil(account) ->
        Argon2.no_user_verify()
        {:error, :invalid_credentials}

      account.status != "active" ->
        {:error, :inactive}

      CustomerAccount.verify_password(account, password) ->
        now = DateTime.utc_now() |> DateTime.truncate(:second)

        {:ok, account} =
          account |> CustomerAccount.changeset(%{last_login_at: now}) |> Repo.update()

        {:ok, preload_account(account)}

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
      preload: [customer_account: [memberships: :business]]
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
        owner_id: nil,
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

  def request_password_reset(email) do
    email = email |> to_string() |> String.trim() |> String.downcase()
    account = Repo.get_by(CustomerAccount, email: email)

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

  ## —— Memberships ——————————————————————————————————————————

  def list_memberships(%CustomerAccount{} = account) do
    from(c in Customer,
      where: c.customer_account_id == ^account.id,
      preload: [:business, :loyalty_tier],
      order_by: [asc: c.inserted_at]
    )
    |> Repo.all()
  end

  def ensure_membership(%CustomerAccount{} = account, business_id)
      when is_binary(business_id) do
    business = Repo.get(Business, business_id)

    cond do
      is_nil(business) or business.is_active != true ->
        {:error, :business_not_found}

      true ->
        case Repo.get_by(Customer,
               customer_account_id: account.id,
               business_id: business.id
             ) do
          %Customer{} = existing ->
            {:ok, Repo.preload(existing, [:business, :loyalty_tier])}

          nil ->
            # Prefer linking an existing CRM row with the same email in this business
            existing_by_email =
              if account.email do
                find_customer_by_email(business.id, business.owner_id, account.email)
              end

            cond do
              match?(%Customer{customer_account_id: id} when not is_nil(id), existing_by_email) and
                  existing_by_email.customer_account_id != account.id ->
                {:error, :already_linked}

              match?(%Customer{}, existing_by_email) ->
                existing_by_email
                |> Customer.changeset(%{
                  customer_account_id: account.id,
                  portal_enabled: true,
                  email: account.email,
                  name: existing_by_email.name || account.name || account.email,
                  phone: existing_by_email.phone || account.phone
                })
                |> Repo.update()
                |> case do
                  {:ok, c} -> {:ok, Repo.preload(c, [:business, :loyalty_tier])}
                  error -> error
                end

              true ->
                %Customer{}
                |> Customer.changeset(%{
                  name: account.name || account.email,
                  email: account.email,
                  phone: account.phone,
                  business_id: business.id,
                  owner_id: business.owner_id,
                  customer_account_id: account.id,
                  portal_enabled: true
                })
                |> Repo.insert()
                |> case do
                  {:ok, c} -> {:ok, Repo.preload(c, [:business, :loyalty_tier])}
                  error -> error
                end
            end
        end
    end
  end

  def membership_for(%CustomerAccount{} = account, business_id)
      when is_binary(business_id) do
    Repo.get_by(Customer, customer_account_id: account.id, business_id: business_id)
  end

  def resolve_membership(%CustomerAccount{} = account, business_id)
      when is_binary(business_id) do
    case membership_for(account, business_id) do
      %Customer{} = c -> {:ok, c}
      nil -> ensure_membership(account, business_id)
    end
  end

  ## —— Staff provision / invite ——————————————————————————————

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
            case staff_provision_login(customer, %{
                   "portal_password" => password || random_password(),
                   "portal_enabled" => true
                 }) do
              {:ok, updated, pwd} ->
                account_id = updated.customer_account_id
                account = account_id && Repo.get(CustomerAccount, account_id)

                if account do
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
                else
                  {:error, :account_missing}
                end

              error ->
                error
            end
        end
    end
  end

  @doc """
  Staff creates or updates a customer portal login (platform identity).
  Links the business membership to the global account.
  When newly linked, sends a buyer invite/promo email (optional join).
  """
  def staff_provision_login(%Customer{} = customer, attrs) do
    attrs = stringify_keys(attrs)
    password = blank_to_nil(attrs["portal_password"] || attrs["password"])
    enable? = parse_bool(attrs["portal_enabled"], default: !is_nil(password))
    send_invite? = parse_bool(attrs["send_invite"], default: true)
    email = customer.email && String.trim(customer.email) |> String.downcase()

    account =
      cond do
        is_binary(customer.customer_account_id) ->
          Repo.get(CustomerAccount, customer.customer_account_id)

        is_binary(email) and email != "" ->
          Repo.get_by(CustomerAccount, email: email)

        true ->
          nil
      end

    cond do
      enable? == false and is_nil(password) ->
        case customer |> Customer.changeset(%{portal_enabled: false}) |> Repo.update() do
          {:ok, updated} -> {:ok, updated, nil}
          error -> error
        end

      not is_binary(email) or email == "" ->
        {:error, :email_required}

      is_nil(account) ->
        provision_password = password || random_password()

        case %CustomerAccount{}
             |> CustomerAccount.registration_changeset(%{
               email: email,
               password: provision_password,
               name: customer.name,
               phone: customer.phone,
               email_verified: false,
               status: "active"
             })
             |> Repo.insert() do
          {:ok, account} ->
            {:ok, updated} =
              customer
              |> Customer.changeset(%{
                portal_enabled: true,
                customer_account_id: account.id
              })
              |> Repo.update()

            if send_invite? do
              _ = issue_and_deliver_buyer_invite(account)
            end

            # Only return plaintext password when staff explicitly set one
            {:ok, updated, if(is_binary(password), do: password, else: nil)}

          {:error, %Ecto.Changeset{} = cs} ->
            if email_taken?(cs), do: {:error, :already_registered}, else: {:error, cs}

          error ->
            error
        end

      true ->
        status = if enable? == false, do: "disabled", else: "active"
        was_unlinked? = is_nil(customer.customer_account_id)

        account_result =
          if is_binary(password) do
            account
            |> CustomerAccount.password_changeset(%{password: password})
            |> Ecto.Changeset.put_change(:status, status)
            |> then(fn cs ->
              cs
              |> Ecto.Changeset.put_change(:name, account.name || customer.name)
              |> Ecto.Changeset.put_change(:phone, account.phone || customer.phone)
            end)
            |> Repo.update()
          else
            account
            |> CustomerAccount.changeset(%{
              status: status,
              name: account.name || customer.name,
              phone: account.phone || customer.phone
            })
            |> Repo.update()
          end

        case account_result do
          {:ok, account} ->
            {:ok, updated} =
              customer
              |> Customer.changeset(%{
                portal_enabled: enable? != false,
                customer_account_id: account.id
              })
              |> Repo.update()

            if send_invite? and (was_unlinked? or enable?) do
              _ = issue_and_deliver_buyer_invite(account)
            end

            {:ok, updated, if(is_binary(password), do: password, else: nil)}

          error ->
            error
        end
    end
  end

  @doc """
  Accept a buyer invite token and set password (optional join).
  """
  def accept_invite(raw_token, new_password)
      when is_binary(raw_token) and is_binary(new_password) do
    hash = hash_token(raw_token)

    case Repo.get_by(CustomerAccount, email_verify_token_hash: hash) do
      nil ->
        {:error, :invalid_token}

      account ->
        case account
             |> CustomerAccount.password_changeset(%{password: new_password})
             |> then(fn cs ->
               cs
               |> Ecto.Changeset.put_change(:email_verified, true)
               |> Ecto.Changeset.put_change(:email_verify_token_hash, nil)
               |> Ecto.Changeset.put_change(:status, "active")
             end)
             |> Repo.update() do
          {:ok, updated} ->
            # Mark memberships portal_enabled
            from(c in Customer,
              where: c.customer_account_id == ^updated.id
            )
            |> Repo.update_all(set: [portal_enabled: true])

            {:ok, preload_account(updated)}

          error ->
            error
        end
    end
  end

  def accept_invite(_, _), do: {:error, :invalid_token}

  def issue_and_deliver_buyer_invite(%CustomerAccount{} = account) do
    token = random_token()

    {:ok, account} =
      account
      |> CustomerAccount.changeset(%{
        email_verify_token_hash: hash_token(token),
        email_verified: false
      })
      |> Repo.update()

    _ = deliver_buyer_invite_email(account, token)
    {:ok, account, token}
  end

  ## —— Self-service ——————————————————————————————————————————

  def get_profile(%CustomerAccount{} = account, business_id \\ nil) do
    account = preload_account(account)

    membership =
      cond do
        is_binary(business_id) ->
          Enum.find(account.memberships || [], &(&1.business_id == business_id))

        true ->
          List.first(account.memberships || [])
      end

    %{
      account: account,
      memberships: account.memberships || [],
      customer: membership && Repo.preload(membership, :loyalty_tier)
    }
  end

  def update_profile(%CustomerAccount{} = account, attrs) do
    attrs = stringify_keys(attrs)
    business_id = blank_to_nil(attrs["business_id"])

    account_attrs =
      %{}
      |> maybe_put(attrs, "name")
      |> maybe_put(attrs, "phone")

    {:ok, account} =
      if map_size(account_attrs) > 0 do
        account |> CustomerAccount.changeset(account_attrs) |> Repo.update()
      else
        {:ok, account}
      end

    with {:ok, membership} <- resolve_membership_optional(account, business_id) do
      if membership do
        customer_attrs =
          %{}
          |> maybe_put(attrs, "name")
          |> maybe_put(attrs, "phone")
          |> maybe_put(attrs, "address")
          |> maybe_put_bool(attrs, "marketing_opt_in_email")
          |> maybe_put_bool(attrs, "marketing_opt_in_sms")
          |> maybe_put_bool(attrs, "marketing_opt_in_whatsapp")

        if map_size(customer_attrs) == 0 do
          {:ok, membership}
        else
          membership |> Customer.changeset(customer_attrs) |> Repo.update()
        end
      else
        {:ok, account}
      end
    end
  end

  defp resolve_membership_optional(account, nil), do: {:ok, List.first(list_memberships(account))}
  defp resolve_membership_optional(account, business_id), do: resolve_membership(account, business_id)

  def list_orders(%CustomerAccount{} = account, opts \\ []) do
    membership_ids = membership_ids(account, opts[:business_id])

    if membership_ids == [] do
      []
    else
      from(s in Sale,
        where: s.customer_id in ^membership_ids,
        order_by: [desc: s.inserted_at],
        preload: [:items, :payments, :business],
        limit: 100
      )
      |> Repo.all()
    end
  end

  def get_order(%CustomerAccount{} = account, sale_id, opts \\ []) do
    membership_ids = membership_ids(account, opts[:business_id])

    from(s in Sale,
      where: s.id == ^sale_id and s.customer_id in ^membership_ids,
      preload: [:items, :payments, :business]
    )
    |> Repo.one()
  end

  def loyalty_summary(%CustomerAccount{} = account, opts \\ []) do
    memberships =
      case opts[:business_id] do
        bid when is_binary(bid) ->
          case membership_for(account, bid) do
            nil -> []
            c -> [Repo.preload(c, [:loyalty_tier, :business])]
          end

        _ ->
          list_memberships(account)
      end

    Enum.map(memberships, fn customer ->
      business = customer.business || Repo.get!(Business, customer.business_id)
      rates = Kaarobar.Loyalty.rates(business, customer)

      %{
        business_id: business.id,
        business_name: business.name,
        customer_id: customer.id,
        points: customer.loyalty_points || 0,
        tier: customer.loyalty_tier && %{id: customer.loyalty_tier.id, name: customer.loyalty_tier.name},
        rates: %{
          earn_per_amount: to_string(rates.earn_per_amount),
          points_per_earn: rates.points_per_earn,
          redeem_value: to_string(rates.redeem_value)
        }
      }
    end)
  end

  def ar_balance(%CustomerAccount{} = account, opts \\ []) do
    memberships =
      case opts[:business_id] do
        bid when is_binary(bid) ->
          case membership_for(account, bid) do
            nil -> []
            c -> [c]
          end

        _ ->
          list_memberships(account)
      end

    Enum.map(memberships, fn customer ->
      balance =
        Kaarobar.Accounting.customer_balance(
          customer.id,
          customer.business_id,
          customer.owner_id
        )

      %{
        business_id: customer.business_id,
        customer_id: customer.id,
        balance: to_string(balance)
      }
    end)
  end

  def list_open_ar(%CustomerAccount{} = account, opts \\ []) do
    membership_ids = membership_ids(account, opts[:business_id])

    if membership_ids == [] do
      []
    else
      from(i in ArInvoice,
        where: i.customer_id in ^membership_ids,
        where: i.status in ["open", "partial", "Open", "Partial"],
        order_by: [desc: i.inserted_at]
      )
      |> Repo.all()
    end
  end

  def pay_ar(%CustomerAccount{} = account, attrs) do
    attrs = stringify_keys(attrs)
    amount = Decimal.new("#{attrs["amount"]}")
    invoice_id = attrs["invoice_id"]
    method = attrs["method"] || "card"
    method = if method in ~w(cash card wallet bank), do: method, else: "card"
    membership_ids = membership_ids(account, blank_to_nil(attrs["business_id"]))

    if not is_binary(invoice_id) or invoice_id == "" do
      {:error, :invoice_required}
    else
      case from(i in ArInvoice,
             where: i.id == ^invoice_id and i.customer_id in ^membership_ids
           )
           |> Repo.one() do
        nil ->
          {:error, :not_found}

        invoice ->
          Kaarobar.Accounting.record_ar_payment(invoice.id, invoice.owner_id, invoice.owner_id, %{
            "amount" => amount,
            "method" => method,
            "reference" => "portal"
          })
      end
    end
  end

  ## —— Helpers ——————————————————————————————————————————————

  def preload_account(%CustomerAccount{} = account) do
    Repo.preload(account, memberships: [:business, :loyalty_tier])
  end

  defp membership_ids(account, business_id) do
    account
    |> list_memberships()
    |> then(fn list ->
      if is_binary(business_id) do
        Enum.filter(list, &(&1.business_id == business_id))
      else
        list
      end
    end)
    |> Enum.map(& &1.id)
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

  defp deliver_buyer_invite_email(account, token) do
    base = System.get_env("KAAROBAR_WEB_URL") || "http://localhost:3000"
    link = "#{base}/login?as=consumer&invite=#{URI.encode_www_form(token)}"

    email =
      Swoosh.Email.new()
      |> Swoosh.Email.to(account.email)
      |> Swoosh.Email.from({"Kaarobar", "noreply@kaarobar.local"})
      |> Swoosh.Email.subject("You're invited to shop on Kaarobar")
      |> Swoosh.Email.text_body("""
      You've been invited to join Kaarobar as a consumer — browse stores, track orders, and earn loyalty across businesses.

      Accept your invite and set a password:
      #{link}

      Or sign in at #{base}/login and choose "Sign in as Consumer".

      Invite token (if needed): #{token}
      """)

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

  defp blank_to_nil(nil), do: nil
  defp blank_to_nil(""), do: nil
  defp blank_to_nil(v) when is_binary(v), do: if(String.trim(v) == "", do: nil, else: String.trim(v))
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
      _ -> false
    end)
  end

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
