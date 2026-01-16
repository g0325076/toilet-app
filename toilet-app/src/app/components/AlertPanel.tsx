"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock, MapPin, ShieldAlert, WrenchIcon } from 'lucide-react';
import { AlertUI } from '@/types/schema';
import { doc, writeBatch, collection, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

interface AlertPanelProps {
  alertsData: AlertUI[];
}

export default function AlertPanel({ alertsData }: AlertPanelProps) {
  // 未解決のアラートのみを抽出
  const activeAlerts = alertsData.filter(a => !a.isResolved);

  const handleResolve = async (alert: AlertUI) => {
    try {
      const batch = writeBatch(db);

      // 1. ログコレクションへの書き込み (履歴保存)
      const logRef = doc(collection(db, "Logs"));
      batch.set(logRef, {
        alertId: alert.id,
        alertTitle: alert.title,
        alertType: alert.type,
        action: 'resolved',
        timestamp: Timestamp.now(),
        location: alert.location,
        description: alert.description,
        severity: alert.severity
      });

      // 2. アラートコレクションからの削除 (表示から消す)
      const alertRef = doc(db, "Alerts", alert.id);
      batch.delete(alertRef);

      // ★追加: 盗難(theft)や故障(malfunction)の場合、個室のステータスを 'normal' に戻す
      if (alert.toiletId && (alert.type === 'theft' || alert.type === 'malfunction')) {
        const toiletRef = doc(db, "Toilets", alert.toiletId);
        batch.update(toiletRef, { 
          status: 'normal' 
        });
      }

      // 3. 一括実行
      await batch.commit();
      
      toast.success("解決済みとし、ステータスを正常に戻しました");
    } catch (e) {
      console.error(e);
      toast.error("エラーが発生しました");
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-50 border-l-4 border-l-red-500';
      case 'warning': return 'bg-yellow-50 border-l-4 border-l-yellow-500';
      default: return 'bg-blue-50 border-l-4 border-l-blue-500';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'theft': return <ShieldAlert className="w-5 h-5 text-purple-600" />;
      case 'malfunction': return <WrenchIcon className="w-5 h-5 text-orange-600" />;
      case 'empty': return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'offline': return <AlertTriangle className="w-5 h-5 text-gray-500" />;
      default: return <AlertTriangle className="w-5 h-5 text-blue-600" />;
    }
  };

  return (
    <Card className="border-red-100 shadow-sm overflow-hidden">
      <CardHeader className="py-3 px-4 border-b bg-red-50/30 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-bold flex items-center gap-2 text-red-800">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          発生中のアラート
          {activeAlerts.length > 0 && (
            <Badge variant="destructive" className="ml-2 px-2 py-0.5 text-xs animate-pulse">
              {activeAlerts.length}件
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-0">
        {activeAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
            <CheckCircle2 className="w-12 h-12 text-green-500 opacity-20" />
            <p className="text-sm font-medium">現在、対応が必要なアラートはありません</p>
          </div>
        ) : (
          <div className="divide-y max-h-[400px] overflow-y-auto">
            {activeAlerts.map((alert) => (
              <div key={alert.id} className={`p-4 flex flex-col sm:flex-row gap-3 hover:bg-gray-50 transition-colors ${getSeverityColor(alert.severity)}`}>
                
                <div className="mt-1 flex-shrink-0">
                  {getAlertIcon(alert.type)}
                </div>
                
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-sm text-gray-900">{alert.title}</h4>
                    <span className="text-xs text-gray-500 flex items-center gap-1 whitespace-nowrap">
                      <Clock className="w-3 h-3" /> {alert.timestamp}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-700 leading-snug">{alert.description}</p>
                  
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-2 font-mono bg-white/50 inline-block px-1 rounded">
                    <MapPin className="w-3 h-3 inline" /> {alert.location}
                  </div>
                </div>

                <div className="mt-2 sm:mt-0 flex-shrink-0 flex items-center">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="bg-white border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800 shadow-sm w-full sm:w-auto"
                    onClick={() => handleResolve(alert)}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    解決済みにする
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}