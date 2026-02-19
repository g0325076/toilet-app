import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentUpdated, onDocumentCreated } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import * as nodemailer from "nodemailer";

// 60秒の待機処理があるため、関数のタイムアウトを長め(120秒)に設定
setGlobalOptions({ region: "asia-northeast1", timeoutSeconds: 120 });

admin.initializeApp();
const db = admin.firestore();

// --- 定数設定 ---
const ALERT_DELAY_MINUTES = 30;     // 紙切れアラートまでの猶予
const OFFLINE_THRESHOLD_MINUTES = 10; // 通信途絶判定までの時間
const LOG_RETENTION_DAYS = 30;      // ログ保存期間
const THEFT_CHECK_DELAY_MS = 20000;       // 盗難検知(紙なし時)の待機時間: 20秒
const SUSPICIOUS_REMOVAL_DELAY_MS = 60000; // 盗難検知(紙あり時)の待機時間: 60秒

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

interface Area { id: string; name: string; }
interface FloorData { name: string; areas: Area[]; }

interface AlertData {
  toiletId?: string;
  title: string;
  type: string;
  location: string;
  description: string;
  severity: string;
  timestamp: admin.firestore.Timestamp;
  isResolved: boolean;
  isNotified: boolean;
}

// --- ヘルパー関数 ---

