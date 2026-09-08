defmodule Kaarobar.Accounts.TOTP do
  @moduledoc """
  RFC 6238 time-based one-time passwords — SHA-1, 6 digits, a 30-second step.

  That is the exact configuration Google Authenticator, Authy and every other
  common authenticator app assumes when it scans a plain `otpauth://` URI
  with no explicit algorithm, digit count or period, which is what makes this
  worth forty lines of `:crypto` rather than a dependency: nothing here is a
  choice, it is the one shape a QR code has to be in to work with an app the
  platform does not control.
  """

  import Bitwise

  @period 30
  @digits 6

  @doc "A fresh, unconfirmed secret: 160 random bits, base32-encoded."
  @spec generate_secret() :: String.t()
  def generate_secret do
    20 |> :crypto.strong_rand_bytes() |> Base.encode32(padding: false)
  end

  @doc "The `otpauth://` URI an authenticator app turns into a QR code."
  @spec provisioning_uri(String.t(), String.t()) :: String.t()
  def provisioning_uri(secret, account_name) do
    label = URI.encode("Kaarobar:#{account_name}")

    "otpauth://totp/#{label}?secret=#{secret}&issuer=Kaarobar&algorithm=SHA1&digits=#{@digits}&period=#{@period}"
  end

  @doc """
  Checks a 6-digit code against a secret.

  Accepts the current step and one on either side of it — ninety seconds of
  tolerance total — because a phone's clock and the server's clock are never
  perfectly aligned, and a code rejected for arriving one second into the next
  window is indistinguishable, to the person holding the phone, from a bug.
  """
  @spec valid?(String.t(), String.t()) :: boolean()
  def valid?(secret, code) when is_binary(secret) and is_binary(code) do
    code = String.trim(code)
    counter = div(System.os_time(:second), @period)

    code != "" and Enum.any?(-1..1, fn drift -> generate(secret, counter + drift) == code end)
  end

  def valid?(_secret, _code), do: false

  @doc false
  # Exposed only so the test suite can check this against RFC 6238's own
  # test vectors by counter rather than by the current wall clock.
  @spec generate(String.t(), non_neg_integer()) :: String.t() | nil
  def generate(secret, counter) do
    case Base.decode32(secret, padding: false) do
      {:ok, key} ->
        hmac = :crypto.mac(:hmac, :sha, key, <<counter::64>>)
        <<_::binary-size(19), last>> = hmac
        offset = last &&& 0x0F
        <<_::binary-size(^offset), value::unsigned-32, _::binary>> = hmac

        (value &&& 0x7FFFFFFF)
        |> rem(1_000_000)
        |> Integer.to_string()
        |> String.pad_leading(@digits, "0")

      :error ->
        nil
    end
  end
end
