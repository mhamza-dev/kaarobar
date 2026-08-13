import * as yup from "yup";

export type LeaveRequestFormValues = {
  type: string;
  start_date: string;
  end_date: string;
  reason: string;
};

export const emptyLeaveRequestForm = (): LeaveRequestFormValues => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    type: "annual",
    start_date: today,
    end_date: today,
    reason: "",
  };
};

export const leaveRequestFormSchema: yup.ObjectSchema<LeaveRequestFormValues> =
  yup
    .object({
      type: yup.string().trim().required("Leave type is required"),
      start_date: yup.string().trim().required("Start date is required"),
      end_date: yup.string().trim().required("End date is required"),
      reason: yup.string().trim().default(""),
    })
    .test(
      "end-after-start",
      "End date must be on or after start date",
      (values) => {
        if (!values?.start_date || !values?.end_date) return true;
        return values.end_date >= values.start_date;
      }
    );