// 1. 場所名の取得 (フロア・エリア名を結合)
async function getLocationString(toiletData: ToiletData): Promise<string> {
  let locationName = toiletData.name || "不明な個室";
  if (toiletData.floorId) {
    try {
      const floorDoc = await db.collection("Floors").doc(toiletData.floorId).get();
      if (floorDoc.exists) {
        const floorData = floorDoc.data() as FloorData;
        const floorName = floorData.name || "";
        let areaName = "";
        if (toiletData.areaId && Array.isArray(floorData.areas)) {
          const area = floorData.areas.find((a) => a.id === toiletData.areaId);
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

// 2. ログ作成
async function createAlertLog(alertId: string, data: AlertData) {
  try {
    await db.collection("Logs").add({
      alertId: alertId,
      alertTitle: data.title,
      alertType: data.type,
      action: 'created',
      timestamp: admin.firestore.Timestamp.now(),
      location: data.location,
      description: data.description,
      severity: data.severity
    });
  } catch (e) {
    console.error("Error creating log:", e);
  }
}

// --- メイン関数: トイレデータ更新トリガー ---
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

    // ---------------------------------------------------------
    // A. ステータス変更検知 (デバイス側からの theft/malfunction 通知)
    // ---------------------------------------------------------
    if (newData.status !== oldData.status) {
      if (newData.status === 'theft') {
        const newAlertRef = db.collection("Alerts").doc();
        const alertData: AlertData = {
          toiletId: docId,
          type: "theft",
          severity: "critical",
          title: "盗難・持ち出し検知",
          description: `個室「${newData.name}」で異常な持ち出しを検知しました (デバイス検知)。`,
          location: locationStr,
          timestamp: now,
          isResolved: false,
          isNotified: false
        };
        batch.set(newAlertRef, alertData);
        await createAlertLog(newAlertRef.id, alertData);
        hasUpdates = true;
      }
      
      if (newData.status === 'malfunction') {
        const newAlertRef = db.collection("Alerts").doc();
        const alertData: AlertData = {
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
        await createAlertLog(newAlertRef.id, alertData);
        hasUpdates = true;
      }
    }

    // ---------------------------------------------------------
    // B. 紙切れ発生検知 (紙あり -> 紙なし)
    // ---------------------------------------------------------
    if (!newData.paperRemaining && oldData.paperRemaining) {
       batch.update(event.data.after.ref, { 
         paperEmptySince: now 
       });
       hasUpdates = true;
    }

    // ---------------------------------------------------------
    // C. 紙切れ遅延アラート判定 (30分以上経過)
    // ---------------------------------------------------------
    if (!newData.paperRemaining && 
        newData.reserveCount === 0 && 
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
            
            // 重複アラート防止
            const existingEmpty = await db.collection("Alerts")
              .where("toiletId", "==", docId)
              .where("type", "==", "empty")
              .where("isResolved", "==", false)
              .limit(1)
              .get();
            
            if (existingEmpty.empty) {
                const newAlertRef = db.collection("Alerts").doc();
                const alertData: AlertData = {
                    toiletId: docId,
                    type: "empty",
                    severity: "critical",
                    title: "紙切れ (長時間)",
                    description: `紙切れが${Math.floor(diffMinutes)}分以上続いています。予備在庫もありません。`,
                    location: locationStr,
                    timestamp: now,
                    isResolved: false,
                    isNotified: false
                };
                batch.set(newAlertRef, alertData);
                await createAlertLog(newAlertRef.id, alertData);
                hasUpdates = true;
            }
          }
      }
    }

    // ---------------------------------------------------------
    // D. 補充検知 (紙なし -> 紙あり)
    // ---------------------------------------------------------
    if (newData.paperRemaining && !oldData.paperRemaining) {
      const updates: { paperEmptySince: admin.firestore.FieldValue; status?: string } = { 
        paperEmptySince: admin.firestore.FieldValue.delete()
      };
      
      if (newData.status === 'empty') {
        updates.status = 'normal';
      }
      batch.update(event.data.after.ref, updates);
      hasUpdates = true;
    }

    // ---------------------------------------------------------
    // E. オフラインからの復帰検知
    // ---------------------------------------------------------
    if (oldData.status === 'offline' && newData.status === 'offline') {
        batch.update(event.data.after.ref, { 
            status: 'normal',
            isOnline: true
        });
        
        // 未解決の「通信途絶」アラートがあれば自動解決
        const recoveryAlert = await db.collection("Alerts")
            .where("toiletId", "==", docId)
            .where("type", "==", "offline")
            .where("isResolved", "==", false)
            .limit(1)
            .get();

        if (!recoveryAlert.empty) {
            batch.update(recoveryAlert.docs[0].ref, { isResolved: true });
        }
        hasUpdates = true;
        console.log(`Device ${docId} recovered from offline automatically.`);
    }

    // ---------------------------------------------------------
    // F. 盗難疑い検知 パターン1 (予備減少 & メイン紙なし)
    //    -> 「紙切れで予備を出したが、セットせずに持ち去った」
    // ---------------------------------------------------------
    if (newData.reserveCount < oldData.reserveCount && !newData.paperRemaining) {
        console.log(`Theft check (Empty Main) initiated for ${docId}. Waiting ${THEFT_CHECK_DELAY_MS}ms...`);
        
        // 1. 先にここまでの更新をコミット
        if (hasUpdates) {
            await batch.commit();
            hasUpdates = false;
        }

        // 2. 20秒待機
        await new Promise(resolve => setTimeout(resolve, THEFT_CHECK_DELAY_MS));

        // 3. 再確認
        const currentSnap = await event.data.after.ref.get();
        if (currentSnap.exists) {
            const currentData = currentSnap.data() as ToiletData;
            
            // 4. まだ紙がないなら盗難
            if (!currentData.paperRemaining && currentData.status !== 'theft') {
                const theftBatch = db.batch();
                theftBatch.update(event.data.after.ref, { status: 'theft' });

                const newAlertRef = db.collection("Alerts").doc();
                const alertData: AlertData = {
                    toiletId: docId,
                    type: "theft",
                    severity: "critical",
                    title: "予備ロール持ち去り検知",
                    description: `予備ロールが取り出されましたが、補充されていません (紙切れ継続)。`,
                    location: locationStr,
                    timestamp: admin.firestore.Timestamp.now(),
                    isResolved: false,
                    isNotified: false
                };
                
                theftBatch.set(newAlertRef, alertData);
                await createAlertLog(newAlertRef.id, alertData);
                await theftBatch.commit();
                console.log(`Theft detected (Empty Main) for ${docId}`);
                return; // ここで終了
            }
        }
    }

    // ---------------------------------------------------------
    // G. 盗難疑い検知 パターン2 (予備減少 & メイン紙あり) [★今回追加]
    //    -> 「まだ紙があるのに予備を持ち出し、戻さなかった (順次抜き取り)」
    // ---------------------------------------------------------
    if (newData.reserveCount < oldData.reserveCount && newData.paperRemaining) {
        console.log(`Suspicious reserve removal check for ${docId}. Waiting ${SUSPICIOUS_REMOVAL_DELAY_MS}ms...`);
        
        // 1. 先にここまでの更新をコミット
        if (hasUpdates) {
            await batch.commit();
            hasUpdates = false;
        }

        // 2. 60秒待機 (清掃や一時的な取り出しを考慮)
        await new Promise(resolve => setTimeout(resolve, SUSPICIOUS_REMOVAL_DELAY_MS));

        // 3. 再確認
        const currentSnap = await event.data.after.ref.get();
        if (currentSnap.exists) {
            const currentData = currentSnap.data() as ToiletData;
            
            // 判定条件:
            // - 予備が減ったままである (戻されていない)
            // - メインの紙はまだある (補充に使われたわけではない)
            // - 既に盗難ステータスではない
            if (currentData.reserveCount < oldData.reserveCount && 
                currentData.paperRemaining && 
                currentData.status !== 'theft') {
                
                const theftBatch = db.batch();
                theftBatch.update(event.data.after.ref, { status: 'theft' });

                const newAlertRef = db.collection("Alerts").doc();
                const alertData: AlertData = {
                    toiletId: docId,
                    type: "theft",
                    severity: "critical",
                    title: "予備ロール不審持ち出し",
                    description: `メインの紙が残っている状態で予備ロールが取り出され、${SUSPICIOUS_REMOVAL_DELAY_MS/1000}秒経過しても戻されませんでした。順次持ち去りの可能性があります。`,
                    location: locationStr,
                    timestamp: admin.firestore.Timestamp.now(),
                    isResolved: false,
                    isNotified: false
                };
                
                theftBatch.set(newAlertRef, alertData);
                await createAlertLog(newAlertRef.id, alertData);
                await theftBatch.commit();
                console.log(`Suspicious removal detected for ${docId}`);
                return; // ここで終了
            } else {
                 console.log(`Suspicious removal check cleared for ${docId}. Paper restored or used normally.`);
            }
        }
    }

    // 待機ロジックに入らなかった、または入る前の更新があればコミット
    if (hasUpdates) {
        await batch.commit();
    }

  } catch (error) {
    console.error("Error in onToiletUpdated:", error);
  }
});

// --- 定期実行: オフライン検知 (10分毎) ---
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
      const alertData: AlertData = {
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
      await createAlertLog(newAlertRef.id, alertData);
    }

    await batch.commit();
  } catch (error) {
    console.error("Error in checkOfflineDevices:", error);
  }
});

