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
