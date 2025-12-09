import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";

admin.initializeApp();
const db = admin.firestore();

// --- 型定義 ---

// リクエストボディの型
interface RequestBody {
  toiletId: string;
  paperRemaining: number | string;
  isTheftDetected: boolean;
  reserveCount?: number | string;
}

// Firestoreデータの型
interface ToiletData {
  id: string;
  name: string;
  floorId?: string;
  areaId?: string;
  gender?: string;
  paperRemaining: number;
  hasPaper: boolean;
  reserveCount: number;
  status: string;
  isOnline: boolean;
  // 読み込み時は Timestamp, 書き込み時は FieldValue も許容
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

// 1. Arduinoからのデータ受信・更新用API
export const updateToiletStatus = functions.https.onRequest(async (req, res) => {
  // 【修正】req.body を RequestBody 型としてキャスト
  const body = req.body as RequestBody;
  const { toiletId, paperRemaining, isTheftDetected, reserveCount } = body;

  if (!toiletId) {
    res.status(400).send("Error: toiletId is required.");
    return;
  }

  try {
    const toiletRef = db.collection("Toilets").doc(toiletId);
    const toiletDoc = await toiletRef.get();
    
    let toiletData: ToiletData;

    // 更新データの作成
    // 【修正】Partial<ToiletData> 型を使用 (anyを回避)
    const updatePayload: Partial<ToiletData> = {
      paperRemaining: Number(paperRemaining),
      hasPaper: Number(paperRemaining) > 0 || Number(reserveCount) > 0,
      lastChecked: admin.firestore.FieldValue.serverTimestamp(),
      isOnline: true,
    };
    
    if (reserveCount !== undefined) {
      updatePayload.reserveCount = Number(reserveCount);
    }

    // 2. データの更新 または 新規作成
    if (!toiletDoc.exists) {
      // 新規作成ロジック
      const newToiletData: ToiletData = {
        id: toiletId,
        name: "未設定デバイス",
        gender: "male",
        reserveCount: reserveCount !== undefined ? Number(reserveCount) : 2,
        status: "normal",
        paperRemaining: Number(paperRemaining),
        hasPaper: Number(paperRemaining) > 0 || Number(reserveCount) > 0,
        isOnline: true,
        lastChecked: admin.firestore.Timestamp.now(),
      };
      await toiletRef.set(newToiletData);
      toiletData = newToiletData;
    } else {
      // 更新ロジック
      await toiletRef.update(updatePayload);
      // 既存データとマージして toiletData を更新（型キャスト）
      toiletData = { ...(toiletDoc.data() as ToiletData), ...updatePayload } as ToiletData;
    }

    // -------------------------------------------------
    // 3. アラート判定ロジック
    // -------------------------------------------------

    const currentRemaining = Number(paperRemaining);
    const currentReserves = reserveCount !== undefined ? Number(reserveCount) : (toiletData.reserveCount || 0);
    
    let alertType = "";
    let alertSeverity = "";
    let alertTitle = "";
    let alertDescription = "";

    // A. 盗難アラート
    if (isTheftDetected) {
      alertType = "theft";
      alertSeverity = "critical";
      alertTitle = "盗難の疑い";
      alertDescription = "トイレットペーパーの異常な減少を検知しました。";
    }
    // B. 紙切れアラート
    else if (currentRemaining <= 10 && currentReserves === 0) {
      alertType = "empty";
      alertSeverity = "critical";
      alertTitle = "紙切れ";
      alertDescription = "個室内のトイレットペーパーが完全に在庫切れです。至急補充してください。";
    }
    // C. 予備不足アラート
    else if (currentReserves === 0) {
      alertType = "low-stock";
      alertSeverity = "warning";
      alertTitle = "予備不足";
      alertDescription = "予備のトイレットペーパーがありません。補充の準備をしてください。";
    }

    // アラート対象の場合、DBに書き込み
    if (alertType) {
      const existingAlerts = await db.collection("Alerts")
        .where("toiletId", "==", toiletId)
        .where("isResolved", "==", false)
        .where("type", "==", alertType)
        .get();

      if (existingAlerts.empty) {
        let locationString = toiletData.name || "不明な個室";
        if (toiletData.floorId) {
          const floorDoc = await db.collection("Floors").doc(toiletData.floorId).get();
          if (floorDoc.exists) {
            // 【修正】FloorData 型を使用
            const floorData = floorDoc.data() as FloorData;
            // 【修正】AreaData 型を使用
            const area = floorData.areas?.find((a: AreaData) => a.id === toiletData.areaId);
            const areaName = area ? area.name : "";
            locationString = `${floorData.name} ${areaName} ${toiletData.name}`;
          }
        } else {
          locationString = `(未設定) ${toiletId}`;
        }

        await db.collection("Alerts").add({
          toiletId: toiletId,
          type: alertType,
          severity: alertSeverity,
          title: alertTitle,
          description: alertDescription,
          location: locationString,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          isResolved: false,
          isNotified: false
        });
        
        console.log(`Alert created: ${alertTitle} for ${toiletId}`);
      }
    }

    res.status(200).send({ status: "success" });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error");
  }
});

// 2. 定期監視機能 (オフライン検知)
export const checkOfflineDevices = onSchedule(
  {
    schedule: "every 10 minutes",
    timeZone: "Asia/Tokyo",
  },
  async (event) => {
    const now = admin.firestore.Timestamp.now();
    const threshold = new Date(now.toMillis() - 30 * 60 * 1000); 
    const thresholdTimestamp = admin.firestore.Timestamp.fromDate(threshold);

    try {
      const offlineToiletsSnapshot = await db.collection("Toilets")
        .where("isOnline", "==", true)
        .where("lastChecked", "<", thresholdTimestamp)
        .get();

      if (offlineToiletsSnapshot.empty) {
        console.log("No offline devices found.");
        return;
      }

      const batch = db.batch();

      for (const doc of offlineToiletsSnapshot.docs) {
        // 【修正】ToiletData 型を使用
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
          let locationString = toiletData.name || "不明な個室";
          if (toiletData.floorId) {
            const floorDoc = await db.collection("Floors").doc(toiletData.floorId).get();
            if (floorDoc.exists) {
              const floorData = floorDoc.data() as FloorData;
              const area = floorData.areas?.find((a: AreaData) => a.id === toiletData.areaId);
              locationString = `${floorData.name} ${area ? area.name : ""} ${toiletData.name}`;
            }
          }

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
      console.error("Error in checkOfflineDevices:", error);
    }
  }
);