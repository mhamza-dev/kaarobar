defmodule Kaarobar.NotificationsTest do
  use ExUnit.Case, async: false

  alias Kaarobar.Notifications.Push
  alias Kaarobar.Notifications.SMS

  describe "Kaarobar.Notifications.SMS.Log" do
    test "accepts the message and returns a reference" do
      assert {:ok, "log-" <> _rest} = SMS.Log.send("+15551234567", "Your order is ready")
    end

    test "is the default adapter" do
      assert SMS.adapter() == SMS.Log
    end
  end

  describe "Kaarobar.Notifications.Push.Expo" do
    setup do
      Application.put_env(:backend, Push.Expo, req_module: PushReqStub)
      on_exit(fn -> Application.delete_env(:backend, Push.Expo) end)
    end

    test "reports success from Expo's response shape" do
      PushReqStub.stub(fn ->
        {:ok, %{status: 200, body: %{"data" => %{"status" => "ok", "id" => "abc"}}}}
      end)

      assert {:ok, %{"data" => %{"status" => "ok"}}} =
               Push.Expo.send("ExponentPushToken[x]", "Ready", "Order #12 is ready", %{
                 order_id: 12
               })
    end

    test "turns Expo's own error status into {:error, message}" do
      PushReqStub.stub(fn ->
        {:ok,
         %{
           status: 200,
           body: %{"data" => %{"status" => "error", "message" => "DeviceNotRegistered"}}
         }}
      end)

      assert {:error, "DeviceNotRegistered"} =
               Push.Expo.send("ExponentPushToken[x]", "Ready", "Order #12 is ready", %{})
    end

    test "turns a non-200 into {:error, {:http_error, status}}" do
      PushReqStub.stub(fn -> {:ok, %{status: 500, body: "boom"}} end)

      assert {:error, {:http_error, 500}} =
               Push.Expo.send("ExponentPushToken[x]", "Ready", "Order #12 is ready", %{})
    end

    test "passes a transport error straight through" do
      PushReqStub.stub(fn -> {:error, :timeout} end)

      assert {:error, :timeout} =
               Push.Expo.send("ExponentPushToken[x]", "Ready", "Order #12 is ready", %{})
    end
  end
end

defmodule PushReqStub do
  @moduledoc false
  def stub(fun), do: Process.put(:push_req_stub, fun)
  def post(_url, _opts), do: Process.get(:push_req_stub).()
end
