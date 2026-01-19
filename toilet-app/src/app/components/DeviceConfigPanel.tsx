"use client";

import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore"; 
import { db } from "@/lib/firebase";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { toast } from "sonner";
import { Loader2, Save, Wrench } from "lucide-react"; 

// 設定データの型定義
interface DeviceConfig {
  SEND_INTERVAL: number;
  TIME_ON: number;
  TIME_OFF: number;
  distanceThreshold: number;
  motorA_Cycles: number;
}

export default function DeviceConfigPanel() {
  const [config, setConfig] = useState<DeviceConfig>({
    SEND_INTERVAL: 3000,
    TIME_ON: 300,
    TIME_OFF: 1000,
    distanceThreshold: 10,
    motorA_Cycles: 3
  });
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // Firestoreのドキュメントパス (config.jsに基づく)
  const CONFIG_DOC_PATH = "config/config01";

  // 1. 設定読み込み
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docRef = doc(db, CONFIG_DOC_PATH);
        const snap = await getDoc(docRef);
        
        if (snap.exists()) {
          // 既存データがあればマージ（型安全のため一部キャスト）
          const data = snap.data() as Partial<DeviceConfig>;
          setConfig(prev => ({ ...prev, ...data }));
        }
      } catch (e) {
        console.error("設定の取得に失敗しました", e);
        toast.error("設定データの読み込みに失敗しました");
      } finally {
        setInitializing(false);
      }
    };
    fetchConfig();
  }, []);

  // 入力ハンドラ
  const handleChange = (key: keyof DeviceConfig, value: string) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue)) {
      setConfig(prev => ({ ...prev, [key]: numValue }));
    }
  };

  // 2. 保存処理
  const handleSave = async () => {
    setLoading(true);
    try {
      const docRef = doc(db, CONFIG_DOC_PATH);
      // 数値型として保存
      await setDoc(docRef, config, { merge: true });
      
      toast.success("デバイス設定を保存しました", {
        description: "数秒以内にデバイスに反映されます。"
      });
    } catch (e) {
      console.error(e);
      toast.error("保存中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  if (initializing) {
    return <div className="p-8 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto"/>読み込み中...</div>;
  }

  return (
    <Card className="border-blue-100 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Wrench className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <CardTitle>デバイス動作パラメータ設定</CardTitle>
            <CardDescription>
              トイレットペーパーホルダー(自動巻き取り機)の挙動を調整します。
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 通信・センサー設定 */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-gray-700 border-b pb-2">基本設定</h4>
            
            <div className="space-y-2">
              <Label htmlFor="sendInterval">データ送信間隔 (ms)</Label>
              <Input 
                id="sendInterval" 
                type="number" 
                value={config.SEND_INTERVAL}
                onChange={(e) => handleChange("SEND_INTERVAL", e.target.value)}
              />
              <p className="text-xs text-gray-400">センサーがデータを送信する頻度です (例: 3000 = 3秒)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="distanceThreshold">紙切れ判定距離 (cm)</Label>
              <Input 
                id="distanceThreshold" 
                type="number" 
                value={config.distanceThreshold}
                onChange={(e) => handleChange("distanceThreshold", e.target.value)}
              />
              <p className="text-xs text-gray-400">これ以上の距離を検知すると「紙切れ」と判断します</p>
            </div>
          </div>

          {/* モーター設定 */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-gray-700 border-b pb-2">モーター制御</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="timeOn">紙送り時間 (ms)</Label>
                <Input 
                  id="timeOn" 
                  type="number" 
                  value={config.TIME_ON}
                  onChange={(e) => handleChange("TIME_ON", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeOff">一時停止時間 (ms)</Label>
                <Input 
                  id="timeOff" 
                  type="number" 
                  value={config.TIME_OFF}
                  onChange={(e) => handleChange("TIME_OFF", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="motorCycles">動作回数 (回)</Label>
              <Input 
                id="motorCycles" 
                type="number" 
                value={config.motorA_Cycles}
                onChange={(e) => handleChange("motorA_Cycles", e.target.value)}
              />
              <p className="text-xs text-gray-400">モーターを回転させるセット回数</p>
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-end border-t mt-4">
          <Button 
            onClick={handleSave} 
            disabled={loading} 
            className="min-w-[140px] bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            設定を保存
          </Button>
        </div>

      </CardContent>
    </Card>
  );
}