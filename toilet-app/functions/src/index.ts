import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2";

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
  reserveCount: number;
  status: string;
  isOnline: boolean;
  paperEmptySince?: admin.firestore.Timestamp | admin.firestore.FieldValue; 
  lastChecked?: admin.firestore.Timestamp | admin.firestore.FieldValue;
}

const ALERT_DELAY_MINUTES = 30;
const OFFLINE_THRESHOLD_MINUTES = 10;

// ヘルパー関数: 場所名の取得
async function getLocationString(toiletData: ToiletData): Promise<string> {
  let locationName = toiletData.name || "不明な個室";
  if (toiletData.floorId) {
    try {
      const floorDoc = await db.collection("Floors").doc(toiletData.floorId).get();
      if (floorDoc.exists) {
        const floorData = floorDoc.data();
        const floorName = floorData?.name || "";
        let areaName = "";
        if (toiletData.areaId && Array.isArray(floorData?.areas)) {
          const area = floorData.areas.find((a: { id: string; name: string }) => a.id === toiletData.areaId);
          if (area) areaName = area.name;
        }
        const parts = [floorName, areaName, toiletData.name].filter(p => p);
        locationName = parts.join(" ");
      }
    } catch (e) {
      console.error("Error fetching location details:", e);
    }
  }
  return locationName;
}

// ★追加: ログ作成用のヘルパー関数
interface AlertData {
  title: string;
  type: string;
  location: string;
  description: string;
  severity: string;
}

async function createAlertLog(alertId: string, data: AlertData) {
  try {
    await db.collection("Logs").add({
      alertId: alertId,
      alertTitle: data.title,
      alertType: data.type,
      action: 'created', // 発生ログ
      timestamp: admin.firestore.Timestamp.now(),
      location: data.location,
      description: data.description,
      severity: data.severity
    });
  } catch (e) {
    console.error("Error creating log:", e);
  }
}

export const onToiletUpdated = onDocumentUpdated("Toilets/{toiletId}", async (event) => {
  if (!event.data) return;

  const newData = event.data.after.data() as ToiletData;
  const oldData = event.data.before.data() as ToiletData;
  const docId = event.params.toiletId;

  const batch = db.batch();
  let hasUpdates = false;
  const now = admin.firestore.Timestamp.now();

  try {
    const locationStr = await getLocationString(newData);

    // A. ステータス変更検知
    if (newData.status !== oldData.status) {
      if (newData.status === 'theft') {
        const newAlertRef = db.collection("Alerts").doc();
        const alertData = {
          toiletId: docId,
          type: "theft",
          severity: "critical",
          title: "盗難・持ち出し検知",
          description: `個室「${newData.name}」で異常な持ち出しを検知しました。`,
          location: locationStr,
          timestamp: now,
          isResolved: false,
          isNotified: false
        };
        batch.set(newAlertRef, alertData);
        await createAlertLog(newAlertRef.id, alertData); // ★ログ作成
        hasUpdates = true;
      }
      
      if (newData.status === 'malfunction') {
        const newAlertRef = db.collection("Alerts").doc();
        const alertData = {
          toiletId: docId,
          type: "malfunction",
          severity: "warning",
          title: "設備故障",
          description: `個室「${newData.name}」の設備異常を検知しました。`,
          location: locationStr,
          timestamp: now,
          isResolved: false,
          isNotified: false
        };
        batch.set(newAlertRef, alertData);
        await createAlertLog(newAlertRef.id, alertData); // ★ログ作成
        hasUpdates = true;
      }
    }

    // B. 紙切れ遅延検知
    if (!newData.paperRemaining && 
        newData.status !== "empty" && 
        newData.status !== "theft" && 
        newData.status !== "malfunction" && 
        newData.status !== "offline") {
      
      if (newData.paperEmptySince instanceof admin.firestore.Timestamp) {
          const emptySinceDate = newData.paperEmptySince.toDate();
          const diffMillis = now.toMillis() - emptySinceDate.getTime();
          const diffMinutes = diffMillis / (1000 * 60);

          if (diffMinutes >= ALERT_DELAY_MINUTES) {
            batch.update(event.data.after.ref, { status: "empty" });
            
            const existingEmpty = await db.collection("Alerts")
              .where("toiletId", "==", docId)
              .where("type", "==", "empty")
              .where("isResolved", "==", false)
              .limit(1)
              .get();
            
            if (existingEmpty.empty) {
                const newAlertRef = db.collection("Alerts").doc();
                const alertData = {
                    toiletId: docId,
                    type: "empty",
                    severity: "critical",
                    title: "紙切れ (長時間)",
                    description: `紙切れが${Math.floor(diffMinutes)}分以上続いています。`,
                    location: locationStr,
                    timestamp: now,
                    isResolved: false,
                    isNotified: false
                };
                batch.set(newAlertRef, alertData);
                await createAlertLog(newAlertRef.id, alertData); // ★ログ作成
                hasUpdates = true;
            }
          }
      }
    }

    if (hasUpdates) {
        await batch.commit();
        console.log(`Alert processed for toilet: ${docId}`);
    }

  } catch (error) {
    console.error("Error in onToiletUpdated:", error);
  }
});

// 定期実行トリガー (オフライン検知)
export const checkOfflineDevices = onSchedule("every 10 minutes", async (event) => {
  const now = admin.firestore.Timestamp.now();
  const cutoff = new Date(now.toMillis() - OFFLINE_THRESHOLD_MINUTES * 60 * 1000);
  const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoff);

  try {
    const snapshot = await db.collection("Toilets")
      .where("lastChecked", "<", cutoffTimestamp)
      .where("isOnline", "==", true)
      .get();

    if (snapshot.empty) return;

    const batch = db.batch();
    
    for (const doc of snapshot.docs) {
      const tData = doc.data() as ToiletData;
      batch.update(doc.ref, { isOnline: false, status: "offline" });
      
      const locationStr = await getLocationString(tData);

      const newAlertRef = db.collection("Alerts").doc();
      const alertData = {
        toiletId: doc.id,
        type: "offline",
        severity: "warning",
        title: "通信途絶",
        description: "デバイスからの応答がありません。",
        location: locationStr,
        timestamp: now,
        isResolved: false,
        isNotified: false
      };
      batch.set(newAlertRef, alertData);
      await createAlertLog(newAlertRef.id, alertData); // ★ログ作成
    }

    await batch.commit();
  } catch (error) {
    console.error("Error in checkOfflineDevices:", error);
  }
});