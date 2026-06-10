import React, { useState, useEffect, useRef, useMemo } from "react";

const now = new Date();
const TODAY_DATE = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const CURRENT_MONTH = TODAY_DATE.slice(0, 7);

// Qtydwarn ahead ກ່ອນProductExpired (ປັບໄດ້ໃນໜ້າຕັ້ງຄ່າ)
const DEFAULT_EXPIRY_WARN_DAYS = 60;

// ນັບQtydຈາກdນີ້ ຫາExpiry (ຕິດລົບ = Expiredແລ້ວ)
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(TODAY_DATE + "T00:00:00");
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

// StatusExpired: expired / soon / ok
function expiryStatus(dateStr, warnDays = DEFAULT_EXPIRY_WARN_DAYS) {
  const d = daysUntil(dateStr);
  if (d === null) return { level: "none", days: null };
  if (d < 0) return { level: "expired", days: d };
  if (d <= warnDays) return { level: "soon", days: d };
  return { level: "ok", days: d };
}

// ລວມQtyຄົງleft (ນັບແຕ່ລັອດທີ່ status = ok, ບໍ່ນັບ returned)
function totalStock(p) {
  if (!p.batches) return 0;
  return p.batches.filter(b => b.status !== "returned").reduce((s, b) => s + (b.qty || 0), 0);
}

// ລັອດທີ່Expiredໃກ້ສຸດ — ໃຊ້ສະແດງ badge ເຕືອນExpired (ບໍ່ກ່ຽວກັບການຫັກຂາຍ)
function earliestBatch(p) {
  if (!p.batches) return null;
  const active = p.batches.filter(b => b.status !== "returned" && b.qty > 0);
  if (active.length === 0) return null;
  return active.slice().sort((a, b) => {
    const da = daysUntil(a.expiry), db = daysUntil(b.expiry);
    if (da === null) return 1; if (db === null) return -1;
    return da - db;
  })[0];
}

// StatusStock: out / low / ok
function stockStatus(p) {
  const s = totalStock(p);
  const low = p.lowStock ?? 0;
  if (s <= 0) return "out";
  if (s <= low) return "low";
  return "ok";
}

// ຫັກStockແບບ FIFO: ຫັກລັອດທີ່ "ເຂົ້າມາກ່ອນ" (ເກົ່າສຸດ) ກ່ອນ
// ລຳດັບໃນ array batches ຄືລຳດັບການຮັບເຂົ້າ (ເກົ່າ → ໃໝ່)
function deductFIFO(batches, qty) {
  let remaining = qty;
  const result = batches.map(b => {
    if (remaining <= 0 || b.status === "returned") return b;
    const take = Math.min(b.qty, remaining);
    remaining -= take;
    return { ...b, qty: b.qty - take };
  });
  return result.filter(b => b.qty > 0 || b.status === "returned");
}

// ຄຳນວນDateລ່ວງໜ້າ (ໃຊ້ສ້າງຂໍ້ມູນຕົວຢ່າງ)
function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const INITIAL_MINIMART_PRODUCTS = [
  { id: 101, barcode: "88501234", name: "Coca Cola 325ml", price: 7000, cost: 5000, lowStock: 12, category: "Drinks", image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=200&h=200&fit=crop",
    batches: [ { id: "b1", qty: 48, expiry: dateOffset(120), status: "ok" } ] },
  { id: 102, barcode: "88505678", name: "Lays Potato Chips", price: 12000, cost: 9000, lowStock: 10, category: "Snacks", image: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=200&h=200&fit=crop",
    batches: [ { id: "b2", qty: 6, expiry: dateOffset(20), status: "ok" } ] },
  { id: 103, barcode: "88509999", name: "Drinking Water 600ml", price: 5000, cost: 3000, lowStock: 24, category: "Drinks", image: "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=200&h=200&fit=crop",
    batches: [] },
  { id: 104, barcode: "88502222", name: "Fresh Milk 1L", price: 18000, cost: 14000, lowStock: 8, category: "Drinks", image: "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=200&h=200&fit=crop",
    batches: [ { id: "b3", qty: 8, expiry: dateOffset(5), status: "ok" }, { id: "b4", qty: 10, expiry: dateOffset(40), status: "ok" } ] },
];

const INITIAL_USERS = [
  { id: 1, name: "Admin Manager", username: "admin", password: "123456", role: "admin", active: true },
  { id: 2, name: "Ben Kham", username: "ben", password: "1111", role: "cashier", active: true },
];

const MINIMART_CATEGORIES = ["All", "Drinks", "Snacks", "Foods", "Others"];

