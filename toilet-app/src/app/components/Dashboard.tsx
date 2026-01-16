"use client";

import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import DetailMap from './DetailMap';
import AlertPanel from './AlertPanel';
import VisualMap from './VisualMap';
import { 
  LogOut, Building2, AlertTriangle, Bell, Settings, FileText, 
  Loader2, PlusCircle, ShieldAlert, WrenchIcon, LayoutGrid, 
  Map as MapIcon, CheckCircle2, WifiOff, ArrowLeft // ★ArrowLeftを追加
} from 'lucide-react';
import { useFacilityData } from '@/hooks/useFirebaseData';
import { AreaUI } from '@/types/schema';

// デザイン定義
const STATUS_STYLES = {
  normal: { 
    bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-800', 
    iconColor: 'text-green-600', label: '正常' 
  },
  warning: { 
    bg: 'bg-yellow-50', border: 'border-yellow-400', text: 'text-yellow-800', 
    iconColor: 'text-yellow-600', label: '注意' 
  },
  critical: { 
    bg: 'bg-red-50', border: 'border-red-400', text: 'text-red-800', 
    iconColor: 'text-red-600', label: '不足' 
  },
  theft: { 
    bg: 'bg-purple-50', border: 'border-purple-500', text: 'text-purple-900', 
    iconColor: 'text-purple-700', label: '盗難検知' 
  },
  malfunction: { 
    bg: 'bg-orange-50', border: 'border-orange-400', text: 'text-orange-800', 
    iconColor: 'text-orange-600', label: '障害検知' 
  },
  offline: { 
    bg: 'bg-gray-100', border: 'border-gray-500', text: 'text-gray-700', 
    iconColor: 'text-gray-500', label: '通信断' 
  },
};

interface DashboardProps {
  onLogout: () => void;
  onOpenSettings: () => void;
  onOpenLogs: () => void;
}

