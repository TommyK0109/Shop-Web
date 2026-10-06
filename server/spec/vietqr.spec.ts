import { describe, expect, it } from "vitest";
import {
  buildVietQrPayload,
  generateDemoPaymentMethod,
  generatePaymentReference,
  renderQrSvg,
} from "../src/services/vietqr.services";

/**
 * Walks a payload back into its tag/value pairs the way a scanner does. This
 * is deliberately a second, independent implementation of the parse — asserting
 * on a hard-coded golden string would only prove the encoder still does what it
 * did yesterday, not that it produces something readable.
 */
function parseTlv(input: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < input.length) {
    const tag = input.slice(i, i + 2);
    const length = Number.parseInt(input.slice(i + 2, i + 4), 10);
    out[tag] = input.slice(i + 4, i + 4 + length);
    i += 4 + length;
  }
  return out;
}

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

const params = {
  bankBin: "970436",
  accountNumber: "1234567890",
  amountVnd: 250_000,
  reference: "SF-AB12CD34",
};

describe("buildVietQrPayload", () => {
  it("emits the EMVCo header fields a scanner reads first", () => {
    const top = parseTlv(buildVietQrPayload(params));

    expect(top["00"]).toBe("01"); // payload format indicator
    expect(top["01"]).toBe("12"); // dynamic: carries an amount, single use
    expect(top["53"]).toBe("704"); // ISO 4217 numeric for VND
    expect(top["54"]).toBe("250000");
    expect(top["58"]).toBe("VN");
  });

  it("nests the bank and account under the Napas VietQR GUID", () => {
    const top = parseTlv(buildVietQrPayload(params));
    const account = parseTlv(top["38"]);

    expect(account["00"]).toBe("A000000727");
    expect(account["02"]).toBe("QRIBFTTA"); // transfer-to-account service

    const beneficiary = parseTlv(account["01"]);
    expect(beneficiary["00"]).toBe("970436");
    expect(beneficiary["01"]).toBe("1234567890");
  });

  it("carries the payment reference as the transfer description", () => {
    const top = parseTlv(buildVietQrPayload(params));
    expect(parseTlv(top["62"])["08"]).toBe("SF-AB12CD34");
  });

  it("closes with a CRC-16/CCITT-FALSE over the payload including the 6304 tag", () => {
    const payload = buildVietQrPayload(params);
    expect(crc16(payload.slice(0, -4))).toBe(payload.slice(-4));
  });

  it("declares a length for every field that matches the value it precedes", () => {
    // A wrong length is the one encoding bug a scanner cannot recover from,
    // and it only shows up on non-ASCII input — so assert the walk consumes
    // the payload exactly, with nothing left over.
    const payload = buildVietQrPayload({ ...params, reference: "Cua Hang So" });
    let i = 0;
    while (i < payload.length) {
      const length = Number.parseInt(payload.slice(i + 2, i + 4), 10);
      expect(Number.isNaN(length)).toBe(false);
      i += 4 + length;
    }
    expect(i).toBe(payload.length);
  });

  it("folds Vietnamese diacritics to ASCII rather than dropping the words", () => {
    // EMVCo lengths count characters, so a multi-byte name would otherwise
    // desynchronise the whole payload. Folding keeps the reference readable.
    const payload = buildVietQrPayload({ ...params, reference: "Cửa Hàng Số Đỏ" });
    expect(parseTlv(payload)["62"]).toContain("CUA HANG SO DO");
  });

  it("is deterministic, so a stored Payment can regenerate the buyer's QR", () => {
    // Payment rows freeze the bank details, amount and reference instead of
    // the payload string; that only works if these inputs fix the output.
    expect(buildVietQrPayload(params)).toBe(buildVietQrPayload(params));
  });
});

describe("renderQrSvg", () => {
  it("renders an inline SVG", async () => {
    const svg = await renderQrSvg(buildVietQrPayload(params));
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });
});

describe("generatePaymentReference", () => {
  it("produces a short, typable SF- code", () => {
    expect(generatePaymentReference()).toMatch(/^SF-[0-9A-F]{8}$/);
  });

  it("does not repeat across a realistic batch", () => {
    const refs = new Set(Array.from({ length: 1000 }, generatePaymentReference));
    expect(refs.size).toBe(1000);
  });
});

describe("generateDemoPaymentMethod", () => {
  it("provisions a real Napas BIN with a 10-digit account", () => {
    const method = generateDemoPaymentMethod("Cửa Hàng Đồ Điện Tử");
    expect(method.bankBin).toMatch(/^\d{6}$/);
    expect(method.bankName.length).toBeGreaterThan(0);
    expect(method.accountNumber).toMatch(/^\d{10}$/);
  });

  it("stores the account name as ASCII, since that is what tag 59 can hold", () => {
    expect(generateDemoPaymentMethod("Cửa Hàng Đồ Điện Tử").accountName).toBe("CUA HANG DO DIEN TU");
  });

  it("falls back to a placeholder when the name folds away to nothing", () => {
    expect(generateDemoPaymentMethod("日本語").accountName).toBe("STOREFRONT SELLER");
  });
});
