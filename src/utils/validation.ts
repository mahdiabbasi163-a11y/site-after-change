import { Request, Response, NextFunction } from "express";
import { z, ZodSchema } from "zod";
import { normalizePhone, isValidIranianMobile } from "./phone";
import { sendError } from "./response";

export const mobileSchema = z
  .string({ message: "شماره همراه الزامی است." })
  .transform((val) => normalizePhone(val))
  .refine((val) => isValidIranianMobile(val), {
    message: "شماره همراه وارد شده معتبر نیست. الگوی صحیح: ۰۹xxxxxxxx"
  });

export const positiveAmountSchema = z
  .number({ message: "مبلغ الزامی است." })
  .positive("مبلغ باید بزرگتر از صفر باشد.");

export const idSchema = z
  .string({ message: "شناسه الزامی است." })
  .min(1, "شناسه نمی‌تواند خالی باشد.");

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issue = result.error.issues[0];
      const errorMessage = issue ? `${issue.path.join(".")}: ${issue.message}` : "ورودی نامعتبر است.";
      return sendError(res, errorMessage, 400, 400);
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const issue = result.error.issues[0];
      const errorMessage = issue ? `${issue.path.join(".")}: ${issue.message}` : "پارامترهای جستجو نامعتبر است.";
      return sendError(res, errorMessage, 400, 400);
    }
    req.query = result.data as any;
    next();
  };
}
