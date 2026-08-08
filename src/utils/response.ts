import { Response } from "express";

export interface ApiResponseOptions {
  status?: number;
  code?: number | string;
  extra?: Record<string, any>;
}

export function sendSuccess(res: Response, data: any, extraPayload: Record<string, any> = {}, statusCode: number = 200) {
  return res.status(statusCode).json({
    ok: true,
    data,
    status: extraPayload.status || "ok",
    success: true,
    ...extraPayload
  });
}

export function sendError(
  res: Response,
  message: string,
  statusCode: number = 400,
  errorCode: number | string = statusCode,
  extraPayload: Record<string, any> = {}
) {
  return res.status(statusCode).json({
    ok: false,
    error: message,
    errorDetails: {
      code: errorCode,
      message
    },
    status: "error",
    message,
    ...extraPayload
  });
}
