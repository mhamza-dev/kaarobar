defmodule KaarobarWeb.Serializers do
  @moduledoc """
  How each record is shaped for the wire.

  One module rather than one per view, because the same record appears in
  several responses — a branch inside a business, inside a staff member, inside
  a session — and three slightly different shapes of "branch" is how a client
  ends up with three slightly different branch models.

  What is deliberately absent is as important as what is present. Password
  hashes, PIN hashes, TOTP secrets and raw tokens have no representation here
  at all: they cannot leak through a forgotten `Map.take` because there is no
  code path that renders them.
  """

  import KaarobarWeb.JSONHelpers

  alias Kaarobar.AccessControl.Role
  alias Kaarobar.Accounts.User
  alias Kaarobar.Accounts.UserToken
  alias Kaarobar.Audit.Entry
  alias Kaarobar.Scope
  alias Kaarobar.Tenancy.Branch
  alias Kaarobar.Tenancy.Business
  alias Kaarobar.Tenancy.Invitation
  alias Kaarobar.Tenancy.Membership
  alias Kaarobar.Tenancy.Organization
  alias Kaarobar.Verticals

  # --- Identity ---------------------------------------------------------------

  def user(%User{} = user) do
    %{
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      avatar_url: user.avatar_url,
      locale: user.locale,
      timezone: user.timezone,
      confirmed: not is_nil(user.confirmed_at),
      mfa_enabled: User.totp_enabled?(user),
      status: user.status,
      last_login_at: timestamp(user.last_login_at),
      inserted_at: timestamp(user.inserted_at)
    }
  end

  def device(%UserToken{} = token) do
    %{
      id: token.id,
      device_name: token.device_name,
      user_agent: token.user_agent,
      ip_address: token.ip_address,
      last_used_at: timestamp(token.last_used_at),
      expires_at: timestamp(token.expires_at),
      created_at: timestamp(token.inserted_at)
    }
  end

  # --- Tenancy ----------------------------------------------------------------

  def organization(%Organization{} = organization) do
    %{
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      country_code: organization.country_code,
      default_currency: organization.default_currency,
      timezone: organization.timezone,
      default_locale: organization.default_locale,
      status: organization.status,
      owner_id: organization.owner_id,
      settings: organization.settings,
      inserted_at: timestamp(organization.inserted_at)
    }
  end

  def business(%Business{} = business) do
    %{
      id: business.id,
      organization_id: business.organization_id,
      name: business.name,
      slug: business.slug,
      business_type: business.business_type,
      business_type_label: Verticals.label(business.business_type),
      currency: business.currency,
      timezone: business.timezone,
      default_locale: business.default_locale,
      legal_name: business.legal_name,
      tax_number: business.tax_number,
      license_number: business.license_number,
      phone: business.phone,
      email: business.email,
      website: business.website,
      logo_url: business.logo_url,
      brand_color: business.brand_color,
      prices_include_tax: business.prices_include_tax,
      # What the client should render, resolved once here rather than
      # reimplemented in three frontends.
      modules: Verticals.active_modules(business),
      product_kinds: Verticals.product_kinds_for(business.business_type),
      required_sale_fields: Enum.map(Verticals.required_sale_fields(business.business_type), &to_string/1),
      requires_batch: Verticals.requires_batch?(business.business_type),
      social: business.social,
      receipt_settings: business.receipt_settings,
      settings: business.settings,
      status: business.status,
      branches: preloaded(business.branches, &branch/1),
      inserted_at: timestamp(business.inserted_at)
    }
  end

  def branch(%Branch{} = branch) do
    %{
      id: branch.id,
      business_id: branch.business_id,
      name: branch.name,
      code: branch.code,
      address: %{
        line1: branch.address_line1,
        line2: branch.address_line2,
        city: branch.city,
        state: branch.state,
        postal_code: branch.postal_code,
        country_code: branch.country_code
      },
      phone: branch.phone,
      email: branch.email,
      latitude: branch.latitude && Decimal.to_string(branch.latitude, :normal),
      longitude: branch.longitude && Decimal.to_string(branch.longitude, :normal),
      timezone: branch.timezone,
      is_main: branch.is_main,
      is_warehouse: branch.is_warehouse,
      opening_hours: branch.opening_hours,
      status: branch.status,
      inserted_at: timestamp(branch.inserted_at)
    }
  end

  # --- Staff ------------------------------------------------------------------

  def membership(%Membership{} = membership) do
    %{
      id: membership.id,
      organization_id: membership.organization_id,
      business_id: membership.business_id,
      employee_code: membership.employee_code,
      job_title: membership.job_title,
      status: membership.status,
      started_on: date(membership.started_on),
      ended_on: date(membership.ended_on),
      # Whether a PIN exists, never the PIN. The register screen needs to know
      # which staff can be switched to; nobody needs the value.
      has_pin: not is_nil(membership.pin_hash),
      organization_wide: Membership.organization_wide?(membership),
      user: preloaded(membership.user, &user/1),
      business: preloaded(membership.business, &business_summary/1),
      roles: membership_roles(membership),
      branch_ids: membership_branch_ids(membership),
      inserted_at: timestamp(membership.inserted_at)
    }
  end

  defp membership_roles(%Membership{membership_roles: membership_roles})
       when is_list(membership_roles) do
    Enum.map(membership_roles, fn membership_role ->
      case membership_role.role do
        %Role{} = role -> role_summary(role)
        _not_loaded -> %{id: membership_role.role_id}
      end
    end)
  end

  defp membership_roles(%Membership{}), do: []

  defp membership_branch_ids(%Membership{membership_branches: branches}) when is_list(branches),
    do: Enum.map(branches, & &1.branch_id)

  defp membership_branch_ids(%Membership{}), do: []

  def business_summary(%Business{} = business) do
    %{
      id: business.id,
      name: business.name,
      slug: business.slug,
      business_type: business.business_type,
      currency: business.currency
    }
  end

  def business_summary(_other), do: nil

  # --- Access control ---------------------------------------------------------

  def role(%Role{} = role) do
    role
    |> role_summary()
    |> Map.merge(%{
      description: role.description,
      permissions: Role.permission_keys(role),
      inserted_at: timestamp(role.inserted_at)
    })
  end

  def role_summary(%Role{} = role) do
    %{
      id: role.id,
      key: role.key,
      name: role.name,
      rank: role.rank,
      is_system: role.is_system,
      organization_id: role.organization_id
    }
  end

  def permission(%{key: key, group: group, label: label}) do
    %{key: key, group: to_string(group), label: label}
  end

  def grant(grant) do
    %{
      permission_key: grant.permission_key,
      effect: grant.effect,
      reason: grant.reason,
      expires_at: timestamp(grant.expires_at),
      granted_by_id: grant.granted_by_id
    }
  end

  # --- Invitations ------------------------------------------------------------

  def invitation(%Invitation{} = invitation) do
    %{
      id: invitation.id,
      email: invitation.email,
      name: invitation.name,
      phone: invitation.phone,
      status: invitation.status,
      message: invitation.message,
      branch_ids: invitation.branch_ids,
      expires_at: timestamp(invitation.expires_at),
      accepted_at: timestamp(invitation.accepted_at),
      role: preloaded(invitation.role, &role_summary/1),
      business: preloaded(invitation.business, &business_summary/1),
      invited_by: preloaded(invitation.invited_by, &user/1),
      inserted_at: timestamp(invitation.inserted_at)
    }
  end

  # --- Audit ------------------------------------------------------------------

  def audit_entry(%Entry{} = entry) do
    %{
      id: entry.id,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      entity_label: entry.entity_label,
      actor: %{
        id: entry.actor_user_id,
        label: entry.actor_label,
        type: entry.actor_type
      },
      organization_id: entry.organization_id,
      business_id: entry.business_id,
      branch_id: entry.branch_id,
      summary: entry.summary,
      changes: entry.changes,
      metadata: entry.metadata,
      ip_address: entry.ip_address,
      request_id: entry.request_id,
      occurred_at: timestamp(entry.inserted_at)
    }
  end

  # --- Scope ------------------------------------------------------------------

  @doc """
  The caller's own context: who they are, where they are, and what they may do.

  The client renders its whole navigation from this — which screens exist,
  which buttons are enabled — so it is returned in full on sign-in rather than
  requiring a second round trip before the first screen can be drawn.
  """
  def scope(%Scope{} = scope) do
    %{
      user: scope.user && user(scope.user),
      organization: scope.organization && organization(scope.organization),
      business: scope.business && business(scope.business),
      branch: scope.branch && branch(scope.branch),
      is_owner: scope.owner?,
      roles: scope.role_keys,
      permissions: scope.permissions |> MapSet.to_list() |> Enum.sort(),
      branch_ids: branch_ids(scope)
    }
  end

  defp branch_ids(%Scope{branch_ids: :all}), do: nil
  defp branch_ids(%Scope{branch_ids: ids}), do: MapSet.to_list(ids)
end
