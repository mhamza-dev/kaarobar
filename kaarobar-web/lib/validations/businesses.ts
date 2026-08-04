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

export type BusinessCreateFormValues = BusinessFormValues & {
  tax_jurisdiction: string;
};

export const emptyBusinessCreateForm = (): BusinessCreateFormValues => ({
  name: "",
  industry: "general",
  tax_jurisdiction: "PK",
});

export const businessCreateFormSchema: yup.ObjectSchema<BusinessCreateFormValues> =
  yup.object({
    name: yup.string().trim().required("Name is required"),
    industry: yup.string().trim().required("Industry is required"),
    tax_jurisdiction: yup.string().trim().default("PK"),
  });

export type BranchFormValues = {
  name: string;
};

export const emptyBranchForm = (): BranchFormValues => ({ name: "" });

export const branchFormSchema: yup.ObjectSchema<BranchFormValues> = yup.object({
  name: yup.string().trim().required("Branch name is required"),
});

export type BusinessEditFormValues = {
  name: string;
  industry: string;
  tagline: string;
  primary_color: string;
  marketplace_enabled: boolean;
  marketplace_slug: string;
  marketplace_description: string;
  online_branch_id: string;
};

export const emptyBusinessEditForm = (): BusinessEditFormValues => ({
  name: "",
  industry: "general",
  tagline: "",
  primary_color: "",
  marketplace_enabled: false,
  marketplace_slug: "",
  marketplace_description: "",
  online_branch_id: "",
});

export const businessEditFormSchema: yup.ObjectSchema<BusinessEditFormValues> =
  yup.object({
    name: yup.string().trim().required("Name is required"),
    industry: yup.string().trim().required("Industry is required"),
    tagline: yup.string().trim().default(""),
    primary_color: yup.string().trim().default(""),
    marketplace_enabled: yup.boolean().default(false),
    marketplace_slug: yup.string().trim().default(""),
    marketplace_description: yup.string().trim().default(""),
    online_branch_id: yup.string().trim().default(""),
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
