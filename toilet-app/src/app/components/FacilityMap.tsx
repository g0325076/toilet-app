import { Badge } from './ui/badge';
import { FloorUI, AlertUI } from '@/types/schema'; // AlertUIを追加
import { ShieldAlert, WrenchIcon, AlertTriangle, CheckCircle2 } from 'lucide-react'; // アイコン追加

interface FacilityMapProps {
  floor: FloorUI;
  onAreaClick: (areaId: string) => void;
  alerts: AlertUI[]; // 【追加】アラート情報を受け取る
}

export default function FacilityMap({ floor, onAreaClick, alerts }: FacilityMapProps) {
  
  // エリアの状態を判定する関数
  const getAreaStatus = (areaId: string, toiletIds: string[], percentage: number) => {
    // このエリアに関連する未解決アラートを抽出
    const areaAlerts = alerts.filter(a => toiletIds.includes(a.toiletId) && !a.isResolved);
    
    // 優先度順にステータスを決定
    const hasTheft = areaAlerts.some(a => a.type === 'theft');
    const hasMalfunction = areaAlerts.some(a => a.type === 'malfunction');
    const hasEmpty = areaAlerts.some(a => a.type === 'empty');
    const hasLowStock = areaAlerts.some(a => a.type === 'low-stock');

    if (hasTheft) {
      return { 
        color: 'bg-red-100 border-red-500 text-red-700', 
        icon: <ShieldAlert className="w-6 h-6 mb-1 text-red-600" />,
        message: '盗難の疑い'
      };
    }
    if (hasMalfunction) {
      return { 
        color: 'bg-orange-100 border-orange-500 text-orange-800', 
        icon: <WrenchIcon className="w-6 h-6 mb-1 text-orange-600" />,
        message: '障害検知'
      };
    }
    if (hasEmpty) {
      return { 
        color: 'bg-red-50 border-red-400 text-red-800', 
        icon: <AlertTriangle className="w-6 h-6 mb-1 text-red-600" />,
        message: '紙切れ'
      };
    }
    
    // 通常の残量判定
    if (percentage >= 70) return { color: 'bg-green-50 border-green-300 hover:bg-green-100 text-green-700', icon: null, message: '正常' };
    if (percentage >= 30) return { color: 'bg-yellow-50 border-yellow-300 hover:bg-yellow-100 text-yellow-700', icon: null, message: '注意' };
    return { color: 'bg-red-50 border-red-300 hover:bg-red-100 text-red-700', icon: null, message: '不足' };
  };

  return (
    <div className="relative bg-white border-2 border-gray-200 rounded-lg p-8 min-h-[500px]">
      {/* フロア平面図のシミュレーション */}
      <div className="grid grid-cols-2 gap-8 h-full">
        {floor.areas.map((area, index) => {
          // トイレIDのリストを作成（データ構造によっては area.toiletIds が無い場合もあるため抽出）
          const toiletIds = area.toilets.map(t => t.id);
          const status = getAreaStatus(area.id, toiletIds, area.percentage);

          return (
            <button
              key={area.id}
              onClick={() => onAreaClick(area.id)}
              className={`relative border-2 rounded-lg p-6 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[200px] ${status.color} shadow-sm hover:shadow-md`}
              style={{
                gridColumn: index === 0 || index === 2 ? '1' : '2',
              }}
            >
              {/* アラートアイコンがあれば表示 */}
              {status.icon && (
                <div className="absolute top-3 right-3 animate-pulse">
                  {status.icon}
                </div>
              )}

              <div className="text-center">
                <h3 className="mb-2 font-bold text-lg">{area.name}</h3>
                
                <div className="text-4xl mb-2 font-extrabold">
                  {area.percentage}%
                </div>
                
                {/* ステータスメッセージ */}
                <div className="font-bold text-sm mb-2">{status.message}</div>

                <p className="text-xs opacity-80">
                  個室数: {area.toilets.length}
                </p>
                <p className="text-xs opacity-80">
                  補充必要: {area.toilets.filter(t => (t.reserveCount ?? 0) === 0).length}
                </p>
              </div>
              
              <div className="absolute bottom-2 right-2">
                <Badge variant="outline" className="text-xs bg-white/50 backdrop-blur-sm">
                  クリックで詳細
                </Badge>
              </div>
            </button>
          );
        })}
      </div>

      {/* 凡例 */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur border rounded-lg p-3 shadow-sm z-10">
        <p className="text-xs text-gray-500 mb-2">ステータス:</p>
        <div className="flex flex-col gap-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
            <span>盗難・紙切れ</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-500"></span>
            <span>障害・故障</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span>正常 (70%~)</span>
          </div>
        </div>
      </div>
    </div>
  );
}