// --- 定期実行: 古いログの削除 (24時間毎) ---
export const cleanupLogs = onSchedule("every 24 hours", async (event) => {
  const now = admin.firestore.Timestamp.now();
  const cutoffMillis = now.toMillis() - (LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const cutoffTimestamp = admin.firestore.Timestamp.fromMillis(cutoffMillis);

  try {
    const snapshot = await db.collection("Logs")
      .where("timestamp", "<", cutoffTimestamp)
      .limit(500)
      .get();

    if (snapshot.empty) {
      console.log("No old logs to delete.");
      return;
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    
    await batch.commit();
    console.log(`Deleted ${snapshot.size} old logs.`);
  } catch (error) {
    console.error("Error in cleanupLogs:", error);
  }
});

// ★追加: メール送信設定
// ※セキュリティのため、本番運用では環境変数(defineSecret等)の使用を推奨します
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "g0325076@iwate-u.ac.jp", // 【変更】送信元のGmailアドレス
    pass: "fogj epir mntg jdgt",    // 【変更】Gmailのアプリパスワード（ログインパスワードではありません）
  },
});

// ★追加: アラート発生時に管理者へメール通知するトリガー
export const onAlertCreated = onDocumentCreated("Alerts/{alertId}", async (event) => {
  if (!event.data) return;

  const alertData = event.data.data() as AlertData; // 既存のAlertData型を使用
  const alertId = event.params.alertId;

  try {
    // 1. 'admin' 権限を持つユーザーのみを検索
    const adminSnapshot = await db.collection("Users")
      .where("role", "==", "admin")
      .get();

    if (adminSnapshot.empty) {
      console.log("通知対象の管理者(admin)が見つかりませんでした。");
      return;
    }

    // 2. メールアドレスをリスト化
    const adminEmails: string[] = [];
    adminSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.email) {
        adminEmails.push(data.email);
      }
    });

    if (adminEmails.length === 0) return;

    console.log(`Sending email to ${adminEmails.length} admins: ${adminEmails.join(", ")}`);

    // 3. メールの内容を作成
    // FirestoreのTimestamp型を日付文字列に変換
    const dateStr = alertData.timestamp.toDate().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
    
    const mailOptions = {
      from: '"トイレの神様" <g0325076@iwate-u.ac.jp>', // 【変更】送信元名とアドレス
      bcc: adminEmails, // 個人のメアドを隠すためBCCで一斉送信
      subject: `【重要】${alertData.title}が発生しました`,
      text: `
管理者各位

以下の個室でアラートが発生しました。確認をお願いします。

■ アラート内容
タイトル: ${alertData.title}
重要度: ${alertData.severity === 'critical' ? '緊急' : '警告'}
発生時刻: ${dateStr}

■ 場所
${alertData.location}

■ 詳細
${alertData.description}

--------------------------------------------------
このメールはシステムからの自動送信です。
      `,
    };

    // 4. 送信実行
    await transporter.sendMail(mailOptions);
    
    // 5. 通知済みフラグを更新
    await event.data.ref.update({ isNotified: true });
    
    // ログにも記録（アクション: notified）
    await db.collection("Logs").add({
      alertId: alertId,
      alertTitle: alertData.title,
      alertType: alertData.type,
      action: 'notified', // 通知ログ
      timestamp: admin.firestore.Timestamp.now(),
      location: alertData.location,
      description: `管理者${adminEmails.length}名にメール通知しました。`,
      severity: 'info'
    });

  } catch (error) {
    console.error("メール送信エラー:", error);
  }
});