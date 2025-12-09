"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ShieldAlert, WrenchIcon, Clock, MapPin, ArrowLeft, AlertCircle, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { AlertType, AlertSeverity } from '@/types/schema'; 
import { collection, query, orderBy, limit, getDocs, Timestamp, deleteDoc, doc, writeBatch } from "firebase/firestore"; 
import { db } from "@/lib/firebase"; 
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";

// ログのインターフェース
export interface FirestoreLog {
  id: string;
  alertId: string;
  alertTitle: string;
  alertType: AlertType;
  action: 'created' | 'resolved';
  timestamp: Timestamp;
  location: string;
  description: string;
  severity: AlertSeverity;
}

interface AlertLogPageProps {
  onBack: () => void;
}

export default function AlertLogPage({ onBack }: AlertLogPageProps) {
  const [logs, setLogs] = useState<FirestoreLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 削除確認ダイアログの状態
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);

  // ログデータの取得
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "Logs"), orderBy("timestamp", "desc"), limit(100));
      const querySnapshot = await getDocs(q);
      const fetchedLogs = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
      })) as FirestoreLog[];
      setLogs(fetchedLogs);
    } catch (error) {
      console.error("Error fetching logs:", error);
      toast.error("ログの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // 個別削除処理
  const handleDeleteLog = async () => {
    if (!deletingLogId) return;
    
    try {
      await deleteDoc(doc(db, "Logs", deletingLogId));
      toast.success("ログを削除しました");
      // リストから除外してUI更新
      setLogs(prev => prev.filter(log => log.id !== deletingLogId));
    } catch (error) {
      console.error("Error deleting log:", error);
      toast.error("削除に失敗しました");
    } finally {
      setIsDeleteDialogOpen(false);
      setDeletingLogId(null);
    }
  };

  // 一括削除処理
  const handleClearAllLogs = async () => {
    try {
      // Firestoreの一括削除はバッチ処理で行う（一度に最大500件）
      const batch = writeBatch(db);
      
      // 現在表示されているログを対象にする
      logs.forEach(log => {
        const logRef = doc(db, "Logs", log.id);
        batch.delete(logRef);
      });

      await batch.commit();
      toast.success("全てのログを削除しました");
      setLogs([]); // UIをクリア
    } catch (error) {
      console.error("Error clearing logs:", error);
      toast.error("一括削除に失敗しました");
    } finally {
      setIsClearAllDialogOpen(false);
    }
  };

  // 削除ボタンクリック時のハンドラ
  const openDeleteConfirm = (id: string) => {
    setDeletingLogId(id);
    setIsDeleteDialogOpen(true);
  };

  const formatDate = (timestamp: Timestamp | Date | null) => {
    if (!timestamp) return "-";
    const date = (timestamp instanceof Timestamp) ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  
  const getAlertIcon = (type: AlertType) => {
    switch (type) {
      case 'theft': return <ShieldAlert className="w-5 h-5" />;
      case 'malfunction': return <WrenchIcon className="w-5 h-5" />;
      case 'empty': return <AlertTriangle className="w-5 h-5" />;
      default: return <AlertCircle className="w-5 h-5" />;
    }
  };

  const getBadgeColor = (severity: AlertSeverity) => {
    switch (severity) {
        case 'critical': return 'bg-red-100 text-red-700';
        case 'warning': return 'bg-yellow-100 text-yellow-700';
        default: return 'bg-blue-100 text-blue-700';
    }
  };

  const renderLogCard = (log: FirestoreLog) => (
    <div key={log.id} className="border rounded-lg p-4 bg-white mb-3 hover:shadow-sm transition-shadow relative group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <div className="mt-1 text-gray-500">{getAlertIcon(log.alertType)}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="font-bold text-gray-900">{log.alertTitle}</h4>
              <Badge className={getBadgeColor(log.severity)}>{log.severity}</Badge>
              <Badge variant="outline" className={log.action === 'resolved' ? "bg-green-50 text-green-700 border-green-200" : "bg-orange-50 text-orange-700 border-orange-200"}>
                {log.action === 'resolved' ? '解決済み' : '発生'}
              </Badge>
            </div>
            <p className="text-sm text-gray-600 mb-2">{log.description}</p>
            <div className="flex items-center gap-4 text-sm flex-wrap text-gray-500">
              <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{log.location}</span>
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{formatDate(log.timestamp)}</span>
            </div>
          </div>
        </div>
        
        {/* 個別削除ボタン (ホバー時に目立つようにしても良い) */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-gray-400 hover:text-red-600 hover:bg-red-50 -mt-2 -mr-2"
          onClick={() => openDeleteConfirm(log.id)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin w-8 h-8 text-blue-600"/></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-2" />戻る</Button>
              <h1 className="text-lg font-bold">アラートログ履歴</h1>
            </div>
            {logs.length > 0 && (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => setIsClearAllDialogOpen(true)}
                className="bg-white text-red-600 border border-red-200 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" /> 全て削除
              </Button>
            )}
          </div>
      </header>
      <div className="max-w-7xl mx-auto px-4 py-6">
          <Card>
             <CardContent className="pt-6 bg-gray-50/50 min-h-[500px]">
                {logs.length === 0 ? (
                  <div className="text-center py-20 text-gray-500">
                    <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>ログはありません</p>
                  </div>
                ) : (
                  logs.map(renderLogCard)
                )}
             </CardContent>
          </Card>
      </div>

      {/* 個別削除確認ダイアログ */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-white z-[100]">
          <AlertDialogHeader>
            <AlertDialogTitle>ログを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は元に戻せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLog} className="bg-red-600 hover:bg-red-700 text-white">
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 一括削除確認ダイアログ */}
      <AlertDialog open={isClearAllDialogOpen} onOpenChange={setIsClearAllDialogOpen}>
        <AlertDialogContent className="bg-white z-[100]">
          <AlertDialogHeader>
            <AlertDialogTitle>全てのログを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              表示されている {logs.length} 件のログを全て削除します。<br/>
              この操作は元に戻せません。本当に実行しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAllLogs} className="bg-red-600 hover:bg-red-700 text-white">
              全て削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}