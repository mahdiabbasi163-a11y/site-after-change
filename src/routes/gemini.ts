import { Router } from "express";
import { SparePartRepository } from "../repositories";
import { parseRobustJson, generateContentWithFallback, generateLocalPartsRecommendation, generateLocalDiagnose } from "../services/gemini";

const router = Router();

// POST /api/gemini/suggest-parts
router.post("/suggest-parts", async (req, res) => {
  try {
    const { errorCode, availableParts } = req.body;
    if (!errorCode || !availableParts || !Array.isArray(availableParts)) {
      return res.status(400).json({ error: "الگوی کدهای خطا یا لیست قطعات موجود ناقص است." });
    }

    let isQuotaHit = false;
    try {
      const partsSummary = availableParts.map((p: any) => `[ID: ${p.id}] ${p.name || p.title} - دسته: ${p.category} - برند: ${p.brand}`).join("\n");
      const prompt = `شما یک دستیار هوشمند و متخصص ارشد تعمیرات لوازم خانگی هستید.
با توجه به مشخصات کد خطای زیر، مناسب‌ترین قطعه یا قطعات یدکی را از میان "لیست قطعات موجود در فروشگاه" پیشنهاد دهید.

کد خطا: ${errorCode.code}
برند: ${errorCode.brand}
دستگاه: ${errorCode.category}
عنوان خطا: ${errorCode.title}
توضیحات: ${errorCode.description}
علل احتمالی: ${(errorCode.causes || []).join("، ")}

لیست قطعات موجود در فروشگاه:
${partsSummary}

لطفا خروجی را دقیقاً به فرمت JSON زیر بدون هیچ متن اضافی برگردانید:
{
  "recommendedPartIds": ["ID قطعه 1", "ID قطعه 2"],
  "aiReason": "توضیحات تحلیلی کوتاه دلایل پیشنهاد قطعات",
  "additionalFittings": ["نکته فنی 1", "نکته فنی 2"]
}`;

      const response = await generateContentWithFallback({
        contents: prompt
      });

      if (response && response.text) {
        const parsed = parseRobustJson(response.text);
        return res.json(parsed);
      }
    } catch (err: any) {
      console.warn("[Gemini Parts API] Fallback activated due to API limits:", err.message);
      isQuotaHit = true;
    }

    if (isQuotaHit) {
      const localResult = generateLocalPartsRecommendation(errorCode, availableParts);
      return res.json(localResult);
    }

    return res.status(500).json({ error: "خطا در پردازش هوش مصنوعی" });
  } catch (err: any) {
    console.error("Error in suggest-parts endpoint:", err);
    const dbParts = await SparePartRepository.findAll();
    const fallbackParts = generateLocalPartsRecommendation(req.body.errorCode || {}, req.body.availableParts || dbParts);
    return res.json(fallbackParts);
  }
});

// POST /api/gemini/diagnose
router.post("/diagnose", async (req, res) => {
  try {
    const { query, brand, model, category } = req.body;
    if (!query) {
      return res.status(400).json({ error: "شرح مشکل یا کد خطا الزامی است." });
    }

    let isQuotaHit = false;
    try {
      const prompt = `شما یک تعمیرکار ارشد و هوش مصنوعی متخصص عیب‌یابی لوازم خانگی هستید.
بر اساس اطلاعات زیر:
- مشکل/کد خطا: ${query}
- برند: ${brand || "نامشخص"}
- مدل: ${model || "نامشخص"}
- دسته دستگاه: ${category || "نامشخص"}

لطفاً عیب‌یابی دقیق انجام داده و خروجی را دقیقاً به فرمت JSON زیر ارسال نمایید:
{
  "causes": ["علت 1", "علت 2", "علت 3"],
  "likely_part": "نام قطعه احتمالی معیوب",
  "risk_level": "پایین / متوسط / بالا / بحرانی",
  "diy_possible": "آیا کاربر خودش می‌تواند تعمیر کند؟ توضیحات کوتاه",
  "repair_time": "زمان تقریبی تعمیر",
  "technician_required": true/false,
  "detailed_analysis": "تحلیل تخصصی کامل و قدم به قدم جهت برطرف نمودن مشکل"
}`;

      const response = await generateContentWithFallback({
        contents: prompt
      });

      if (response && response.text) {
        const parsed = parseRobustJson(response.text);
        return res.json(parsed);
      }
    } catch (err: any) {
      console.warn("[Gemini Diagnose API] Fallback activated:", err.message);
      isQuotaHit = true;
    }

    if (isQuotaHit) {
      const localDiagnose = generateLocalDiagnose(query, brand, model, category);
      return res.json(localDiagnose);
    }

    return res.status(500).json({ error: "خطا در پردازش تحلیل هوشمند" });
  } catch (err: any) {
    console.error("Error in diagnose endpoint:", err);
    const fallback = generateLocalDiagnose(req.body.query || "", req.body.brand || "", req.body.model || "", req.body.category || "");
    return res.json(fallback);
  }
});

export default router;
