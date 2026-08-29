defmodule KaarobarWeb.SalesJSON do
  @moduledoc false

  alias KaarobarWeb.SalesSerializers

  def sales(%{sales: sales, meta: meta}) do
    %{data: Enum.map(sales, &SalesSerializers.sale_summary/1), meta: meta}
  end

  def sale(%{sale: sale}), do: %{data: SalesSerializers.sale(sale)}

  def quote(%{quote: summary}), do: %{data: SalesSerializers.quote_summary(summary)}

  def sale_returns(%{sale_returns: returns}) do
    %{data: Enum.map(returns, &SalesSerializers.sale_return/1)}
  end

  def sale_return(%{sale_return: record}), do: %{data: SalesSerializers.sale_return(record)}

  def refund_requests(%{refund_requests: requests}) do
    %{data: Enum.map(requests, &SalesSerializers.refund_request/1)}
  end

  def refund_request(%{refund_request: request}) do
    %{data: SalesSerializers.refund_request(request)}
  end
end
