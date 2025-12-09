// src/lib/firebase.ts

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// .env.local から Firebase の設定を読み込む
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Firebase アプリの初期化
// （サーバーサイドレンダリングや再読み込み時に重複して初期化されるのを防ぐ）
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 各種サービスをエクスポート
// これを他のファイル（例: page.tsx）から import して使用する
export const db = getFirestore(app);
export const auth = getAuth(app);
export const firebaseApp = app; // 必要に応じて app 本体も