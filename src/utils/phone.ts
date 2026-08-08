/**
 * Phone number normalization utility for Iranian mobile numbers.
 * Converts Farsi/Arabic digits to English digits.
 * Removes country code (+98, 0098, 98) and formatting symbols.
 * Returns standard 11-digit format starting with 09 (e.g. 09123456789).
 */
export function normalizePhone(phoneInput: string): string {
  if (!phoneInput) return "";

  let phone = String(phoneInput).trim();

  // Convert Farsi and Arabic digits to English
  const farsiDigits = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
  const arabicDigits = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];

  for (let i = 0; i < 10; i++) {
    phone = phone.replace(farsiDigits[i], String(i)).replace(arabicDigits[i], String(i));
  }

  // Remove non-digit characters except leading +
  phone = phone.replace(/[^0-9+]/g, "");

  if (phone.startsWith("+98")) {
    phone = "0" + phone.substring(3);
  } else if (phone.startsWith("0098")) {
    phone = "0" + phone.substring(4);
  } else if (phone.startsWith("98") && phone.length === 12) {
    phone = "0" + phone.substring(2);
  }

  if (phone.length === 10 && phone.startsWith("9")) {
    phone = "0" + phone;
  }

  return phone;
}

export function isValidIranianMobile(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^09\d{9}$/.test(normalized);
}
