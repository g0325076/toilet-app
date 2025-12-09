"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { AlertTriangle, ShieldAlert, WrenchIcon, CheckCircle2, Clock, MapPin } from 'lucide-react';
// 【修正】mockDataからのインポートを廃止し、schemaからAlertUIをAlertとしてインポート
import { AlertUI as Alert, AlertType, AlertSeverity } from '@/types/schema';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { toast } from 'sonner';
import { doc, updateDoc, deleteDoc, addDoc, collection, Timestamp } from "firebase/firestore"; 
import { db } from "@/lib/firebase"; 

interface AlertPanelProps {
  alertsData: Alert[];
}

export default function AlertPanel({ alertsData }: AlertPanelProps) {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [showResolveDialog, setShowResolveDialog] = useState(false);

  const activeAlerts = alertsData.filter(a => !a.isResolved);
  const resolvedAlerts = alertsData.filter(a => a.isResolved);
  const theftAlerts = activeAlerts.filter(a => a.type === 'theft');
  const malfunctionAlerts = activeAlerts.filter(a => a.type === 'malfunction');
  const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');

  const getAlertIcon = (type: AlertType) => {
    switch (type) {
      case 'theft': return <ShieldAlert className="w-5 h-5" />;
      case 'malfunction': return <WrenchIcon className="w-5 h-5" />;
      case 'empty': return <AlertTriangle className="w-5 h-5" />; // emptyも追加
      case 'low-stock': return <AlertTriangle className="w-5 h-5" />;
      default: return <AlertTriangle className="w-5 h-5" />;
    }
  };

  const getAlertColor = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical': return 'bg-red-50 border-red-200 text-red-700';
      case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-700';
      default: return 'bg-blue-50 border-blue-200 text-blue-700';
    }
  };
  
  const getBadgeColor = (severity: AlertSeverity) => {
    switch (severity) {
        case 'critical': return 'bg-red-100 text-red-700 hover:bg-red-100';
        case 'warning': return 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100';
        default: return 'bg-blue-100 text-blue-700 hover:bg-blue-100';
    }
  };

  const handleResolveAlert = async () => {
    if (selectedAlert) {
      try {
        // 【追加】30日後の日付を計算
        const now = new Date();
        const expireDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 現在 + 30日

        // 1. ログに記録 (Logsコレクションへ保存)
        await addDoc(collection(db, "Logs"), {
          alertId: selectedAlert.id,
          alertTitle: selectedAlert.title,
          alertType: selectedAlert.type,
          action: 'resolved',
          timestamp: Timestamp.now(), // 作成日
          expireAt: Timestamp.fromDate(expireDate), // 【追加】削除予定日（TTL用）
          location: selectedAlert.location,
          description: selectedAlert.description,
          severity: selectedAlert.severity
        });

        // 2. Alertsコレクションからは削除
        await deleteDoc(doc(db, "Alerts", selectedAlert.id));

        toast.success(`アラートを解決済みにしました: ${selectedAlert.title}`);
        setShowResolveDialog(false);
        setSelectedAlert(null);
      } catch (error) {
        console.error("Error resolving alert:", error);
        toast.error("更新に失敗しました");
      }
    }
  };

  const renderAlertCard = (alert: Alert) => (
    <div key={alert.id} className={`border-2 rounded-lg p-4 ${getAlertColor(alert.severity)} ${alert.isResolved ? 'opacity-60' : ''}`}>
       <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <div className="mt-1">{getAlertIcon(alert.type)}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4>{alert.title}</h4>
              <Badge className={getBadgeColor(alert.severity)}>
                 {alert.severity === 'critical' ? '緊急' : alert.severity === 'warning' ? '警告' : '情報'}
              </Badge>
              {alert.isResolved && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                    <CheckCircle2 className="w-3 h-3 mr-1" />解決済み
                  </Badge>
              )}
            </div>
            <p className="text-sm mb-2">{alert.description}</p>
            <div className="flex items-center gap-4 text-sm">
               <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{alert.location}</span>
               <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{alert.timestamp}</span>
            </div>
          </div>
        </div>
        {!alert.isResolved && (
          <Button variant="outline" size="sm" className="bg-white text-black border-gray-300 hover:bg-gray-100"
            onClick={() => { setSelectedAlert(alert); setShowResolveDialog(true); }}>
            解決
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
             <div><CardTitle>アラート通知</CardTitle><CardDescription>盗難検知・障害検知システム (Realtime DB)</CardDescription></div>
             {criticalAlerts.length > 0 && <Badge className="bg-red-100 text-red-700"><AlertTriangle className="w-4 h-4 mr-1" />{criticalAlerts.length}件の緊急アラート</Badge>}
          </div>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="bg-gray-100 p-3 rounded-lg"><p className="text-sm text-gray-600">アクティブ</p><p className="text-2xl">{activeAlerts.length}</p></div>
                <div className="bg-red-50 p-3 rounded-lg"><p className="text-sm text-red-600">盗難検知</p><p className="text-2xl text-red-700">{theftAlerts.length}</p></div>
                <div className="bg-orange-50 p-3 rounded-lg"><p className="text-sm text-orange-600">障害検知</p><p className="text-2xl text-orange-700">{malfunctionAlerts.length}</p></div>
                <div className="bg-green-50 p-3 rounded-lg"><p className="text-sm text-green-600">解決済み</p><p className="text-2xl text-green-700">{resolvedAlerts.length}</p></div>
            </div>
            
            <Tabs defaultValue="all">
               <TabsList className=" mb-4">
                  <TabsTrigger value="all">全て ({activeAlerts.length})</TabsTrigger>
                  <TabsTrigger value="theft">盗難 ({theftAlerts.length})</TabsTrigger>
                  <TabsTrigger value="malfunction">障害 ({malfunctionAlerts.length})</TabsTrigger>
                  <TabsTrigger value="resolved">解決済み ({resolvedAlerts.length})</TabsTrigger>
               </TabsList>
               <TabsContent value="all" className="space-y-3">{activeAlerts.length === 0 ? <div className="text-center py-8 text-gray-500">なし</div> : activeAlerts.map(renderAlertCard)}</TabsContent>
               <TabsContent value="theft" className="space-y-3">{theftAlerts.length === 0 ? <div className="text-center py-8 text-gray-500">なし</div> : theftAlerts.map(renderAlertCard)}</TabsContent>
               <TabsContent value="malfunction" className="space-y-3">{malfunctionAlerts.length === 0 ? <div className="text-center py-8 text-gray-500">なし</div> : malfunctionAlerts.map(renderAlertCard)}</TabsContent>
               <TabsContent value="resolved" className="space-y-3">{resolvedAlerts.length === 0 ? <div className="text-center py-8 text-gray-500">なし</div> : resolvedAlerts.map(renderAlertCard)}</TabsContent>
            </Tabs>
        </CardContent>
      </Card>
      
      <AlertDialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
        <AlertDialogContent>
           <AlertDialogHeader>
            <AlertDialogTitle>アラートを解決済みにしますか？</AlertDialogTitle>
            <AlertDialogDescription asChild>
               <div>{selectedAlert && (<div className="mt-4 space-y-2"><p><strong>タイトル:</strong> {selectedAlert.title}</p><p><strong>場所:</strong> {selectedAlert.location}</p></div>)}</div>
            </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleResolveAlert} className="bg-black text-white hover:bg-gray-800">解決済みにする</AlertDialogAction>
           </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}