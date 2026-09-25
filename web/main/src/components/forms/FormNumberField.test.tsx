import { render, screen } from "@testing-library/react";
import { Formik } from "formik";
import { describe, expect, it } from "vitest";

import { FormNumberField } from "./FormNumberField";

describe("FormNumberField", () => {
  it("accepts decimals by default, so native validation can't block the form", () => {
    render(
      <Formik initialValues={{ price: "999.50" }} onSubmit={() => {}}>
        <FormNumberField name="price" label="Price" />
      </Formik>,
    );
    const input = screen.getByLabelText("Price") as HTMLInputElement;
    expect(input).toHaveAttribute("step", "any");
    expect(input.checkValidity()).toBe(true);
  });
});
