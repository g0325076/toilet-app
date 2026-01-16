"use client";

import { useState, useEffect } from "react";
import { doc, setDoc, getDoc } from "firebase/firestore"; 
import { db, auth } from "@/lib/firebase";
import { Switch } from "@/app/components/ui/switch";
import { Label } from "@/app/components/ui/label";
import { Button } from "@/app/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react"; 

export default function NotificationSettings() {
  const [settings, setSettings] = useState({
    theft: true,      // 盗難
    lowStock: true,   // 紙切れ・予備不足
    malfunction: true // 障害・オフライン
  });
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // 初回読み込み
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userRef = doc(db, "Users", user.uid);
        const snap = await getDoc(userRef);
        
        if (snap.exists()) {
          const data = snap.data();
          if (data.notificationSettings) {
            setSettings(prev => ({ ...prev, ...data.notificationSettings }));
          }
        }
      } catch (e) {
        console.error("設定の取得に失敗しました", e);
      } finally {
        setInitializing(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) {
      toast.error("ログインが必要です");
      return;
    }

    setLoading(true);
    try {
      const userRef = doc(db, "Users", user.uid);
      await setDoc(userRef, {
        notificationSettings: settings
      }, { merge: true });
      
      toast.success("通知設定を保存しました");
    } catch (e) {
      console.error(e);
      toast.error("保存中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  if (initializing) {
    return <div className="p-8 text-center text-gray-400">設定を読み込み中...</div>;
  }

  return (
    <div className="space-y-6 p-6 border rounded-lg bg-white shadow-sm">
      <div className="space-y-1">
        <h3 className="text-lg font-bold text-gray-800">通知フィルター設定</h3>
        <p className="text-sm text-gray-500">
          画面上のポップアップ通知を受け取るアラートの種類を選択します。<br/>
          (アラートログ自体は設定に関わらず記録されます)
        </p>
      </div>
      
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between py-2 border-b border-gray-100">
          <div className="space-y-0.5">
            <Label htmlFor="theft-alert" className="text-base font-medium">盗難・異常検知 (緊急)</Label>
            <p className="text-xs text-gray-400">大量持ち出しの疑いなど</p>
          </div>
          <Switch 
            id="theft-alert" 
            checked={settings.theft}
            onCheckedChange={(c) => setSettings(s => ({...s, theft: c}))}
          />
        </div>

        <div className="flex items-center justify-between py-2 border-b border-gray-100">
          <div className="space-y-0.5">
            <Label htmlFor="low-stock" className="text-base font-medium">在庫切れ・予備不足</Label>
            <p className="text-xs text-gray-400">紙切れアラート、予備ロール減少</p>
          </div>
          <Switch 
            id="low-stock"
            checked={settings.lowStock}
            onCheckedChange={(c) => setSettings(s => ({...s, lowStock: c}))}
          />
        </div>

        <div className="flex items-center justify-between py-2 border-b border-gray-100">
          <div className="space-y-0.5">
            <Label htmlFor="malfunction" className="text-base font-medium">システム障害</Label>
            <p className="text-xs text-gray-400">センサー故障、通信切断(オフライン)</p>
          </div>
          <Switch 
            id="malfunction"
            checked={settings.malfunction}
            onCheckedChange={(c) => setSettings(s => ({...s, malfunction: c}))}
          />
        </div>
      </div>

      <div className="pt-4 flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={loading} 
          // ★修正: variant="outline" を追加して枠線を表示
          variant="outline"
          className="min-w-[120px] border-gray-300 hover:bg-gray-50"
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          設定を保存
        </Button>
      </div>
    </div>
  );
}