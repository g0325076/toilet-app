"use client";

import { useState} from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import FacilityMap from './FacilityMap';
import DetailMap from './DetailMap';
import AlertPanel from './AlertPanel';
import { LogOut, Building2, AlertTriangle, Bell, Settings, FileText, Loader2, PlusCircle, ShieldAlert, WrenchIcon } from 'lucide-react';
import { useFacilityData } from '@/hooks/useFirebaseData';

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
interface DashboardProps {
  onLogout: () => void;
  onOpenSettings: () => void;
  onOpenLogs: () => void;
}

export default function Dashboard({ onLogout, onOpenSettings, onOpenLogs }: DashboardProps) {
  // DBからデータを取得
  const { data, loading } = useFacilityData();
  const { floors, alerts } = data;

  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<string>('');

  // アクティブなフロアIDを決定
  const activeFloorId = selectedFloor || (floors.length > 0 ? floors[0].id : '');

  // ローディング中の表示
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
        <span className="text-gray-600 font-medium">データを読み込み中...</span>
      </div>
    );
  }

  // データ取得用のヘルパー変数
  const currentFloorData = floors.find(f => f.id === activeFloorId);
  const selectedAreaData = selectedArea 
    ? currentFloorData?.areas.find(a => a.id === selectedArea)
    : null;

  // 統計情報の計算
  const totalToilets = currentFloorData?.areas.reduce((sum, area) => sum + area.toilets.length, 0) || 0;
  
  const lowStockToilets = currentFloorData?.areas.reduce((sum, area) => 
    sum + (area.toilets || []).filter(t => (t.reserveCount ?? 0) === 0).length, 0
  ) || 0;
  
  const areasCount = currentFloorData?.areas.length || 0;
  const averageStock = areasCount > 0 
    ? Math.round((currentFloorData?.areas.reduce((sum, area) => sum + (area.percentage || 0), 0) || 0) / areasCount)
    : 0;
  
  // アラート統計
  const activeAlerts = alerts.filter(a => !a.isResolved);
  const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');

  // エリアの緊急度判定
  const getAreaAlertStyle = (toiletIds: string[]) => {
    const areaAlerts = activeAlerts.filter(a => toiletIds.includes(a.toiletId));
    
    if (areaAlerts.some(a => a.type === 'theft')) {
      return { bg: 'bg-red-50 border-red-500', text: 'text-red-900', icon: <ShieldAlert className="w-5 h-5 text-red-600" /> };
    }
    if (areaAlerts.some(a => a.type === 'malfunction')) {
      return { bg: 'bg-orange-50 border-orange-500', text: 'text-orange-900', icon: <WrenchIcon className="w-5 h-5 text-orange-600" /> };
    }
    if (areaAlerts.some(a => a.type === 'empty')) {
      return { bg: 'bg-red-50 border-red-300', text: 'text-red-800', icon: <AlertTriangle className="w-5 h-5 text-red-500" /> };
    }
    return null; 
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
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
        {/* データが1件もない場合の表示 */}
        {floors.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
            <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <PlusCircle className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">データがありません</h3>
            <p className="text-gray-500 mb-6">まだフロアやトイレが登録されていません。<br/>設定画面から最初のデータを追加してください。</p>
            <Button onClick={onOpenSettings}>
              <Settings className="w-4 h-4 mr-2" />
              設定画面へ移動
            </Button>
          </div>
        ) : (
          <>
            {/* 統計カード */}
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

            {/* アラートパネル */}
            <AlertPanel alertsData={alerts} />

            {/* フロア選択タブ */}
            <Tabs value={activeFloorId} onValueChange={(value: string) => {
              setSelectedFloor(value);
              setSelectedArea(null);
            }}>
              <div className="flex items-center justify-between mb-4">
                <TabsList>
                  {floors.map(floor => (
                    <TabsTrigger key={floor.id} value={floor.id}>
                      {floor.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {floors.map(floor => (
                <TabsContent key={floor.id} value={floor.id} className="space-y-4 animate-in fade-in-50 duration-300">
                  {selectedArea ? (
                    // 詳細ビュー
                    <Card>
                      <CardHeader className="border-b bg-gray-50/50">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2">
                              {selectedAreaData?.name}
                              <Badge variant="outline" className="font-normal text-xs">詳細モード</Badge>
                            </CardTitle>
                            <CardDescription>個室ごとのトイレットペーパー残量状況</CardDescription>
                          </div>
                          <Button variant="outline" onClick={() => setSelectedArea(null)} className="bg-white">
                            戻る
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="p-6">
                        {selectedAreaData && (
                          <DetailMap 
                            area={selectedAreaData} 
                            alerts={activeAlerts} 
                          />
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    // フロアマップビュー
                    <Card>
                      <CardHeader className="border-b bg-gray-50/50">
                        <CardTitle>{floor.name} フロアマップ</CardTitle>
                        <CardDescription>
                          エリアを選択すると詳細が表示されます
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-6">
                        <FacilityMap 
                          floor={floor} 
                          onAreaClick={(areaId) => setSelectedArea(areaId)}
                          alerts={activeAlerts} 
                        />
                      </CardContent>
                    </Card>
                  )}

                  {/* エリア一覧 */}
                  {!selectedArea && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {floor.areas.map(area => {
                        const stockLevel = area.percentage >= 70 ? 'high' : area.percentage >= 30 ? 'medium' : 'low';
                        let stockColor = stockLevel === 'high' ? 'bg-green-100 text-green-800 border-green-200' : 
                                          stockLevel === 'medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 
                                          'bg-red-100 text-red-800 border-red-200';
                        
                        const toiletIds = area.toilets.map(t => t.id);
                        const alertStyle = getAreaAlertStyle(toiletIds);
                        let alertIcon = null;

                        if (alertStyle) {
                          stockColor = `${alertStyle.bg} ${alertStyle.text}`; 
                          alertIcon = alertStyle.icon;
                        }
                        
                        return (
                          <button
                            key={area.id}
                            onClick={() => setSelectedArea(area.id)}
                            className={`text-left p-4 border rounded-lg hover:shadow-md transition-all group ${stockColor} border-2`}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <span className="font-bold text-lg flex items-center gap-2">
                                {area.name}
                                {alertIcon}
                              </span>
                              <Badge variant="outline" className="bg-white/50 border-0 shadow-sm">
                                残量 {area.percentage}%
                              </Badge>
                            </div>
                            <div className="flex justify-between text-xs opacity-80 font-medium">
                              <span>個室数: {area.toilets.length}</span>
                              <span className={area.toilets.filter(t => (t.reserveCount ?? 0) === 0).length > 0 ? "text-red-700 font-bold" : ""}>
                                補充必要: {area.toilets.filter(t => (t.reserveCount ?? 0) === 0).length}
                              </span>
                            </div>
                            <div className="mt-3 w-full bg-black/10 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${stockLevel === 'high' ? 'bg-green-600' : stockLevel === 'medium' ? 'bg-yellow-500' : 'bg-red-500'}`} 
                                style={{ width: `${area.percentage}%` }}
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
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