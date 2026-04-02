export const normalizePhoneToDigits = (value: string): string =>
  (value || "").replace(/\D/g, "");

export const buildWhatsAppUrl = (phone: string): string => {
  const digits = normalizePhoneToDigits(phone);
  if (!digits) return "";
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
};

