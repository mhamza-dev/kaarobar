defmodule Kaarobar.RateLimiter do
  @moduledoc """
  ETS-backed request throttling, driven by `KaarobarWeb.Plugs.RateLimit`.

  Node-local by design. A shop's traffic is sticky to one node in practice, and
  a local limiter cannot itself become an availability risk for checkout. If
  cluster-wide limits are ever required, swap the backend here rather than at
  every call site.
  """

  use Hammer, backend: :ets
end
