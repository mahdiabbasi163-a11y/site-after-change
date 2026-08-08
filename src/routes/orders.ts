import { Router, Request, Response } from "express";
import { getCurrentUserAsync, logActivity } from "../db/db";
import { OrderRepository, OrderStatusHistoryRepository } from "../repositories";
import { z } from "zod";
import { normalizePhone, isValidIranianMobile } from "../utils/phone";
import { sendSuccess, sendError } from "../utils/response";

const router = Router();

// Zod schema for creating order
const createOrderSchema = z.object({
  customerName: z.string().optional(),
  customer_name: z.string().optional(),
  customerPhone: z.string().optional(),
  customer_phone: z.string().optional(),
  city: z.string().optional(),
  address: z.string({ message: "آدرس الزامی است." }).min(3, "آدرس باید حداقل ۳ کاراکتر باشد."),
  category: z.string({ message: "دسته‌بندی/نوع دستگاه الزامی است." }).min(2, "نوع دستگاه را مشخص کنید."),
  brand: z.string().optional(),
  model: z.string().optional(),
  errorCode: z.string().optional(),
  description: z.string().optional(),
  problem_description: z.string().optional(),
  amount: z.number().optional()
});


// Zod schema for updating order status
const updateOrderSchema = z.object({
  status: z.string().optional(),
  report: z.string().optional(),
  note: z.string().optional(),
  amount: z.number().optional(),
  technician_id: z.string().optional()
});

