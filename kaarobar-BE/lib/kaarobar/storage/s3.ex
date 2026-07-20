defmodule Kaarobar.Storage.S3 do
  @moduledoc """
  S3-compatible storage (AWS, Cloudflare R2, MinIO) via Finch + SigV4.
  """

  @behaviour Kaarobar.Storage

  @impl true
  def put(key, binary, opts \\ []) do
    content_type = Keyword.get(opts, :content_type, "application/octet-stream")
    bucket = bucket!()
    %{host: host, scheme: scheme, port: port} = endpoint_parts()
    path = "/#{bucket}/#{key}"
    url = "#{scheme}://#{host}:#{port}#{path}"
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    amz_date = Calendar.strftime(now, "%Y%m%dT%H%M%SZ")
    date_stamp = Calendar.strftime(now, "%Y%m%d")
    region = Application.get_env(:kaarobar, :s3_region) || "auto"
    payload_hash = sha256_hex(binary)

    headers = [
      {"host", host_header(host, port, scheme)},
      {"content-type", content_type},
      {"x-amz-content-sha256", payload_hash},
      {"x-amz-date", amz_date}
    ]

    signed =
      sign_headers(
        method: "PUT",
        path: path,
        headers: headers,
        payload_hash: payload_hash,
        amz_date: amz_date,
        date_stamp: date_stamp,
        region: region
      )

    request =
      Finch.build(:put, url, signed, binary)

    case Finch.request(request, Kaarobar.Finch) do
      {:ok, %{status: status}} when status in 200..299 ->
        {:ok, key}

      {:ok, %{status: status, body: body}} ->
        {:error, {:http_error, status, body}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @impl true
  def url(key) do
    case Application.get_env(:kaarobar, :s3_public_url) do
      url when is_binary(url) and url != "" ->
        String.trim_trailing(url, "/") <> "/" <> key

      _ ->
        bucket = bucket!()
        %{host: host, scheme: scheme, port: port} = endpoint_parts()
        "#{scheme}://#{host}:#{port}/#{bucket}/#{key}"
    end
  end

  @impl true
  def delete(key) do
    bucket = bucket!()
    %{host: host, scheme: scheme, port: port} = endpoint_parts()
    path = "/#{bucket}/#{key}"
    url = "#{scheme}://#{host}:#{port}#{path}"
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    amz_date = Calendar.strftime(now, "%Y%m%dT%H%M%SZ")
    date_stamp = Calendar.strftime(now, "%Y%m%d")
    region = Application.get_env(:kaarobar, :s3_region) || "auto"
    payload_hash = sha256_hex("")

    headers = [
      {"host", host_header(host, port, scheme)},
      {"x-amz-content-sha256", payload_hash},
      {"x-amz-date", amz_date}
    ]

    signed =
      sign_headers(
        method: "DELETE",
        path: path,
        headers: headers,
        payload_hash: payload_hash,
        amz_date: amz_date,
        date_stamp: date_stamp,
        region: region
      )

    request = Finch.build(:delete, url, signed, "")

    case Finch.request(request, Kaarobar.Finch) do
      {:ok, %{status: status}} when status in 200..299 or status == 204 ->
        :ok

      {:ok, %{status: status, body: body}} ->
        {:error, {:http_error, status, body}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp bucket! do
    Application.get_env(:kaarobar, :s3_bucket) || raise "S3_BUCKET is not configured"
  end

  defp endpoint_parts do
    case Application.get_env(:kaarobar, :s3_endpoint) do
      url when is_binary(url) and url != "" ->
        uri = URI.parse(url)

        %{
          host: uri.host || "s3.amazonaws.com",
          scheme: uri.scheme || "https",
          port: uri.port || if(uri.scheme == "http", do: 80, else: 443)
        }

      _ ->
        region = Application.get_env(:kaarobar, :s3_region) || "us-east-1"

        %{
          host: "s3.#{region}.amazonaws.com",
          scheme: "https",
          port: 443
        }
    end
  end

  defp host_header(host, 443, "https"), do: host
  defp host_header(host, 80, "http"), do: host
  defp host_header(host, port, _), do: "#{host}:#{port}"

  defp sign_headers(opts) do
    method = opts[:method]
    path = opts[:path]
    headers = opts[:headers]
    payload_hash = opts[:payload_hash]
    amz_date = opts[:amz_date]
    date_stamp = opts[:date_stamp]
    region = opts[:region]
    access_key = Application.get_env(:kaarobar, :s3_access_key_id) || ""
    secret = Application.get_env(:kaarobar, :s3_secret_access_key) || ""

    canonical_headers =
      headers
      |> Enum.map(fn {k, v} -> {String.downcase(k), String.trim(v)} end)
      |> Enum.sort_by(&elem(&1, 0))

    signed_headers =
      canonical_headers
      |> Enum.map(&elem(&1, 0))
      |> Enum.join(";")

    canonical_headers_str =
      canonical_headers
      |> Enum.map(fn {k, v} -> "#{k}:#{v}\n" end)
      |> Enum.join()

    canonical_request =
      [
        method,
        path,
        "",
        canonical_headers_str,
        signed_headers,
        payload_hash
      ]
      |> Enum.join("\n")

    credential_scope = "#{date_stamp}/#{region}/s3/aws4_request"

    string_to_sign =
      [
        "AWS4-HMAC-SHA256",
        amz_date,
        credential_scope,
        sha256_hex(canonical_request)
      ]
      |> Enum.join("\n")

    signing_key =
      ("AWS4" <> secret)
      |> hmac(date_stamp)
      |> hmac(region)
      |> hmac("s3")
      |> hmac("aws4_request")

    signature = hmac(signing_key, string_to_sign) |> Base.encode16(case: :lower)

    auth =
      "AWS4-HMAC-SHA256 Credential=#{access_key}/#{credential_scope}, SignedHeaders=#{signed_headers}, Signature=#{signature}"

    [{"authorization", auth} | headers]
  end

  defp sha256_hex(data), do: :crypto.hash(:sha256, data) |> Base.encode16(case: :lower)
  defp hmac(key, data), do: :crypto.mac(:hmac, :sha256, key, data)
end
