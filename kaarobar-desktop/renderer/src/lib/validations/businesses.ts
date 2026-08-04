import * as yup from "yup";

export type BusinessFormValues = {
  name: string;
  industry: string;
};

export const emptyBusinessForm = (): BusinessFormValues => ({
  name: "",
  industry: "general",
});

export const businessFormSchema: yup.ObjectSchema<BusinessFormValues> = yup.object({
  name: yup.string().trim().required("Name is required"),
  industry: yup.string().trim().required("Industry is required"),
});

export type BusinessCreateFormValues = {
  name: string;
  industry: string;
  tax_jurisdiction: string;
  tagline: string;
};

export const emptyBusinessCreateForm = (): BusinessCreateFormValues => ({
  name: "",
  industry: "retail",
  tax_jurisdiction: "PK",
  tagline: "",
});

export const businessCreateFormSchema: yup.ObjectSchema<BusinessCreateFormValues> =
  yup.object({
    name: yup.string().trim().required("Name is required"),
    industry: yup.string().trim().required("Industry is required"),
    tax_jurisdiction: yup.string().trim().default("PK"),
    tagline: yup.string().trim().default(""),
  });

export type BranchFormValues = {
  name: string;
};

export const emptyBranchForm = (): BranchFormValues => ({ name: "" });

export const branchFormSchema: yup.ObjectSchema<BranchFormValues> = yup.object({
  name: yup.string().trim().required("Branch name is required"),
});

export type BusinessDetailsFormValues = {
  name: string;
  industry: string;
  tax_jurisdiction: string;
  tagline: string;
};

export const emptyBusinessDetailsForm = (): BusinessDetailsFormValues => ({
  name: "",
  industry: "retail",
  tax_jurisdiction: "PK",
  tagline: "",
});

export const businessDetailsFormSchema: yup.ObjectSchema<BusinessDetailsFormValues> =
  yup.object({
    name: yup.string().trim().required("Name is required"),
    industry: yup.string().trim().required("Industry is required"),
    tax_jurisdiction: yup.string().trim().default("PK"),
    tagline: yup.string().trim().default(""),
  });

export type BusinessBrandingFormValues = {
  tagline: string;
  primary_color: string;
  marketplace_description: string;
};

export const emptyBusinessBrandingForm = (): BusinessBrandingFormValues => ({
  tagline: "",
  primary_color: "",
  marketplace_description: "",
});

export const businessBrandingFormSchema: yup.ObjectSchema<BusinessBrandingFormValues> =
  yup.object({
    tagline: yup.string().trim().default(""),
    primary_color: yup.string().trim().default(""),
    marketplace_description: yup.string().trim().default(""),
  });
