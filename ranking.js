import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  set,
  get,
  query,
  orderByChild,
  limitToLast,
  serverTimestamp,
  onValue,
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAeHw_31_xYD7d9lVSCu9cEgZ4MOer1IiA",
  authDomain: "aomoriapple-48db3.firebaseapp.com",
  databaseURL: "https://aomoriapple-48db3-default-rtdb.firebaseio.com",
  projectId: "aomoriapple-48db3",
  storageBucket: "aomoriapple-48db3.firebasestorage.app",
  messagingSenderId: "763922739575",
  appId: "1:763922739575:web:3c1a79ba10aff7c4327172",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const MAX_SCORE = 1000000;
const ALLOWED_MODES = ["normal", "hard", "skull"];

// メモリ保持用ランキング
let cachedRanking = [];

function normalizeRankingSnapshot(snapshot) {
  const value = snapshot.val();
  if (!value) return [];
  const list = Object.entries(value).map(([id, item]) => ({ id, ...item }));
  return list.sort((a, b) => b.score - a.score);
}

function scoresRef(mode = null) {
  return ref(db, mode && ALLOWED_MODES.includes(mode) ? `scores/${mode}` : "scores/all");
}

/**
 * ゲーム起動時に呼ぶ。
 * Realtime Database から TOP 100 を先読みしてメモリに保持。
 */
export async function preloadRanking(limitCount = 100) {
  try {
    console.log("[preloadRanking] Starting query...");
    const q = query(scoresRef(), orderByChild("score"), limitToLast(limitCount));
    console.log("[preloadRanking] Query created, calling get...");
    const snap = await get(q);
    console.log("[preloadRanking] Snapshot received, val:", snap.val());
    let result = normalizeRankingSnapshot(snap).slice(0, limitCount);
    if (result.length === 0) {
      // ダミーデータを追加
      result = [
        { name: "テストプレイヤー1", score: 50000, mode: "normal", createdAt: Date.now() },
        { name: "テストプレイヤー2", score: 45000, mode: "normal", createdAt: Date.now() },
        { name: "テストプレイヤー3", score: 40000, mode: "skull", createdAt: Date.now() },
        { name: "テストプレイヤー4", score: 35000, mode: "normal", createdAt: Date.now() },
        { name: "テストプレイヤー5", score: 30000, mode: "normal", createdAt: Date.now() },
      ];
      console.log("[preloadRanking] Using dummy data");
    }
    cachedRanking = result;
    console.log("[preloadRanking] Loaded", cachedRanking.length, "entries");
    return cachedRanking;
  } catch (error) {
    console.error("[preloadRanking] Error:", error);
    cachedRanking = [];
    return [];
  }
}

/**
 * Realtime Database の値変更をリアルタイムで受け取る。
 */
export function listenRanking(onUpdate, limitCount = 100) {
  const q = query(scoresRef(), orderByChild("score"), limitToLast(limitCount));
  const unsubscribe = onValue(q, (snap) => {
    const result = normalizeRankingSnapshot(snap).slice(0, limitCount);
    cachedRanking = result;
    console.log("[listenRanking] Updated", cachedRanking.length, "entries");
    if (typeof onUpdate === "function") {
      onUpdate(result);
    }
  });
  return unsubscribe;
}

/**
 * キャッシュをそのまま返す。Realtime Database アクセスなし。
 */
export function getCachedRanking(limitCount = 100, mode = null) {
  const list = mode && ALLOWED_MODES.includes(mode)
    ? cachedRanking.filter((entry) => entry.mode === mode)
    : cachedRanking;
  return list.slice(0, limitCount);
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
    createdAt: Date.now(),
  });
  if (cachedRanking.length > 100) cachedRanking = cachedRanking.slice(0, 100);
  console.log("[optimisticUpdate] Added to cache, now", cachedRanking.length, "entries");
}

/**
 * Realtime Database に送信。
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

  const scoreData = {
    name: cleanedName,
    score: numericScore,
    mode: safeMode,
    createdAt: serverTimestamp(),
  };

  console.log("[submitScore] Sending to Realtime DB:", scoreData);
  const allRef = push(scoresRef());
  const modeRef = push(scoresRef(safeMode));
  await Promise.all([set(allRef, scoreData), set(modeRef, scoreData)]);
  console.log("[submitScore] Success!");
}

/**
 * 送信後に呼ぶ。Realtime Database から最新データを再読み込み。
 */
export async function refreshRankingAfterSubmit(limitCount = 100) {
  console.log("[refreshRankingAfterSubmit] Reloading...");
  return preloadRanking(limitCount);
}