export default function Dashboard({ onLogout, onOpenSettings, onOpenLogs }: DashboardProps) {
  const { data, loading } = useFacilityData();
  const { floors, alerts } = data;

  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const activeFloorId = selectedFloor || (floors.length > 0 ? floors[0].id : '');

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
        <span className="text-gray-600 font-medium">データを読み込み中...</span>
      </div>
    );
  }

  const currentFloorData = floors.find(f => f.id === activeFloorId);
  
  let selectedAreaData: AreaUI | undefined;
  if (selectedAreaId && currentFloorData) {
    selectedAreaData = currentFloorData.areas.find(a => a.id === selectedAreaId);
  }

  // 統計情報の計算
  const totalToilets = currentFloorData?.areas.reduce((sum, area) => sum + area.toilets.length, 0) || 0;
  
  const lowStockToilets = currentFloorData?.areas.reduce((sum, area) => 
    sum + (area.toilets || []).filter(t => (t.reserveCount ?? 0) === 0).length, 0
  ) || 0;
  
  const areasCount = currentFloorData?.areas.length || 0;
  const averageStock = areasCount > 0 
    ? Math.round((currentFloorData?.areas.reduce((sum, area) => sum + (area.percentage || 0), 0) || 0) / areasCount)
    : 0;
  
  const activeAlerts = alerts.filter(a => !a.isResolved);
  const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">トイレットペーパー残量管理</h1>
              <p className="text-xs text-gray-500">施設管理ダッシュボード</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            {activeAlerts.length > 0 && (
              <Badge variant="outline" className="bg-red-50 border-red-300 text-red-700 px-3 py-1">
                <Bell className="w-4 h-4 mr-1" />
                {activeAlerts.length}件のアラート
                {criticalAlerts.length > 0 && ` (緊急${criticalAlerts.length})`}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={onOpenSettings} className="bg-white">
              <Settings className="w-4 h-4 mr-2" />
              設定
            </Button>
            <Button variant="outline" size="sm" onClick={onOpenLogs} className="bg-white">
              <FileText className="w-4 h-4 mr-2" />
              ログ
            </Button>
            <Button variant="outline" size="sm" onClick={onLogout} className="bg-white text-gray-600">
              <LogOut className="w-4 h-4 mr-2" />
              ログアウト
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {floors.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
            <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <PlusCircle className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">データがありません</h3>
            <Button onClick={onOpenSettings} className="mt-4"><Settings className="mr-2"/>設定画面へ</Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>総個室数 ({currentFloorData?.name || '全フロア'})</CardDescription>
                  <CardTitle className="text-3xl font-bold">{totalToilets}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>平均残量 (予備)</CardDescription>
                  <CardTitle className="text-3xl font-bold">{averageStock}%</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    予備なし (補充必要)
                  </CardDescription>
                  <CardTitle className={`text-3xl font-bold ${lowStockToilets > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {lowStockToilets}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <AlertPanel alertsData={alerts} />

            <Tabs value={activeFloorId} onValueChange={(value: string) => {
              setSelectedFloor(value);
              setSelectedAreaId(null);
            }}>
              <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
                <TabsList>
                  {floors.map(floor => (
                    <TabsTrigger key={floor.id} value={floor.id}>{floor.name}</TabsTrigger>
                  ))}
                </TabsList>

                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md">
                  <Button variant="ghost" size="sm" onClick={() => setViewMode('list')} className={viewMode === 'list' ? "bg-white shadow-sm" : ""}>
                    <LayoutGrid size={16} className="mr-2"/> パネル
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setViewMode('map')} className={viewMode === 'map' ? "bg-white shadow-sm" : ""}>
                    <MapIcon size={16} className="mr-2"/> マップ
                  </Button>
                </div>
              </div>

              {floors.map(floor => (
                <TabsContent key={floor.id} value={floor.id} className="space-y-4 animate-in fade-in-50">
                  {selectedAreaData ? (
                    <Card>
                      <CardHeader className="border-b bg-gray-50/50 flex flex-row justify-between">
                        <div>
                          <CardTitle>{selectedAreaData.name} 詳細</CardTitle>
                          <CardDescription>個室ごとの状況</CardDescription>
                        </div>
                        {/* ★ボタン修正: ログ画面と同じデザインに */}
                        <Button variant="outline" onClick={() => setSelectedAreaId(null)} className="bg-white">
                          <ArrowLeft className="w-4 h-4 mr-2" />
                          戻る
                        </Button>
                      </CardHeader>
                      <CardContent className="p-6">
                        <DetailMap area={selectedAreaData} alerts={activeAlerts} />
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      {viewMode === 'map' && (
                         <div className="animate-in fade-in zoom-in-95">
                           <Card>
                             <CardHeader className="border-b bg-gray-50/50">
                               <CardTitle>{floor.name} マップ配置</CardTitle>
                             </CardHeader>
                             <CardContent className="p-6">
                               <VisualMap 
                                 areas={floor.areas}
                                 imageUrl={floor.mapImageUri}
                                 onAreaClick={(area) => setSelectedAreaId(area.id)}
                               />
                             </CardContent>
                           </Card>
                         </div>
                      )}

                      {viewMode === 'list' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in">
                          {floor.areas.map(area => {
                            const isEmpty = area.toilets.some(t => t.status === 'empty');
                            const isOffline = area.toilets.some(t => t.status === 'offline');
                            
                            const isCriticalLow = area.percentage <= 20;
                            const isWarningLow = area.percentage <= 50;

                            let style = STATUS_STYLES.normal;
                            let Icon = CheckCircle2;

                            if (area.toilets.some(t => t.status === 'theft')) {
                                style = STATUS_STYLES.theft; Icon = ShieldAlert; 
                            } else if (isOffline) {
                                style = STATUS_STYLES.offline; Icon = WifiOff;
                            } else if (area.toilets.some(t => t.status === 'malfunction')) {
                                style = STATUS_STYLES.malfunction; Icon = WrenchIcon;
                            } else if (isEmpty || area.percentage === 0 || isCriticalLow) {
                                style = STATUS_STYLES.critical; Icon = AlertTriangle;
                            } else if (isWarningLow) {
                                style = STATUS_STYLES.warning; Icon = AlertTriangle;
                            }

                            return (
                              <div 
                                key={area.id} 
                                onClick={() => setSelectedAreaId(area.id)}
                                className={`relative rounded-xl border-2 p-6 flex flex-col items-center justify-center text-center gap-2 transition-all hover:shadow-lg cursor-pointer ${style.bg} ${style.border} ${style.text}`}
                              >
                                <div className="absolute top-4 right-4 opacity-50">
                                  <Icon className={`w-6 h-6 ${style.iconColor}`} />
                                </div>
                                <h3 className="text-xl font-bold mb-1">{area.name}</h3>
                                <div className={`text-5xl font-bold tracking-tighter my-2 ${style.iconColor}`}>
                                  {area.percentage}%
                                </div>
                                <div className="font-bold text-sm bg-white/60 px-3 py-1 rounded-full">
                                  {style.label}
                                </div>
                                <div className="mt-4 text-xs opacity-80 w-full max-w-[200px] flex justify-between px-4">
                                  <span>個室: {area.toilets.length}</span>
                                  <span className={(isEmpty || isCriticalLow) ? 'text-red-600 font-bold' : ''}>
                                    補充: {area.toilets.filter(t => (t.reserveCount || 0) < 1).length}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}