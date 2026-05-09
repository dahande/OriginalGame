import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAeHw_31_xYD7d9lVSCu9cEgZ4MOer1IiA",
  authDomain: "aomoriapple-48db3.firebaseapp.com",
  projectId: "aomoriapple-48db3",
  storageBucket: "aomoriapple-48db3.firebasestorage.app",
  messagingSenderId: "763922739575",
  appId: "1:763922739575:web:3c1a79ba10aff7c4327172",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const MAX_SCORE = 1000000;
const ALLOWED_MODES = ["normal", "hard", "skull"];

// メモリ保持用ランキング
let cachedRanking = [];

/**
 * ゲーム起動時に呼ぶ。
 * Firestore から TOP 100 を先読みしてメモリに保持。
 */
export async function preloadRanking() {
  try {
    const q = query(
      collection(db, "scores"),
      orderBy("score", "desc"),
      limit(100)
    );
    const snap = await getDocs(q);
    cachedRanking = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    console.log("[preloadRanking] Loaded", cachedRanking.length, "entries");
    return cachedRanking;
  } catch (error) {
    console.error("[preloadRanking] Error:", error);
    cachedRanking = [];
    return [];
  }
}

/**
 * キャッシュをそのまま返す。Firestore アクセスなし。
 */
export function getCachedRanking(limitCount = 100) {
  return cachedRanking.slice(0, limitCount);
}

/**
 * optimistic update: 送信前に UI に反映させる
 */
export function optimisticUpdate(name, score, mode) {
  const safeMode = ALLOWED_MODES.includes(mode) ? mode : "normal";
  cachedRanking.unshift({
    name,
    score,
    mode: safeMode,
    createdAt: new Date(),
  });
  // 101件目以降は削除して最新 100 件のみ保持
  if (cachedRanking.length > 100) {
    cachedRanking = cachedRanking.slice(0, 100);
  }
  console.log("[optimisticUpdate] Added to cache, now", cachedRanking.length, "entries");
}

/**
 * Firestore に送信。
 */
export async function submitScore(name, score, mode) {
  const cleanedName = String(name || "").trim().slice(0, 24);
  const numericScore = Number(score) || 0;
  const safeMode = ALLOWED_MODES.includes(mode) ? mode : "normal";

  if (!cleanedName) {
    throw new Error("名前を入力してください。");
  }
  if (numericScore <= 0 || numericScore >= MAX_SCORE) {
    throw new Error("スコアが不正です。");
  }

  const docData = {
    name: cleanedName,
    score: numericScore,
    mode: safeMode,
    createdAt: serverTimestamp(),
  };
  
  console.log("[submitScore] Sending to Firestore:", docData);
  
  const docRef = await addDoc(collection(db, "scores"), docData);
  console.log("[submitScore] Success! Doc ID:", docRef.id);
}

/**
 * 送信後に呼ぶ。Firestore から最新データを再読み込み。
 */
export async function refreshRankingAfterSubmit() {
  console.log("[refreshRankingAfterSubmit] Reloading...");
  return preloadRanking();
}
