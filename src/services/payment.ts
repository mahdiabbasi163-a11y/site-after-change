export const ZARINPAL_MERCHANT_ID = process.env.ZARINPAL_MERCHANT_ID || "00000000-0000-0000-0000-000000000000";
export const IS_SANDBOX = process.env.ZARINPAL_SANDBOX !== "false" && (process.env.ZARINPAL_SANDBOX === "true" || ZARINPAL_MERCHANT_ID === "00000000-0000-0000-0000-000000000000");

export const ZARINPAL_REQUEST_URL = IS_SANDBOX 
  ? "https://sandbox.zarinpal.com/pg/v4/payment/request.json" 
  : "https://api.zarinpal.com/pg/v4/payment/request.json";

export const ZARINPAL_VERIFY_URL = IS_SANDBOX 
  ? "https://sandbox.zarinpal.com/pg/v4/payment/verify.json"
  : "https://api.zarinpal.com/pg/v4/payment/verify.json";

export const ZARINPAL_START_PAY_URL = IS_SANDBOX
  ? "https://sandbox.zarinpal.com/pg/StartPay/"
  : "https://www.zarinpal.com/pg/StartPay/";
