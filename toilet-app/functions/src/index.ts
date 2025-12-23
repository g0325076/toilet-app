import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2";

// 東京リージョンに設定
setGlobalOptions({ region: "asia-northeast1" });

admin.initializeApp();
const db = admin.firestore();

// --- 型定義 ---
interface ToiletData {
  id: string;
  name: string;
  floorId?: string;
  areaId?: string;
  paperRemaining: boolean;
  hasPaper: boolean;
  reserveCount: number;
  status: string;
  isOnline: boolean;
  isTheftDetected?: boolean;
  // 【修正】Timestamp だけでなく FieldValue (削除用コマンド) も許容するように変更
  paperEmptySince?: admin.firestore.Timestamp | admin.firestore.FieldValue; 
  lastChecked: admin.firestore.Timestamp | admin.firestore.FieldValue;
}

interface AreaData {
  id: string;
  name: string;
  toiletIds?: string[];
}

interface FloorData {
  id: string;
  name: string;
  areas?: AreaData[];
}

// ----------------------------------------------------------------
// DB更新トリガー (状態変化の記録役)
// ----------------------------------------------------------------
export const onToiletUpdated = onDocumentUpdated("Toilets/{toiletId}", async (event) => {
  if (!event.data) return;

  const newData = event.data.after.data() as ToiletData;
  const oldData = event.data.before.data() as ToiletData;
  const toiletId = event.params.toiletId;

  // 【修正】any をやめて、正しい型 (Partial<ToiletData>) を使用
  const updates: Partial<ToiletData> = {}; 

  // 1. 盗難検知 (即時アラート)
  if (newData.isTheftDetected && !oldData.isTheftDetected) {
    let locationString = newData.name || "不明な個室";
    if (newData.floorId) {
      const floorDoc = await db.collection("Floors").doc(newData.floorId).get();
      if (floorDoc.exists) {
        const floorData = floorDoc.data() as FloorData;
        const areaName = floorData.areas?.find(a => a.id === newData.areaId)?.name || "";
        locationString = `${floorData.name} ${areaName} ${newData.name}`;
      }
    }

    await db.collection("Alerts").add({
      toiletId: toiletId,
      type: "theft",
      severity: "critical",
      title: "盗難検知",
      description: "予備ロールの盗難が疑われます。",
      location: locationString,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      isResolved: false,
      isNotified: false
    });
    
    updates.status = "theft";
  }

  // 2. 紙切れ時刻の記録管理
  // 紙がなくなった (falseになった) 瞬間
  if (newData.paperRemaining === false && oldData.paperRemaining !== false) {
    updates.hasPaper = false;
    // 記録開始
    updates.paperEmptySince = admin.firestore.FieldValue.serverTimestamp();
  } 
  // 紙が補充された (trueになった) 瞬間
  else if (newData.paperRemaining === true) {
    if (newData.status === "empty") {
      updates.status = "normal";
    }
    if (newData.hasPaper !== true) {
      updates.hasPaper = true;
    }
    // 記録をリセット（削除）
    updates.paperEmptySince = admin.firestore.FieldValue.delete();
  }

  if (Object.keys(updates).length > 0) {
    await event.data.after.ref.update(updates);
  }
});

// ----------------------------------------------------------------
// 定期実行系 (判定役)
// ----------------------------------------------------------------

// オフライン検知 (10分おき)
export const checkOfflineDevices = onSchedule("every 10 minutes", async () => {
  const now = admin.firestore.Timestamp.now();
  const cutoff = new Date(now.toMillis() - 30 * 60 * 1000);

  try {
    const snapshot = await db.collection("Toilets")
      .where("isOnline", "==", true)
      .where("lastChecked", "<", admin.firestore.Timestamp.fromDate(cutoff))
      .get();

    if (snapshot.empty) return;

    const batch = db.batch();

    for (const doc of snapshot.docs) {
      const toiletData = doc.data() as ToiletData;
      const toiletId = doc.id;

      batch.update(doc.ref, {
        isOnline: false,
        status: "offline"
      });

      const existingAlerts = await db.collection("Alerts")
        .where("toiletId", "==", toiletId)
        .where("isResolved", "==", false)
        .where("type", "==", "malfunction")
        .get();

      if (existingAlerts.empty) {
        const locationString = toiletData.name || "不明な個室";
        const newAlertRef = db.collection("Alerts").doc();
        batch.set(newAlertRef, {
          toiletId: toiletId,
          type: "malfunction",
          severity: "warning",
          title: "通信エラー",
          description: "センサーからの応答が30分以上ありません。",
          location: locationString,
          timestamp: now,
          isResolved: false,
          isNotified: false
        });
      }
    }
    await batch.commit();
    console.log("Offline devices updated.");
  } catch (error) {
    console.error("Error checking offline devices:", error);
  }
});

// 在庫チェック (10分おき)
export const checkStock = onSchedule("every 10 minutes", async () => {
  const now = admin.firestore.Timestamp.now();
  const ALERT_DELAY_MINUTES = 5; // ★猶予時間（5分）

  try {
    const snapshot = await db.collection("Toilets").get();
    const batch = db.batch();
    let hasUpdates = false;

    for (const doc of snapshot.docs) {
      const toilet = doc.data() as ToiletData;
      
      const isPaperEmpty = toilet.paperRemaining === false;
      const isReserveEmpty = toilet.reserveCount === 0;

      // 「紙なし」かつ「予備なし」の場合
      if (isPaperEmpty && isReserveEmpty) {
        
        // paperEmptySince が記録されているか確認
        // (型ガード: FieldValue型ではなくTimestamp型であることを確認してから使う)
        if (toilet.paperEmptySince && toilet.paperEmptySince instanceof admin.firestore.Timestamp) {
          const emptySinceDate = toilet.paperEmptySince.toDate();
          const diffMillis = now.toMillis() - emptySinceDate.getTime();
          const diffMinutes = diffMillis / (1000 * 60);

          // 猶予時間を超えていたらアラート
          if (diffMinutes >= ALERT_DELAY_MINUTES) {
            
            if (toilet.status !== "empty" && toilet.status !== "theft" && toilet.status !== "offline") {
                batch.update(doc.ref, { status: "empty" });
                hasUpdates = true;
            }

            const existingEmpty = await db.collection("Alerts")
              .where("toiletId", "==", doc.id)
              .where("type", "==", "empty")
              .where("isResolved", "==", false)
              .get();
            
            if (existingEmpty.empty) {
                const newAlertRef = db.collection("Alerts").doc();
                batch.set(newAlertRef, {
                    toiletId: doc.id,
                    type: "empty",
                    severity: "critical",
                    title: "紙切れ",
                    description: `紙切れ状態が${Math.floor(diffMinutes)}分以上続いています。`,
                    location: toilet.name,
                    timestamp: now,
                    isResolved: false,
                    isNotified: false
                });
                hasUpdates = true;
            }
          }
        }
      }
    }
    
    if (hasUpdates) {
        await batch.commit();
    }
  } catch (error) {
    console.error(error);
  }
});