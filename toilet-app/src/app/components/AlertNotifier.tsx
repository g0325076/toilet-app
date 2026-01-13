"use client";

import { useEffect, useRef, useState } from "react";
import { useFacilityData } from "@/hooks/useFirebaseData";
import { toast } from "sonner";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { AlertTriangle, Info, ShieldAlert, XCircle } from "lucide-react";

export default function AlertNotifier() {
  const { data } = useFacilityData();
  const [settings, setSettings] = useState({
    theft: true,
    lowStock: true,
    malfunction: true,
  });

  // 通知済みのアラートIDを記録（リロード時等の重複通知防止）
  // 初期値として、マウント時点での最新アラートIDを入れておくと、
  // 「ページを開いた瞬間に過去のアラートが大量に通知される」のを防げます。
  const processedAlertIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  // 1. ユーザー設定のリアルタイム監視
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // 設定が変わったら即座に反映させるため onSnapshot を使用
    const unsub = onSnapshot(doc(db, "Users", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const val = docSnap.data().notificationSettings;
        if (val) setSettings(prev => ({ ...prev, ...val }));
      }
    });

    return () => unsub();
  }, []);

  // 2. 新着アラートの監視と通知トリガー
  useEffect(() => {
    if (data.alerts.length === 0) return;

    // 初回ロード時は通知せず、IDだけ記録して「既読」扱いにする
    if (isFirstLoad.current) {
      data.alerts.forEach(alert => processedAlertIds.current.add(alert.id));
      isFirstLoad.current = false;
      return;
    }

    // 最新のアラートをチェック
    data.alerts.forEach(alert => {
      // 既に通知済みならスキップ
      if (processedAlertIds.current.has(alert.id)) return;

      // 未通知のアラートを発見 -> IDを記録
      processedAlertIds.current.add(alert.id);

      // --- フィルタリングロジック ---
      // 設定でOFFになっているタイプは通知しない
      if (alert.type === 'theft' && !settings.theft) return;
      if ((alert.type === 'empty' || alert.type === 'low-stock') && !settings.lowStock) return;
      if ((alert.type === 'malfunction' || alert.type === 'offline' || alert.type === 'error') && !settings.malfunction) return;

      // --- 通知の表示 ---
      // タイプに応じてアイコンや色を変える
      let icon = <Info className="w-5 h-5 text-blue-500" />;
      if (alert.type === 'theft') icon = <ShieldAlert className="w-5 h-5 text-red-600" />;
      else if (alert.type === 'empty') icon = <AlertTriangle className="w-5 h-5 text-orange-500" />;
      else if (alert.type === 'offline') icon = <XCircle className="w-5 h-5 text-gray-500" />;

      toast(alert.title, {
        description: `${alert.location} - ${alert.description}`,
        icon: icon,
        duration: 8000, // 重要なので少し長めに表示
        action: {
          label: "確認",
          onClick: () => {
             // 必要であれば詳細ログ画面へ遷移などの処理
             console.log("Alert clicked", alert.id);
          }
        },
      });
    });

  }, [data.alerts, settings]);

  return null; // UIを持たないロジックのみのコンポーネント
}