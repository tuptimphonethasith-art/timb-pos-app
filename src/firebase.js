import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, setDoc, getDoc, getDocs, deleteDoc,
  collection, onSnapshot, writeBatch, enableIndexedDbPersistence
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBQzmmi6zElSpbkSr3FsfcFf5R17fJ0SeA",
  authDomain: "timb-pos-12ab3.firebaseapp.com",
  projectId: "timb-pos-12ab3",
  storageBucket: "timb-pos-12ab3.firebasestorage.app",
  messagingSenderId: "242003788279",
  appId: "1:242003788279:web:ae78a3c7303fa04447eef2"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

try { enableIndexedDbPersistence(db); } catch (e) { console.warn("offline:", e?.code); }

const SHOP = "shop_main";

// ===== Single doc (config, users, shifts, salesStats, receiveLog) =====
export async function saveDoc(name, data) {
  try {
    await setDoc(doc(db, "shops", SHOP, "data", name), { value: data, updatedAt: Date.now() });
    console.log("✓ saved", name);
  } catch (e) { console.error("✗ saveDoc", name, e.message); }
}

export function watchDoc(name, callback) {
  return onSnapshot(doc(db, "shops", SHOP, "data", name), (snap) => {
    if (snap.exists()) callback(snap.data().value);
  }, (err) => console.error("watchDoc " + name, err));
}

// ===== Products — one-time load (ປະຫຍັດ reads) =====
const PRODUCTS_PATH = `shops/${SHOP}/products`;

// ໂຫຼດສິນຄ້າຄັ້ງດຽວ (ບໍ່ realtime) — ປະຫຍັດ reads
export async function loadProductsOnce() {
  try {
    const snap = await getDocs(collection(db, PRODUCTS_PATH));
    const list = [];
    snap.forEach(d => list.push(d.data()));
    console.log("✓ loaded", list.length, "products (one-time)");
    return list;
  } catch (e) { console.error("✗ loadProductsOnce", e.message); return []; }
}

// ບັນທຶກ 1 ສິນຄ້າ (ໃຊ້ຕອນແກ້/ເພີ່ມ — ປະຫຍັດ writes)
export async function saveOneProduct(product) {
  if (!product || !product.id) return;
  try {
    const safe = { ...product };
    if (safe.image && safe.image.length > 100000) safe.image = "";
    await setDoc(doc(db, PRODUCTS_PATH, String(product.id)), safe);
    console.log("✓ saved product", product.id);
  } catch (e) { console.error("✗ saveOneProduct", e.message); }
}

// ບັນທຶກສິນຄ້າທັງໝົດ (ໃຊ້ຕອນ import CSV ເທົ່ານັ້ນ)
export async function saveProducts(products) {
  if (!Array.isArray(products)) return;
  try {
    const CHUNK = 400;
    for (let i = 0; i < products.length; i += CHUNK) {
      const batch = writeBatch(db);
      const slice = products.slice(i, i + CHUNK);
      slice.forEach(p => {
        if (!p.id) return;
        const safe = { ...p };
        if (safe.image && safe.image.length > 100000) safe.image = "";
        batch.set(doc(db, PRODUCTS_PATH, String(p.id)), safe);
      });
      await batch.commit();
    }
    console.log("✓ saved", products.length, "products");
  } catch (e) { console.error("✗ saveProducts", e.message); }
}

export async function deleteOneProduct(id) {
  if (!id) return;
  try {
    await deleteDoc(doc(db, PRODUCTS_PATH, String(id)));
    console.log("✓ deleted product", id);
  } catch (e) { console.error("✗ deleteOneProduct", e.message); }
}

// ===== Transactions — realtime (ສຳຄັນສຸດ ສຳລັບ multi-station sync) =====
const TXN_PATH = `shops/${SHOP}/transactions`;

export async function saveOneTransaction(txn) {
  if (!txn || !txn.id) return;
  try {
    await setDoc(doc(db, TXN_PATH, String(txn.id)), txn);
    console.log("✓ saved txn", txn.id);
  } catch (e) { console.error("✗ saveOneTransaction", e.message); }
}

export async function saveTransactions(txns) {
  if (!Array.isArray(txns)) return;
  try {
    const CHUNK = 400;
    for (let i = 0; i < txns.length; i += CHUNK) {
      const batch = writeBatch(db);
      const slice = txns.slice(i, i + CHUNK);
      slice.forEach(t => {
        if (!t.id) return;
        batch.set(doc(db, TXN_PATH, String(t.id)), t);
      });
      await batch.commit();
    }
    console.log("✓ saved", txns.length, "transactions");
  } catch (e) { console.error("✗ saveTransactions", e.message); }
}

export async function deleteTransaction(txnId) {
  if (!txnId) return;
  try {
    await deleteDoc(doc(db, TXN_PATH, String(txnId)));
    console.log("✓ deleted txn", txnId);
  } catch (e) { console.error("✗ deleteTransaction", e.message); }
}

export function watchTransactions(callback) {
  return onSnapshot(collection(db, TXN_PATH), (snap) => {
    const list = [];
    snap.forEach(d => list.push(d.data()));
    list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    callback(list);
  }, (err) => console.error("watchTransactions", err));
}

export { SHOP as SHOP_ID };