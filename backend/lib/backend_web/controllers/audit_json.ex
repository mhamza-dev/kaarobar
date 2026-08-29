defmodule KaarobarWeb.AuditJSON do
  @moduledoc false

  alias KaarobarWeb.Serializers

  def index(%{entries: entries, meta: meta}) do
    %{data: Enum.map(entries, &Serializers.audit_entry/1), meta: meta}
  end
end
