import { Router } from "express";
import { handleCreateOrder, handleListOrders, handleUpdateOrder } from "./orders";

const router = Router();

// Legacy aliases mapping to unified order handlers
router.post("/request", handleCreateOrder);
router.get("/requests", handleListOrders);
router.post("/update-status", handleUpdateOrder);
router.post("/update", handleUpdateOrder);

export default router;
