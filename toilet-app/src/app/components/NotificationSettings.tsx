"use client";

import { useState, useEffect } from "react";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { Switch } from "@/app/components/ui/switch";
import { Label } from "@/app/components/ui/label";
import { Button } from "@/app/components/ui/button";
import { toast } from "sonner";

export default function NotificationSettings() {
  const [settings, setSettings] = useState({
    theft: true,
    lowStock: true,
    malfunction: false,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!auth.currentUser) return;
      const userRef = doc(db, "Users", auth.currentUser.uid);
      const snap = await getDoc(userRef);
      if (snap.exists() && snap.data().notificationSettings) {
        setSettings(snap.data().notificationSettings);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const userRef = doc(db, "Users", auth.currentUser.uid);
      await updateDoc(userRef, {
        notificationSettings: settings
      });
      toast.success("通知設定を保存しました");
    } catch (e) {
      toast.error("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 border rounded-lg bg-white">
      <h3 className="text-lg font-medium">通知設定</h3>
      
      <div className="flex items-center justify-between">
        <Label htmlFor="theft-alert">盗難アラート (緊急)</Label>
        <Switch 
          id="theft-alert" 
          checked={settings.theft}
          onCheckedChange={(c) => setSettings(s => ({...s, theft: c}))}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="low-stock">紙切れ・予備不足</Label>
        <Switch 
          id="low-stock"
          checked={settings.lowStock}
          onCheckedChange={(c) => setSettings(s => ({...s, lowStock: c}))}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="malfunction">障害検知 (センサー故障・通信断)</Label>
        <Switch 
          id="malfunction"
          checked={settings.malfunction}
          onCheckedChange={(c) => setSettings(s => ({...s, malfunction: c}))}
        />
      </div>

      <Button onClick={handleSave} disabled={loading}>
        設定を保存
      </Button>
    </div>
  );
}