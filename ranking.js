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

  await addDoc(collection(db, "scores"), {
    name: cleanedName,
    score: numericScore,
    mode: safeMode,
    createdAt: serverTimestamp(),
  });
}

export async function loadRanking(mode = null, limitCount = 100) {
  const clauses = [];
  if (mode && ALLOWED_MODES.includes(mode)) {
    clauses.push(where("mode", "==", mode));
  }
  clauses.push(orderBy("score", "desc"));
  clauses.push(limit(limitCount));

  const q = query(collection(db, "scores"), ...clauses);
  const snap = await getDocs(q);

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}
