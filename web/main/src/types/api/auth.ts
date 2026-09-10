import type { Branch, Business, Organization, User } from "./tenancy";

/** `POST /auth/register` and a plain (non-MFA) `POST /auth/login`. */
export type AuthSession = {
  token: string;
  token_type: "Bearer";
  user: User;
  organization?: Organization;
  business?: Business;
  branch?: Branch;
};

/** `POST /auth/login` when the account has TOTP confirmed. */
export type MfaChallenge = {
  mfa_required: true;
  challenge: string;
};

export function isMfaChallenge(response: AuthSession | MfaChallenge): response is MfaChallenge {
  return "mfa_required" in response && response.mfa_required === true;
}

export type RegisterInput = {
  user: {
    email: string;
    password: string;
    name: string;
    timezone?: string;
    locale?: string;
  };
  organization: {
    name: string;
    slug?: string;
    country_code?: string;
    default_currency?: string;
    timezone?: string;
  };
  business?: {
    name: string;
    business_type: string;
  };
};

export type LoginInput = {
  email: string;
  password: string;
};

export type MfaVerifyInput = {
  challenge: string;
  code: string;
};
