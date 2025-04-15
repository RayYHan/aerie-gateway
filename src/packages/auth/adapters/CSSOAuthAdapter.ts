import { getEnv } from '../../../env.js';
import { authGroupMappingsExist, generateJwt, getUserRoles, mapGroupsToRoles, syncRolesToDB } from '../functions.js';
import fetch from 'node-fetch';
import type { AuthAdapter, AuthResponse, ValidateResponse } from '../../../types/auth.js';
import { Request } from 'express';

type CSSOValidateResponse = {
  sub?: string;
  groups?: string[];
};

export const CSSOAuthAdapter: AuthAdapter = {
  logout: async (req: Request): Promise<boolean> => {
    const { AUTH_SSO_TOKEN_NAME, AUTH_URL } = getEnv();
    const cookies = req.cookies;
    const ssoToken = cookies[AUTH_SSO_TOKEN_NAME[0]];
    const url = `${AUTH_URL}/v2/logout`
    const response = await fetch(url, {method: 'POST', headers: {cookie:`${AUTH_SSO_TOKEN_NAME[0]}=${ssoToken}`}});
    return response.status == 200;
  },
  validate: async (req: Request): Promise<ValidateResponse> => {
    const { AUTH_SSO_TOKEN_NAME, AUTH_URL } = getEnv();
    const cookies = req.cookies;
    const ssoToken = cookies[AUTH_SSO_TOKEN_NAME[0]];
    const url = AUTH_URL
    const response = await fetch(url, {method: 'GET', headers: {cookie:`${AUTH_SSO_TOKEN_NAME[0]}=${ssoToken}`}});
   // as CSSOValidateResponse;
    const redirectTo = req.headers.referrer;
    const redirectURL = `${AUTH_URL}/v2/login?redirect=${redirectTo}`
    if (response.status != 200) {
      return {
        message: 'invalid token, redirecting to login UI',
        redirectURL,
        success: false
      };
    }
    const json = (await response.json()) as {sub: string, groups: {[key:string]: boolean}};
    const groups_obj = json['groups'];
    const groups = Object.keys(groups_obj).filter(key => groups_obj[key]);
    const loginResp = await authn({sub: json['sub'], groups});
    return {
      message: 'valid SSO token',
      redirectURL: '',
      success: true,
      token: loginResp.token ?? undefined,
      userId: loginResp.message
    }
  }
}

async function authn(authData: CSSOValidateResponse): Promise<AuthResponse> {
  try {
    const {sub = '', groups = []} = authData;
    const {default_role, allowed_roles} = mapGroupsToRoles(groups);
    if (authGroupMappingsExist()) {
      const existing_roles = await getUserRoles(sub, default_role, allowed_roles);
      const existing_set = new Set(existing_roles.allowed_roles);
      const existing_default_role = existing_roles.default_role;
      const mapped_roles_match_db = allowed_roles.length == existing_roles.allowed_roles.length && allowed_roles.every(e => existing_set.has(e));
      const default_role_match_db = existing_default_role === default_role
      if (!mapped_roles_match_db || !default_role_match_db) {
        await syncRolesToDB(sub, default_role, allowed_roles);
      }
    }
    const user_roles = await getUserRoles(sub, default_role, allowed_roles);
    if (user_roles.allowed_roles.length === 0) {
      console.error("no allowed roles")
      return {
        message: `User ${sub} has no allowed roles`,
        success: false,
        token: null,
      }
    }
    return {
      message: sub,
      success: true,
      token: generateJwt(sub, user_roles.default_role, user_roles.allowed_roles),
    }
  } catch (error) {
    console.error(error);
    return {
      message: 'An unexpeced error occurred',
      success: false,
      token: null
    }
  }
}
