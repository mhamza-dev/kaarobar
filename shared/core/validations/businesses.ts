import * as yup from "yup";

export type BusinessFormValues = {
  name: string;
  industry: string;
  tagline: string;
};

export const emptyBusinessForm = (): BusinessFormValues => ({
  name: "",
  industry: "retail",
  tagline: "",
});

export const businessFormSchema: yup.ObjectSchema<BusinessFormValues> = yup.object({
  name: yup.string().trim().required("Name is required"),
  industry: yup.string().trim().required("Industry is required"),
  tagline: yup.string().trim().default(""),
});

export type BusinessCreateFormValues = BusinessFormValues & {
  tax_jurisdiction: string;
};

export const emptyBusinessCreateForm = (): BusinessCreateFormValues => ({
  name: "",
  industry: "retail",
  tagline: "",
  tax_jurisdiction: "PK",
});

export const businessCreateFormSchema: yup.ObjectSchema<BusinessCreateFormValues> =
  yup.object({
    name: yup.string().trim().required("Name is required"),
    industry: yup.string().trim().required("Industry is required"),
    tagline: yup.string().trim().default(""),
    tax_jurisdiction: yup.string().trim().default("PK"),
  });

export type BusinessDetailFormValues = {
  name: string;
  industry: string;
  tagline: string;
  primary_color: string;
  marketplace_description: string;
};

export const emptyBusinessDetailForm = (): BusinessDetailFormValues => ({
  name: "",
  industry: "general",
  tagline: "",
  primary_color: "",
  marketplace_description: "",
});

export const businessDetailFormSchema: yup.ObjectSchema<BusinessDetailFormValues> =
  yup.object({
    name: yup.string().trim().required("Name is required"),
    industry: yup.string().trim().default(""),
    tagline: yup.string().trim().default(""),
    primary_color: yup.string().trim().default(""),
    marketplace_description: yup.string().trim().default(""),
  });

export type BranchFormValues = {
  name: string;
};

export const emptyBranchForm = (): BranchFormValues => ({ name: "" });

export const branchFormSchema: yup.ObjectSchema<BranchFormValues> = yup.object({
  name: yup.string().trim().required("Branch name is required"),
});
