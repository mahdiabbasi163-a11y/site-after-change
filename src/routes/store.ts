import { Router } from "express";
import { getCurrentUserAsync, logActivity } from "../db/db";
import { SparePartRepository, PartOrderRepository } from "../repositories";
import { sendSuccess, sendError } from "../utils/response";

const router = Router();

// GET /api/spare-parts & /api/store/parts (Paginated)
const handleGetParts = async (req: any, res: any) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));

    const allParts = await SparePartRepository.findAll();
    const total = allParts.length;
    const startIndex = (page - 1) * limit;
    const paginatedParts = allParts.slice(startIndex, startIndex + limit);

    return sendSuccess(res, {
      parts: paginatedParts,
      spareParts: paginatedParts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    }, {
      spareParts: paginatedParts,
      parts: paginatedParts
    });
  } catch (err: any) {
    return sendError(res, err.message, 500, 500);
  }
};

router.get("/spare-parts", handleGetParts);
router.get("/store/parts", handleGetParts);
router.get("/parts", handleGetParts);

// POST /api/spare-parts (Admin create)
router.post("/spare-parts", async (req, res) => {
  try {
    const user = await getCurrentUserAsync(req);
    if (!user || user.role !== "admin") {
      return sendError(res, "فقط مدیر مجاز است.", 403, 403);
    }

    const { name, title, category, brand, model, price, stock, description, image, image_url } = req.body;
    const partTitle = name || title;
    if (!partTitle || price === undefined) {
      return sendError(res, "نام قطعه و قیمت الزامی است.", 400, 400);
    }

    const newPart = await SparePartRepository.create({
      title: partTitle,
      category: category || "قطعات عمومی",
      brand: brand || "عمومی",
      model: model || "",
      price: parseFloat(price) || 0,
      stock: parseInt(stock) || 0,
      description: description || "",
      image_url: image || image_url || ""
    });

    return sendSuccess(res, { part: newPart }, {
      message: "قطعه جدید با موفقیت اضافه شد.",
      part: newPart
    });
  } catch (err: any) {
    return sendError(res, err.message, 500, 500);
  }
});

// PUT /api/spare-parts/:id (Admin update)
router.put("/spare-parts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await getCurrentUserAsync(req);
    if (!user || user.role !== "admin") {
      return sendError(res, "فقط مدیر مجاز است.", 403, 403);
    }

    const existing = await SparePartRepository.findById(id);
    if (!existing) {
      return sendError(res, "قطعه یافت نشد.", 404, 404);
    }

    const updated = await SparePartRepository.update(id, req.body);

    return sendSuccess(res, { part: updated }, {
      message: "قطعه با موفقیت بروزرسانی شد.",
      part: updated
    });
  } catch (err: any) {
    return sendError(res, err.message, 500, 500);
  }
});

// DELETE /api/spare-parts/:id (Admin delete)
router.delete("/spare-parts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await getCurrentUserAsync(req);
    if (!user || user.role !== "admin") {
      return sendError(res, "فقط مدیر مجاز است.", 403, 403);
    }

    await SparePartRepository.deleteById(id);

    return sendSuccess(res, { message: "قطعه با موفقیت حذف شد." }, { message: "قطعه با موفقیت حذف شد." });
  } catch (err: any) {
    return sendError(res, err.message, 500, 500);
  }
});

// 5) POST /api/store/purchase & /api/store/parts/order
const handlePurchaseOrder = async (req: any, res: any) => {
  try {
    const user = await getCurrentUserAsync(req);
    const userId = user ? user.id : (req.body.user_id || "guest");

    const partId = (req.body.part_id || req.body.partId || req.body.id || req.body.spare_part_id || "").trim();
    const qty = parseInt(req.body.quantity || req.body.qty || req.body.count || 1);
    const unitPrice = parseFloat(req.body.unit_price || req.body.price || 0);
    const totalPrice = parseFloat(req.body.total_price || req.body.totalPrice || (unitPrice * qty));

    if (!partId) {
      return sendError(res, "شناسه قطعه الزامی است.", 400, 400);
    }

    const result = await PartOrderRepository.createPartPurchaseTransaction({
      userId,
      partId,
      quantity: qty,
      totalPrice,
      paymentMethod: req.body.gateway || req.body.payment_method || "card_to_card"
    });

    if (user) {
      await logActivity(user.id, "store_purchase", req, `خرید از فروشگاه: قطعه ${partId} (تعداد: ${qty})`);
    }

    return sendSuccess(res, {
      order_id: result.partOrder.id,
      partOrder: result.partOrder,
      order: result.partOrder
    }, {
      message: "سفارش شما با موفقیت ثبت شد و در انتظار تایید ادمین است.",
      order_id: result.partOrder.id,
      partOrder: result.partOrder,
      order: result.partOrder
    });
  } catch (err: any) {
    console.error("Error creating store order:", err);
    return sendError(res, "خطا در ثبت سفارش: " + err.message, 500, 500);
  }
};

router.post("/store/purchase", handlePurchaseOrder);
router.post("/store/parts/order", handlePurchaseOrder);
router.post("/purchase", handlePurchaseOrder);
router.post("/parts/order", handlePurchaseOrder);

// 6) GET /api/store/my-orders
const handleMyStoreOrders = async (req: any, res: any) => {
  try {
    const user = await getCurrentUserAsync(req);
    if (!user) {
      return sendSuccess(res, { orders: [], partOrders: [] }, { orders: [], partOrders: [] });
    }

    const orders = await PartOrderRepository.findByUserId(user.id);
    return sendSuccess(res, { orders, partOrders: orders }, { orders, partOrders: orders });
  } catch (err: any) {
    return sendSuccess(res, { orders: [], partOrders: [] }, { orders: [], partOrders: [] });
  }
};

router.get("/store/my-orders", handleMyStoreOrders);
router.get("/my-orders", handleMyStoreOrders);
router.get("/store/orders/my-orders", handleMyStoreOrders);

// GET /api/store/orders (Admin)
router.get("/orders", async (req, res) => {
  try {
    const user = await getCurrentUserAsync(req);
    if (!user || user.role !== "admin") {
      return sendError(res, "فقط مدیر دسترسی دارد.", 403, 403);
    }
    const orders = await PartOrderRepository.findAll();
    return sendSuccess(res, { orders }, { orders });
  } catch (err: any) {
    return sendError(res, err.message, 500, 500);
  }
});

// POST /api/store/update-order (Admin)
router.post("/update-order", async (req, res) => {
  try {
    const user = await getCurrentUserAsync(req);
    if (!user || user.role !== "admin") {
      return sendError(res, "فقط مدیر دسترسی دارد.", 403, 403);
    }

    const { order_id, status } = req.body;
    if (!order_id || !["pending", "confirmed", "shipped", "delivered", "cancelled"].includes(status)) {
      return sendError(res, "شناسه سفارش یا وضعیت نامعتبر است.", 400, 400);
    }

    await PartOrderRepository.updateStatusTransaction(order_id, status);

    return sendSuccess(res, { message: "وضعیت سفارش بروزرسانی شد." }, { message: "وضعیت سفارش بروزرسانی شد." });
  } catch (err: any) {
    return sendError(res, err.message, 500, 500);
  }
});

export default router;