// ===== ຄຳແປໃບບິນ 6 ພາສາ (ໃຊ້ໃນ ReceiptView ເລືອກພາສາພິມ) =====
const RECEIPT_LANG = {
  lo: { name: "ລາວ", billNo: "ເລກບິນ", date: "ວັນທີ", time: "ເວລາ", cashier: "ພະນັກງານ", currency: "ສະກຸນເງິນ", item: "ລາຍການ", qty: "ຈຳນວນ", subtotal: "ມູນຄ່າສິນຄ້າ", vat: "ອາກອນມູນຄ່າເພີ່ມ VAT 10%", total: "ລວມທັງໝົດ TOTAL", pay: "ຈ່າຍດ້ວຍ", cash: "ເງິນສົດ", transfer: "ໂອນ", card: "ບັດ", split: "ໂອນ+ເງິນສົດ", received: "ຮັບເງິນ", change: "ເງິນທອນ", copy: "*** ສຳເນົາ ***", footer: "ສິນຄ້ານີ້ຊື້ໄປແລ້ວ ບໍ່ສາມາດປ່ຽນ ຫຼື ສົ່ງຄືນໄດ້", thanks: "ຂອບໃຈທີ່ໃຊ້ບໍລິການ" },
  th: { name: "ไทย", billNo: "เลขที่บิล", date: "วันที่", time: "เวลา", cashier: "พนักงาน", currency: "สกุลเงิน", item: "รายการ", qty: "จำนวน", subtotal: "มูลค่าสินค้า", vat: "ภาษีมูลค่าเพิ่ม VAT 10%", total: "รวมทั้งหมด TOTAL", pay: "ชำระโดย", cash: "เงินสด", transfer: "โอน", card: "บัตร", split: "โอน+เงินสด", received: "รับเงิน", change: "เงินทอน", copy: "*** สำเนา ***", footer: "สินค้าที่ซื้อแล้ว ไม่สามารถเปลี่ยนหรือคืนได้", thanks: "ขอบคุณที่ใช้บริการ" },
  zh: { name: "中文", billNo: "单号", date: "日期", time: "时间", cashier: "收银员", currency: "货币", item: "商品", qty: "数量", subtotal: "小计", vat: "增值税 VAT 10%", total: "总计 TOTAL", pay: "支付方式", cash: "现金", transfer: "转账", card: "刷卡", split: "转账+现金", received: "收款", change: "找零", copy: "*** 副本 ***", footer: "商品售出后，恕不退换", thanks: "谢谢惠顾" },
  en: { name: "English", billNo: "Bill No", date: "Date", time: "Time", cashier: "Cashier", currency: "Currency", item: "Item", qty: "Qty", subtotal: "Subtotal", vat: "VAT 10%", total: "TOTAL", pay: "Paid by", cash: "Cash", transfer: "Transfer", card: "Card", split: "Transfer+Cash", received: "Received", change: "Change", copy: "*** COPY ***", footer: "Goods sold are not returnable or exchangeable", thanks: "Thank you" },
  ko: { name: "한국어", billNo: "영수증 번호", date: "날짜", time: "시간", cashier: "직원", currency: "통화", item: "품목", qty: "수량", subtotal: "소계", vat: "부가세 VAT 10%", total: "합계 TOTAL", pay: "결제수단", cash: "현금", transfer: "계좌이체", card: "카드", split: "이체+현금", received: "받은 금액", change: "거스름돈", copy: "*** 사본 ***", footer: "구매하신 상품은 교환 및 반품이 불가합니다", thanks: "감사합니다" },
  vi: { name: "Tiếng Việt", billNo: "Số hóa đơn", date: "Ngày", time: "Giờ", cashier: "Nhân viên", currency: "Tiền tệ", item: "Mặt hàng", qty: "SL", subtotal: "Tạm tính", vat: "Thuế GTGT VAT 10%", total: "TỔNG CỘNG", pay: "Thanh toán", cash: "Tiền mặt", transfer: "Chuyển khoản", card: "Thẻ", split: "CK+Tiền mặt", received: "Nhận", change: "Tiền thối", copy: "*** BẢN SAO ***", footer: "Hàng đã mua không thể đổi hoặc trả lại", thanks: "Cảm ơn quý khách" },
};
const RECEIPT_LANG_ORDER = ["lo", "th", "zh", "en", "ko", "vi"];

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=Dancing+Script:wght@700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sora', sans-serif; background: #faf7f5; color: #2b1d22; -webkit-font-smoothing: antialiased; }
  :root {
    --bg0: #faf7f5; --bg1: #ffffff; --bg2: #f5eef0; --bg3: #ebe0e4;
    --amber: #ee3a6b; --amber-dim: #c91d52; --amber-glow: rgba(238,58,107,0.10);
    --green: #16a34a; --red: #dc2626; --blue: #2563eb;
    --text1: #2b1d22; --text2: #6b5560; --text3: #a89098;
    --border: rgba(43,29,34,0.08); --border-amber: rgba(238,58,107,0.4);
    --mono: 'IBM Plex Mono', monospace;
    --script: 'Dancing Script', cursive;
    --coffee: #6b4423;
    --shadow: 0 4px 24px rgba(238,58,107,0.08);
    --shadow-card: 0 2px 12px rgba(43,29,34,0.06);
    --radius: 14px;
  }
  input, select, button { font-family: 'Sora', sans-serif; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--bg3); border-radius: 6px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--text3); }
  .img-avatar { border-radius: 12px; object-fit: cover; }
  button { transition: all 0.15s ease; }
  button:active { transform: scale(0.97); }
  input:focus, select:focus { outline: none; }
  input, select { color: var(--text1) !important; }

  .print-only { display: none; }
  @media print {
    @page { margin: 0; size: 80mm auto; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    /* reset ພື້ນຫຼັງເຂັ້ມຂອງທຸກ ancestor ໃຫ້ເປັນຂາວ */
    html, body, #root, #root * { background: #fff !important; background-color: #fff !important; height: auto !important; overflow: visible !important; }

    /* ເຊື່ອງທຸກ element (ແຕ່ບໍ່ເຊື່ອງ background ໂດຍໃຊ້ visibility) */
    body * { visibility: hidden !important; }

    /* ສະແດງສະເພາະພື້ນທີ່ພິມທີ່ active ພ້ອມບັງຄັບສີດຳ */
    body.printing-receipt #printable-receipt, body.printing-receipt #printable-receipt *,
    body.printing-labels #printable-labels, body.printing-labels #printable-labels *,
    body.printing-expiry #printable-expiry, body.printing-expiry #printable-expiry * {
      visibility: visible !important;
      color: #000 !important; background: #fff !important;
      box-shadow: none !important; text-shadow: none !important;
    }

    body.printing-receipt #printable-receipt {
      position: absolute; left: 0; top: 0; width: 72mm; box-sizing: border-box; margin: 0; padding: 2mm 2.5mm; border: none !important; font-size: 12px !important; line-height: 1.35 !important;
    }
    body.printing-labels #printable-labels {
      position: absolute; left: 0; top: 0; width: 100%;
      display: flex !important; flex-wrap: wrap !important; gap: 2mm !important; padding: 0;
    }
    body.printing-expiry #printable-expiry {
      position: absolute; left: 0; top: 0; width: 100%; padding: 0;
    }
    body.printing-expiry .print-only { display: block !important; }
    body.printing-expiry .print-status { display: inline !important; }

    .price-label { border: 0.5px solid #000 !important; break-inside: avoid; box-sizing: border-box !important; flex-shrink: 0 !important; }
    .expiry-table, .expiry-table > div { border-color: #000 !important; }
    .no-print { display: none !important; }
  }
`;

// --- NUMPAD ---
function Numpad({ value, onChange, withQuickAdd, exactAmount, onEnter, hideQuickAmounts }) {
  const append = (num) => { if (value === "0" && num !== "000") onChange(num); else onChange(value + num); };
  const backspace = () => onChange(value.slice(0, -1));
  const clear = () => onChange("");
  const addAmt = (amt) => onChange(String((parseInt(value || "0", 10)) + amt));
  const numBtnStyle = { background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px 0", color: "var(--text1)", fontSize: 18, fontWeight: 600, cursor: "pointer" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
      {withQuickAdd && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 4 }}>
          {!hideQuickAmounts && <>
          <button onClick={() => addAmt(20000)} style={{background:"var(--bg3)", color:"#fff", borderRadius:8, cursor:"pointer", border:"1px solid var(--border)"}}>+20k</button>
          <button onClick={() => addAmt(50000)} style={{background:"var(--bg3)", color:"#fff", borderRadius:8, cursor:"pointer", border:"1px solid var(--border)"}}>+50k</button>
          <button onClick={() => addAmt(100000)} style={{background:"var(--bg3)", color:"#fff", borderRadius:8, cursor:"pointer", border:"1px solid var(--border)"}}>+100k</button>
          </>}
          <button onClick={() => onChange(String(exactAmount))} style={{ background: "var(--amber)", color: "#000", border: "none", borderRadius:8, cursor:"pointer", gridColumn: hideQuickAmounts ? "1 / -1" : "auto", padding: hideQuickAmounts ? "12px 0" : 0, fontWeight: 700 }}>Exact</button>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(k => <button key={k} onClick={() => append(k)} style={numBtnStyle}>{k}</button>)}
        <button onClick={clear} style={{ ...numBtnStyle, color: "var(--red)" }}>C</button>
        <button onClick={() => append('0')} style={numBtnStyle}>0</button>
        {withQuickAdd
          ? <button onClick={() => append('000')} style={numBtnStyle}>000</button>
          : <button onClick={backspace} style={numBtnStyle}>⌫</button>
        }
      </div>
      {onEnter && !withQuickAdd && (
        <button onClick={onEnter} style={{ background: "var(--amber)", border: "none", borderRadius: 8, padding: "14px 0", color: "#1a0f00", fontSize: 16, fontWeight: 700, cursor: "pointer", marginTop: 4 }}>Sign In →</button>
      )}
    </div>
  );
}

// --- QWERTY KEYBOARD ---
function QwertyKeyboard({ value, onChange, onEnter }) {
  const [isCaps, setIsCaps] = useState(false);
  const append = (char) => onChange(value + (isCaps ? char.toUpperCase() : char));
  const backspace = () => onChange(value.slice(0, -1));
  const r1 = ['1','2','3','4','5','6','7','8','9','0'];
  const r2 = ['q','w','e','r','t','y','u','i','o','p'];
  const r3 = ['a','s','d','f','g','h','j','k','l'];
  const r4 = ['z','x','c','v','b','n','m'];
  const kStyle = { background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, padding: "14px 0", color: "var(--text1)", fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 6 }}>{r1.map(k => <button key={k} onClick={() => append(k)} style={kStyle}>{k}</button>)}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 6 }}>{r2.map(k => <button key={k} onClick={() => append(k)} style={kStyle}>{isCaps ? k.toUpperCase() : k}</button>)}</div>
      <div style={{ display: "flex", gap: 6, padding: "0 12px" }}>{r3.map(k => <button key={k} onClick={() => append(k)} style={{ ...kStyle, flex: 1 }}>{isCaps ? k.toUpperCase() : k}</button>)}</div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => setIsCaps(!isCaps)} style={{ ...kStyle, width: 48, background: isCaps ? "var(--amber)" : "var(--bg3)", color: isCaps ? "#000" : "var(--text1)" }}>⇧</button>
        {r4.map(k => <button key={k} onClick={() => append(k)} style={{ ...kStyle, flex: 1 }}>{isCaps ? k.toUpperCase() : k}</button>)}
        <button onClick={backspace} style={{ ...kStyle, width: 48, background: "var(--bg3)" }}>⌫</button>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => append(' ')} style={{ ...kStyle, flex: 2, background: "var(--bg3)", fontSize: 13 }}>Space</button>
        <button onClick={onEnter} style={{ ...kStyle, flex: 1, background: "var(--amber)", color: "#000", fontSize: 13 }}>Enter ↵</button>
      </div>
    </div>
  );
}

// --- TOPBAR ---
function Topbar({ user, view, setView, station, shopConfig, fbStatus, onLogout }) {
  const fbInfo = fbStatus === "online" ? { c: "var(--green)", t: "☁️ Synced" } : fbStatus === "offline" ? { c: "var(--text3)", t: "💾 Local" } : { c: "#d98324", t: "⏳ Connecting" };
  return (
    <div style={{ height: 56, background: "var(--bg1)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 20px", gap: 14, flexShrink: 0, boxShadow: "var(--shadow-card)" }}>
      {shopConfig?.logo
        ? <img src={shopConfig.logo} alt={shopConfig.name} style={{ height: 38, objectFit: "contain", marginRight: 4 }} onError={e => e.target.style.display = "none"} />
        : <div style={{ fontSize: 22, fontWeight: 700, color: "var(--amber)", fontFamily: "var(--script)", marginRight: 8 }}>{shopConfig?.name?.split(" ")[0] || "POS"}</div>
      }
      {station && <div style={{ background: "var(--amber-glow)", border: "1px solid var(--border-amber)", color: "var(--amber)", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 700 }}>🖥️ Station {station}</div>}
      {fbStatus && <div style={{ fontSize: 11, color: fbInfo.c, fontWeight: 600 }}>{fbInfo.t}</div>}
      <div style={{ flex: 1, display: "flex", gap: 6 }}>
        <button onClick={() => setView("pos")} style={{ background: view === "pos" ? "var(--amber-glow)" : "transparent", border: view === "pos" ? "1px solid var(--border-amber)" : "1px solid transparent", borderRadius: 8, padding: "6px 14px", fontSize: 13, color: view === "pos" ? "var(--amber)" : "var(--text2)", cursor: "pointer", fontWeight: view === "pos" ? 700 : 400 }}>🛒 POS</button>
        {user.role === "admin" && (
          <button onClick={() => setView("admin")} style={{ background: view === "admin" ? "var(--amber-glow)" : "transparent", border: view === "admin" ? "1px solid var(--border-amber)" : "1px solid transparent", borderRadius: 8, padding: "6px 14px", fontSize: 13, color: view === "admin" ? "var(--amber)" : "var(--text2)", cursor: "pointer", fontWeight: view === "admin" ? 700 : 400 }}>📊 Admin</button>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)" }}>{user.name}</div>
          <div style={{ fontSize: 11, color: "var(--text2)" }}>{user.role === "admin" ? "Manager" : "Staff"}</div>
        </div>
        <button onClick={onLogout} style={{ background: "rgba(224,90,90,0.1)", border: "1px solid rgba(224,90,90,0.3)", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "var(--red)", cursor: "pointer" }}>Log out</button>
      </div>
    </div>
  );
}

// --- LOGIN ---
function LoginScreen({ onLogin, error, station, setStation, shopConfig }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [focusedInput, setFocusedInput] = useState("username");
  const submit = () => onLogin(username, password);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg0)", flexDirection: "column", gap: 28, padding: 20 }}>
      <div style={{ textAlign: "center" }}>
        {shopConfig?.logo
          ? <img src={shopConfig.logo} alt={shopConfig.name} style={{ width: 140, height: 140, objectFit: "contain", marginBottom: 8 }} onError={e => e.target.style.display = "none"} />
          : <div style={{ fontSize: 44, fontWeight: 700, color: "var(--amber)", fontFamily: "var(--script)" }}>{shopConfig?.name || "POS"}</div>
        }
        <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 4, letterSpacing: 4, textTransform: "uppercase" }}>Point of Sale System</div>
      </div>
      <div style={{ display: "flex", gap: 24 }}>
        <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 16, padding: "36px 40px", width: 340 }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 24 }}>Staff Login</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--text2)", display: "block", marginBottom: 6 }}>This terminal is</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["1", "2"].map(s => (
                  <button key={s} onClick={() => setStation(s)} style={{ flex: 1, background: station === s ? "var(--amber-glow)" : "var(--bg2)", border: "1px solid " + (station === s ? "var(--border-amber)" : "var(--border)"), borderRadius: 8, padding: "10px", color: station === s ? "var(--amber)" : "var(--text2)", fontWeight: 700, cursor: "pointer" }}>🖥️ Station {s}</button>
                ))}
              </div>
            </div>
            <div onClick={() => setFocusedInput("username")}>
              <label style={{ fontSize: 12, color: "var(--text2)", display: "block", marginBottom: 6 }}>Username</label>
              <input value={username} onFocus={() => setFocusedInput("username")} onChange={() => {}} style={{ width: "100%", background: "var(--bg2)", border: focusedInput === "username" ? "1px solid var(--border-amber)" : "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", color: "var(--text1)", outline: "none" }} readOnly />
            </div>
            <div onClick={() => setFocusedInput("password")}>
              <label style={{ fontSize: 12, color: "var(--text2)", display: "block", marginBottom: 6 }}>Password (PIN)</label>
              <input type="password" value={password} onFocus={() => setFocusedInput("password")} onChange={() => {}} placeholder="••••••" style={{ width: "100%", background: "var(--bg2)", border: focusedInput === "password" ? "1px solid var(--border-amber)" : "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", color: "var(--amber)", fontSize: 20, letterSpacing: 4, outline: "none" }} readOnly />
            </div>
            {error && <div style={{ fontSize: 13, color: "var(--red)" }}>{error}</div>}
            <button onClick={submit} style={{ marginTop: 8, background: "var(--amber)", border: "none", borderRadius: 8, padding: "12px", color: "#1a0f00", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Sign In →</button>
          </div>
        </div>
        <div style={{ width: focusedInput === "username" ? 520 : 260, transition: "width 0.2s", overflow: "hidden" }}>
          <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px", height: "100%" }}>
            {focusedInput === "username"
              ? <QwertyKeyboard value={username} onChange={setUsername} onEnter={() => setFocusedInput("password")} />
              : <Numpad value={password} onChange={setPassword} onEnter={submit} />
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// --- CUSTOMER DISPLAY ---
function CustomerDisplayWindow({ syncData }) {
  const { cart = [], total = 0, shopConfig = {}, receipt = null, station = "" } = syncData || {};

  if (!shopConfig?.name) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f0f0f", color: "#aaa" }}>
      Waiting for system connection...
    </div>
  );

  if (receipt) {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0f0f0f" }}>
        <div style={{ width: 120, height: 120, borderRadius: "50%", background: "rgba(92,184,120,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 50, color: "#5cb878", marginBottom: 20 }}>✓</div>
        <div style={{ fontSize: 40, fontWeight: 700, color: "#fff", marginBottom: 10 }}>Payment Complete!</div>
        <div style={{ fontSize: 20, color: "#aaa" }}>Thank you for your purchase</div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div style={{ height: "100vh", background: "#0f0f0f", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ fontSize: 36, fontWeight: 700, color: "#e8a020" }}>{shopConfig.name}</div>
        <div style={{ fontSize: 20, color: "#aaa" }}>Welcome{station ? ` · Stn ${station}` : ""}</div>
        <div style={{ background: "#fff", padding: 16, borderRadius: 20, marginTop: 12 }}>
          <img src={shopConfig.qrImage} style={{ width: 200, height: 200, objectFit: "contain" }} alt="QR" />
        </div>
        <div style={{ fontSize: 16, color: "#888", fontFamily: "monospace" }}>{shopConfig.promptPay}</div>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", background: "#0f0f0f", display: "flex" }}>
      <div style={{ flex: 1, padding: "40px 50px", display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: "#e8a020", marginBottom: 20 }}>{shopConfig.name} - 🛒 Minimart</div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {cart.map(item => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: "1px solid #2f2f2a" }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <img src={item.image} style={{ width: 60, height: 60, borderRadius: 10, objectFit: "cover" }} alt={item.name} />
                <div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: "#fff" }}>{item.name}</div>
                  <div style={{ fontSize: 15, color: "#aaa", marginTop: 4 }}>₭{item.price.toLocaleString()} × {item.qty}</div>
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#e8a020" }}>₭{(item.price * item.qty).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ width: 440, background: "#1a1a18", padding: 40, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ fontSize: 18, color: "#aaa" }}>Total Due</div>
        <div style={{ fontSize: 50, fontWeight: 700, color: "#e8a020", fontFamily: "monospace", marginTop: 8, marginBottom: 30 }}>₭{(total || 0).toLocaleString()}</div>
        <div style={{ background: "#fff", padding: 16, borderRadius: 16, marginBottom: 20 }}>
          <img src={shopConfig.qrImage} style={{ width: 240, height: 240, objectFit: "contain" }} alt="QR Pay" />
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#5a9ee0" }}>Scan QR to Pay</div>
      </div>
    </div>
  );
}

// --- Standalone customer display (listens via BroadcastChannel)
function CustomerDisplayStandalone({ displayStation }) {
  const [syncData, setSyncData] = useState(null);
  useEffect(() => {
    let ch;
    try {
      ch = new BroadcastChannel("pos_customer_display");
      ch.onmessage = (e) => {
        // ຮັບສະເພາະຂໍ້ມູນຂອງStnທີ່ກົງກັນ (ຖ້າກຳນົດ)
        if (!displayStation || String(e.data?.station) === String(displayStation)) {
          setSyncData(e.data);
        }
      };
      // tell POS the display is ready → POS sends the latest data back
      ch.postMessage({ __hello: true, station: displayStation });
    } catch (err) { console.warn("BroadcastChannel not supported", err); }
    return () => { try { ch && ch.close(); } catch {} };
  }, [displayStation]);

  return (
    <div>
      <style>{css}</style>
      <CustomerDisplayWindow syncData={syncData} />
    </div>
  );
}


function POSScreen({ user, station, minimartProducts, setMinimartProducts, transactions, setTransactions, shifts, setShifts, activeShifts, setActiveShifts, setSalesStats, shopConfig, onSyncData, fbSave }) {
  const currentShift = activeShifts[station] || null;
  const [showOpenShift, setShowOpenShift] = useState(false);
  const [openFloat, setOpenFloat] = useState("");
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [countedCash, setCountedCash] = useState("");
  const [countTHB, setCountTHB] = useState("");
  const [countVND, setCountVND] = useState("");
  const [activeCount, setActiveCount] = useState("LAK"); // ຊ່ອງນັບເງິນທີ່ກຳລັງພິມ
  const [closedReceipt, setClosedReceipt] = useState(null); // shift report after close
  const [showHistory, setShowHistory] = useState(false); // ໜ້າເບິ່ງbillsຍ້ອນຫຼັງ
  const [reprintTxn, setReprintTxn] = useState(null); // billsທີ່ເລືອກປິ້ນຄືນ
  const [historyFilter, setHistoryFilter] = useState("shift"); // shift | all
  const warnDays = shopConfig.expiryWarnDays || DEFAULT_EXPIRY_WARN_DAYS;
  const [cart, setCart] = useState([]);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(""); // ຄ່າ search ທີ່ delay
  const [visibleCount, setVisibleCount] = useState(60); // ສະແດງເທື່ອລະ 60 ໂຕ
  const [payModal, setPayModal] = useState(false);
  const [payMethod, setPayMethod] = useState("Cash");
  const [payCurrency, setPayCurrency] = useState("LAK"); // ສະກຸນທີ່ຮັບເງິນສົດ: LAK/THB/VND (ທອນເປັນກີບສະເໝີ)
  const [cashGiven, setCashGiven] = useState("");
  const [qrGiven, setQrGiven] = useState("");
  const [activeInput, setActiveInput] = useState("cash");
  const [receipt, setReceipt] = useState(null);
  const [lastAdded, setLastAdded] = useState(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [showCustomerDisplay, setShowCustomerDisplay] = useState(false);
  const [stockAlert, setStockAlert] = useState("");

  // Debounce search input — ຫຼຸດການ filter ຊ້ຳໆ ຂະນະພິມ
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 180);
    return () => clearTimeout(t);
  }, [search]);

  // ກວດໝົດ ແລະ ກັ່ນຕອງ — ໃຊ້ debouncedSearch
  const filtered = React.useMemo(() => {
    const s = debouncedSearch.toLowerCase().trim();
    return minimartProducts.filter(p => (category === "All" || p.category === category) && (s === "" || p.name.toLowerCase().includes(s) || (p.barcode || "").includes(s)));
  }, [minimartProducts, category, debouncedSearch]);

  // reset visible ເມື່ອປ່ຽນ filter
  useEffect(() => { setVisibleCount(60); }, [debouncedSearch, category]);

  const visibleProducts = filtered.slice(0, visibleCount);
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  useEffect(() => {
    let timer = null;
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (payModal) return;
      if (e.key === "Enter") {
        if (barcodeInput.length > 0) {
          const found = minimartProducts.find(p => p.barcode === barcodeInput);
          if (found) addToCart(found);
          setBarcodeInput("");
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
        clearTimeout(timer);
        setBarcodeInput(prev => prev + e.key);
        timer = setTimeout(() => setBarcodeInput(""), 500);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => { window.removeEventListener("keydown", handleKeyDown); clearTimeout(timer); };
  }, [barcodeInput, minimartProducts, payModal]);

  // create a BroadcastChannel to push data to the standalone customer display
  const displayChRef = useRef(null);
  useEffect(() => {
    try {
      const ch = new BroadcastChannel("pos_customer_display");
      displayChRef.current = ch;
      // when the display opens and says hello → send the latest data
      ch.onmessage = (e) => {
        if (e.data?.__hello) {
          ch.postMessage({ cart, total, shopConfig, receipt, station });
        }
      };
      return () => { try { ch.close(); } catch {} };
    } catch (err) { console.warn("BroadcastChannel not supported", err); }
  }, []);

  useEffect(() => {
    onSyncData({ cart, total, shopConfig, receipt, station });
    // push to the standalone display (if any)
    try { displayChRef.current && displayChRef.current.postMessage({ cart, total, shopConfig, receipt, station }); } catch {}
  }, [cart, total, receipt]);

  const addToCart = (product) => {
    const allowNeg = shopConfig.allowNegativeStock;
    // ຖ້າເປັນແພັກ → ກວດ stock ຈາກ parent ດ້ວຍ packOf × qty
    const isPack = product.packOf && product.packParentBarcode;
    const parent = isPack ? minimartProducts.find(p => p.barcode === product.packParentBarcode) : null;
    const stockTarget = parent || product;
    const inCart = cart.find(i => i.id === product.id);
    const inCartQty = inCart ? inCart.qty : 0;
    const available = totalStock(stockTarget);
    const needed = (inCartQty + 1) * (isPack ? product.packOf : 1);
    if (!allowNeg) {
      if (available <= 0) {
        setStockAlert(`"${product.name}" Out of stock — cannot sell`);
        setTimeout(() => setStockAlert(""), 2500);
        return;
      }
      if (needed > available) {
        const unitsLabel = isPack ? `${available} units (= ${Math.floor(available / product.packOf)} packs)` : `${available}`;
        setStockAlert(`"${product.name}" Only ${unitsLabel} in stock`);
        setTimeout(() => setStockAlert(""), 2500);
        return;
      }
    } else if (needed > available) {
      setStockAlert(`⚠️ "${product.name}" stock going negative — remember to receive stock later`);
      setTimeout(() => setStockAlert(""), 2500);
    }
    setLastAdded(product.id);
    setTimeout(() => setLastAdded(null), 250);
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      return ex ? prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i) : [...prev, { ...product, qty: 1 }];
    });
  };
  const updateQty = (id, delta) => setCart(prev => prev.map(i => {
    if (i.id !== id) return i;
    const next = i.qty + delta;
    const allowNeg = shopConfig.allowNegativeStock;
    if (!allowNeg && delta > 0) {
      const isPack = i.packOf && i.packParentBarcode;
      const parent = isPack ? minimartProducts.find(p => p.barcode === i.packParentBarcode) : null;
      const target = parent || minimartProducts.find(p => p.id === id);
      const max = target ? totalStock(target) : next;
      const needed = next * (isPack ? i.packOf : 1);
      if (needed > max) {
        setStockAlert(`"${i.name}" Only ${max} in stock`);
        setTimeout(() => setStockAlert(""), 2500);
        return i;
      }
    }
    return { ...i, qty: next };
  }).filter(i => i.qty > 0));

  // ===== ເລດແລກປ່ຽນ (ປັບໄດ້ຫຼັງບ້ານ) =====
  const rateTHB = Number(shopConfig.rateTHB) || 630;   // 1 ບາດ = ? ກີບ
  const rateVND = Number(shopConfig.rateVND) || 850;   // 1,000 ຍວນ = ? ກີບ
  // ແປງເງິນຕ່າງປະເທດ → ກີບ
  const toLAK = (amt) => payCurrency === "THB" ? Math.round(amt * rateTHB)
    : payCurrency === "VND" ? Math.round(amt * rateVND / 1000)
    : Math.round(amt);
  // ຍອດ total (ກີບ) → ສະກຸນທີ່ເລືອກ (ໃຫ້ພະນັກງານຮູ້ວ່າຕ້ອງເກັບເທົ່າໃດ)
  const totalInCurrency = payCurrency === "THB" ? total / rateTHB
    : payCurrency === "VND" ? total / rateVND * 1000
    : total;

  const cashGivenNum = parseFloat(cashGiven || 0);
  // cashAmt = ມູນຄ່າເງິນສົດທີ່ຮັບ ຄິດເປັນກີບ (Cash ໃຊ້ສະກຸນທີ່ເລືອກ; Split ໃຊ້ກີບສະເໝີ)
  const cashAmt = payMethod === "Cash" ? toLAK(cashGivenNum) : parseInt(cashGiven || 0, 10);
  const qrAmt = parseInt(qrGiven || 0, 10);
  let isPaymentValid = false;
  let change = 0;
  if (payMethod === "Cash") { isPaymentValid = cashAmt >= total; change = cashAmt - total; }
  else if (payMethod === "QR" || payMethod === "Card") { isPaymentValid = true; }
  else if (payMethod === "Split") { isPaymentValid = (cashAmt + qrAmt) >= total; change = (cashAmt + qrAmt) - total; }

  const processPayment = () => {
    let rCash = 0, rQR = 0, rCard = 0;
    if (payMethod === "Cash") rCash = total;
    else if (payMethod === "QR") rQR = total;
    else if (payMethod === "Card") rCard = total;
    else if (payMethod === "Split") { rQR = qrAmt; rCash = total - qrAmt; }

    // ຄຳນວນທຶນ ແລະ ກຳໄລ ຂອງbillsນີ້
    const txnCost = cart.reduce((s, i) => s + ((i.cost || 0) * i.qty), 0);
    const txnProfit = total - txnCost;

    const txn = {
      id: `TXN-${String(transactions.length + 1).padStart(4, "0")}`,
      cashier: user.name,
      station: station,
      shiftId: currentShift ? currentShift.id : null,
      total,
      cost: txnCost,
      profit: txnProfit,
      items: cart.reduce((s, i) => s + i.qty, 0),
      method: payMethod,
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      date: TODAY_DATE,
      cartItems: [...cart],
      revenueCash: rCash,
      revenueQR: rQR,
      revenueCard: rCard,
      cashReceived: cashAmt,
      change: change,
      payCurrency: payMethod === "Cash" ? payCurrency : "LAK",
      foreignReceived: (payMethod === "Cash" && payCurrency !== "LAK") ? cashGivenNum : null,
      rateUsed: payCurrency === "THB" ? rateTHB : payCurrency === "VND" ? rateVND : null
    };
    setTransactions(prev => [txn, ...prev]);
    // ບັນທຶກບິນໃໝ່ໂດຍກົງ Firebase (ບໍ່ລໍ useEffect — ໄວ + ບໍ່ມີ race condition)
    if (fbSave && fbSave.saveOneTransaction) {
      fbSave.saveOneTransaction(txn);
    }
    // ສະສົມສະຖິຕິຂາຍ (ສຳລັບ Top Selling — ບໍ່ຫາຍຕອນປິດກະ) ພ້ອມກຳໄລ
    setSalesStats(prev => {
      const next = { ...prev };
      cart.forEach(c => {
        const ex = next[c.id] || { name: c.name, qty: 0, revenue: 0, profit: 0 };
        next[c.id] = {
          name: c.name,
          qty: ex.qty + c.qty,
          revenue: ex.revenue + (c.price * c.qty),
          profit: (ex.profit || 0) + ((c.price - (c.cost || 0)) * c.qty)
        };
      });
      return next;
    });
    // ຫັກStockອັດຕະໂນມັດແບບ FIFO — ຮອງຮັບແພັກ (1 ແພັກ = N ຕຸກ → ຫັກຈາກ parent ດ້ວຍ packOf × qty)
    setMinimartProducts(prev => {
      // ສ້າງ map ການຫັກລວມ {productId: totalQtyToDeduct}
      const deductMap = {};
      cart.forEach(c => {
        if (c.packOf && c.packParentBarcode) {
          // ແມ່ນແພັກ → ຫາ parent ດ້ວຍ barcode ແລ້ວຫັກ packOf × qty
          const parent = prev.find(p => p.barcode === c.packParentBarcode);
          const targetId = parent ? parent.id : c.id;
          deductMap[targetId] = (deductMap[targetId] || 0) + (c.qty * c.packOf);
        } else {
          // ສິນຄ້າທຳມະດາ
          deductMap[c.id] = (deductMap[c.id] || 0) + c.qty;
        }
      });
      const updated = prev.map(p => {
        const q = deductMap[p.id];
        return q ? { ...p, batches: deductFIFO(p.batches || [], q) } : p;
      });
      // ບັນທຶກສະເພາະສິນຄ້າທີ່ປ່ຽນແປງ (1 doc ຕໍ່ສິນຄ້າ — ປະຫຍັດ writes)
      if (fbSave && fbSave.saveOneProduct) {
        Object.keys(deductMap).forEach(id => {
          const p = updated.find(x => String(x.id) === String(id));
          if (p) fbSave.saveOneProduct(p);
        });
      }
      return updated;
    });
    setReceipt(txn);
    setCart([]);
    setPayModal(false);
    setCashGiven("");
    setQrGiven("");
    setPayCurrency("LAK");
  };

  // --- ເປີດກະ ---
  const openShift = () => {
    const floatAmt = parseInt(openFloat || "0", 10) || 0;
    const shift = {
      id: `SHIFT-${station}-${Date.now()}`,
      station,
      openedBy: user.name,
      openedAt: new Date().toLocaleString("en-GB"),
      openDate: TODAY_DATE,
      openFloat: floatAmt,
    };
    setActiveShifts(prev => ({ ...prev, [station]: shift }));
    setShowOpenShift(false);
    setOpenFloat("");
  };

  // --- ຄຳນວນTotalກະປະຈຸບັນ (ສະເພາະbillsຂອງກະນີ້) ---
  const shiftTxns = currentShift ? transactions.filter(t => t.shiftId === currentShift.id) : [];
  const shiftSales = (() => {
    let cash = 0, qr = 0, card = 0, profit = 0;           // ຍອດຂາຍ (ກີບ)
    let lakDrawer = 0, thbDrawer = 0, vndDrawer = 0;       // ເງິນຈິງໃນລິ້ນຊັກ ແຍກສະກຸນ
    shiftTxns.forEach(t => {
      profit += (t.profit || 0);
      if (t.method === "Split") { cash += (t.revenueCash || 0); qr += (t.revenueQR || 0); lakDrawer += (t.revenueCash || 0); }
      else if (t.method === "Cash") {
        cash += (t.total || 0);
        if (t.payCurrency === "THB") { thbDrawer += (t.foreignReceived || 0); lakDrawer -= (t.change || 0); }       // ຮັບບາດ, ທອນກີບ
        else if (t.payCurrency === "VND") { vndDrawer += (t.foreignReceived || 0); lakDrawer -= (t.change || 0); }  // ຮັບຍວນ, ທອນກີບ
        else { lakDrawer += (t.total || 0); }                                                                       // ຮັບກີບ
      }
      else if (t.method === "QR") qr += (t.total || 0);
      else if (t.method === "Card") card += (t.total || 0);
    });
    return { cash, qr, card, profit, total: cash + qr + card, count: shiftTxns.length, lakDrawer, thbDrawer, vndDrawer };
  })();
  const openFloatLAK = currentShift ? (currentShift.openFloat || 0) : 0;
  const expectedLAK = openFloatLAK + shiftSales.lakDrawer;  // ກີບທີ່ຄວນມີ (float + ຮັບກີບ - ທອນ)
  const expectedTHB = shiftSales.thbDrawer;                 // ບາດທີ່ຄວນມີ
  const expectedVND = shiftSales.vndDrawer;                 // ຍວນທີ່ຄວນມີ
  const countedLAK = parseInt(countedCash || "0", 10) || 0;
  const countedTHB = parseFloat(countTHB || "0") || 0;
  const countedVND = parseInt(countVND || "0", 10) || 0;
  const diffLAK = countedLAK - expectedLAK;
  const diffTHB = countedTHB - expectedTHB;
  const diffVND = countedVND - expectedVND;
  // ຂາດ/ເກີນ ລວມເປັນກີບ (ແປງບາດ/ຍວນເປັນກີບແລ້ວບວກ)
  const totalDiffLAK = diffLAK + Math.round(diffTHB * rateTHB) + Math.round(diffVND * rateVND / 1000);
  const hasTHB = expectedTHB > 0;
  const hasVND = expectedVND > 0;
  const canCloseShift = countedCash !== "" && (!hasTHB || countTHB !== "") && (!hasVND || countVND !== "");
  // backward-compat
  const expectedCash = expectedLAK;
  const cashDiff = totalDiffLAK;

  // --- ປິດກະ ---
  const closeShift = () => {
    const closed = {
      ...currentShift,
      closedBy: user.name,
      closedAt: new Date().toLocaleString("en-GB"),
      closeDate: TODAY_DATE,
      sales: shiftSales,
      expectedCash,
      countedCash: countedLAK,
      cashDiff,
      txnCount: shiftTxns.length,
      // ແຍກສະກຸນ (ກີບ/ບາດ/ຍວນ)
      rateTHB, rateVND,
      expectedLAK, expectedTHB, expectedVND,
      countedLAK, countedTHB, countedVND,
      diffLAK, diffTHB, diffVND, totalDiffLAK,
    };
    setShifts(prev => [closed, ...prev]);
    // ບໍ່ລົບບິນຫຼັງປິດກະ — ໃຫ້ຢູ່ຄົບເພື່ອເບິ່ງຍ້ອນຫຼັງ
    // (ບິນຍັງມີ shiftId ໃຫ້ກອງຕາມກະໄດ້)
    setActiveShifts(prev => { const n = { ...prev }; delete n[station]; return n; });
    setShowCloseShift(false);
    setCountedCash(""); setCountTHB(""); setCountVND(""); setActiveCount("LAK");
    setClosedReceipt(closed);
  };

  if (receipt) return <ReceiptView receipt={receipt} shopConfig={shopConfig} onDone={() => setReceipt(null)} />;
  if (closedReceipt) return <ShiftReport shift={closedReceipt} shopConfig={shopConfig} onDone={() => setClosedReceipt(null)} />;
  // ປິ້ນbillsຍ້ອນຫຼັງ (reprint) — ໃຊ້ ReceiptView ດຽວກັນ
  if (reprintTxn) return <ReceiptView receipt={reprintTxn} shopConfig={shopConfig} onDone={() => setReprintTxn(null)} reprint />;

  // ຖ້າຍັງບໍ່ໄດ້ເປີດກະ → ບັງຄັບເປີດກະກ່ອນຂາຍ
  if (!currentShift) {
    return (
      <div style={{ display: "flex", height: "calc(100vh - 56px)", alignItems: "center", justifyContent: "center", background: "var(--bg0)" }}>
        <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, width: 380, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Station {station} — shift not open</div>
          <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>Enter the cash float before selling</div>
          <div style={{ textAlign: "left", marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: "var(--text2)", display: "block", marginBottom: 6 }}>Opening float (cash in drawer) ₭</label>
            <input type="text" readOnly value={openFloat ? parseInt(openFloat).toLocaleString() : ""} placeholder="0" style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border-amber)", borderRadius: 8, padding: "14px 14px", fontSize: 22, fontWeight: 700, textAlign: "right", fontFamily: "var(--mono)" }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <Numpad value={openFloat} onChange={setOpenFloat} />
          </div>
          <button onClick={openShift} style={{ width: "100%", background: "var(--green)", border: "none", borderRadius: 10, padding: "14px", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>🔓 Open Shift — Station {station}</button>
        </div>
      </div>
    );
  }


  return (
    <div style={{ display: "flex", height: "calc(100vh - 56px)", overflow: "hidden", position: "relative" }}>
      {/* Toast ແຈ້ງເຕືອນStock */}
      {stockAlert && (
        <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 200, background: "var(--red)", color: "#fff", padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>⚠️ {stockAlert}</div>
      )}
      {/* Left: Product Panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", borderRight: "1px solid var(--border)" }}>
        {/* Header */}
        <div style={{ padding: "14px 16px", background: "var(--bg1)", borderBottom: "1px solid var(--border)", fontSize: 15, fontWeight: 700, color: "var(--amber)" }}>🛒 Point of Sale (scan barcode / tap products)</div>

        {/* Search */}
        <div style={{ padding: "12px 16px 10px", background: "var(--bg0)", display: "flex", gap: 12, alignItems: "center" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search products or scan a barcode..." style={{ flex: 1, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", color: "var(--text1)", fontSize: 13, outline: "none" }} />
          <div style={{ background: "rgba(92,184,120,0.1)", color: "var(--green)", borderRadius: 6, padding: "8px 12px", fontSize: 12, fontWeight: 600 }}>📡 Scanner ready</div>
        </div>

        {/* Categories */}
        <div style={{ padding: "4px 16px 12px", display: "flex", gap: 6, overflowX: "auto" }}>
          {MINIMART_CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)} style={{ background: category === c ? "var(--amber)" : "var(--bg2)", border: "none", borderRadius: 20, padding: "6px 14px", fontSize: 12, color: category === c ? "#000" : "var(--text2)", fontWeight: category === c ? 700 : 400, cursor: "pointer", whiteSpace: "nowrap" }}>{c}</button>
          ))}
        </div>

        {/* Product Grid */}
        <div onScroll={e => {
          const el = e.currentTarget;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200 && visibleCount < filtered.length) {
            setVisibleCount(v => Math.min(v + 60, filtered.length));
          }
        }} style={{ flex: 1, overflowY: "auto", padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, alignContent: "start" }}>
          {visibleProducts.map(p => {
            const ss = stockStatus(p);
            const eb = earliestBatch(p);
            const es = expiryStatus(eb ? eb.expiry : null, warnDays);
            const isPack = p.packOf && p.packParentBarcode;
            const packParent = isPack ? minimartProducts.find(x => x.barcode === p.packParentBarcode) : null;
            const stockNum = isPack && packParent ? Math.floor(totalStock(packParent) / p.packOf) : totalStock(p);
            const allowNeg = shopConfig.allowNegativeStock;
            const disabled = !allowNeg && ss === "out";
            const badgeBg = stockNum <= 0 ? "var(--red)" : ss === "low" ? "#d98324" : "var(--bg3)";
            const badgeText = stockNum < 0 ? `${stockNum}` : stockNum === 0 ? "0" : `x${stockNum}`;
            return (
            <button key={p.id} onClick={() => addToCart(p)} disabled={disabled} style={{ position: "relative", background: lastAdded === p.id ? "var(--amber-glow)" : "var(--bg1)", border: "1px solid " + (lastAdded === p.id ? "var(--border-amber)" : "var(--border)"), borderRadius: 10, padding: "12px 8px", cursor: disabled ? "not-allowed" : "pointer", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, opacity: disabled ? 0.45 : 1, boxShadow: "var(--shadow-card)" }}>
              {/* Badge Expired (ລັອດໃກ້ສຸດ) */}
              {es.level === "expired" && <div style={{ position: "absolute", top: 6, left: 6, background: "var(--red)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>Expired</div>}
              {es.level === "soon" && <div style={{ position: "absolute", top: 6, left: 6, background: "#d98324", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>Exp {es.days}d</div>}
              {/* Badge Stock */}
              <div style={{ position: "absolute", top: 6, right: 6, background: badgeBg, color: stockNum > 0 && ss === "ok" ? "var(--text2)" : "#fff", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>{badgeText}</div>
              {isPack && <div style={{ position: "absolute", bottom: 6, right: 6, background: "var(--blue)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>📦 PACK ×{p.packOf}</div>}
              <img src={p.image} className="img-avatar" style={{ width: 64, height: 64 }} onError={e => e.target.src = "https://placehold.co/64x64/242420/a8a49c?text=IMG"} alt={p.name} />
              <div>
                {p.barcode && <div style={{ fontSize: 10, color: "var(--text3)" }}>{p.barcode}</div>}
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)" }}>{p.name}</div>
                <div style={{ fontSize: 13, fontFamily: "var(--mono)", color: "var(--amber)", marginTop: 2 }}>₭{(p.price || 0).toLocaleString()}</div>
              </div>
            </button>
            );
          })}
          {filtered.length > visibleCount && (
            <div style={{ gridColumn: "1/-1", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 16 }}>
              <div style={{ fontSize: 12, color: "var(--text3)" }}>Showing {visibleCount} of {filtered.length} products</div>
              <button onClick={() => setVisibleCount(v => v + 60)} style={{ background: "var(--bg1)", border: "1px solid var(--border-amber)", color: "var(--amber)", padding: "8px 20px", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Load 60 more ↓</button>
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart Panel */}
      <div style={{ width: 340, display: "flex", flexDirection: "column", background: "var(--bg1)" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Cart</div>
            <div style={{ fontSize: 10, color: "var(--green)" }}>🔓 Shift open · float ₭{(currentShift.openFloat || 0).toLocaleString()}</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => {
              const url = window.location.pathname + "?display=" + station;
              window.open(url, "customerDisplay" + station, "width=1000,height=700");
            }} style={{ background: "rgba(90,158,224,0.15)", border: "1px solid rgba(90,158,224,0.4)", color: "var(--blue)", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>🪟 Pop-out (Display 2)</button>
            <button onClick={() => setShowCustomerDisplay(v => !v)} style={{ background: "var(--amber-glow)", border: "1px solid var(--border-amber)", color: "var(--amber)", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>🖥️ {showCustomerDisplay ? "Hide" : "Show"} here</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {cart.length === 0
            ? <div style={{ textAlign: "center", padding: "50px 20px", color: "var(--text3)" }}>Cart is empty</div>
            : cart.map(item => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", padding: "10px 16px", gap: 10, borderBottom: "1px solid var(--border)" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}{item.packOf && item.packParentBarcode && <span style={{ background: "var(--blue)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 3, marginLeft: 6 }}>📦×{item.packOf}</span>}</div>
                  <div style={{ fontSize: 12, color: "var(--text2)" }}>₭{(item.price || 0).toLocaleString()}{item.packOf && item.packParentBarcode && <span style={{ color: "var(--text3)", fontSize: 11 }}> · {item.qty * item.packOf} units</span>}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button onClick={() => updateQty(item.id, -1)} style={{ width: 24, height: 24, borderRadius: 6, background: "var(--bg2)", border: "none", color: "#fff", cursor: "pointer" }}>−</button>
                  <span style={{ fontSize: 13, minWidth: 16, textAlign: "center" }}>{item.qty}</span>
                  <button onClick={() => updateQty(item.id, 1)} style={{ width: 24, height: 24, borderRadius: 6, background: "var(--bg2)", border: "none", color: "#fff", cursor: "pointer" }}>+</button>
                </div>
              </div>
            ))
          }
        </div>
        <div style={{ borderTop: "1px solid var(--border)", padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
            <span>Total</span><span style={{ color: "var(--amber)" }}>₭{(total || 0).toLocaleString()}</span>
          </div>
          <button onClick={() => setPayModal(true)} disabled={cart.length === 0} style={{ width: "100%", background: cart.length > 0 ? "var(--amber)" : "var(--bg3)", border: "none", borderRadius: 10, padding: "14px", fontSize: 14, fontWeight: 700, color: cart.length > 0 ? "#1a0f00" : "var(--text3)", cursor: cart.length > 0 ? "pointer" : "not-allowed" }}>Checkout</button>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={() => setShowHistory(true)} style={{ flex: 1, background: "transparent", border: "1px solid var(--border)", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 600, color: "var(--text2)", cursor: "pointer" }}>🧾 Past Bills</button>
            <button onClick={() => { setCountedCash(""); setShowCloseShift(true); }} style={{ flex: 1, background: "transparent", border: "1px solid var(--border)", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 600, color: "var(--text2)", cursor: "pointer" }}>🔒 Close Shift</button>
          </div>
        </div>
      </div>

      {/* billsຍ້ອນຫຼັງ (current shift Stnນີ້) */}
      {showHistory && (
        <div style={{ position: "absolute", inset: 0, background: "var(--bg0)", zIndex: 90, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "14px 20px", background: "var(--bg1)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <span style={{ fontSize: 15, fontWeight: 700 }}>🧾 Past Bills — Station {station}</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setHistoryFilter("shift")} style={{ background: historyFilter === "shift" ? "var(--amber)" : "var(--bg2)", border: "1px solid " + (historyFilter === "shift" ? "var(--amber)" : "var(--border)"), color: historyFilter === "shift" ? "#fff" : "var(--text1)", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Current shift ({shiftTxns.length})</button>
              <button onClick={() => setHistoryFilter("all")} style={{ background: historyFilter === "all" ? "var(--amber)" : "var(--bg2)", border: "1px solid " + (historyFilter === "all" ? "var(--amber)" : "var(--border)"), color: historyFilter === "all" ? "#fff" : "var(--text1)", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>All bills ({transactions.length})</button>
              <button onClick={() => setShowHistory(false)} style={{ background: "rgba(224,90,90,0.1)", border: "none", color: "var(--red)", padding: "6px 14px", borderRadius: 6, cursor: "pointer" }}>✕ Close</button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
            {(() => { const displayedTxns = historyFilter === "all" ? transactions : shiftTxns; return displayedTxns.length === 0
              ? <div style={{ textAlign: "center", padding: 50, color: "var(--text3)" }}>No bills{historyFilter === "shift" ? " in this shift yet" : " yet"}</div>
              : <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 700, margin: "0 auto" }}>
                  {displayedTxns.slice(0, 200).map(t => (
                    <div key={t.id} style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--amber)" }}>{t.id}</span>
                          <span style={{ fontSize: 12, color: "var(--text3)" }}>{t.time}</span>
                          <span style={{ fontSize: 11, background: "var(--bg3)", color: "var(--text2)", padding: "2px 8px", borderRadius: 10 }}>{t.method === "Split" ? "Split" : t.method === "Cash" ? "Cash" : t.method === "QR" ? "Transfer" : "Card"}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text2)" }}>{(t.cartItems || []).map(i => `${i.name}×${i.qty}`).join(", ")}</div>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--amber)" }}>₭{(t.total || 0).toLocaleString()}</div>
                      <button onClick={() => { setShowHistory(false); setReprintTxn(t); }} style={{ background: "var(--bg2)", border: "1px solid var(--border-amber)", color: "var(--amber)", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>🖨️ Reprint</button>
                    </div>
                  ))}
                  {displayedTxns.length > 200 && <div style={{ textAlign: "center", padding: 12, fontSize: 11, color: "var(--text3)" }}>Showing latest 200 of {displayedTxns.length}</div>}
                </div>
            ; })()}
          </div>
        </div>
      )}

      {/* Customer Display Inline Panel */}
      {showCustomerDisplay && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "#0f0f0f", zIndex: 50, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "10px 16px", background: "#1a1a18", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #2f2f2a" }}>
            <span style={{ color: "#e8a020", fontWeight: 700 }}>🖥️ Customer Display</span>
            <button onClick={() => setShowCustomerDisplay(false)} style={{ background: "rgba(224,90,90,0.1)", border: "none", color: "#e05a5a", padding: "6px 14px", borderRadius: 6, cursor: "pointer" }}>✕ Close</button>
          </div>
          <div style={{ flex: 1 }}>
            <CustomerDisplayWindow syncData={{ cart, total, shopConfig, receipt, station }} />
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {showCloseShift && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, width: 440 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>🔒 Close Shift — Station {station}</div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 20 }}>Opened by {currentShift.openedBy} · {currentShift.openedAt}</div>

            {/* ສະຫຼຸບTotalຂາຍກະ */}
            <div style={{ background: "var(--bg2)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "var(--amber)" }}>Shift sales summary ({shiftSales.count} bills)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text2)" }}>💵 Cash sales</span><span style={{ color: "var(--green)" }}>₭{shiftSales.cash.toLocaleString()}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text2)" }}>📱 Transfer</span><span style={{ color: "var(--blue)" }}>₭{shiftSales.qr.toLocaleString()}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text2)" }}>💳 Card</span><span style={{ color: "var(--amber)" }}>₭{shiftSales.card.toLocaleString()}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 6, fontWeight: 700 }}><span>Total Sales</span><span style={{ color: "var(--amber)" }}>₭{shiftSales.total.toLocaleString()}</span></div>
              </div>
            </div>

            {/* ນັບເງິນຈິງ ແຍກສະກຸນ */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--amber)" }}>ນັບເງິນຈິງໃນລິ້ນຊັກ</div>

              {/* ກີບ */}
              <div onClick={() => setActiveCount("LAK")} style={{ marginBottom: 8, padding: 10, borderRadius: 8, border: "1px solid " + (activeCount === "LAK" ? "var(--border-amber)" : "var(--border)"), background: "var(--bg2)", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text2)", marginBottom: 4 }}>
                  <span>ກີບ ₭ — ຄວນມີ</span><span style={{ fontWeight: 700, color: "var(--text1)" }}>₭{expectedLAK.toLocaleString()}</span>
                </div>
                <input type="text" readOnly value={countedCash ? parseInt(countedCash).toLocaleString() : ""} placeholder="ນັບເງິນກີບ" style={{ width: "100%", background: "var(--bg1)", border: "none", borderRadius: 6, padding: "8px 10px", fontSize: 18, fontWeight: 700, textAlign: "right", fontFamily: "var(--mono)", color: "var(--text1)" }} />
              </div>

              {/* ບາດ */}
              {hasTHB && (
                <div onClick={() => setActiveCount("THB")} style={{ marginBottom: 8, padding: 10, borderRadius: 8, border: "1px solid " + (activeCount === "THB" ? "var(--border-amber)" : "var(--border)"), background: "var(--bg2)", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text2)", marginBottom: 4 }}>
                    <span>ບາດ ฿ — ຄວນມີ</span><span style={{ fontWeight: 700, color: "var(--text1)" }}>{expectedTHB.toLocaleString()} ฿</span>
                  </div>
                  <input type="text" readOnly value={countTHB ? parseFloat(countTHB).toLocaleString() : ""} placeholder="ນັບເງິນບາດ" style={{ width: "100%", background: "var(--bg1)", border: "none", borderRadius: 6, padding: "8px 10px", fontSize: 18, fontWeight: 700, textAlign: "right", fontFamily: "var(--mono)", color: "var(--text1)" }} />
                </div>
              )}

              {/* ຍວນ */}
              {hasVND && (
                <div onClick={() => setActiveCount("VND")} style={{ marginBottom: 8, padding: 10, borderRadius: 8, border: "1px solid " + (activeCount === "VND" ? "var(--border-amber)" : "var(--border)"), background: "var(--bg2)", cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text2)", marginBottom: 4 }}>
                    <span>ຍວນ ¥ — ຄວນມີ</span><span style={{ fontWeight: 700, color: "var(--text1)" }}>{expectedVND.toLocaleString()} ¥</span>
                  </div>
                  <input type="text" readOnly value={countVND ? parseInt(countVND).toLocaleString() : ""} placeholder="ນັບເງິນຍວນ" style={{ width: "100%", background: "var(--bg1)", border: "none", borderRadius: 6, padding: "8px 10px", fontSize: 18, fontWeight: 700, textAlign: "right", fontFamily: "var(--mono)", color: "var(--text1)" }} />
                </div>
              )}

              <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6 }}>ກົ່ມຊ່ອງສະກຸນທີ່ຈະນັບ ແລ້ວໃຊ້ປຸ່ມເລກລຸ່ມນີ້</div>
              <Numpad
                value={activeCount === "LAK" ? countedCash : activeCount === "THB" ? countTHB : countVND}
                onChange={val => activeCount === "LAK" ? setCountedCash(val) : activeCount === "THB" ? setCountTHB(val) : setCountVND(val)}
              />
            </div>

            {/* ຂາດ/ເກີນ ແຍກສະກຸນ + ລວມເປັນກີບ */}
            {countedCash !== "" && (
              <div style={{ marginBottom: 16, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: diffLAK === 0 ? "var(--text2)" : diffLAK > 0 ? "var(--blue)" : "var(--red)" }}>
                  <span>ກີບ</span><span>{diffLAK === 0 ? "✓ ພໍດີ" : diffLAK > 0 ? `▲ ເກີນ ₭${diffLAK.toLocaleString()}` : `▼ ຂາດ ₭${Math.abs(diffLAK).toLocaleString()}`}</span>
                </div>
                {hasTHB && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: diffTHB === 0 ? "var(--text2)" : diffTHB > 0 ? "var(--blue)" : "var(--red)" }}>
                  <span>ບາດ</span><span>{diffTHB === 0 ? "✓ ພໍດີ" : diffTHB > 0 ? `▲ ເກີນ ${diffTHB.toLocaleString()} ฿` : `▼ ຂາດ ${Math.abs(diffTHB).toLocaleString()} ฿`}</span>
                </div>}
                {hasVND && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: diffVND === 0 ? "var(--text2)" : diffVND > 0 ? "var(--blue)" : "var(--red)" }}>
                  <span>ຍວນ</span><span>{diffVND === 0 ? "✓ ພໍດີ" : diffVND > 0 ? `▲ ເກີນ ${diffVND.toLocaleString()} ¥` : `▼ ຂາດ ${Math.abs(diffVND).toLocaleString()} ¥`}</span>
                </div>}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, padding: "10px 12px", borderRadius: 8, fontWeight: 700, background: totalDiffLAK === 0 ? "rgba(92,184,120,0.12)" : "rgba(224,90,90,0.12)", color: totalDiffLAK === 0 ? "var(--green)" : totalDiffLAK > 0 ? "var(--blue)" : "var(--red)" }}>
                  <span>{totalDiffLAK === 0 ? "✓ ລວມພໍດີ" : totalDiffLAK > 0 ? "▲ ລວມເກີນ (ກີບ)" : "▼ ລວມຂາດ (ກີບ)"}</span>
                  <span>₭{Math.abs(totalDiffLAK).toLocaleString()}</span>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowCloseShift(false)} style={{ flex: 1, background: "var(--bg2)", border: "none", borderRadius: 8, padding: "14px", color: "var(--text2)", cursor: "pointer" }}>Cancel</button>
              <button onClick={closeShift} disabled={!canCloseShift} style={{ flex: 2, background: canCloseShift ? "var(--red)" : "var(--bg3)", border: "none", borderRadius: 8, padding: "14px", color: canCloseShift ? "#fff" : "var(--text3)", fontWeight: 700, cursor: canCloseShift ? "pointer" : "not-allowed" }}>Confirm Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {payModal && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, display: "flex", gap: 32 }}>
            <div style={{ width: 340, display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Payment</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: "var(--amber)", marginBottom: 24 }}>₭{(total || 0).toLocaleString()}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24 }}>
                {["Cash", "QR", "Card", "Split"].map(m => (
                  <button key={m} onClick={() => { setPayMethod(m); setCashGiven(""); setQrGiven(""); setPayCurrency("LAK"); setActiveInput(m === "Split" ? "qr" : "cash"); }} style={{ background: payMethod === m ? "var(--amber-glow)" : "var(--bg2)", border: "1px solid " + (payMethod === m ? "var(--border-amber)" : "var(--border)"), borderRadius: 8, padding: "12px", color: payMethod === m ? "var(--amber)" : "var(--text2)", fontWeight: 600, cursor: "pointer" }}>
                    {m === "Cash" ? "Cash" : m === "Split" ? "Split" : m}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1 }}>
                {payMethod === "Cash" && (
                  <div>
                    {/* ເລືອກສະກຸນເງິນທີ່ຮັບ (ທອນເປັນກີບສະເໝີ) */}
                    <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                      {[["LAK", "ກີບ ₭"], ["THB", "ບາດ ฿"], ["VND", "ຍວນ ¥"]].map(([code, label]) => (
                        <button key={code} onClick={() => { setPayCurrency(code); setCashGiven(""); }} style={{ flex: 1, background: payCurrency === code ? "var(--amber)" : "var(--bg2)", color: payCurrency === code ? "#000" : "var(--text2)", border: "1px solid " + (payCurrency === code ? "var(--amber)" : "var(--border)"), borderRadius: 8, padding: "8px 4px", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>{label}</button>
                      ))}
                    </div>
                    {payCurrency !== "LAK" && (
                      <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 8, background: "var(--bg2)", padding: "8px 10px", borderRadius: 8 }}>
                        ຕ້ອງເກັບ ≈ <b style={{ color: "var(--amber)" }}>{totalInCurrency.toLocaleString(undefined, { maximumFractionDigits: payCurrency === "THB" ? 2 : 0 })} {payCurrency === "THB" ? "฿" : "¥"}</b>
                        <span style={{ color: "var(--text3)", marginLeft: 6 }}>(₭{total.toLocaleString()})</span>
                      </div>
                    )}
                    <div onClick={() => setActiveInput("cash")}>
                      <label style={{ fontSize: 12, color: "var(--text2)", display: "block", marginBottom: 6 }}>ຮັບເງິນ ({payCurrency === "LAK" ? "₭ ກີບ" : payCurrency === "THB" ? "฿ ບາດ" : "¥ ຍວນ"})</label>
                      <input type="text" readOnly value={cashGiven ? parseFloat(cashGiven).toLocaleString() : ""} onChange={() => {}} style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border-amber)", borderRadius: 8, padding: "12px 14px", color: "var(--text1)", fontSize: 20 }} />
                      {payCurrency !== "LAK" && cashGiven !== "" && (
                        <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>= ₭{cashAmt.toLocaleString()} ກີບ</div>
                      )}
                    </div>
                  </div>
                )}
                {payMethod === "Split" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div onClick={() => setActiveInput("qr")}>
                      <label style={{ fontSize: 12, color: "var(--text2)", display: "block", marginBottom: 6 }}>QR amount (₭)</label>
                      <input type="text" readOnly value={qrGiven ? parseInt(qrGiven).toLocaleString() : ""} onChange={() => {}} style={{ width: "100%", background: "var(--bg2)", border: activeInput === "qr" ? "1px solid var(--border-amber)" : "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", color: "var(--blue)" }} />
                    </div>
                    <div onClick={() => setActiveInput("cash")}>
                      <label style={{ fontSize: 12, color: "var(--text2)", display: "block", marginBottom: 6 }}>Cash amount (₭)</label>
                      <input type="text" readOnly value={cashGiven ? parseInt(cashGiven).toLocaleString() : ""} onChange={() => {}} style={{ width: "100%", background: "var(--bg2)", border: activeInput === "cash" ? "1px solid var(--border-amber)" : "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", color: "var(--green)" }} />
                    </div>
                  </div>
                )}
                {(payMethod === "Cash" || payMethod === "Split") && change >= 0 && (cashGiven !== "" || qrGiven !== "") && (
                  <div style={{ marginTop: 24, fontSize: 18, fontWeight: 700, color: "var(--green)", background: "rgba(92,184,120,0.1)", padding: "14px", borderRadius: 8, textAlign: "center" }}>ເງິນທອນ (ກີບ): ₭{(change || 0).toLocaleString()}</div>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                <button onClick={() => setPayModal(false)} style={{ flex: 1, background: "var(--bg2)", border: "none", borderRadius: 8, padding: "14px", color: "var(--text2)", cursor: "pointer" }}>Cancel</button>
                <button onClick={processPayment} disabled={!isPaymentValid} style={{ flex: 2, background: "var(--amber)", border: "none", borderRadius: 8, padding: "14px", color: "#1a0f00", fontWeight: 700, cursor: isPaymentValid ? "pointer" : "not-allowed", opacity: isPaymentValid ? 1 : 0.5 }}>Confirm Payment</button>
              </div>
            </div>
            {(payMethod === "Cash" || payMethod === "Split") && (
              <div style={{ width: 280, borderLeft: "1px solid var(--border)", paddingLeft: 32, display: "flex", alignItems: "center" }}>
                <Numpad
                  value={activeInput === "cash" ? cashGiven : qrGiven}
                  onChange={val => activeInput === "cash" ? setCashGiven(val) : setQrGiven(val)}
                  withQuickAdd={true}
                  hideQuickAmounts={payMethod === "Cash" && payCurrency !== "LAK"}
                  exactAmount={
                    payMethod === "Split"
                      ? (activeInput === "cash" ? Math.max(0, total - qrAmt) : total)
                      : (payCurrency === "LAK" ? total : Math.ceil(totalInCurrency))
                  }
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- RECEIPT VIEW ---
// --- Shift report (printable A4)
function ShiftReport({ shift, shopConfig, onDone }) {
  const printShift = () => {
    document.body.classList.add("printing-receipt");
    setTimeout(() => { window.print(); setTimeout(() => document.body.classList.remove("printing-receipt"), 300); }, 80);
  };
  const s = shift.sales || { cash: 0, qr: 0, card: 0, total: 0 };
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 56px)", background: "var(--bg0)" }}>
      <div id="printable-receipt" style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, width: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          {shopConfig.logo && <img src={shopConfig.logo} alt="" style={{ height: 48, objectFit: "contain", marginBottom: 6 }} onError={e => e.target.style.display = "none"} />}
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text1)", marginBottom: 4, fontFamily: "var(--script)" }}>{shopConfig.name}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--amber)" }}>📋 Shift Report — Station {shift.station}</div>
        </div>
        <div style={{ fontSize: 12, color: "var(--text2)", borderTop: "1px dashed var(--border)", borderBottom: "1px dashed var(--border)", padding: "12px 0", margin: "12px 0", display: "flex", flexDirection: "column", gap: 4 }}>
          <div>Opened: {shift.openedBy} · {shift.openedAt}</div>
          <div>Closed: {shift.closedBy} · {shift.closedAt}</div>
          <div>Bills: {shift.txnCount}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>💵 Cash sales</span><span style={{ fontFamily: "var(--mono)" }}>₭{s.cash.toLocaleString()}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>📱 Transfer</span><span style={{ fontFamily: "var(--mono)" }}>₭{s.qr.toLocaleString()}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>💳 Card</span><span style={{ fontFamily: "var(--mono)" }}>₭{s.card.toLocaleString()}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderTop: "1px solid var(--border)", paddingTop: 8 }}><span>Total Sales</span><span style={{ color: "var(--amber)" }}>₭{s.total.toLocaleString()}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}><span>📈 Profit</span><span style={{ color: "var(--green)" }}>₭{(s.profit || 0).toLocaleString()}</span></div>
        </div>
        <div style={{ background: "var(--bg2)", borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text2)" }}>Opening float</span><span>₭{(shift.openFloat || 0).toLocaleString()}</span></div>
          {shift.expectedLAK != null ? (
            <>
              <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text2)" }}>ກີບ ຄວນມີ / ນັບໄດ້</span><span>₭{(shift.expectedLAK || 0).toLocaleString()} / ₭{(shift.countedLAK || 0).toLocaleString()}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: (shift.diffLAK || 0) === 0 ? "var(--green)" : (shift.diffLAK || 0) > 0 ? "var(--blue)" : "var(--red)" }}><span>ກີບ</span><span>{(shift.diffLAK || 0) === 0 ? "✓ ພໍດີ" : (shift.diffLAK || 0) > 0 ? `▲ ເກີນ ₭${shift.diffLAK.toLocaleString()}` : `▼ ຂາດ ₭${Math.abs(shift.diffLAK).toLocaleString()}`}</span></div>
              </div>
              {(shift.expectedTHB > 0 || shift.countedTHB > 0) && (
                <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text2)" }}>ບາດ ຄວນມີ / ນັບໄດ້</span><span>{(shift.expectedTHB || 0).toLocaleString()} / {(shift.countedTHB || 0).toLocaleString()} ฿</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: (shift.diffTHB || 0) === 0 ? "var(--green)" : (shift.diffTHB || 0) > 0 ? "var(--blue)" : "var(--red)" }}><span>ບາດ</span><span>{(shift.diffTHB || 0) === 0 ? "✓ ພໍດີ" : (shift.diffTHB || 0) > 0 ? `▲ ເກີນ ${shift.diffTHB.toLocaleString()} ฿` : `▼ ຂາດ ${Math.abs(shift.diffTHB).toLocaleString()} ฿`}</span></div>
                </div>
              )}
              {(shift.expectedVND > 0 || shift.countedVND > 0) && (
                <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text2)" }}>ຍວນ ຄວນມີ / ນັບໄດ້</span><span>{(shift.expectedVND || 0).toLocaleString()} / {(shift.countedVND || 0).toLocaleString()} ¥</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: (shift.diffVND || 0) === 0 ? "var(--green)" : (shift.diffVND || 0) > 0 ? "var(--blue)" : "var(--red)" }}><span>ຍວນ</span><span>{(shift.diffVND || 0) === 0 ? "✓ ພໍດີ" : (shift.diffVND || 0) > 0 ? `▲ ເກີນ ${shift.diffVND.toLocaleString()} ¥` : `▼ ຂາດ ${Math.abs(shift.diffVND).toLocaleString()} ¥`}</span></div>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderTop: "1px solid var(--border)", paddingTop: 6, color: (shift.totalDiffLAK || 0) === 0 ? "var(--green)" : (shift.totalDiffLAK || 0) > 0 ? "var(--blue)" : "var(--red)" }}>
                <span>{(shift.totalDiffLAK || 0) === 0 ? "✓ ລວມພໍດີ" : (shift.totalDiffLAK || 0) > 0 ? "▲ ລວມເກີນ (ກີບ)" : "▼ ລວມຂາດ (ກີບ)"}</span>
                <span>₭{Math.abs(shift.totalDiffLAK || 0).toLocaleString()}</span>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text2)" }}>Expected in drawer</span><span>₭{(shift.expectedCash || 0).toLocaleString()}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text2)" }}>Counted</span><span>₭{(shift.countedCash || 0).toLocaleString()}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderTop: "1px solid var(--border)", paddingTop: 6, color: shift.cashDiff === 0 ? "var(--green)" : shift.cashDiff > 0 ? "var(--blue)" : "var(--red)" }}>
                <span>{shift.cashDiff === 0 ? "✓ Balanced" : shift.cashDiff > 0 ? "▲ Over" : "▼ Short"}</span>
                <span>₭{Math.abs(shift.cashDiff || 0).toLocaleString()}</span>
              </div>
            </>
          )}
        </div>
        <div className="no-print" style={{ display: "flex", gap: 10 }}>
          <button onClick={printShift} style={{ flex: 1, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px", color: "#fff", cursor: "pointer" }}>🖨️ Print Report</button>
          <button onClick={onDone} style={{ flex: 1, background: "var(--amber)", border: "none", borderRadius: 10, padding: "12px", color: "#000", fontWeight: 700, cursor: "pointer" }}>Done</button>
        </div>
      </div>
    </div>
  );
}

function ReceiptView({ receipt, shopConfig, onDone, reprint }) {
  const [lang, setLang] = useState("lo");
  const t = RECEIPT_LANG[lang] || RECEIPT_LANG.lo;
  const cur = "₭";
  const fmt = (n) => cur + (n || 0).toLocaleString();
  const total = receipt.total || 0;
  const subtotal = Math.round(total / 1.1); // ລາຄາ VAT-inclusive → ແຍກສ່ວນ VAT ອອກ
  const vat = total - subtotal;
  const payLabel = receipt.method === "Cash" ? t.cash
    : receipt.method === "QR" ? t.transfer
    : receipt.method === "Card" ? t.card
    : receipt.method === "Split" ? t.split
    : receipt.method;
  const showReceived = (receipt.method === "Cash" || receipt.method === "Split") && receipt.cashReceived != null;
  const isForeign = receipt.payCurrency && receipt.payCurrency !== "LAK" && receipt.foreignReceived != null;
  const curSym = receipt.payCurrency === "THB" ? "฿" : receipt.payCurrency === "VND" ? "¥" : "₭";
  const cjkFont = "'Sora','Noto Sans SC','Noto Sans KR','Microsoft YaHei','Malgun Gothic',sans-serif";
  const row = { display: "flex", justifyContent: "space-between" };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "calc(100vh - 56px)", background: "var(--bg0)", overflowY: "auto", paddingTop: 16, paddingBottom: 16 }}>
      {/* ເລືອກພາສາພິມ — ບໍ່ພິມ */}
      <div className="no-print" style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginBottom: 12, maxWidth: 360 }}>
        {RECEIPT_LANG_ORDER.map(code => (
          <button key={code} onClick={() => setLang(code)} style={{ background: lang === code ? "var(--amber)" : "var(--bg2)", color: lang === code ? "#000" : "var(--text2)", border: "1px solid " + (lang === code ? "var(--amber)" : "var(--border)"), borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 600, fontSize: 12 }}>{RECEIPT_LANG[code].name}</button>
        ))}
      </div>

      <div id="printable-receipt" style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 16, padding: 16, width: 320, fontFamily: cjkFont }}>
        {/* ຫົວບິນ */}
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          {shopConfig.logo && <img src={shopConfig.logo} alt="" style={{ height: 36, objectFit: "contain", marginBottom: 2 }} onError={e => e.target.style.display = "none"} />}
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text1)", marginBottom: 2, fontFamily: "var(--script)" }}>{shopConfig.name}</div>
          {shopConfig.promptPay && <div style={{ fontSize: 10, color: "var(--text2)", marginBottom: 2 }}>Tel: {shopConfig.promptPay}</div>}
          {reprint && <div style={{ fontSize: 11, fontWeight: 700, color: "var(--blue)", marginBottom: 2 }}>{t.copy}</div>}
        </div>

        {/* ຂໍ້ມູນບິນ: ເລກບິນ / ວັນທີ / ເວລາ / ພະນັກງານ / ສະກຸນເງິນ */}
        <div style={{ fontSize: 11, color: "var(--text2)", borderTop: "1px dashed var(--border)", paddingTop: 6, marginBottom: 4, lineHeight: 1.6 }}>
          <div style={row}><span>{t.billNo}</span><span style={{ fontFamily: "var(--mono)" }}>{receipt.id}</span></div>
          <div style={row}><span>{t.date}</span><span>{receipt.date}</span></div>
          <div style={row}><span>{t.time}</span><span>{receipt.time}</span></div>
          <div style={row}><span>{t.cashier}</span><span>{receipt.cashier || "-"}</span></div>
          <div style={row}><span>{t.currency}</span><span>LAK (₭)</span></div>
        </div>

        {/* ລາຍການສິນຄ້າ */}
        <div style={{ borderTop: "1px dashed var(--border)", borderBottom: "1px dashed var(--border)", padding: "6px 0", margin: "4px 0" }}>
          <div style={{ ...row, fontSize: 10, color: "var(--text3)", marginBottom: 4, fontWeight: 600 }}>
            <span>{t.item}</span><span>{cur}</span>
          </div>
          {(receipt.cartItems || []).map(i => (
            <div key={i.id} style={{ ...row, fontSize: 12, marginBottom: 2, lineHeight: 1.3 }}>
              <span style={{ flex: 1, paddingRight: 6 }}>{i.name} ×{i.qty}</span>
              <span style={{ fontFamily: "var(--mono)" }}>{fmt(i.price * i.qty)}</span>
            </div>
          ))}
        </div>

        {/* ມູນຄ່າສິນຄ້າ / VAT / ລວມ */}
        <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 4 }}>
          <div style={{ ...row, marginBottom: 2 }}><span>{t.subtotal}</span><span style={{ fontFamily: "var(--mono)" }}>{fmt(subtotal)}</span></div>
          <div style={{ ...row, marginBottom: 4 }}><span>{t.vat}</span><span style={{ fontFamily: "var(--mono)" }}>{fmt(vat)}</span></div>
        </div>
        <div style={{ ...row, fontSize: 16, fontWeight: 700, marginBottom: 6, borderTop: "1px solid var(--border)", paddingTop: 4 }}>
          <span>{t.total}</span><span style={{ color: "var(--amber)" }}>{fmt(total)}</span>
        </div>

        {/* ການຈ່າຍເງິນ / ຮັບເງິນ / ເງິນທອນ */}
        <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6, marginBottom: 8 }}>
          <div style={row}><span>{t.pay}</span><span style={{ fontWeight: 600, color: "var(--text1)" }}>{payLabel}{isForeign ? ` (${curSym})` : ""}</span></div>
          {receipt.method === "Split" && <div style={{ ...row, fontSize: 11 }}><span></span><span>{t.transfer} {fmt(receipt.revenueQR)} + {t.cash} {fmt(receipt.revenueCash)}</span></div>}
          {showReceived && isForeign && <div style={row}><span>{t.received}</span><span style={{ fontFamily: "var(--mono)" }}>{(receipt.foreignReceived || 0).toLocaleString()} {curSym} = {fmt(receipt.cashReceived)}</span></div>}
          {showReceived && !isForeign && <div style={row}><span>{t.received}</span><span style={{ fontFamily: "var(--mono)" }}>{fmt(receipt.cashReceived)}</span></div>}
          {showReceived && <div style={row}><span>{t.change}</span><span style={{ fontFamily: "var(--mono)", fontWeight: 600, color: "var(--text1)" }}>{fmt(receipt.change)}</span></div>}
        </div>

        {/* ທ້າຍບິນ */}
        <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 6, textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "var(--text2)", marginBottom: 3, lineHeight: 1.4 }}>{t.footer}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text1)" }}>{t.thanks}</div>
        </div>

        {/* ປຸ່ມ — ບໍ່ພິມ */}
        <div className="no-print" style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={() => { document.body.classList.add("printing-receipt"); setTimeout(() => { window.print(); setTimeout(() => document.body.classList.remove("printing-receipt"), 300); }, 80); }} style={{ flex: 1, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px", color: "var(--text1)", cursor: "pointer" }}>🖨️ Print</button>
          <button onClick={onDone} style={{ flex: 1, background: "var(--amber)", border: "none", borderRadius: 10, padding: "12px", color: "#000", fontWeight: 700, cursor: "pointer" }}>{reprint ? "Back" : "New Order"}</button>
        </div>
      </div>
    </div>
  );
}

// --- ADMIN SCREEN ---
function AdminScreen({ transactions, setTransactions, shifts, salesStats, receiveLog, setReceiveLog, users, setUsers, currentUser, minimartProducts, setMinimartProducts, shopConfig, setShopConfig, onReprint, fbDelete }) {
  const [tab, setTab] = useState("dashboard");
  const [viewMode, setViewMode] = useState("daily");
  const [filterDate, setFilterDate] = useState(TODAY_DATE);
  const [filterMonth, setFilterMonth] = useState(CURRENT_MONTH);

  const [showProdModal, setShowProdModal] = useState(false);
  const [editProd, setEditProd] = useState(null);
  const [productDetail, setProductDetail] = useState(null); // Product to view full history
  const [newProd, setNewProd] = useState({ name: "", price: "", cost: "", stock: "", lowStock: "", expiry: "", category: "Drinks", image: "", barcode: "", packOf: "", packParentBarcode: "" });

  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveData, setReceiveData] = useState({ productId: "", qty: "", expiry: "" });
  const [receiveScan, setReceiveScan] = useState("");

  const [showTxnModal, setShowTxnModal] = useState(false);
  const [editTxn, setEditTxn] = useState(null);
  const [newTxn, setNewTxn] = useState({ date: "", total: "", method: "", revenueQR: "" });
  const [errorMsg, setErrorMsg] = useState("");

  const warnDays = shopConfig.expiryWarnDays || DEFAULT_EXPIRY_WARN_DAYS;
  const [selectedLabels, setSelectedLabels] = useState([]); // Productທີ່ເລືອກພິມປ້າຍ
  const [labelSize, setLabelSize] = useState("50x38"); // ຂະໜາດປ້າຍປະຈຸບັນ
  const [topSearch, setTopSearch] = useState(""); // ຄົ້ນຫາໃນ top selling
  const [adminSearch, setAdminSearch] = useState("");
  const [adminSearchDebounced, setAdminSearchDebounced] = useState("");
  const [adminVisible, setAdminVisible] = useState(50);
  // ຊ່ອງໃສ່ເລດ — ໃຊ້ local state ໃຫ້ພິມໄດ້ອິດສະຫຼະ, ບັນທຶກຕອນພິມຈົບ (onBlur)
  const [rateTHBStr, setRateTHBStr] = useState(String(shopConfig.rateTHB ?? 630));
  const [rateVNDStr, setRateVNDStr] = useState(String(shopConfig.rateVND ?? 850));
  useEffect(() => { setRateTHBStr(String(shopConfig.rateTHB ?? 630)); }, [shopConfig.rateTHB]);
  useEffect(() => { setRateVNDStr(String(shopConfig.rateVND ?? 850)); }, [shopConfig.rateVND]);

  useEffect(() => {
    const t = setTimeout(() => setAdminSearchDebounced(adminSearch), 200);
    return () => clearTimeout(t);
  }, [adminSearch]);
  useEffect(() => { setAdminVisible(50); }, [adminSearchDebounced]);
  const [topScanMsg, setTopScanMsg] = useState("");

  // ຍິງບາໂຄດເພື່ອຄົ້ນຫາໃນໜ້າ Top Selling
  useEffect(() => {
    if (tab !== "topsell") return;
    let timer = null;
    let buf = "";
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      if (e.key === "Enter") {
        if (buf.length > 0) {
          const found = minimartProducts.find(p => p.barcode === buf);
          if (found) { setTopSearch(found.name); setTopScanMsg("✓ Found: " + found.name); }
          else { setTopScanMsg("✗ No barcode: " + buf); }
          setTimeout(() => setTopScanMsg(""), 2500);
          buf = "";
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
        clearTimeout(timer);
        buf += e.key;
        timer = setTimeout(() => { buf = ""; }, 500);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); clearTimeout(timer); };
  }, [tab, minimartProducts]);
  const [labelScanMsg, setLabelScanMsg] = useState("");

  // ຍິງບາໂຄດໃນໜ້າ Products → ເປີດ Product Detail ທັນທີ
  useEffect(() => {
    if (tab !== "products") return;
    let timer = null;
    let buf = "";
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      if (showProdModal || showReceiveModal || productDetail) return; // ບໍ່ຈັບເວລາ modal ເປີດ
      if (e.key === "Enter") {
        if (buf.length > 0) {
          const found = minimartProducts.find(p => p.barcode === buf);
          if (found) { setProductDetail(found); }
          else { setImportMsg("✗ No product with barcode: " + buf); setTimeout(() => setImportMsg(""), 3000); }
          buf = "";
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
        clearTimeout(timer);
        buf += e.key;
        timer = setTimeout(() => { buf = ""; }, 500);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); clearTimeout(timer); };
  }, [tab, minimartProducts, showProdModal, showReceiveModal, productDetail]);

  // --- ActionsStaff ---
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editStaff, setEditStaff] = useState(null);
  const [newStaff, setNewStaff] = useState({ name: "", username: "", password: "", role: "cashier" });

  const openStaffModal = (u = null) => {
    setEditStaff(u);
    setNewStaff(u ? { name: u.name, username: u.username, password: u.password, role: u.role } : { name: "", username: "", password: "", role: "cashier" });
    setErrorMsg("");
    setShowStaffModal(true);
  };

  const saveStaff = () => {
    if (!newStaff.name || !newStaff.username || !newStaff.password) { setErrorMsg("Please complete all fields"); return; }
    // ກວດUsernameຊ້ຳ
    const dup = users.find(u => u.username === newStaff.username && (!editStaff || u.id !== editStaff.id));
    if (dup) { setErrorMsg("This username is already taken"); return; }
    if (editStaff) setUsers(prev => prev.map(u => u.id === editStaff.id ? { ...u, ...newStaff } : u));
    else setUsers(prev => [...prev, { id: Date.now(), ...newStaff, active: true }]);
    setShowStaffModal(false);
  };

  const toggleStaffActive = (id) => setUsers(prev => prev.map(u => u.id === id ? { ...u, active: !u.active } : u));
  const deleteStaff = (id) => setUsers(prev => prev.filter(u => u.id !== id));

  // ຍິງບາໂຄດເພື່ອເລືອກProductພິມປ້າຍ (ເມື່ອຢູ່ tab labels)
  useEffect(() => {
    if (tab !== "labels") return;
    let timer = null;
    let buf = "";
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      if (e.key === "Enter") {
        if (buf.length > 0) {
          const found = minimartProducts.find(p => p.barcode === buf);
          if (found) {
            setSelectedLabels(prev => prev.includes(found.id) ? prev : [...prev, found.id]);
            setLabelScanMsg("✓ Added: " + found.name);
          } else {
            setLabelScanMsg("✗ No barcode: " + buf);
          }
          setTimeout(() => setLabelScanMsg(""), 2000);
          buf = "";
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
        clearTimeout(timer);
        buf += e.key;
        timer = setTimeout(() => { buf = ""; }, 500);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); clearTimeout(timer); };
  }, [tab, minimartProducts]);

  // ພິມໂດຍກຳນົດເປົ້າNote (labels / expiry) ຜ່ານ body class
  const doPrint = (target) => {
    document.body.classList.remove("printing-labels", "printing-expiry");
    document.body.classList.add("printing-" + target);
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove("printing-labels", "printing-expiry"), 300);
    }, 80);
  };

  const dashboardTxns = transactions.filter(t => {
    if (viewMode === "daily") return t.date === filterDate;
    if (viewMode === "monthly") return t.date && t.date.startsWith(filterMonth);
    if (viewMode === "all") return true;
    return true;
  });

  const summary = (() => {
    const total = dashboardTxns.reduce((s, t) => s + (t.total || 0), 0);
    const cash = dashboardTxns.reduce((s, t) => {
      if (t.method === "Split") return s + (t.revenueCash || 0);
      if (t.method === "Cash") return s + (t.total || 0);
      return s;
    }, 0);
    const qr = dashboardTxns.reduce((s, t) => {
      if (t.method === "Split") return s + (t.revenueQR || 0);
      if (t.method === "QR") return s + (t.total || 0);
      return s;
    }, 0);
    const card = dashboardTxns.reduce((s, t) => t.method === "Card" ? s + (t.total || 0) : s, 0);
    const profit = dashboardTxns.reduce((s, t) => s + (t.profit || 0), 0);
    const cost = dashboardTxns.reduce((s, t) => s + (t.cost || 0), 0);
    // ເງິນສົດຕ່າງປະເທດທີ່ຮັບຈິງ (ຈຳນວນບາດ/ຍວນ)
    const thbReceived = dashboardTxns.reduce((s, t) => (t.payCurrency === "THB" && t.foreignReceived) ? s + t.foreignReceived : s, 0);
    const vndReceived = dashboardTxns.reduce((s, t) => (t.payCurrency === "VND" && t.foreignReceived) ? s + t.foreignReceived : s, 0);
    // ແຍກTotalຕາມStnຂາຍ (ພ້ອມແຍກ ສົດ/ໂອນ/Card)
    const byStation = {};
    dashboardTxns.forEach(t => {
      const st = t.station || "?";
      if (!byStation[st]) byStation[st] = { total: 0, count: 0, cash: 0, qr: 0, card: 0 };
      byStation[st].total += (t.total || 0);
      byStation[st].count += 1;
      if (t.method === "Split") {
        byStation[st].cash += (t.revenueCash || 0);
        byStation[st].qr += (t.revenueQR || 0);
      } else if (t.method === "Cash") byStation[st].cash += (t.total || 0);
      else if (t.method === "QR") byStation[st].qr += (t.total || 0);
      else if (t.method === "Card") byStation[st].card += (t.total || 0);
    });
    return { total, cash, qr, card, profit, cost, count: dashboardTxns.length, byStation, thbReceived, vndReceived };
  })();

  // --- ນຳຂໍ້ມູນProductLog out (Export CSV) ---
  const exportProducts = () => {
    const headers = ["barcode", "name", "category", "price", "cost", "lowStock", "stock", "image"];
    const rows = minimartProducts.map(p => [
      p.barcode || "", p.name || "", p.category || "", p.price || 0, p.cost || 0,
      p.lowStock || 0, totalStock(p), p.image || ""
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(cell => {
        const s = String(cell);
        return (s.includes(",") || s.includes('"') || s.includes("\n")) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(","))
      .join("\n");
    // ໃສ່ BOM ໃຫ້ Excel ອ່ານພາສາລາວ/ໄທໄດ້ຖືກ
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products_${TODAY_DATE}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- ນຳຂໍ້ມູນProductເຂົ້າ (Import CSV) ---
  const [importMsg, setImportMsg] = useState("");
  const importProducts = (file) => {
    // ກວດກາ file extension ກ່ອນ
    const fname = file.name.toLowerCase();
    if (fname.endsWith(".xlsx") || fname.endsWith(".xls")) {
      setImportMsg("✗ Please save as CSV first (File → Save As → CSV UTF-8). Excel binary not supported.");
      setTimeout(() => setImportMsg(""), 8000);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let text = String(e.target.result || "");
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // ລົບ BOM
        const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
        if (lines.length < 2) { setImportMsg("✗ File has no data"); return; }
        const parseLine = (line) => {
          const out = []; let cur = ""; let q = false;
          for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (q) {
              if (c === '"' && line[i+1] === '"') { cur += '"'; i++; }
              else if (c === '"') q = false;
              else cur += c;
            } else {
              if (c === '"') q = true;
              else if (c === ",") { out.push(cur); cur = ""; }
              else cur += c;
            }
          }
          out.push(cur);
          return out;
        };
        const header = parseLine(lines[0]).map(h => h.trim().toLowerCase());
        const idx = (name) => header.indexOf(name);

        // ====== ກວດກາລ່ວງໜ້າ ======
        // 1) ກວດ scientific notation ໃນ barcode (Excel ປ່ຽນເລກ 13 ຫຼັກ → 9.506E+12)
        const sciRegex = /^\d+(\.\d+)?[Ee][+-]?\d+$/;
        let sciCount = 0, sampleSci = "";
        for (let i = 1; i < lines.length; i++) {
          const bc = (parseLine(lines[i])[idx("barcode")] || "").trim();
          if (sciRegex.test(bc)) { sciCount++; if (!sampleSci) sampleSci = bc; }
        }
        if (sciCount > 0) {
          setImportMsg(`✗ Found ${sciCount} barcodes as scientific notation (e.g. "${sampleSci}"). In Excel: select barcode column → Format Cells → Text → re-enter or paste barcodes → Save as CSV.`);
          setTimeout(() => setImportMsg(""), 12000);
          return;
        }
        // 2) ກວດຈຳນວນຄໍລຳບໍ່ກົງ header (ບອກວ່າມີຫຍັງຜິດ)
        const expectedCols = header.length;
        let mismatchCount = 0;
        for (let i = 1; i < lines.length; i++) {
          if (parseLine(lines[i]).length !== expectedCols) mismatchCount++;
        }
        if (mismatchCount > 0) {
          setImportMsg(`✗ ${mismatchCount} rows have wrong number of columns. This usually means numbers contain commas without quotes. In Excel: Format Cells → Number → uncheck "Use 1000 Separator" → Save as CSV.`);
          setTimeout(() => setImportMsg(""), 12000);
          return;
        }

        // ====== Import ຈິງ ======
        let added = 0, updated = 0;
        const next = [...minimartProducts];
        for (let i = 1; i < lines.length; i++) {
          const cells = parseLine(lines[i]);
          const barcode = (cells[idx("barcode")] || "").trim();
          const name = (cells[idx("name")] || "").trim();
          if (!barcode || !name) continue;
          const stockNum = parseInt(String(cells[idx("stock")] || "0").replace(/,/g, ""), 10) || 0;
          const item = {
            barcode, name,
            category: (cells[idx("category")] || "Others").trim(),
            price: parseFloat(String(cells[idx("price")] || "0").replace(/,/g, "")) || 0,
            cost: parseFloat(String(cells[idx("cost")] || "0").replace(/,/g, "")) || 0,
            lowStock: parseInt(String(cells[idx("lowstock")] || "0").replace(/,/g, ""), 10) || 0,
            image: (cells[idx("image")] || "").trim(),
          };
          const existIdx = next.findIndex(p => p.barcode === barcode);
          if (existIdx >= 0) {
            next[existIdx] = { ...next[existIdx], ...item };
            updated++;
          } else {
            next.push({ id: Date.now() + i, ...item, batches: stockNum > 0 ? [{ id: "b" + (Date.now() + i), qty: stockNum, expiry: "", status: "ok" }] : [] });
            added++;
          }
        }
        setMinimartProducts(next);
        // ບັນທຶກສິນຄ້າທັງໝົດໄປ Firebase ຫຼັງ import (bulk save — ໃຊ້ writes ຫຼາຍແຕ່ນານໆເຮັດ)
        if (typeof window !== "undefined" && window.fbSaveAllProducts) window.fbSaveAllProducts(next);
        setImportMsg(`✓ Done: added ${added} new, updated ${updated}`);
        setTimeout(() => setImportMsg(""), 5000);
      } catch (err) {
        setImportMsg("✗ Cannot read file: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const openProdModal = (p = null) => {
    setEditProd(p);
    setNewProd(p ? { ...p, price: String(p.price), cost: String(p.cost ?? ""), lowStock: String(p.lowStock ?? ""), packOf: String(p.packOf ?? ""), packParentBarcode: p.packParentBarcode ?? "" } : { name: "", price: "", cost: "", lowStock: "", category: "Drinks", image: "", barcode: "", packOf: "", packParentBarcode: "" });
    setErrorMsg("");
    setShowProdModal(true);
  };

  const saveProduct = () => {
    if (!newProd.name || !newProd.price || !newProd.barcode) {
      setErrorMsg("Please fill in all fields (barcode, name, price).");
      return;
    }
    const item = {
      name: newProd.name,
      barcode: newProd.barcode,
      category: newProd.category,
      image: newProd.image,
      price: parseFloat(newProd.price) || 0,
      cost: parseFloat(newProd.cost) || 0,
      lowStock: parseInt(newProd.lowStock, 10) || 0,
      packOf: parseInt(newProd.packOf, 10) || 0,
      packParentBarcode: (newProd.packParentBarcode || "").trim(),
    };
    if (editProd) {
      const updated = { ...editProd, ...item };
      setMinimartProducts(prev => prev.map(x => x.id === editProd.id ? updated : x));
      if (typeof window !== "undefined" && window.fbSaveOneProduct) window.fbSaveOneProduct(updated);
    } else {
      const created = { id: Date.now(), ...item, batches: [] };
      setMinimartProducts(prev => [...prev, created]);
      if (typeof window !== "undefined" && window.fbSaveOneProduct) window.fbSaveOneProduct(created);
    }
    setShowProdModal(false);
  };

  // --- Receive stock (add new lot)
  // ຍິງບາໂຄດຫາProductເມື່ອ modal ຮັບເຄື່ອງເປີດ
  useEffect(() => {
    if (!showReceiveModal) return;
    let timer = null;
    let buf = "";
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      if (e.key === "Enter") {
        if (buf.length > 0) {
          const found = minimartProducts.find(p => p.barcode === buf);
          if (found) { setReceiveData(d => ({ ...d, productId: String(found.id) })); setErrorMsg(""); setReceiveScan(found.name); }
          else { setErrorMsg("No product for barcode: " + buf); setReceiveScan(""); }
          buf = "";
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
        clearTimeout(timer);
        buf += e.key;
        timer = setTimeout(() => { buf = ""; }, 500);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); clearTimeout(timer); };
  }, [showReceiveModal, minimartProducts]);

  const receiveStock = () => {
    const qty = parseInt(receiveData.qty, 10);
    if (!receiveData.productId) { setErrorMsg("Please select a product"); return; }
    if (isNaN(qty) || qty <= 0) { setErrorMsg("Please enter a quantity"); return; }
    const prod = minimartProducts.find(p => p.id === parseInt(receiveData.productId, 10));
    const newBatch = { id: "b" + Date.now(), qty, expiry: receiveData.expiry || "", status: "ok" };
    setMinimartProducts(prev => {
      const updated = prev.map(p => p.id === parseInt(receiveData.productId, 10)
        ? { ...p, batches: [...(p.batches || []), newBatch] } : p);
      // ບັນທຶກສິນຄ້າທີ່ໄດ້ຮັບເຄື່ອງ
      const target = updated.find(p => p.id === parseInt(receiveData.productId, 10));
      if (target && typeof window !== "undefined" && window.fbSaveOneProduct) window.fbSaveOneProduct(target);
      return updated;
    });
    // ບັນທຶກ log ການຮັບເຄື່ອງເຂົ້າ
    const now = new Date();
    setReceiveLog(prev => [{
      id: "RCV-" + now.getTime(),
      productId: prod ? prod.id : null,
      productName: prod ? prod.name : "?",
      barcode: prod ? prod.barcode : "",
      qty,
      expiry: receiveData.expiry || "",
      receivedBy: currentUser ? currentUser.name : "?",
      date: TODAY_DATE,
      time: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      timestamp: now.getTime(),
    }, ...prev]);
    setShowReceiveModal(false);
    setReceiveData({ productId: "", qty: "", expiry: "" });
  };

  // --- ປ່ຽນStatusລັອດ (ກວດແລ້ວ / ເທີນແລ້ວ) ---
  const setBatchStatus = (productId, batchId, status) => {
    setMinimartProducts(prev => {
      const updated = prev.map(p => {
        if (p.id !== productId) return p;
        return { ...p, batches: (p.batches || []).map(b => b.id === batchId ? { ...b, status } : b) };
      });
      const target = updated.find(p => p.id === productId);
      if (target && typeof window !== "undefined" && window.fbSaveOneProduct) window.fbSaveOneProduct(target);
      return updated;
    });
  };

  const openTxnModal = (t) => {
    setEditTxn(t);
    setNewTxn({ date: t.date, total: t.total, method: t.method, revenueQR: t.revenueQR || "" });
    setErrorMsg("");
    setShowTxnModal(true);
  };

  const saveTxn = () => {
    const tTotal = parseFloat(newTxn.total);
    if (isNaN(tTotal)) { setErrorMsg("Invalid total"); return; }
    let rCash = 0, rQR = 0;
    if (newTxn.method === "Cash") rCash = tTotal;
    else if (newTxn.method === "QR") rQR = tTotal;
    else if (newTxn.method === "Split") { rQR = parseFloat(newTxn.revenueQR || 0); rCash = tTotal - rQR; }
    const updated = { ...editTxn, date: newTxn.date, total: tTotal, method: newTxn.method, revenueCash: rCash, revenueQR: rQR };
    setTransactions(prev => prev.map(x => x.id === editTxn.id ? updated : x));
    // ບັນທຶກໂດຍກົງ Firebase
    if (typeof window !== "undefined" && window.fbSaveOneTxn) window.fbSaveOneTxn(updated);
    setShowTxnModal(false);
  };

  return (
    <div style={{ height: "calc(100vh - 56px)", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      {/* Admin Tabs */}
      <div style={{ display: "flex", gap: 6, padding: "12px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg1)", flexWrap: "wrap" }}>
        {[["dashboard", "📊 Dashboard"], ["products", "📦 Products"], ["topsell", "🔥 Top Sellers"], ["alerts", "🔔 Stock/Expired"], ["receive", "📥 Receive Log"], ["labels", "🏷️ Price Labels"], ["staff", "👥 Staff"], ["shifts", "📋 Shifts"], ["transactions", "🧾 Bills"], ["settings", "⚙️ Settings"]].map(([k, l]) => {
          const alertCount = (k === "alerts") ? minimartProducts.filter(p => { const ss = stockStatus(p); const eb = earliestBatch(p); const es = expiryStatus(eb ? eb.expiry : null, warnDays).level; return ss !== "ok" || es === "expired" || es === "soon"; }).length : 0;
          return (
          <button key={k} onClick={() => setTab(k)} style={{ position: "relative", background: tab === k ? "var(--amber-glow)" : "transparent", border: tab === k ? "1px solid var(--border-amber)" : "1px solid transparent", borderRadius: 8, padding: "6px 16px", fontSize: 13, color: tab === k ? "var(--amber)" : "var(--text2)", cursor: "pointer" }}>{l}{alertCount > 0 && <span style={{ marginLeft: 6, background: "var(--red)", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>{alertCount}</span>}</button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        {tab === "dashboard" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Sales Report</div>
              <div style={{ display: "flex", gap: 10 }}>
                <select value={viewMode} onChange={e => setViewMode(e.target.value)} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", color: "#fff" }}>
                  <option value="daily">Daily</option>
                  <option value="monthly">Monthly</option>
                  <option value="all">All bills</option>
                </select>
                {viewMode === "daily" && <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", color: "#fff" }} />}
                {viewMode === "monthly" && <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", color: "#fff" }} />}
                {viewMode === "all" && <span style={{ fontSize: 12, color: "var(--text3)", alignSelf: "center" }}>Showing {transactions.length} bills total</span>}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", padding: 20, borderRadius: 12, textAlign: "center" }}>
                <div style={{ fontSize: 14, color: "var(--text2)" }}>💰 Total Sales ({viewMode === "daily" ? filterDate : filterMonth})</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: "var(--amber)", marginTop: 6 }}>₭{(summary.total || 0).toLocaleString()}</div>
                <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 4 }}>{summary.count} orders · cost ₭{(summary.cost || 0).toLocaleString()}</div>
              </div>
              <div style={{ background: "var(--bg1)", border: "1px solid rgba(92,184,120,0.3)", padding: 20, borderRadius: 12, textAlign: "center" }}>
                <div style={{ fontSize: 14, color: "var(--text2)" }}>📈 Total Profit</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: "var(--green)", marginTop: 6 }}>₭{(summary.profit || 0).toLocaleString()}</div>
                <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 4 }}>{summary.total > 0 ? Math.round((summary.profit / summary.total) * 100) : 0}% of sales</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 8 }}>💵 Cash</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--green)" }}>₭{(summary.cash || 0).toLocaleString()}</div>
              </div>
              <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 8 }}>📱 Transfer (QR)</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--blue)" }}>₭{(summary.qr || 0).toLocaleString()}</div>
              </div>
              <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 8 }}>💳 Card (Card)</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--amber)" }}>₭{(summary.card || 0).toLocaleString()}</div>
              </div>
            </div>

            {/* ເງິນສົດຕ່າງປະເທດທີ່ຮັບ + ຍອດລວມ */}
            <div style={{ fontSize: 15, fontWeight: 700, margin: "28px 0 14px" }}>💱 ເງິນສົດຕ່າງປະເທດທີ່ຮັບ</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 8 }}>฿ ເງິນບາດ (THB)</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--blue)" }}>{(summary.thbReceived || 0).toLocaleString()} ฿</div>
              </div>
              <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 8 }}>¥ ເງິນຍວນ (VND)</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--green)" }}>{(summary.vndReceived || 0).toLocaleString()} ¥</div>
              </div>
              <div style={{ background: "var(--bg1)", border: "1px solid var(--border-amber)", borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 8 }}>💰 ຍອດລວມ (ກີບ)</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--amber)" }}>₭{(summary.total || 0).toLocaleString()}</div>
              </div>
            </div>

            {/* ແຍກTotalຂາຍຕາມStnຂາຍ */}
            <div style={{ fontSize: 15, fontWeight: 700, margin: "28px 0 14px" }}>🖥️ Sales by Station</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              {["1", "2"].map(st => {
                const d = summary.byStation[st] || { total: 0, count: 0, cash: 0, qr: 0, card: 0 };
                return (
                  <div key={st} style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: st === "1" ? "var(--blue)" : "var(--green)" }}>🖥️ Station {st}</span>
                      <span style={{ fontSize: 12, color: "var(--text3)" }}>{d.count} bills</span>
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "var(--amber)", marginBottom: 12 }}>₭{(d.total || 0).toLocaleString()}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: "var(--text2)" }}>💵 Cash</span><span style={{ color: "var(--green)", fontWeight: 600 }}>₭{(d.cash || 0).toLocaleString()}</span></div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: "var(--text2)" }}>📱 Transfer</span><span style={{ color: "var(--blue)", fontWeight: 600 }}>₭{(d.qr || 0).toLocaleString()}</span></div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: "var(--text2)" }}>💳 Card</span><span style={{ color: "var(--amber)", fontWeight: 600 }}>₭{(d.card || 0).toLocaleString()}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "products" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Products ({minimartProducts.length} items)</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={async () => { if (typeof window !== "undefined" && window.fbLoadProducts) { const list = await window.fbLoadProducts(); if (Array.isArray(list) && list.length > 0) { setMinimartProducts(list); setImportMsg("✓ Refreshed " + list.length + " products from cloud"); setTimeout(() => setImportMsg(""), 3000); } } }} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", color: "var(--text1)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>🔄 Refresh</button>
                <button onClick={exportProducts} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>⬇️ Export CSV</button>
                <label style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                  ⬆️ Import CSV
                  <input type="file" accept=".csv" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) { importProducts(e.target.files[0]); e.target.value = ""; } }} />
                </label>
                <button onClick={() => { setReceiveData({ productId: "", qty: "", expiry: "", barcodeSearch: "" }); setReceiveScan(""); setErrorMsg(""); setShowReceiveModal(true); }} style={{ background: "var(--green)", border: "none", borderRadius: 8, padding: "8px 14px", color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>📥 Receive Stock</button>
                <button onClick={() => openProdModal()} style={{ background: "var(--amber)", border: "none", borderRadius: 8, padding: "8px 14px", color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>+ Add Product</button>
              </div>
            </div>
            {importMsg && <div style={{ fontSize: 13, color: importMsg.startsWith("✓") ? "var(--green)" : "var(--red)", marginBottom: 12, background: "var(--bg2)", padding: "8px 12px", borderRadius: 6 }}>{importMsg}</div>}
            <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 8 }}>💡 Export a CSV for Excel/Google Sheets · Import matches by barcode (existing = update, new = add)</div>
            <div style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.25)", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "var(--green)", fontWeight: 600 }}>📡 Scan a barcode to instantly open that product's history</div>
            <input value={adminSearch} onChange={e => setAdminSearch(e.target.value)} placeholder="🔍 Search by name or barcode..." style={{ width: "100%", maxWidth: 600, background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 14 }} />
            {(() => {
              const s = adminSearchDebounced.toLowerCase().trim();
              const list = s === "" ? minimartProducts : minimartProducts.filter(p => p.name.toLowerCase().includes(s) || (p.barcode || "").includes(s));
              const show = list.slice(0, adminVisible);
              return (
              <>
              <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 10 }}>Showing {show.length} of {list.length}{list.length !== minimartProducts.length && ` (filtered from ${minimartProducts.length})`}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
              {show.map(p => {
                const ss = stockStatus(p);
                const eb = earliestBatch(p);
                const es = expiryStatus(eb ? eb.expiry : null, warnDays);
                const batchCount = (p.batches || []).filter(b => b.status !== "returned" && b.qty > 0).length;
                return (
                <div key={p.id} style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
                  <img src={p.image} style={{ width: 50, height: 50, borderRadius: 8, objectFit: "cover" }} onError={e => e.target.src = "https://placehold.co/50x50"} alt={p.name} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: "var(--amber)" }}>BC: {p.barcode}</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 13, color: "var(--text2)" }}>₭{(p.price || 0).toLocaleString()}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: ss === "out" ? "var(--red)" : ss === "low" ? "#d98324" : "var(--text3)" }}>📦 Stock: {totalStock(p)}{batchCount > 1 ? ` (${batchCount} lots)` : ""}</span>
                      {eb && eb.expiry && <span style={{ fontSize: 11, color: es.level === "expired" ? "var(--red)" : es.level === "soon" ? "#d98324" : "var(--text3)" }}>⏰ {eb.expiry}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <button onClick={() => setProductDetail(p)} style={{ background: "var(--amber-glow)", border: "1px solid var(--border-amber)", color: "var(--amber)", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>📊 History</button>
                    <button onClick={() => openProdModal(p)} style={{ background: "var(--bg2)", border: "1px solid var(--border)", color: "var(--text1)", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11 }}>✏️ Edit</button>
                  </div>
                </div>
                );
              })}
              </div>
              {list.length > adminVisible && (
                <div style={{ textAlign: "center", marginTop: 16 }}>
                  <button onClick={() => setAdminVisible(v => v + 50)} style={{ background: "var(--bg1)", border: "1px solid var(--border-amber)", color: "var(--amber)", padding: "10px 24px", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Load 50 more ↓</button>
                </div>
              )}
              </>
              );
            })()}
          </div>
        )}

        {tab === "topsell" && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>🔥 Top Selling (cumulative)</div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 14 }}>Ranked by units sold — scan a barcode or type a name to find a specific product</div>

            <div style={{ background: "rgba(92,184,120,0.1)", border: "1px solid rgba(92,184,120,0.3)", borderRadius: 8, padding: "10px 12px", marginBottom: 12, fontSize: 12, color: "var(--green)", fontWeight: 600 }}>📡 Scan a barcode to search products{topScanMsg && <span style={{ color: topScanMsg.startsWith("✓") ? "var(--amber)" : "var(--red)", marginLeft: 8 }}>{topScanMsg}</span>}</div>

            <input value={topSearch} onChange={e => setTopSearch(e.target.value)} placeholder="🔍 Search by product name or scan barcode..." style={{ width: "100%", maxWidth: 800, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", color: "var(--text1)", fontSize: 13, outline: "none", marginBottom: 16 }} />

            {(() => {
              // ລວມProductທຸກໂຕ (ລວມໂຕທີ່ຍັງບໍ່ໄດ້ຂາຍ = 0 
              const all = minimartProducts.map(p => {
                const st = salesStats[p.id] || { qty: 0, revenue: 0, profit: 0 };
                return { id: p.id, name: p.name, barcode: p.barcode, qty: st.qty, revenue: st.revenue, profit: st.profit };
              });
              // Add Productທີ່ມີໃນ salesStats ແຕ່ຖືກDeleteLog outຈາກ products ແລ້ວ
              Object.entries(salesStats || {}).forEach(([id, d]) => {
                if (!all.find(x => String(x.id) === String(id))) all.push({ id, name: d.name, barcode: "", qty: d.qty, revenue: d.revenue, profit: d.profit });
              });
              const q = topSearch.trim().toLowerCase();
              const filtered = q === "" ? all : all.filter(p => p.name.toLowerCase().includes(q) || (p.barcode || "").includes(q));
              filtered.sort((a, b) => b.qty - a.qty);

              if (filtered.length === 0) return <div style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>No products found</div>;
              const maxQty = Math.max(...filtered.map(p => p.qty), 1);
              const rank = (p) => all.slice().sort((a, b) => b.qty - a.qty).findIndex(x => String(x.id) === String(p.id));
              const medal = (r) => r === 0 ? "🥇" : r === 1 ? "🥈" : r === 2 ? "🥉" : `${r + 1}.`;

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 800 }}>
                  {filtered.slice(0, 50).map((p) => {
                    const r = rank(p);
                    return (
                    <div key={p.id} style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 14, opacity: p.qty === 0 ? 0.5 : 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, width: 36, textAlign: "center", color: r < 3 && p.qty > 0 ? "var(--amber)" : "var(--text3)" }}>{p.qty > 0 ? medal(r) : "–"}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{p.name}{p.barcode && <span style={{ fontSize: 11, color: "var(--text3)", marginLeft: 8 }}>BC:{p.barcode}</span>}</div>
                        <div style={{ height: 6, background: "var(--bg3)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${(p.qty / maxQty) * 100}%`, height: "100%", background: "var(--amber)" }} />
                        </div>
                      </div>
                      <div style={{ textAlign: "right", minWidth: 110 }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: p.qty > 0 ? "var(--amber)" : "var(--text3)" }}>{p.qty} sold</div>
                        <div style={{ fontSize: 11, color: "var(--text3)" }}>Total ₭{(p.revenue || 0).toLocaleString()}</div>
                        <div style={{ fontSize: 11, color: "var(--green)" }}>Profit ₭{(p.profit || 0).toLocaleString()}</div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {tab === "alerts" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }} className="no-print">
              <div style={{ fontSize: 15, fontWeight: 600 }}>🔔 Expiry / Stock Check</div>
              <button onClick={() => doPrint("expiry")} style={{ background: "var(--amber)", border: "none", borderRadius: 8, padding: "8px 16px", color: "#000", fontWeight: 700, cursor: "pointer" }}>🖨️ Print Check Sheet (A4)</button>
            </div>
            {(() => {
              // ສ້າງລາຍການລະດັບລັອດ (batch) ສຳລັບOut/ໃກ້Out
              const rows = [];
              minimartProducts.forEach(p => {
                (p.batches || []).forEach(b => {
                  if (b.status === "returned") return;
                  const es = expiryStatus(b.expiry, warnDays);
                  if (es.level === "expired" || es.level === "soon") {
                    rows.push({ p, b, es });
                  }
                });
              });
              rows.sort((a, c) => (a.es.days ?? 9999) - (c.es.days ?? 9999));
              const out = minimartProducts.filter(p => stockStatus(p) === "out");
              const low = minimartProducts.filter(p => stockStatus(p) === "low");

              return (
                <div id="printable-expiry">
                  {/* ຫົວໃບພິມ (ເຫັນສະເພາະຕອນພິມ) */}
                  <div className="print-only" style={{ display: "none", marginBottom: 16, color: "#000" }}>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{shopConfig.name} — Expiry Check Sheet</div>
                    <div style={{ fontSize: 13 }}>Printed: {TODAY_DATE} · warn ahead {warnDays} d</div>
                  </div>

                  {/* ຕາຕະລາງລັອດExpired */}
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--amber)", marginBottom: 10 }}>📋 Expired / Expiring Lots ({rows.length})</div>
                  {rows.length === 0
                    ? <div style={{ padding: 20, color: "var(--green)" }} className="no-print">✓ No lots near expiry</div>
                    : <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 24 }} className="expiry-table">
                        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 0.7fr 1fr 0.9fr 1.4fr", padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: 11, color: "var(--text3)", fontWeight: 700 }}>
                          <span>Product</span><span>Qty</span><span>Expiry</span><span>Status</span><span className="no-print">Note</span>
                        </div>
                        {rows.map(({ p, b, es }) => (
                          <div key={p.id + b.id} style={{ display: "grid", gridTemplateColumns: "1.6fr 0.7fr 1fr 0.9fr 1.4fr", padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 13, alignItems: "center" }}>
                            <span style={{ fontWeight: 600 }}>{p.name}</span>
                            <span>{b.qty}</span>
                            <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{b.expiry || "-"}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: es.level === "expired" ? "var(--red)" : "#d98324" }}>{es.level === "expired" ? `Out ${Math.abs(es.days)}d` : `left ${es.days}d`}</span>
                            <div style={{ display: "flex", gap: 6 }} className="no-print">
                              {b.status === "ok" && <>
                                <button onClick={() => setBatchStatus(p.id, b.id, "checked")} style={{ background: "rgba(90,158,224,0.15)", border: "none", color: "var(--blue)", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>✓ Checked</button>
                                <button onClick={() => setBatchStatus(p.id, b.id, "returned")} style={{ background: "rgba(224,90,90,0.15)", border: "none", color: "var(--red)", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>↩ Returned</button>
                              </>}
                              {b.status === "checked" && <span style={{ fontSize: 11, color: "var(--blue)", fontWeight: 700 }}>✓ Checked <button onClick={() => setBatchStatus(p.id, b.id, "ok")} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 11, textDecoration: "underline" }}>Cancel</button></span>}
                            </div>
                            <span style={{ display: "none" }} className="print-status">{b.status === "checked" ? "[checked]" : "☐ ____"}</span>
                          </div>
                        ))}
                      </div>
                  }

                  {/* Stock */}
                  <div className="no-print">
                    {out.length > 0 && <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--red)", marginBottom: 10 }}>📭 OutStock ({out.length})</div>
                      {out.map(p => <div key={p.id} style={{ fontSize: 13, color: "var(--text2)", padding: "4px 0" }}>• {p.name} — reorder needed</div>)}
                    </div>}
                    {low.length > 0 && <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#d98324", marginBottom: 10 }}>📉 StockExp ({low.length})</div>
                      {low.map(p => <div key={p.id} style={{ fontSize: 13, color: "var(--text2)", padding: "4px 0" }}>• {p.name} — left {totalStock(p)} units (alert ≤{p.lowStock})</div>)}
                    </div>}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {tab === "receive" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>📥 Stock Receive History ({receiveLog.length})</div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>Every time someone receives stock — who, when, what, how much</div>
              </div>
              <button onClick={() => { setReceiveData({ productId: "", qty: "", expiry: "", barcodeSearch: "" }); setReceiveScan(""); setErrorMsg(""); setShowReceiveModal(true); }} style={{ background: "var(--green)", border: "none", borderRadius: 8, padding: "10px 16px", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>📥 Receive Stock</button>
            </div>
            {receiveLog.length === 0
              ? <div style={{ textAlign: "center", padding: 60, color: "var(--text3)", background: "var(--bg1)", borderRadius: 12 }}>No stock receive history yet</div>
              : <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 2.5fr 0.6fr 1fr 1.2fr", padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 11, color: "var(--text3)", textTransform: "uppercase", fontWeight: 600, letterSpacing: 0.5 }}>
                    <span>Date</span>
                    <span>Time</span>
                    <span>Product</span>
                    <span style={{ textAlign: "right" }}>Qty</span>
                    <span>Expiry</span>
                    <span>Received by</span>
                  </div>
                  {receiveLog.slice(0, 200).map((r, i) => (
                    <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 2.5fr 0.6fr 1fr 1.2fr", padding: "12px 16px", borderBottom: i < Math.min(receiveLog.length, 200) - 1 ? "1px solid var(--border)" : "none", fontSize: 13, alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "var(--text2)" }}>{r.date}</span>
                      <span style={{ fontSize: 12, color: "var(--text2)", fontFamily: "var(--mono)" }}>{r.time}</span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{r.productName}</div>
                        {r.barcode && <div style={{ fontSize: 10, color: "var(--text3)", fontFamily: "var(--mono)" }}>BC: {r.barcode}</div>}
                      </div>
                      <span style={{ fontWeight: 700, color: "var(--green)", textAlign: "right" }}>+{r.qty}</span>
                      <span style={{ fontSize: 12, color: r.expiry ? "var(--text2)" : "var(--text3)" }}>{r.expiry || "—"}</span>
                      <span style={{ fontSize: 12 }}>{r.receivedBy}</span>
                    </div>
                  ))}
                  {receiveLog.length > 200 && <div style={{ padding: 12, textAlign: "center", fontSize: 12, color: "var(--text3)" }}>Showing latest 200 of {receiveLog.length} entries</div>}
                </div>
            }
          </div>
        )}

        {tab === "labels" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>🏷️ Price Labels — select products to print</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setSelectedLabels(minimartProducts.map(p => p.id))} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 12px", color: "#fff", cursor: "pointer", fontSize: 12 }}>Select All</button>
                <button onClick={() => setSelectedLabels([])} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 12px", color: "#fff", cursor: "pointer", fontSize: 12 }}>Clear</button>
                <button onClick={() => doPrint("labels")} disabled={selectedLabels.length === 0} style={{ background: selectedLabels.length ? "var(--amber)" : "var(--bg3)", border: "none", borderRadius: 6, padding: "6px 16px", color: selectedLabels.length ? "#000" : "var(--text3)", fontWeight: 700, cursor: selectedLabels.length ? "pointer" : "not-allowed", fontSize: 12 }}>🖨️ Print Labels ({selectedLabels.length})</button>
              </div>
            </div>

            <div className="no-print" style={{ background: "rgba(92,184,120,0.1)", border: "1px solid rgba(92,184,120,0.3)", borderRadius: 8, padding: "10px 12px", marginBottom: 16, fontSize: 12, color: "var(--green)", fontWeight: 600 }}>📡 Scan a barcode to add a product to the print list{labelScanMsg && <span style={{ color: labelScanMsg.startsWith("✓") ? "var(--amber)" : "var(--red)", marginLeft: 8 }}>{labelScanMsg}</span>}</div>

            {/* ເລືອກProduct (ບໍ່ພິມ) */}
            <input value={adminSearch} onChange={e => setAdminSearch(e.target.value)} placeholder="🔍 Search products to add labels..." className="no-print" style={{ width: "100%", maxWidth: 500, background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 14 }} />
            <div className="no-print" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginBottom: 24 }}>
              {(() => {
                const s = adminSearchDebounced.toLowerCase().trim();
                const list = s === "" ? minimartProducts : minimartProducts.filter(p => p.name.toLowerCase().includes(s) || (p.barcode || "").includes(s));
                return list.slice(0, adminVisible).map(p => {
                const sel = selectedLabels.includes(p.id);
                return (
                  <button key={p.id} onClick={() => setSelectedLabels(sel ? selectedLabels.filter(x => x !== p.id) : [...selectedLabels, p.id])} style={{ background: sel ? "var(--amber-glow)" : "var(--bg1)", border: "1px solid " + (sel ? "var(--border-amber)" : "var(--border)"), borderRadius: 8, padding: "10px 12px", display: "flex", gap: 10, alignItems: "center", cursor: "pointer", textAlign: "left" }}>
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: "1px solid var(--border-amber)", background: sel ? "var(--amber)" : "transparent", color: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{sel ? "✓" : ""}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)" }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: "var(--amber)" }}>₭{(p.price || 0).toLocaleString()}</div>
                    </div>
                  </button>
                );
              });
              })()}
            </div>

            {/* ປ້າຍລາຄາ (ພິມໄດ້) */}
            <div className="no-print" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text1)", marginBottom: 10 }}>Label size</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
                {[
                  { id: "50x38", w: 50, h: 38, perA4: 18 },
                  { id: "50x40", w: 50, h: 40, perA4: 8 },
                  { id: "58x38", w: 58, h: 38, perA4: 18 },
                  { id: "80x38", w: 80, h: 38, perA4: 14 },
                  { id: "101x38", w: 101, h: 38, perA4: 12 },
                  { id: "100x70", w: 100, h: 70, perA4: 8 },
                  { id: "210x100", w: 210, h: 100, perA4: 3 },
                  { id: "210x290", w: 210, h: 290, perA4: 1 },
                ].map(sz => {
                  const sel = labelSize === sz.id;
                  return (
                    <label key={sz.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: sel ? "var(--amber-glow)" : "var(--bg1)", border: "1px solid " + (sel ? "var(--border-amber)" : "var(--border)"), borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
                      <input type="radio" name="labelSize" value={sz.id} checked={sel} onChange={() => setLabelSize(sz.id)} style={{ accentColor: "var(--amber)" }} />
                      <span style={{ color: sel ? "var(--amber)" : "var(--text1)", fontWeight: sel ? 600 : 400 }}>Label {sz.w}×{sz.h}mm</span>
                      <span style={{ color: "var(--text3)", fontSize: 11, marginLeft: "auto" }}>A4: {sz.perA4} pcs</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12 }} className="no-print">Preview (will print at exact mm size on A4):</div>
            {(() => {
              const sizes = { "50x38":[50,38], "50x40":[50,40], "58x38":[58,38], "80x38":[80,38], "101x38":[101,38], "100x70":[100,70], "210x100":[210,100], "210x290":[210,290] };
              const [w, h] = sizes[labelSize] || [50, 38];
              // ກຳນົດຂະໜາດຟອນຕາມຂະໜາດປ້າຍ (ໃຊ້ສ່ວນສູງເປັນຫຼັກ)
              const px = (mm) => `${mm}mm`;
              const priceFont = Math.max(10, Math.min(48, Math.round(h * 0.32)));
              const nameFont = Math.max(7, Math.min(18, Math.round(h * 0.13)));
              const bcFont = Math.max(6, Math.min(14, Math.round(h * 0.09)));
              const shopFont = Math.max(6, Math.min(11, Math.round(h * 0.08)));
              return (
                <div id="printable-labels" className={"labels-w-" + labelSize} style={{ display: "flex", flexWrap: "wrap", gap: "2mm" }}>
                  {minimartProducts.filter(p => selectedLabels.includes(p.id)).map(p => (
                    <div key={p.id} className="price-label" style={{ width: px(w), height: px(h), background: "#fff", color: "#000", border: "0.5px solid #000", padding: "1.5mm", display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center", textAlign: "center", overflow: "hidden", boxSizing: "border-box" }}>
                      <div style={{ fontSize: shopFont, fontWeight: 600, color: "#666", width: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shopConfig.name}</div>
                      <div style={{ fontSize: nameFont, fontWeight: 700, lineHeight: 1.1, width: "100%", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.name}</div>
                      <div style={{ fontSize: priceFont, fontWeight: 800, color: "#000", fontFamily: "var(--mono)", lineHeight: 1 }}>₭{(p.price || 0).toLocaleString()}</div>
                      <div style={{ fontSize: bcFont, fontFamily: "var(--mono)", color: "#000", letterSpacing: 0.5 }}>{p.barcode}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
            {selectedLabels.length === 0 && <div className="no-print" style={{ textAlign: "center", padding: 30, color: "var(--text3)" }}>No products selected — pick some above first</div>}
          </div>
        )}

        {tab === "shifts" && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>📋 Shift History ({shifts.length})</div>
            {shifts.length === 0
              ? <div style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>No closed shifts yet</div>
              : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
                  {shifts.map(s => (
                    <div key={s.id} style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: s.station === "1" ? "var(--blue)" : "var(--green)" }}>🖥️ Station {s.station}</span>
                        <span style={{ fontSize: 11, color: "var(--text3)" }}>{s.closeDate}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 10 }}>
                        <div>Open: {s.openedBy} · {s.openedAt}</div>
                        <div>Close: {s.closedBy} · {s.closedAt}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text2)" }}>Sales ({s.txnCount} bills)</span><span style={{ color: "var(--amber)", fontWeight: 600 }}>₭{(s.sales?.total || 0).toLocaleString()}</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text2)" }}>📈 Profit</span><span style={{ color: "var(--green)", fontWeight: 600 }}>₭{(s.sales?.profit || 0).toLocaleString()}</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span style={{ color: "var(--text3)" }}>Cash / Transfer / Card</span><span style={{ color: "var(--text2)" }}>{(s.sales?.cash || 0).toLocaleString()} / {(s.sales?.qr || 0).toLocaleString()} / {(s.sales?.card || 0).toLocaleString()}</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 6, marginTop: 2, fontWeight: 700, color: s.cashDiff === 0 ? "var(--green)" : s.cashDiff > 0 ? "var(--blue)" : "var(--red)" }}>
                          <span>{s.cashDiff === 0 ? "✓ Balanced" : s.cashDiff > 0 ? "▲ Over" : "▼ Short"}</span>
                          <span>₭{Math.abs(s.cashDiff || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}

        {tab === "staff" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>👥 Staff Management ({users.length}  )</div>
              <button onClick={() => openStaffModal()} style={{ background: "var(--amber)", border: "none", borderRadius: 8, padding: "8px 16px", color: "#000", fontWeight: 700, cursor: "pointer" }}>+ Add Staff</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
              {users.map(u => (
                <div key={u.id} style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, opacity: u.active ? 1 : 0.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>@{u.username}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 12, background: u.role === "admin" ? "var(--amber-glow)" : "rgba(90,158,224,0.15)", color: u.role === "admin" ? "var(--amber)" : "var(--blue)" }}>{u.role === "admin" ? "Manager" : "Cashier"}</span>
                  </div>
                  <div style={{ fontSize: 12, color: u.active ? "var(--green)" : "var(--red)", marginBottom: 12 }}>{u.active ? "🟢 Active" : "🔴 Disabled"}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => openStaffModal(u)} style={{ flex: 1, background: "var(--bg2)", border: "1px solid var(--border)", color: "#fff", padding: "6px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Edit</button>
                    <button onClick={() => toggleStaffActive(u.id)} style={{ flex: 1, background: "var(--bg2)", border: "1px solid var(--border)", color: u.active ? "#d98324" : "var(--green)", padding: "6px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>{u.active ? "Disable" : "Enable"}</button>
                    {u.role !== "admin" && <button onClick={() => deleteStaff(u.id)} style={{ background: "rgba(224,90,90,0.1)", border: "none", color: "var(--red)", padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Delete</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "transactions" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>All Bills</div>
              <div style={{ display: "flex", gap: 10 }}>
                <select value={viewMode} onChange={e => setViewMode(e.target.value)} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", color: "#fff" }}>
                  <option value="daily">Daily</option>
                  <option value="monthly">Monthly</option>
                  <option value="all">All bills</option>
                </select>
                {viewMode === "daily" && <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", color: "#fff" }} />}
                {viewMode === "monthly" && <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", color: "#fff" }} />}
                {viewMode === "all" && <span style={{ fontSize: 12, color: "var(--text3)", alignSelf: "center" }}>Showing {transactions.length} bills total</span>}
              </div>
            </div>
            {dashboardTxns.length === 0
              ? <div style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>No records</div>
              : <TxnTable transactions={dashboardTxns} onEdit={openTxnModal} onDelete={(id) => { setTransactions(prev => prev.filter(t => t.id !== id)); if (fbDelete) fbDelete(id); }} onReprint={onReprint} />
            }
          </div>
        )}

        {tab === "settings" && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Store Settings</div>
            <div style={{ background: "var(--bg1)", padding: 24, borderRadius: 16, border: "1px solid var(--border)", maxWidth: 500 }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, display: "block", marginBottom: 6, color: "var(--text2)" }}>Store Name</label>
                <input value={shopConfig.name} onChange={e => setShopConfig({ ...shopConfig, name: e.target.value })} style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px", color: "#fff" }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, display: "block", marginBottom: 6, color: "var(--text2)" }}>Payment Account</label>
                <input value={shopConfig.promptPay} onChange={e => setShopConfig({ ...shopConfig, promptPay: e.target.value })} style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px", color: "#fff" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, display: "block", marginBottom: 6, color: "var(--text2)" }}>QR ຮັບເງິນ (ອັບໂຫຼດຮູບ ຫຼື ໃສ່ URL)</label>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 90, height: 90, borderRadius: 10, background: "#fff", border: "1px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                    {shopConfig.qrImage
                      ? <img src={shopConfig.qrImage} alt="QR" style={{ width: "100%", height: "100%", objectFit: "contain" }} onError={e => { e.target.style.display = "none"; }} />
                      : <span style={{ fontSize: 28, color: "var(--text3)" }}>🏧</span>
                    }
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ background: "var(--amber)", color: "#fff", padding: "8px 14px", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13, textAlign: "center" }}>
                      📁 ອັບໂຫຼດຮູບ QR
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                        const file = e.target.files[0];
                        if (!file) return;
                        if (file.size > 2 * 1024 * 1024) { setErrorMsg("ຮູບໃຫຍ່ເກີນ (ສູງສຸດ 2MB) ກະລຸນາເລືອກຮູບນ້ອຍກວ່າ"); return; }
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const img = new Image();
                          img.onload = () => {
                            const max = 600; // ໃຫຍ່ພໍໃຫ້ scan ໄດ້ຊັດ
                            const scale = Math.min(1, max / Math.max(img.width, img.height));
                            const canvas = document.createElement("canvas");
                            canvas.width = img.width * scale;
                            canvas.height = img.height * scale;
                            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
                            const dataUrl = canvas.toDataURL("image/png"); // PNG ໃຫ້ QR ຄົມ scan ໄດ້ດີ
                            setShopConfig({ ...shopConfig, qrImage: dataUrl });
                            setErrorMsg("");
                          };
                          img.src = ev.target.result;
                        };
                        reader.readAsDataURL(file);
                        e.target.value = "";
                      }} />
                    </label>
                    {shopConfig.qrImage && (
                      <button onClick={() => setShopConfig({ ...shopConfig, qrImage: "" })} style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--red)", padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>✕ ລຶບຮູບ QR</button>
                    )}
                    <input value={typeof shopConfig.qrImage === "string" && shopConfig.qrImage.startsWith("data:") ? "" : (shopConfig.qrImage || "")} onChange={e => setShopConfig({ ...shopConfig, qrImage: e.target.value })} placeholder="ຫຼື ວາງ URL ຮູບ QR ທີ່ນີ້" style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px", color: "#fff", fontSize: 12 }} />
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 6 }}>ອັບໂຫຼດຮູບ QR ຈາກເຄື່ອງ (ຖ່າຍ/save ມາ) ຫຼື ວາງ URL ກໍໄດ້ — ຮູບຈະຂຶ້ນຕອນລູກຄ້າຈ່າຍ QR</div>
              </div>
              <div style={{ marginTop: 14 }}>
                <label style={{ fontSize: 12, display: "block", marginBottom: 6, color: "var(--text2)" }}>Expiry warning (days)</label>
                <input type="number" value={shopConfig.expiryWarnDays ?? DEFAULT_EXPIRY_WARN_DAYS} onChange={e => setShopConfig({ ...shopConfig, expiryWarnDays: parseInt(e.target.value, 10) || 0 })} style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px", color: "#fff" }} />
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>Products expiring within {shopConfig.expiryWarnDays ?? DEFAULT_EXPIRY_WARN_DAYS} days will be flagged</div>
              </div>

              {/* ===== ເລດແລກປ່ຽນເງິນ (ບາດ / ຍວນ → ກີບ) ===== */}
              <div style={{ marginTop: 18, padding: 14, background: "var(--bg2)", borderRadius: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)", marginBottom: 4 }}>💱 ເລດແລກປ່ຽນເງິນ</div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 12 }}>ໃຊ້ຄິດເງິນຕອນຮັບເງິນສົດບາດ/ຍວນ — ທອນເປັນກີບສະເໝີ</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 170 }}>
                    <label style={{ fontSize: 12, display: "block", marginBottom: 6, color: "var(--text2)" }}>1 ບາດ (THB) = ? ກີບ</label>
                    <input type="text" inputMode="decimal" value={rateTHBStr} onChange={e => setRateTHBStr(e.target.value.replace(/[^0-9.]/g, ""))} onBlur={() => { const n = parseFloat(rateTHBStr) || 0; setRateTHBStr(String(n)); setShopConfig({ ...shopConfig, rateTHB: n }); }} style={{ width: "100%", background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px", color: "#fff" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 170 }}>
                    <label style={{ fontSize: 12, display: "block", marginBottom: 6, color: "var(--text2)" }}>1,000 ຍວນ (VND) = ? ກີບ</label>
                    <input type="text" inputMode="decimal" value={rateVNDStr} onChange={e => setRateVNDStr(e.target.value.replace(/[^0-9.]/g, ""))} onBlur={() => { const n = parseFloat(rateVNDStr) || 0; setRateVNDStr(String(n)); setShopConfig({ ...shopConfig, rateVND: n }); }} style={{ width: "100%", background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px", color: "#fff" }} />
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 8 }}>ຕົວຢ່າງ: 1 ບາດ = {(shopConfig.rateTHB ?? 630).toLocaleString()} ກີບ · 1,000 ຍວນ = {(shopConfig.rateVND ?? 850).toLocaleString()} ກີບ</div>
              </div>

              <div style={{ marginTop: 18, padding: 14, background: "var(--bg2)", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text1)" }}>Allow selling beyond stock</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>Stock can go negative when no time to receive stock first. Remember to top up later.</div>
                </div>
                <label style={{ position: "relative", display: "inline-block", width: 46, height: 26, flexShrink: 0 }}>
                  <input type="checkbox" checked={!!shopConfig.allowNegativeStock} onChange={e => setShopConfig({ ...shopConfig, allowNegativeStock: e.target.checked })} style={{ opacity: 0, width: 0, height: 0 }} />
                  <span style={{ position: "absolute", inset: 0, background: shopConfig.allowNegativeStock ? "var(--amber)" : "var(--bg3)", borderRadius: 26, cursor: "pointer", transition: "0.2s" }}>
                    <span style={{ position: "absolute", height: 20, width: 20, left: shopConfig.allowNegativeStock ? 23 : 3, top: 3, background: "#fff", borderRadius: "50%", transition: "0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }} />
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Product Modal */}
      {showProdModal && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, width: 400 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>{editProd ? "Edit Product" : "Add Product"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, display: "block", marginBottom: 6, color: "var(--text2)" }}>Barcode</label>
                <input value={newProd.barcode} onChange={e => setNewProd({ ...newProd, barcode: e.target.value })} style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px", color: "#fff" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, display: "block", marginBottom: 6, color: "var(--text2)" }}>Product Name</label>
                <input value={newProd.name} onChange={e => setNewProd({ ...newProd, name: e.target.value })} style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px", color: "#fff" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, display: "block", marginBottom: 6, color: "var(--text2)" }}>Category</label>
                <select value={newProd.category} onChange={e => setNewProd({ ...newProd, category: e.target.value })} style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px", color: "#fff" }}>
                  {MINIMART_CATEGORIES.filter(c => c !== "All").map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, display: "block", marginBottom: 6, color: "var(--text2)" }}>Sell Price (₭)</label>
                  <input type="number" value={newProd.price} onChange={e => setNewProd({ ...newProd, price: e.target.value })} style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px", color: "#fff" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, display: "block", marginBottom: 6, color: "var(--text2)" }}>Cost Price (₭)</label>
                  <input type="number" value={newProd.cost} onChange={e => setNewProd({ ...newProd, cost: e.target.value })} style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px", color: "#fff" }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, display: "block", marginBottom: 6, color: "var(--text2)" }}>Alert when total stock ≤</label>
                <input type="number" value={newProd.lowStock} onChange={e => setNewProd({ ...newProd, lowStock: e.target.value })} style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px", color: "#fff" }} />
              </div>
              <div style={{ fontSize: 11, color: "var(--text3)", background: "var(--bg2)", padding: "10px 12px", borderRadius: 8, lineHeight: 1.5 }}>💡 For stock quantity and expiry, use the <b style={{color:"var(--amber)"}}>"📥 Receive Stock"</b> to add as a batch (lot) — the same product can arrive in separate lots with different expiry dates</div>

              {/* Pack settings (optional) */}
              <div style={{ background: "var(--bg2)", border: "1px dashed var(--border)", borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text1)", marginBottom: 4 }}>📦 Pack settings (optional)</div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 10, lineHeight: 1.5 }}>If this product <b>is a pack</b> (e.g. carton of 12 bottles), enter how many units per pack and the barcode of the single-unit product. Selling 1 pack will then deduct that many units from the single-unit product's stock automatically.</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--text2)", display: "block", marginBottom: 4 }}>Units per pack</label>
                    <input type="number" value={newProd.packOf} onChange={e => setNewProd({ ...newProd, packOf: e.target.value })} placeholder="e.g. 12" style={{ width: "100%", background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 10px", fontSize: 13 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: "var(--text2)", display: "block", marginBottom: 4 }}>Single-unit product barcode</label>
                    <input value={newProd.packParentBarcode} onChange={e => setNewProd({ ...newProd, packParentBarcode: e.target.value })} placeholder="leave empty if not a pack" style={{ width: "100%", background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 10px", fontSize: 13, fontFamily: "var(--mono)" }} />
                  </div>
                </div>
                {newProd.packOf && newProd.packParentBarcode && (() => {
                  const parent = minimartProducts.find(p => p.barcode === newProd.packParentBarcode.trim());
                  return (
                    <div style={{ fontSize: 11, marginTop: 8, padding: "6px 10px", background: parent ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.1)", color: parent ? "var(--green)" : "var(--red)", borderRadius: 6 }}>
                      {parent
                        ? `✓ Linked: 1 pack = ${newProd.packOf} × "${parent.name}" (stock: ${totalStock(parent)})`
                        : `✗ No product found with barcode "${newProd.packParentBarcode}"`
                      }
                    </div>
                  );
                })()}
              </div>

              <div>
                <label style={{ fontSize: 12, display: "block", marginBottom: 6, color: "var(--text2)" }}>Product Image</label>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 90, height: 90, borderRadius: 10, background: "var(--bg2)", border: "1px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
                    {newProd.image
                      ? <img src={newProd.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} />
                      : <span style={{ fontSize: 28, color: "var(--text3)" }}>📷</span>
                    }
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ background: "var(--amber)", color: "#fff", padding: "8px 14px", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13, textAlign: "center" }}>
                      📁 Upload from device
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                        const file = e.target.files[0];
                        if (!file) return;
                        if (file.size > 2 * 1024 * 1024) { setErrorMsg("Image too large (max 2MB). Please choose a smaller image."); return; }
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          // ບີບອັດຮູບໃຫ້ນ້ອຍລົງເພື່ອປະຢັດພື້ນທີ່
                          const img = new Image();
                          img.onload = () => {
                            const max = 400;
                            const scale = Math.min(1, max / Math.max(img.width, img.height));
                            const canvas = document.createElement("canvas");
                            canvas.width = img.width * scale;
                            canvas.height = img.height * scale;
                            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
                            const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
                            setNewProd({ ...newProd, image: dataUrl });
                            setErrorMsg("");
                          };
                          img.src = ev.target.result;
                        };
                        reader.readAsDataURL(file);
                        e.target.value = "";
                      }} />
                    </label>
                    {newProd.image && (
                      <button onClick={() => setNewProd({ ...newProd, image: "" })} style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--red)", padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>✕ Remove image</button>
                    )}
                    <input value={newProd.image && !newProd.image.startsWith("data:") ? newProd.image : ""} onChange={e => setNewProd({ ...newProd, image: e.target.value })} placeholder="...or paste image URL" style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 12 }} />
                  </div>
                </div>
              </div>
              {errorMsg && <div style={{ fontSize: 13, color: "var(--red)" }}>{errorMsg}</div>}
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button onClick={() => setShowProdModal(false)} style={{ flex: 1, background: "var(--bg2)", border: "none", borderRadius: 8, padding: "12px", color: "#fff", cursor: "pointer" }}>Cancel</button>
                <button onClick={saveProduct} style={{ flex: 2, background: "var(--amber)", border: "none", borderRadius: 8, padding: "12px", color: "#000", fontWeight: 700, cursor: "pointer" }}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Staff Modal */}
      {showStaffModal && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, width: 380 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>{editStaff ? "Edit Staff" : "Add Staff"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, display: "block", marginBottom: 6, color: "var(--text2)" }}>Full Name</label>
                <input value={newStaff.name} onChange={e => setNewStaff({ ...newStaff, name: e.target.value })} style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px", color: "#fff" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, display: "block", marginBottom: 6, color: "var(--text2)" }}>Username</label>
                <input value={newStaff.username} onChange={e => setNewStaff({ ...newStaff, username: e.target.value })} style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px", color: "#fff" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, display: "block", marginBottom: 6, color: "var(--text2)" }}>Password (PIN)</label>
                <input value={newStaff.password} onChange={e => setNewStaff({ ...newStaff, password: e.target.value })} style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px", color: "#fff" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, display: "block", marginBottom: 6, color: "var(--text2)" }}>Role</label>
                <select value={newStaff.role} onChange={e => setNewStaff({ ...newStaff, role: e.target.value })} style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px", color: "#fff" }}>
                  <option value="cashier">Cashier (POS only)</option>
                  <option value="admin">Manager (full access)</option>
                </select>
              </div>
              {errorMsg && <div style={{ fontSize: 13, color: "var(--red)" }}>{errorMsg}</div>}
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button onClick={() => setShowStaffModal(false)} style={{ flex: 1, background: "var(--bg2)", border: "none", borderRadius: 8, padding: "12px", color: "#fff", cursor: "pointer" }}>Cancel</button>
                <button onClick={saveStaff} style={{ flex: 2, background: "var(--amber)", border: "none", borderRadius: 8, padding: "12px", color: "#000", fontWeight: 700, cursor: "pointer" }}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Detail + History Modal */}
      {productDetail && (() => {
        const p = productDetail;
        // ປະຫວັດການຮັບເຂົ້າຂອງສິນຄ້ານີ້
        const recv = (receiveLog || []).filter(r => r.productId === p.id || r.barcode === p.barcode);
        // ປະຫວັດການຂາຍ (ດຶງຈາກບິນທີ່ມີສິນຄ້ານີ້ໃນ cartItems)
        const sales = [];
        (transactions || []).forEach(t => {
          (t.cartItems || []).forEach(ci => {
            if (ci.id === p.id || (ci.barcode && ci.barcode === p.barcode)) {
              sales.push({ id: t.id, date: t.date, time: t.time, qty: ci.qty, price: ci.price, total: ci.price * ci.qty, station: t.station, cashier: t.cashier });
            }
          });
        });
        const totalSold = sales.reduce((s, x) => s + x.qty, 0);
        const totalRevenue = sales.reduce((s, x) => s + x.total, 0);
        const totalReceived = recv.reduce((s, r) => s + r.qty, 0);
        const stats = salesStats[p.id] || { qty: 0, revenue: 0, profit: 0 };
        const batches = (p.batches || []).filter(b => b.status !== "returned");

        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
            <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 16, padding: 0, width: "100%", maxWidth: 720, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "var(--shadow)" }}>
              {/* Header */}
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 72, height: 72, borderRadius: 12, background: "var(--bg2)", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {p.image ? <img src={p.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.target.style.display = "none"} /> : <span style={{ fontSize: 32 }}>📦</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "var(--amber)", fontFamily: "var(--mono)", marginBottom: 2 }}>BC: {p.barcode}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text1)" }}>{p.name}</div>
                  <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 2 }}>Sell ₭{(p.price || 0).toLocaleString()} · Cost ₭{(p.cost || 0).toLocaleString()} · {p.category || "—"}</div>
                </div>
                <button onClick={() => setProductDetail(null)} style={{ background: "var(--bg2)", border: "none", color: "var(--text1)", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16 }}>✕</button>
              </div>

              {/* Stats summary */}
              <div style={{ padding: "16px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, background: "var(--bg2)", borderBottom: "1px solid var(--border)" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>Current Stock</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: totalStock(p) <= 0 ? "var(--red)" : "var(--text1)" }}>{totalStock(p)}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>Total Received</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--green)" }}>+{totalReceived}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>Total Sold</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--amber)" }}>{stats.qty || totalSold}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>Total Profit</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--green)" }}>₭{(stats.profit || 0).toLocaleString()}</div>
                </div>
              </div>

              {/* Body scroll */}
              <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Active lots */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "var(--text1)" }}>📦 Active Lots ({batches.length})</div>
                  {batches.length === 0
                    ? <div style={{ fontSize: 12, color: "var(--text3)", padding: 16, textAlign: "center", background: "var(--bg2)", borderRadius: 8 }}>No active lots</div>
                    : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {batches.map(b => {
                          const es = expiryStatus(b.expiry, warnDays);
                          return (
                            <div key={b.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg2)", borderRadius: 8, fontSize: 13, alignItems: "center" }}>
                              <span style={{ color: "var(--text2)" }}>Qty: <b style={{ color: "var(--text1)" }}>{b.qty}</b></span>
                              <span style={{ color: b.expiry ? (es.level === "expired" ? "var(--red)" : es.level === "soon" ? "#d98324" : "var(--text2)") : "var(--text3)", fontSize: 12 }}>
                                {b.expiry ? `Expiry: ${b.expiry}` : "No expiry set"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                  }
                </div>

                {/* Receive history */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "var(--text1)" }}>📥 Receive History ({recv.length})</div>
                  {recv.length === 0
                    ? <div style={{ fontSize: 12, color: "var(--text3)", padding: 16, textAlign: "center", background: "var(--bg2)", borderRadius: 8 }}>No receive history</div>
                    : <div style={{ background: "var(--bg2)", borderRadius: 8, overflow: "hidden" }}>
                        {recv.map((r, i) => (
                          <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 0.7fr 1.3fr 1fr", padding: "10px 14px", borderBottom: i < recv.length - 1 ? "1px solid var(--border)" : "none", fontSize: 12, alignItems: "center" }}>
                            <span style={{ color: "var(--text2)" }}>{r.date}</span>
                            <span style={{ fontFamily: "var(--mono)", color: "var(--text2)" }}>{r.time}</span>
                            <span style={{ color: "var(--green)", fontWeight: 700 }}>+{r.qty}</span>
                            <span style={{ color: "var(--text2)", fontSize: 11 }}>{r.expiry ? `Exp ${r.expiry}` : "—"}</span>
                            <span>{r.receivedBy}</span>
                          </div>
                        ))}
                      </div>
                  }
                </div>

                {/* Sales history */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "var(--text1)" }}>🧾 Sales History ({sales.length})</div>
                  {sales.length === 0
                    ? <div style={{ fontSize: 12, color: "var(--text3)", padding: 16, textAlign: "center", background: "var(--bg2)", borderRadius: 8 }}>No sales recorded in current bills</div>
                    : <div style={{ background: "var(--bg2)", borderRadius: 8, overflow: "hidden" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 0.7fr 0.6fr 0.5fr 1fr 1fr", padding: "8px 14px", fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, borderBottom: "1px solid var(--border)" }}>
                          <span>Date</span><span>Time</span><span>Qty</span><span>Stn</span><span>Total</span><span>By</span>
                        </div>
                        {sales.slice(0, 100).map((s, i) => (
                          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 0.7fr 0.6fr 0.5fr 1fr 1fr", padding: "10px 14px", borderBottom: i < Math.min(sales.length, 100) - 1 ? "1px solid var(--border)" : "none", fontSize: 12, alignItems: "center" }}>
                            <span style={{ color: "var(--text2)" }}>{s.date}</span>
                            <span style={{ fontFamily: "var(--mono)", color: "var(--text2)" }}>{s.time}</span>
                            <span style={{ fontWeight: 700 }}>×{s.qty}</span>
                            <span style={{ fontSize: 11, color: s.station === "1" ? "var(--blue)" : "var(--green)" }}>{s.station ? "🖥️" + s.station : "—"}</span>
                            <span style={{ color: "var(--amber)", fontWeight: 600 }}>₭{(s.total || 0).toLocaleString()}</span>
                            <span style={{ fontSize: 11 }}>{s.cashier}</span>
                          </div>
                        ))}
                        {sales.length > 100 && <div style={{ padding: 10, textAlign: "center", fontSize: 11, color: "var(--text3)" }}>Showing latest 100 of {sales.length}</div>}
                      </div>
                  }
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 6 }}>💡 Sales history shows all bills (kept forever). Cumulative totals above also stay.</div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => { setProductDetail(null); openProdModal(p); }} style={{ background: "var(--bg2)", border: "1px solid var(--border)", color: "var(--text1)", padding: "10px 18px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>✏️ Edit Product</button>
                <button onClick={() => { setProductDetail(null); setReceiveData({ productId: String(p.id), qty: "", expiry: "", barcodeSearch: "" }); setReceiveScan(""); setErrorMsg(""); setShowReceiveModal(true); }} style={{ background: "var(--green)", border: "none", color: "#fff", padding: "10px 18px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>📥 Receive Stock</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Receive Stock Modal (ຮັບເຄື່ອງເຂົ້າ → ເພີ່ມລັອດໃໝ່) */}
      {showReceiveModal && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, width: 400 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>📥 Receive Stock (New Lot)</div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 16 }}>Add quantity + expiry as a new lot — existing lots are untouched</div>
            <div style={{ background: "rgba(92,184,120,0.1)", border: "1px solid rgba(92,184,120,0.3)", borderRadius: 8, padding: "10px 12px", marginBottom: 16, fontSize: 12, color: "var(--green)", fontWeight: 600 }}>📡 Scan a barcode to auto-select the product{receiveScan && <span style={{ color: "var(--amber)" }}> → Found: {receiveScan}</span>}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, display: "block", marginBottom: 6, color: "var(--text2)" }}>Search / enter barcode manually</label>
                <input value={receiveData.barcodeSearch || ""} onChange={e => {
                  const v = e.target.value;
                  const found = minimartProducts.find(p => p.barcode === v);
                  setReceiveData({ ...receiveData, barcodeSearch: v, productId: found ? String(found.id) : receiveData.productId });
                  if (found) setReceiveScan(found.name);
                }} placeholder="Type or scan barcode..." style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px", color: "#fff" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, display: "block", marginBottom: 6, color: "var(--text2)" }}>Select product (or scan)</label>
                <select value={receiveData.productId} onChange={e => setReceiveData({ ...receiveData, productId: e.target.value })} style={{ width: "100%", background: "var(--bg2)", border: receiveData.productId ? "1px solid var(--border-amber)" : "1px solid var(--border)", borderRadius: 8, padding: "10px", color: "#fff" }}>
                  <option value="">-- Select --</option>
                  {minimartProducts.map(p => <option key={p.id} value={p.id}>{p.name} (BC:{p.barcode} · qty {totalStock(p)})</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, display: "block", marginBottom: 6, color: "var(--text2)" }}>Quantity received</label>
                <input type="number" value={receiveData.qty} onChange={e => setReceiveData({ ...receiveData, qty: e.target.value })} style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px", color: "#fff" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, display: "block", marginBottom: 6, color: "var(--text2)" }}>Expiry date for this lot</label>
                <input type="date" value={receiveData.expiry} onChange={e => setReceiveData({ ...receiveData, expiry: e.target.value })} style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px", color: "#fff" }} />
              </div>
              {errorMsg && <div style={{ fontSize: 13, color: "var(--red)" }}>{errorMsg}</div>}
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button onClick={() => setShowReceiveModal(false)} style={{ flex: 1, background: "var(--bg2)", border: "none", borderRadius: 8, padding: "12px", color: "#fff", cursor: "pointer" }}>Cancel</button>
                <button onClick={receiveStock} style={{ flex: 2, background: "var(--green)", border: "none", borderRadius: 8, padding: "12px", color: "#000", fontWeight: 700, cursor: "pointer" }}>Save Lot</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Edit Modal */}
      {showTxnModal && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 16, padding: 32, width: 380 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Editbills: {editTxn?.id}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, display: "block", marginBottom: 6, color: "var(--text2)" }}>Date</label>
                <input type="date" value={newTxn.date} onChange={e => setNewTxn({ ...newTxn, date: e.target.value })} style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px", color: "#fff" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, display: "block", marginBottom: 6, color: "var(--text2)" }}>New total (₭)</label>
                <input type="number" value={newTxn.total} onChange={e => setNewTxn({ ...newTxn, total: e.target.value })} style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px", color: "#fff" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, display: "block", marginBottom: 6, color: "var(--text2)" }}>Method</label>
                <select value={newTxn.method} onChange={e => setNewTxn({ ...newTxn, method: e.target.value })} style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px", color: "#fff" }}>
                  <option value="Cash">Cash</option>
                  <option value="QR">Transfer</option>
                  <option value="Card">Card</option>
                  <option value="Split">Split</option>
                </select>
              </div>
              {newTxn.method === "Split" && (
                <div>
                  <label style={{ fontSize: 12, display: "block", marginBottom: 6, color: "var(--text2)" }}>QR amount (₭)</label>
                  <input type="number" value={newTxn.revenueQR} onChange={e => setNewTxn({ ...newTxn, revenueQR: e.target.value })} style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px", color: "#fff" }} />
                </div>
              )}
              {errorMsg && <div style={{ fontSize: 13, color: "var(--red)" }}>{errorMsg}</div>}
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button onClick={() => setShowTxnModal(false)} style={{ flex: 1, background: "var(--bg2)", border: "none", borderRadius: 8, padding: "12px", color: "#fff", cursor: "pointer" }}>Cancel</button>
                <button onClick={saveTxn} style={{ flex: 2, background: "var(--amber)", border: "none", borderRadius: 8, padding: "12px", color: "#000", fontWeight: 700, cursor: "pointer" }}>Savebills</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TxnTable({ transactions, onEdit, onDelete, onReprint }) {
  return (
    <div style={{ background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 0.6fr 1fr 1.5fr 1.4fr", padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: 11, color: "var(--text3)", textTransform: "uppercase" }}>
        <span>Date</span><span>ID</span><span>Stn</span><span>Total</span><span>Method</span><span>Actions</span>
      </div>
      {transactions.map((t, i) => (
        <div key={t.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 0.6fr 1fr 1.5fr 1.4fr", padding: "12px 16px", borderBottom: i < transactions.length - 1 ? "1px solid var(--border)" : "none", fontSize: 13, alignItems: "center" }}>
          <span style={{ fontSize: 12 }}>{t.date}</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text2)" }}>{t.id}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: t.station === "1" ? "var(--blue)" : "var(--green)" }}>{t.station ? "🖥️" + t.station : "-"}</span>
          <span style={{ color: "var(--amber)", fontWeight: 600 }}>₭{(t.total || 0).toLocaleString()}</span>
          <span style={{ fontSize: 12 }}>{t.method === "Split" ? `QR ₭${(t.revenueQR || 0).toLocaleString()} + ₭${(t.revenueCash || 0).toLocaleString()}` : t.method}</span>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {onReprint && <button onClick={() => onReprint(t)} style={{ background: "var(--amber-glow)", border: "1px solid var(--border-amber)", color: "var(--amber)", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>🖨️ Print</button>}
            <button onClick={() => onEdit(t)} style={{ background: "var(--bg2)", border: "1px solid var(--border)", color: "var(--text1)", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>Edit</button>
            <button onClick={() => onDelete(t.id)} style={{ background: "rgba(224,90,90,0.1)", border: "none", color: "var(--red)", padding: "4px 8px", borderRadius: 4, cursor: "pointer", fontSize: 11 }}>Del</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- APP ROOT ---
export default function App() {
  const [loginError, setLoginError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState("pos");
  const [station, setStation] = useState("1"); // Stnຂາຍຂອງຄອມນີ້ (1 ຫຼື 2)

  const [users, setUsers] = useState(INITIAL_USERS);
  const [minimartProducts, setMinimartProducts] = useState(INITIAL_MINIMART_PRODUCTS);
  const [transactions, setTransactions] = useState([]);
  const [shifts, setShifts] = useState([]); // ປະຫວັດກະທີ່ປິດແລ້ວ
  const [salesStats, setSalesStats] = useState({}); // ສະຖິຕິຂາຍສະສົມ {id: {name, qty, revenue}} — ບໍ່ຫາຍຕອນປິດກະ
  const [receiveLog, setReceiveLog] = useState([]); // ປະຫວັດການຮັບເຄື່ອງເຂົ້າ
  const [activeShifts, setActiveShifts] = useState({}); // ກະທີ່ກຳລັງເປີດ ຕໍ່Stn { "1": {...}, "2": {...} }
  const [shopConfig, setShopConfig] = useState({
    name: "TimB Coffee Bar",
    promptPay: "020 9166 1936",
    qrImage: "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=TimB_CoffeeBar",
    logo: "/logo.png",
    allowNegativeStock: true,
    rateTHB: 630,
    rateVND: 850
  });
  const [adminReprintTxn, setAdminReprintTxn] = useState(null);

  // ===== Firebase sync (2 ຄອມເຫັນຂໍ້ມູນດຽວກັນ) =====
  // ໃຊ້ໄດ້ເມື່ອຕັ້ງ firebase.js ແລ້ວ; ຖ້າຍັງບໍ່ໄດ້ຕັ້ງ ຈະໃຊ້ state ໃນເຄື່ອງ (ບໍ່ error)
  const fbRef = useRef({ ready: false, save: null });
  const loadedRef = useRef({ products: false, txns: false, users: false, config: false, shifts: false, stats: false, receive: false });
  const appliedRef = useRef({}); // ເກັບ JSON ຄ່າລ່າສຸດທີ່ sync/save ແລ້ວ — ກັນ loop ບັນທຶກ↔echo
  const [fbStatus, setFbStatus] = useState("connecting");

  useEffect(() => {
    let unsubs = [];
    let cancelled = false;
    (async () => {
      try {
        const fb = await import("./firebase.js");
        if (!fb || !fb.db) throw new Error("no-db");
        if (cancelled) return;
        fbRef.current = { ready: true, save: fb.saveDoc, saveProducts: fb.saveProducts, saveOneProduct: fb.saveOneProduct, deleteOneProduct: fb.deleteOneProduct, loadProductsOnce: fb.loadProductsOnce, saveTransactions: fb.saveTransactions, saveOneTransaction: fb.saveOneTransaction, deleteTransaction: fb.deleteTransaction };
        if (typeof window !== "undefined") { window.fbSaveOneTxn = fb.saveOneTransaction; window.fbDeleteTxn = fb.deleteTransaction; window.fbSaveOneProduct = fb.saveOneProduct; window.fbDeleteOneProduct = fb.deleteOneProduct; window.fbLoadProducts = fb.loadProductsOnce; window.fbSaveAllProducts = fb.saveProducts; }
        // ໂຫຼດສິນຄ້າຄັ້ງດຽວ (ບໍ່ realtime — ປະຫຍັດ Firebase reads)
        fb.loadProductsOnce().then(list => {
          loadedRef.current.products = true;
          if (Array.isArray(list) && list.length > 0) setMinimartProducts(list);
        });
        unsubs.push(fb.watchTransactions((v) => { loadedRef.current.txns = true; if (Array.isArray(v)) setTransactions(v); }));
        unsubs.push(fb.watchDoc("users", (v) => { loadedRef.current.users = true; const j = JSON.stringify(v); if (Array.isArray(v) && j !== appliedRef.current.users) { appliedRef.current.users = j; setUsers(v); } }));
        unsubs.push(fb.watchDoc("config", (v) => { loadedRef.current.config = true; const j = JSON.stringify(v); if (v && j !== appliedRef.current.config) { appliedRef.current.config = j; setShopConfig(v); } }));
        unsubs.push(fb.watchDoc("shifts", (v) => { loadedRef.current.shifts = true; const j = JSON.stringify(v); if (Array.isArray(v) && j !== appliedRef.current.shifts) { appliedRef.current.shifts = j; setShifts(v); } }));
        unsubs.push(fb.watchDoc("salesStats", (v) => { loadedRef.current.stats = true; const j = JSON.stringify(v); if (v && j !== appliedRef.current.stats) { appliedRef.current.stats = j; setSalesStats(v); } }));
        unsubs.push(fb.watchDoc("receiveLog", (v) => { loadedRef.current.receive = true; const j = JSON.stringify(v); if (Array.isArray(v) && j !== appliedRef.current.receive) { appliedRef.current.receive = j; setReceiveLog(v); } }));
        setFbStatus("online");
      } catch (e) {
        console.warn("Firebase not ready — using local data:", e?.message);
        setFbStatus("offline");
      }
    })();
    return () => { cancelled = true; unsubs.forEach(u => { try { u && u(); } catch {} }); };
  }, []);

  // ບໍ່ໃຊ້ bulk save ສຳລັບ products ອີກແລ້ວ — ໃຊ້ saveOneProduct/deleteOneProduct ໂດຍກົງ
  // ບໍ່ໃຊ້ bulk save ສຳລັບ transactions ອີກແລ້ວ — ຂາຍແຕ່ລະບິນຈະຖືກ save ໂດຍກົງດ້ວຍ saveOneTransaction
  useEffect(() => { if (!fbRef.current.ready || !loadedRef.current.users) return; const j = JSON.stringify(users); if (j === appliedRef.current.users) return; appliedRef.current.users = j; fbRef.current.save("users", users); }, [users]);
  useEffect(() => { if (!fbRef.current.ready || !loadedRef.current.config) return; const j = JSON.stringify(shopConfig); if (j === appliedRef.current.config) return; appliedRef.current.config = j; fbRef.current.save("config", shopConfig); }, [shopConfig]);
  useEffect(() => { if (!fbRef.current.ready || !loadedRef.current.shifts) return; const j = JSON.stringify(shifts); if (j === appliedRef.current.shifts) return; appliedRef.current.shifts = j; fbRef.current.save("shifts", shifts); }, [shifts]);
  useEffect(() => { if (!fbRef.current.ready || !loadedRef.current.stats) return; const j = JSON.stringify(salesStats); if (j === appliedRef.current.stats) return; appliedRef.current.stats = j; fbRef.current.save("salesStats", salesStats); }, [salesStats]);
  useEffect(() => { if (!fbRef.current.ready || !loadedRef.current.receive) return; const j = JSON.stringify(receiveLog); if (j === appliedRef.current.receive) return; appliedRef.current.receive = j; fbRef.current.save("receiveLog", receiveLog); }, [receiveLog]);

  const [syncData, setSyncData] = useState({ cart: [], total: 0, shopConfig, receipt: null });

  const handleLogin = (username, password) => {
    const found = users.find(u => u.username === username && u.password === password);
    if (!found) { setLoginError("Incorrect username or password."); return; }
    if (found.active === false) { setLoginError("This account is disabled — contact your manager."); return; }
    setCurrentUser(found);
    setLoginError("");
    setView("pos");
  };

  // standalone customer-display mode (opened via ?display=1 ຫຼື ?display=2)
  const displayParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("display") : null;
  if (displayParam) {
    return <CustomerDisplayStandalone displayStation={displayParam} />;
  }

  if (!currentUser) {
    return (
      <div>
        <style>{css}</style>
        <LoginScreen onLogin={handleLogin} error={loginError} station={station} setStation={setStation} shopConfig={shopConfig} />
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg0)" }}>
      <style>{css}</style>
      <Topbar user={currentUser} view={view} setView={setView} station={station} shopConfig={shopConfig} fbStatus={fbStatus} onLogout={() => { setCurrentUser(null); setView("pos"); }} />
      {adminReprintTxn
        ? <ReceiptView receipt={adminReprintTxn} shopConfig={shopConfig} onDone={() => setAdminReprintTxn(null)} reprint />
        :
      ((view === "pos" || currentUser.role === "cashier")
        ? <POSScreen
            user={currentUser}
            station={station}
            minimartProducts={minimartProducts}
            setMinimartProducts={setMinimartProducts}
            transactions={transactions}
            setTransactions={setTransactions}
            shifts={shifts}
            setShifts={setShifts}
            activeShifts={activeShifts}
            setActiveShifts={setActiveShifts}
            setSalesStats={setSalesStats}
            shopConfig={shopConfig}
            onSyncData={setSyncData}
            fbSave={fbRef.current}
          />
        : <AdminScreen
            transactions={transactions}
            setTransactions={setTransactions}
            shifts={shifts}
            salesStats={salesStats}
            receiveLog={receiveLog}
            setReceiveLog={setReceiveLog}
            users={users}
            setUsers={setUsers}
            currentUser={currentUser}
            minimartProducts={minimartProducts}
            setMinimartProducts={setMinimartProducts}
            shopConfig={shopConfig}
            setShopConfig={setShopConfig}
            onReprint={setAdminReprintTxn}
            fbDelete={fbRef.current.deleteTransaction}
          />
      )}
    </div>
  );
}
