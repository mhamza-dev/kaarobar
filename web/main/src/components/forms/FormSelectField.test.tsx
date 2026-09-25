import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Formik } from "formik";
import { describe, expect, it, vi } from "vitest";

import { FormSelectField } from "./FormSelectField";

const suppliers = [
  { value: "0199-aaaa", label: "Al-Madina Wholesale" },
  { value: "0199-bbbb", label: "Crescent Beverages" },
];

function setup(initial = "", onValueChange = vi.fn()) {
  render(
    <Formik initialValues={{ supplier_id: initial }} onSubmit={() => {}}>
      <FormSelectField
        name="supplier_id"
        label="Supplier"
        options={suppliers}
        onValueChange={onValueChange}
      />
    </Formik>,
  );
  return onValueChange;
}

describe("FormSelectField", () => {
  it("shows the chosen option's label, never its id", () => {
    setup("0199-bbbb");
    const trigger = screen.getByRole("combobox", { name: "Supplier" });
    expect(trigger).toHaveTextContent("Crescent Beverages");
    expect(trigger).not.toHaveTextContent("0199-bbbb");
  });

  it("tells a dependent field what was picked", async () => {
    const onValueChange = setup();
    await userEvent.click(screen.getByRole("combobox", { name: "Supplier" }));
    await userEvent.click(await screen.findByRole("option", { name: "Al-Madina Wholesale" }));
    expect(onValueChange).toHaveBeenCalledWith("0199-aaaa");
    expect(screen.getByRole("combobox", { name: "Supplier" })).toHaveTextContent(
      "Al-Madina Wholesale",
    );
  });
});
