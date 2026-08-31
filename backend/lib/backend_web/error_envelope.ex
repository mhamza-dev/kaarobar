defmodule KaarobarWeb.ErrorEnvelope do
  @moduledoc """
  The single error shape returned by this API.

  Every failure — a validation error, a permission denial, an unhandled
  exception — reaches the client as:

      {
        "error": {
          "code": "validation_failed",
          "message": "The submitted data is invalid",
          "details": { "email": ["has already been taken"] }
        }
      }

  `code` is a stable machine-readable string that clients may branch on;
  `message` is human-readable and may change; `details` is present only when
  there is something field-specific to say. Clients never have to parse prose
  to find out what went wrong.
  """

  @type code :: atom() | String.t()

  @doc """
  Builds the error body for a known reason atom.

  Returns `{http_status, body}` so callers set the status and body from one
  lookup and cannot let them drift apart.
  """
  @spec for_reason(atom()) :: {atom(), map()}
  def for_reason(:unauthorized),
    do: {:unauthorized, build("unauthorized", "Authentication is required")}

  def for_reason(:invalid_credentials),
    do: {:unauthorized, build("invalid_credentials", "Email or password is incorrect")}

  def for_reason(:token_expired),
    do: {:unauthorized, build("token_expired", "The access token has expired")}

  def for_reason(:invalid_token),
    do: {:unauthorized, build("invalid_token", "This link has expired or has already been used")}

  # 423 rather than 401: the credentials were right, the account is simply not
  # usable at this moment, and the client should stop retrying them.
  def for_reason(:account_locked),
    do:
      {:locked,
       build(
         "account_locked",
         "Too many failed sign-in attempts. Try again in a few minutes."
       )}

  def for_reason(:account_suspended),
    do:
      {:forbidden,
       build("account_suspended", "This account has been suspended. Contact the account owner.")}

  def for_reason(:forbidden),
    do: {:forbidden, build("forbidden", "You do not have permission to perform this action")}

  def for_reason(:not_found),
    do: {:not_found, build("not_found", "The requested resource was not found")}

  def for_reason(:conflict),
    do: {:conflict, build("conflict", "The request conflicts with the current state")}

  def for_reason(:payment_required),
    do:
      {:payment_required,
       build("payment_required", "Your current subscription plan does not include this feature")}

  def for_reason(:module_disabled),
    do:
      {:forbidden,
       build("module_disabled", "This feature is not available for this type of business")}

  def for_reason(:limit_exceeded),
    do: {:forbidden, build("limit_exceeded", "Your current plan's limit has been reached")}

  def for_reason(:rate_limited),
    do: {:too_many_requests, build("rate_limited", "Too many requests, please retry shortly")}

  def for_reason(:unprocessable_entity),
    do: {:unprocessable_entity, build("unprocessable_entity", "The request could not be processed")}

  # --- Selling ---------------------------------------------------------------
  #
  # These are the messages a cashier reads with a customer standing in front of
  # them. Each says what happened and what to do about it, because "422
  # unprocessable entity" is a message that gets someone else called over.

  def for_reason(:insufficient_stock),
    do:
      {:conflict,
       build("insufficient_stock", "There is not enough stock to complete this sale")}

  def for_reason(:underpaid),
    do: {:unprocessable_entity, build("underpaid", "The tenders do not cover the total")}

  def for_reason(:overpaid),
    do:
      {:unprocessable_entity,
       build("overpaid", "The tenders exceed the total. Only cash may be over-tendered.")}

  def for_reason(:no_payment),
    do: {:unprocessable_entity, build("no_payment", "A sale needs at least one tender")}

  def for_reason(:no_lines),
    do: {:unprocessable_entity, build("no_lines", "A sale needs at least one line")}

  def for_reason(:credit_not_allowed),
    do: {:forbidden, build("credit_not_allowed", "This customer may not buy on credit")}

  def for_reason(:credit_limit_exceeded),
    do:
      {:unprocessable_entity,
       build("credit_limit_exceeded", "This sale would take the customer past their credit limit")}

  def for_reason(:credit_customer_required),
    do:
      {:unprocessable_entity,
       build("credit_customer_required", "A sale on credit has to name the customer")}

  def for_reason(:shift_not_open),
    do: {:conflict, build("shift_not_open", "This register has no open shift")}

  def for_reason(:shift_already_open),
    do: {:conflict, build("shift_already_open", "This register already has an open shift")}

  def for_reason(:shift_open),
    do: {:conflict, build("shift_open", "Close the open shift on this register first")}

  def for_reason(:variant_not_found),
    do: {:not_found, build("variant_not_found", "One of the items is no longer available")}

  def for_reason(:already_voided),
    do: {:conflict, build("already_voided", "This sale has already been voided")}

  def for_reason(:already_refunded),
    do:
      {:conflict,
       build("already_refunded", "Part of this sale has been refunded, so it cannot be voided")}

  def for_reason(:already_billed),
    do: {:conflict, build("already_billed", "Part of this order has already been paid for")}

  def for_reason(:order_closed),
    do: {:conflict, build("order_closed", "This order is no longer open")}

  def for_reason(:exceeds_refundable),
    do:
      {:unprocessable_entity,
       build("exceeds_refundable", "More is being returned than was sold on that line")}

  # --- Regulated goods --------------------------------------------------------
  #
  # Stricter than the rest of the system on purpose. Everywhere else a missing
  # field is a warning; here it is the difference between a legal sale and one
  # that costs the shop its licence, so each message names exactly what the
  # counter has to collect before the sale can go through.

  def for_reason(:buyer_required),
    do:
      {:unprocessable_entity,
       build(
         "buyer_required",
         "This product is restricted. Record the buyer's name before selling it."
       )}

  def for_reason(:buyer_licence_required),
    do:
      {:unprocessable_entity,
       build(
         "buyer_licence_required",
         "This product may only be sold to a licence holder. Record their licence number."
       )}

  def for_reason(:batch_required),
    do:
      {:unprocessable_entity,
       build(
         "batch_required",
         "This product is batch-tracked. Choose the batch so a recall can trace it."
       )}

  def for_reason(:quantity_over_limit),
    do:
      {:unprocessable_entity,
       build(
         "quantity_over_limit",
         "That is more of this product than may be sold in one transaction"
       )}

  def for_reason(:business_licence_invalid),
    do:
      {:forbidden,
       build(
         "business_licence_invalid",
         "This shop has no valid licence on file for restricted goods"
       )}

  def for_reason(:balance_outstanding),
    do:
      {:conflict,
       build("balance_outstanding", "This customer still owes money and cannot be removed")}

  def for_reason(other) when is_atom(other),
    do: {:unprocessable_entity, build(to_string(other), humanize(other))}

  @doc """
  Builds an error body from a failed changeset, with per-field messages.
  """
  @spec for_changeset(Ecto.Changeset.t()) :: {atom(), map()}
  def for_changeset(%Ecto.Changeset{} = changeset) do
    details =
      Ecto.Changeset.traverse_errors(changeset, fn {message, opts} ->
        Regex.replace(~r"%{(\w+)}", message, fn _whole, key ->
          opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
        end)
      end)

    {:unprocessable_entity,
     build("validation_failed", "The submitted data is invalid", details)}
  end

  @doc """
  Builds an error body directly.
  """
  @spec build(code(), String.t(), map() | nil) :: map()
  def build(code, message, details \\ nil)

  def build(code, message, nil) do
    %{error: %{code: to_string(code), message: message}}
  end

  def build(code, message, details) do
    %{error: %{code: to_string(code), message: message, details: details}}
  end

  defp humanize(atom) do
    atom
    |> to_string()
    |> String.replace("_", " ")
    |> String.capitalize()
  end
end
