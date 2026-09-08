defmodule Kaarobar.Accounts.TOTPTest do
  @moduledoc """
  Checked against RFC 6238 Appendix B's own test vectors, not just against
  itself — a TOTP implementation that only ever verifies its own codes can be
  internally consistent and still not interoperate with a real authenticator
  app.
  """

  use ExUnit.Case, async: true

  alias Kaarobar.Accounts.TOTP

  # RFC 6238's test seed is the ASCII string "12345678901234567890" — 20 bytes,
  # base32-encoded here because `Kaarobar.Accounts.TOTP` (correctly) only ever
  # stores and accepts base32, the format a `secret=` query parameter in an
  # `otpauth://` URI holds.
  @rfc_seed "12345678901234567890" |> Base.encode32(padding: false)

  describe "generate/2 against RFC 6238's own vectors" do
    # RFC 6238 gives 8-digit truncations at these Unix times: 94287082,
    # 07081804, 14050471. This module truncates to 6 digits, so these are
    # those same values with the leading two digits dropped — a 6-digit TOTP
    # is defined as the low-order 6 digits of the same computation, not a
    # different one.
    test "T = 59 (time step 1)" do
      assert TOTP.generate(@rfc_seed, div(59, 30)) == "287082"
    end

    test "T = 1111111109" do
      assert TOTP.generate(@rfc_seed, div(1_111_111_109, 30)) == "081804"
    end

    test "T = 1111111111" do
      assert TOTP.generate(@rfc_seed, div(1_111_111_111, 30)) == "050471"
    end

    test "T = 2000000000" do
      assert TOTP.generate(@rfc_seed, div(2_000_000_000, 30)) == "279037"
    end
  end

  describe "valid?/2" do
    test "accepts the current window's code" do
      secret = TOTP.generate_secret()
      counter = div(System.os_time(:second), 30)
      code = TOTP.generate(secret, counter)

      assert TOTP.valid?(secret, code)
    end

    test "accepts a code from one step either side, for clock drift" do
      secret = TOTP.generate_secret()
      counter = div(System.os_time(:second), 30)

      assert TOTP.valid?(secret, TOTP.generate(secret, counter - 1))
      assert TOTP.valid?(secret, TOTP.generate(secret, counter + 1))
    end

    test "rejects a code two steps away" do
      secret = TOTP.generate_secret()
      counter = div(System.os_time(:second), 30)

      refute TOTP.valid?(secret, TOTP.generate(secret, counter + 2))
    end

    test "rejects a code for a different secret" do
      code = TOTP.generate(TOTP.generate_secret(), div(System.os_time(:second), 30))
      refute TOTP.valid?(TOTP.generate_secret(), code)
    end

    test "rejects garbage without raising" do
      refute TOTP.valid?("not-base32!!", "000000")
      refute TOTP.valid?(TOTP.generate_secret(), "")
    end
  end

  describe "provisioning_uri/2" do
    test "is a well-formed otpauth URI an authenticator app can scan" do
      secret = TOTP.generate_secret()
      uri = TOTP.provisioning_uri(secret, "owner@example.com")

      assert uri =~ "otpauth://totp/"
      assert uri =~ "secret=#{secret}"
      assert uri =~ "issuer=Kaarobar"
      assert uri =~ "algorithm=SHA1"
      assert uri =~ "digits=6"
      assert uri =~ "period=30"
    end
  end
end
