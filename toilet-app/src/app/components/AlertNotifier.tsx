"use client";

import { useEffect, useRef } from 'react';
import { ShieldAlert, WrenchIcon, AlertTriangle } from 'lucide-react';
import { useFacilityData } from '@/hooks/useFirebaseData';
import { toast } from 'sonner';

export default function AlertNotifier() {
  // 常に最新データを監視
  const { data, loading } = useFacilityData();
  const { alerts } = data;

  // 通知済みのアラートIDを記憶（リロードするまで保持）
  const notifiedAlertIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (loading) return;

    // 未解決のアラートを確認
    const activeAlerts = alerts.filter(a => !a.isResolved);

    // 【修正】より強力なスタイル指定に変更 (!important を使用)
    // !text-gray-900: 文字色を強制的に濃い黒にする
    // !font-bold: 文字を太くする
    // !text-base: フォントサイズを標準より少し大きくする
    // mt-2: タイトルとの間隔を少し空ける
    const descriptionStyle = "!text-base !text-gray-900 !font-bold mt-2";

    activeAlerts.forEach(alert => {
      // まだ通知していないアラートであれば通知を表示
      if (!notifiedAlertIds.current.has(alert.id)) {
        
        // 1. 通知済みリストに追加
        notifiedAlertIds.current.add(alert.id);

        // 2. アラートタイプに応じたポップアップを表示
        if (alert.type === 'theft') {
          // 盗難（緊急）
          toast.error('盗難の疑いを検知しました！', {
            description: `${alert.location} で異常が発生しています。至急確認してください。`,
            descriptionClassName: descriptionStyle, // 【修正】スタイル適用
            duration: 10000, // 10秒間表示
            icon: <ShieldAlert className="w-5 h-5" />,
            action: {
              label: '確認する',
              onClick: () => {
                // ログ画面などに飛ばす処理も可能ですが、まずは閉じる
              }
            },
            style: {
              background: '#FEF2F2', // 薄い赤
              border: '2px solid #EF4444', // 赤枠
              color: '#991B1B'
            }
          });
        } 
        else if (alert.type === 'malfunction') {
          // 障害
          toast.warning('障害を検知しました', {
            description: `${alert.location}: ${alert.title}`,
            descriptionClassName: descriptionStyle, // 【修正】スタイル適用
            icon: <WrenchIcon className="w-5 h-5" />,
            duration: 8000,
          });
        }
        else if (alert.type === 'empty') {
          // 紙切れ
          toast.error('紙切れ警告', {
            description: `${alert.location} の在庫がなくなりました。`,
            descriptionClassName: descriptionStyle, // 【修正】スタイル適用
            icon: <AlertTriangle className="w-5 h-5" />,
            duration: 8000,
          });
        }
        else if (alert.type === 'low-stock') {
          // 予備不足
          toast('予備不足のお知らせ', {
            description: `${alert.location} の予備がなくなりました。`,
            descriptionClassName: descriptionStyle, // 【修正】スタイル適用
            icon: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
            duration: 5000,
          });
        }
      }
    });
  }, [alerts, loading]);

  // UIは持たないのでnullを返す
  return null;
}