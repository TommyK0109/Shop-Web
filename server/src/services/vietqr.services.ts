import { randomBytes } from "node:crypto";
import QRCode from "qrcode";

// Builds the payment QR a buyer scans at checkout.

/** Napas identifier for the VietQR "transfer to account number" service. */
const VIETQR_GUID = "A000000727";
const SERVICE_ACCOUNT_TRANSFER = "QRIBFTTA";

/**
 * The subset of Napas member banks this demo provisions accounts at, by their
 * 6-digit BIN. Real BINs, so a scanned QR resolves to a real bank; the
 * account numbers paired with them are synthetic.
 */
export const DEMO_BANKS = [
  { bin: "970436", name: "Vietcombank" },
  { bin: "970418", name: "BIDV" },
  { bin: "970405", name: "Agribank" },
  { bin: "970415", name: "VietinBank" },
  { bin: "970422", name: "MB Bank" },
  { bin: "970407", name: "Techcombank" },
  { bin: "970423", name: "TPBank" },
  { bin: "970432", name: "VPBank" },
  { bin: "970403", name: "Sacombank" },
  { bin: "970416", name: "ACB" },
] as const;

/**
 * One TLV triple: 2-digit tag, 2-digit length, value. Length is the character
 * count, which is why every value here has to be ASCII — a multi-byte
 * character would make the declared length disagree with what a scanner
 * counts.
 */
function tlv(tag: string, value: string): string {
  return `${tag}${String(value.length).padStart(2, "0")}${value}`;
}

/**
 * CRC-16/CCITT-FALSE: polynomial 0x1021, initial value 0xFFFF, no reflection,
 * no final XOR. Computed over the whole payload *including* the "6304" tag
 * and length of the checksum field itself, which is why that prefix is
 * appended before this runs.
 */
function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Strips a string down to what an EMVCo field may hold: printable ASCII only,
 * upper-cased, with Vietnamese diacritics folded to their base letters rather
 * than dropped, so "Cửa Hàng Số" stays readable as "CUA HANG SO".
 */
function toAsciiField(value: string, maxLength: number): string {
  return value
    .normalize("NFD")
    // The accents NFD just split off. Written as a property escape rather
    // than a literal range so this line survives any editor or pipeline that
    // is careless with combining characters.
    .replace(/\p{Diacritic}/gu, "")
    // U+0111/U+0110 (d-with-stroke) carry no combining mark, so NFD leaves
    // them intact and the fold above misses them.
    .replace(/[đĐ]/g, "D")
    .replace(/[^\x20-\x7E]/g, "")
    .trim()
    .toUpperCase()
    .slice(0, maxLength);
}

export interface VietQrParams {
  bankBin: string;
  accountNumber: string;
  /** Whole VND. EMVCo tag 54 is decimal, but VND has no sub-unit. */
  amountVnd: number;
  /** Goes in the transfer description so the seller can match it to an order. */
  reference: string;
}

/**
 * The string the QR image encodes. Deterministic: the same inputs always
 * produce the same payload, which is what lets a Payment row regenerate the
 * buyer's original QR from its frozen snapshot instead of storing it.
 */
export function buildVietQrPayload({ bankBin, accountNumber, amountVnd, reference }: VietQrParams): string {
  // Tag 38: the merchant account, itself a nested TLV block.
  const beneficiary = tlv("00", VIETQR_GUID) + tlv("01", tlv("00", bankBin) + tlv("01", accountNumber));
  const merchantAccount = tlv("38", beneficiary + tlv("02", SERVICE_ACCOUNT_TRANSFER));

  const payload =
    tlv("00", "01") + // payload format indicator
    // 12 = dynamic QR: it carries an amount and is good for one payment, as
    // opposed to 11, a reusable static one.
    tlv("01", "12") +
    merchantAccount +
    tlv("52", "0000") + // merchant category code: unspecified
    tlv("53", "704") + // ISO 4217 numeric for VND
    tlv("54", String(Math.round(amountVnd))) +
    tlv("58", "VN") +
    // Tag 62 -> 08: the free-text transfer description.
    tlv("62", tlv("08", toAsciiField(reference, 25)));

  const withCrcTag = `${payload}6304`;
  return withCrcTag + crc16(withCrcTag);
}

/** Renders a payload as an inline SVG, safe to drop straight into HTML. */
export function renderQrSvg(payload: string): Promise<string> {
  return QRCode.toString(payload, {
    type: "svg",
    margin: 1,
    // Bank apps scan in poor light off a phone screen; M trades ~15% of the
    // capacity for recoverable damage, which is the usual choice for payment
    // QRs.
    errorCorrectionLevel: "M",
  });
}

/**
 * The code the buyer types into the transfer description and the seller looks
 * for on their bank statement. Short enough to read off a screen, random
 * enough not to collide — the DB holds a unique index on it as the real
 * guarantee.
 */
export function generatePaymentReference(): string {
  return `SF-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/**
 * Mock bank details for a new store. "The seller supplies the payment method"
 * is the model; provisioning it automatically at application time is what
 * keeps a store from being approved with no way to receive money.
 */
export function generateDemoPaymentMethod(businessName: string): {
  bankBin: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
} {
  const bank = DEMO_BANKS[Math.floor(Math.random() * DEMO_BANKS.length)];
  return {
    bankBin: bank.bin,
    bankName: bank.name,
    // 10 digits, the common length for a Vietnamese personal account.
    accountNumber: String(Math.floor(Math.random() * 1e10)).padStart(10, "0"),
    accountName: toAsciiField(businessName, 50) || "STOREFRONT SELLER",
  };
}
