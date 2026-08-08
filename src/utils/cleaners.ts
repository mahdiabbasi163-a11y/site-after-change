import { ErrorCode, RepairOrder, Technician, SparePart, CommonProblem } from '../types';

export const cleanModelsList = (list: string[]): string[] => {
  if (!Array.isArray(list)) return [];
  const debris = [
    "تیکه", "دو", "اری", "sh", "ch", "g", "t-1", "undefined", "null", "بانه", "ای",
    "و", "یا", "مدل", "عمومی", "کد", "دستگاه", "سایر", "دیواری", "ایستاده", "اسپلیت",
    "پکیج", "کولر", "گازی", "کاستی", "کانالی", "سقفی", "زمینی", "پنجره", "پنجره ای",
    "اینورتر", "inverter", "floor", "stand"
  ];
  return list
    .map(m => String(m || "").trim())
    .filter(m => {
      if (!m || m.length <= 1) return false;
      if (/^\d+$/.test(m)) return false;
      if (debris.includes(m.toLowerCase())) return false;
      return true;
    })
    .filter((value, index, self) => self.indexOf(value) === index);
};

export const cleanCitiesList = (list: any): { name: string; regions: string[] }[] => {
  if (!Array.isArray(list)) return [];
  return list.map(item => {
    if (typeof item === 'string') {
      return { name: item.trim(), regions: [] };
    }
    if (item && typeof item === 'object') {
      return {
        name: String(item.name || '').trim(),
        regions: Array.isArray(item.regions) ? item.regions.map((r: any) => String(r || '').trim()).filter(Boolean) : []
      };
    }
    return null;
  }).filter((c): c is { name: string; regions: string[] } => !!c && !!c.name);
};

export const cleanErrorCodesList = (list: any): ErrorCode[] => {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const cleaned: ErrorCode[] = [];
  for (const item of list) {
    if (item && typeof item === 'object' && item.id) {
      const idStr = String(item.id).trim();
      if (!seen.has(idStr)) {
        seen.add(idStr);
        cleaned.push(item as ErrorCode);
      }
    }
  }
  return cleaned;
};

export const cleanCommonProblemsList = (list: any): CommonProblem[] => {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const cleaned: CommonProblem[] = [];
  for (const item of list) {
    if (item && typeof item === 'object' && item.id) {
      const idStr = String(item.id).trim();
      if (!seen.has(idStr)) {
        seen.add(idStr);
        cleaned.push(item as CommonProblem);
      }
    }
  }
  return cleaned;
};

export const cleanTechniciansList = (list: any): Technician[] => {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const cleaned: Technician[] = [];
  for (const item of list) {
    if (item && typeof item === 'object' && item.id) {
      const idStr = String(item.id).trim();
      if (!seen.has(idStr)) {
        seen.add(idStr);
        cleaned.push(item as Technician);
      }
    }
  }
  return cleaned;
};

export const cleanOrdersList = (list: any): RepairOrder[] => {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const cleaned: RepairOrder[] = [];
  for (const item of list) {
    if (item && typeof item === 'object' && item.id) {
      const idStr = String(item.id).trim();
      if (!seen.has(idStr)) {
        seen.add(idStr);
        cleaned.push(item as RepairOrder);
      }
    }
  }
  return cleaned;
};

export const cleanSparePartsList = (list: any): SparePart[] => {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const cleaned: SparePart[] = [];
  for (const item of list) {
    if (item && typeof item === 'object' && item.id) {
      const idStr = String(item.id).trim();
      if (!seen.has(idStr)) {
        seen.add(idStr);
        cleaned.push(item as SparePart);
      }
    }
  }
  return cleaned;
};
