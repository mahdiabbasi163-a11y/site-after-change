import * as serverUtils from "../server_utils";

export const admin2faOtps = new Map<string, { code: string; expiresAt: number }>();
export const loginOtps = new Map<string, { code: string; expiresAt: number }>();

export { serverUtils };
