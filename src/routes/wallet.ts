import { Router } from "express";
import { getCurrentUserAsync, logActivity } from "../db/db";
import { UserRepository, WalletTransactionRepository } from "../repositories";

const router = Router();

// GET /api/wallet/transactions
router.get("/wallet/transactions", async (req, res) => {
  try {
    const user = await getCurrentUserAsync(req);
    if (!user) {
      return res.status(401).json({ status: "error", error: "احراز هویت نشده است." });
    }

    const txs = await WalletTransactionRepository.findByUserId(user.id);
    return res.json({ status: "ok", balance: user.wallet_balance || 0, transactions: txs });
  } catch (err: any) {
    return res.status(500).json({ status: "error", error: err.message });
  }
});

// POST /api/wallet/charge (Uses Atomic Transaction)
router.post("/wallet/charge", async (req, res) => {
  try {
    const user = await getCurrentUserAsync(req);
    if (!user) {
      return res.status(401).json({ status: "error", error: "احراز هویت نشده است." });
    }

    const amount = parseFloat(req.body.amount || 0);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ status: "error", error: "مبلغ شارژ نامعتبر است." });
    }

    const newBalance = await UserRepository.addWalletBalanceTransaction(user.id, amount, "شارژ کیف پول");

    await logActivity(user.id, "شارژ کیف پول", req, `مبلغ: ${amount} تومان`);

    return res.json({
      status: "ok",
      message: "کیف پول شما با موفقیت شارژ شد.",
      new_balance: newBalance
    });
  } catch (err: any) {
    return res.status(500).json({ status: "error", error: err.message });
  }
});

// GET /api/referral/stats
router.get("/referral/stats", async (req, res) => {
  try {
    const user = await getCurrentUserAsync(req);
    if (!user) {
      return res.status(401).json({ status: "error", error: "احراز هویت نشده است." });
    }

    const referralCode = user.referral_code || `REF-${(user.phone || "").substring(7)}`;
    const allUsers = await UserRepository.findAll();
    const referredUsers = allUsers.filter((u: any) => u.referred_by === referralCode);
    const totalBonus = referredUsers.length * 50000;

    return res.json({
      status: "ok",
      referral_code: referralCode,
      referred_count: referredUsers.length,
      total_bonus: totalBonus
    });
  } catch (err: any) {
    return res.status(500).json({ status: "error", error: err.message });
  }
});

export default router;
