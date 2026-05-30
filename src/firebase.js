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

const PRODUCTS_PATH = `shops/${SHOP}/products`;

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

export function watchProducts(callback) {
  return onSnapshot(collection(db, PRODUCTS_PATH), (snap) => {
    const list = [];
    snap.forEach(d => list.push(d.data()));
    callback(list);
  }, (err) => console.error("watchProducts", err));
}

const TXN_PATH = `shops/${SHOP}/transactions`;

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

export function watchTransactions(callback) {
  return onSnapshot(collection(db, TXN_PATH), (snap) => {
    const list = [];
    snap.forEach(d => list.push(d.data()));
    list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    callback(list);
  }, (err) => console.error("watchTransactions", err));
}

export { SHOP as SHOP_ID };