// 1. POST /api/orders (Create order)
const handleCreateOrder = async (req: Request, res: Response) => {
  try {
    const user = await getCurrentUserAsync(req);
    const body = req.body;

    const parseResult = createOrderSchema.safeParse(body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return sendError(res, issue ? `${issue.path.join(".")}: ${issue.message}` : "اطلاعات ورودی سفارش نامعتبر است.", 400, 400);
    }

    const data = parseResult.data;
    const name = data.customerName || data.customer_name || (user ? user.full_name : "");
    const rawPhone = data.customerPhone || data.customer_phone || (user ? user.phone : "");
    const phone = normalizePhone(rawPhone);

    if (!name) {
      return sendError(res, "نام مشتری الزامی است.", 400, 400);
    }
    if (!phone || !isValidIranianMobile(phone)) {
      return sendError(res, "شماره همراه مشتری نامعتبر است.", 400, 400);
    }

    const orderId = `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newOrder = await OrderRepository.create({
      id: orderId,
      user_id: user ? user.id : null,
      technician_id: null,
      customer_name: name,
      customer_phone: phone,
      city: data.city || (user ? user.city : "تهران") || "تهران",
      address: data.address,
      category: data.category,
      brand: data.brand || "",
      model: data.model || "",
      problem_description: data.description || data.problem_description || data.errorCode || "",
      status: "pending",
      amount: data.amount || 0
    });

    if (user) {
      await logActivity(user.id, "ثبت درخواست تعمیر جدید", req, `کد سفارش: ${orderId} - دستگاه: ${data.category} ${data.brand || ""}`);
    }

    return sendSuccess(res, {
      order_id: orderId,
      order: newOrder
    }, {
      message: "درخواست تعمیر شما با موفقیت ثبت شد و به تکنسین‌های منطقه ارسال گردید.",
      order_id: orderId,
      order: newOrder
    }, 200);
  } catch (err: any) {
    console.error("Error creating order:", err);
    return sendError(res, "خطا در ثبت درخواست تعمیر: " + err.message, 500, 500);
  }
};

router.post("/", handleCreateOrder);

// 2. GET /api/orders (List orders - with pagination page & limit)
const handleListOrders = async (req: Request, res: Response) => {
  try {
    const user = await getCurrentUserAsync(req);

    if (!user) {
      return sendError(res, "جهت دریافت لیست سفارش‌ها وارد سیستم شوید.", 401, 401);
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));

    let allOrders: any[] = [];

    if (user.role === "technician") {
      const techCity = (user.city || "تهران").toLowerCase().trim();
      const rawOrders = await OrderRepository.findAll();
      allOrders = rawOrders.filter((o: any) => {
        if (o.technician_id === user.id) return true;
        const oCity = (o.city || "تهران").toLowerCase().trim();
        return oCity === techCity;
      });
    } else if (user.role === "admin") {
      allOrders = await OrderRepository.findAll();
    } else {
      allOrders = await OrderRepository.findByUserId(user.id);
    }

    const total = allOrders.length;
    const startIndex = (page - 1) * limit;
    const paginatedOrders = allOrders.slice(startIndex, startIndex + limit);

    return sendSuccess(res, {
      orders: paginatedOrders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    }, {
      repair_requests: paginatedOrders,
      orders: paginatedOrders
    });
  } catch (err: any) {
    console.error("Error fetching orders list:", err);
    return sendError(res, "خطا در دریافت لیست سفارش‌ها: " + err.message, 500, 500);
  }
};

router.get("/", handleListOrders);

// 3. GET /api/orders/:id or /api/orders/track/:id
const handleGetOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const order = await OrderRepository.findById(id);
    if (!order) {
      return sendError(res, "سفارشی با این کد پیگیری یافت نشد.", 404, 404);
    }

    return sendSuccess(res, { order }, { order });
  } catch (err: any) {
    return sendError(res, err.message, 500, 500);
  }
};

router.get("/track/:id", handleGetOrder);
router.get("/:id", handleGetOrder);

// 4. PATCH /api/orders/:id (Update order / status & record status change history)
const handleUpdateOrder = async (req: Request, res: Response) => {
  try {
    const user = await getCurrentUserAsync(req);
    if (!user || (user.role !== "technician" && user.role !== "admin")) {
      return sendError(res, "دسترسی غیرمجاز. فقط تکنسین یا مدیر مجاز است.", 403, 403);
    }

    const targetId = req.params.id || req.body.order_id || req.body.orderId || req.body.id;
    if (!targetId) {
      return sendError(res, "شناسه سفارش الزامی است.", 400, 400);
    }

    const order = await OrderRepository.findById(targetId);
    if (!order) {
      return sendError(res, "سفارش مورد نظر یافت نشد.", 404, 404);
    }

    // Ownership check for technician
    if (user.role === "technician" && order.technician_id && String(order.technician_id) !== String(user.id)) {
      return sendError(res, "شما مالک این سفارش نیستید و اجازه تغییر وضعیت آن را ندارید.", 403, 403);
    }

    const { status, report, note, amount } = req.body;
    const updates: any = {};

    if (status) updates.status = status;
    const noteText = note || report || "";
    if (noteText) updates.report = noteText;
    if (amount !== undefined) updates.amount = parseFloat(amount);

    // Auto-assign technician if unassigned
    if (user.role === "technician" && (!order.technician_id || order.technician_id === "")) {
      updates.technician_id = user.id;
    }

    // Record status history change explicitly with updated_by user identifier
    const updaterIdentifier = user.full_name || user.phone || user.id;
    updates.updated_by = updaterIdentifier;
    updates.updatedBy = updaterIdentifier;
    updates.note = noteText || `تغییر وضعیت به ${status || order.status}`;

    const updatedOrder = await OrderRepository.update(targetId, updates);

    // Record activity log
    await logActivity(user.id, "تغییر وضعیت سفارش", req, `سفارش: ${targetId} -> وضعیت جدید: ${status || order.status}`);

    return sendSuccess(res, { order: updatedOrder }, {
      message: "وضعیت سفارش با موفقیت بروزرسانی شد.",
      order: updatedOrder
    });
  } catch (err: any) {
    console.error("Error updating order status:", err);
    return sendError(res, "خطا در بروزرسانی وضعیت: " + err.message, 500, 500);
  }
};

router.patch("/:id", handleUpdateOrder);
router.post("/update-status", handleUpdateOrder);

export { handleCreateOrder, handleListOrders, handleGetOrder, handleUpdateOrder };
export default router;
