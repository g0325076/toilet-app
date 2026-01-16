import { Check, X, AlertTriangle, ShieldAlert, WrenchIcon, Package, WifiOff } from 'lucide-react';
import { Badge } from './ui/badge';
import { AreaUI, AlertUI } from '@/types/schema';

interface DetailMapProps {
  area: AreaUI;
  alerts: AlertUI[];
}

const STATUS_CONFIG = {
  theft: { 
    icon: <ShieldAlert className="w-5 h-5 text-purple-600" />, 
    bg: 'bg-purple-50 border-purple-500', 
    text: 'bg-purple-100 text-purple-900', 
    label: '盗難疑い' 
  },
  malfunction: { 
    icon: <WrenchIcon className="w-5 h-5 text-orange-600" />, 
    bg: 'bg-orange-50 border-orange-500', 
    text: 'bg-orange-100 text-orange-700', 
    label: '故障・点検' 
  },
  offline: { 
    icon: <WifiOff className="w-5 h-5 text-gray-500" />, 
    bg: 'bg-gray-100 border-gray-400', 
    text: 'bg-gray-200 text-gray-700', 
    label: '通信断' 
  },
  empty: { 
    icon: <X className="w-5 h-5 text-red-600" />, 
    bg: 'bg-red-50 border-red-500', 
    text: 'bg-red-100 text-red-700', 
    label: '紙切れ' 
  },
  lowStockAlert: { 
    icon: <AlertTriangle className="w-5 h-5 text-red-600" />, 
    bg: 'bg-red-50 border-red-500',
    text: 'bg-red-100 text-red-700', 
    label: '予備なし' 
  },
  reserveHigh: {
    icon: <Check className="w-5 h-5 text-green-600" />, 
    bg: 'bg-green-50 border-green-300', 
    text: 'bg-green-100 text-green-700', 
    label: '予備充分' 
  },
  reserveMid: {
    icon: <Package className="w-5 h-5 text-yellow-600" />, 
    bg: 'bg-yellow-50 border-yellow-300', 
    text: 'bg-yellow-100 text-yellow-700', 
    label: '予備残り1' 
  },
  reserveLow: {
    icon: <AlertTriangle className="w-5 h-5 text-red-600" />, 
    bg: 'bg-red-50 border-red-300', 
    text: 'bg-red-100 text-red-700', 
    label: '予備なし' 
  },
};

export default function DetailMap({ area, alerts }: DetailMapProps) {
  
  const getToiletAlert = (toiletId: string) => {
    return alerts.find(a => a.toiletId === toiletId && !a.isResolved);
  };

  const getStatusKey = (reserveCount: number, alert?: AlertUI, isOnline?: boolean): keyof typeof STATUS_CONFIG => {
    if (alert) {
      if (alert.type === 'theft') return 'theft';
      if (alert.type === 'malfunction') return 'malfunction';
      if (alert.type === 'offline') return 'offline';
      if (alert.type === 'empty') return 'empty';
      if (alert.type === 'low-stock') return 'lowStockAlert';
    }
    if (isOnline === false) return 'offline';
    if (reserveCount >= 2) return 'reserveHigh';
    if (reserveCount === 1) return 'reserveMid';
    return 'reserveLow';
  };

  const getStatusDisplay = (toilet: AreaUI['toilets'][0], alert?: AlertUI) => {
    const key = getStatusKey(toilet.reserveCount ?? 0, alert, toilet.isOnline);
    const config = STATUS_CONFIG[key];
    if ((key === 'malfunction' || key === 'offline') && alert?.title) {
      return { ...config, label: alert.title };
    }
    return config;
  };

  return (
    <div>
      {/* エリア全体のサマリー */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 font-medium">エリア在庫充足率 (予備)</p>
            <p className="text-2xl font-bold">{area.percentage}%</p>
          </div>
          {/* ★修正: 閾値を変更 (20%以下で赤) */}
          <Badge className={
            area.percentage > 50 ? 'bg-green-100 text-green-700 border-green-200' :
            area.percentage > 20 ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
            'bg-red-100 text-red-700 border-red-200'
          }>
            {area.toilets.filter(t => (t.reserveCount ?? 0) > 0).length}/{area.toilets.length} 個室予備あり
          </Badge>
        </div>
      </div>

      {/* 個室マップ */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {area.toilets.map((toilet) => {
          const activeAlert = getToiletAlert(toilet.id);
          const reserveCount = toilet.reserveCount ?? 0;
          const status = getStatusDisplay(toilet, activeAlert);
          
          return (
            <div
              key={toilet.id}
              className={`border-2 rounded-lg p-3 transition-all relative ${status.bg} flex flex-col gap-2 shadow-sm`}
            >
              {activeAlert && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 z-10">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    activeAlert.type === 'theft' ? 'bg-purple-400' : 'bg-red-400'
                  }`}></span>
                  <span className={`relative inline-flex rounded-full h-4 w-4 ${
                    activeAlert.type === 'theft' ? 'bg-purple-500' : 'bg-red-500'
                  }`}></span>
                </span>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm font-bold truncate mr-2 text-gray-800">{toilet.name}</span>
                {status.icon}
              </div>
              
              <div className={`text-center py-1 rounded ${status.text}`}>
                <div className="text-xs font-bold">{status.label}</div>
              </div>

              <div className="space-y-1 pt-2 mt-1 border-t border-gray-200/60">
                <div className="flex items-center justify-between text-xs">
                  <div className={`flex items-center gap-1 ${reserveCount > 0 ? 'text-gray-500' : 'text-red-600 font-medium'}`}>
                    <Package className="w-3.5 h-3.5" />
                    <span>予備在庫</span>
                  </div>
                  <span className={`font-mono font-bold text-sm ${
                    reserveCount >= 2 ? 'text-green-700' : 
                    reserveCount === 1 ? 'text-yellow-700' : 'text-red-700'
                  }`}>
                    {reserveCount} <span className="text-[10px] font-normal text-gray-500">個</span>
                  </span>
                </div>

                {toilet.lastCheckedStr && (
                  <div className="text-[10px] text-gray-400 text-right">
                    {toilet.lastCheckedStr}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
        <p className="text-xs text-gray-500 mb-2 font-medium">ステータス凡例:</p>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Check className="w-4 h-4 text-green-600" /> 予備充分
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Package className="w-4 h-4 text-yellow-600" /> 予備残り1
          </span>
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-red-600" /> 予備なし
          </span>
          <span className="inline-flex items-center gap-1.5 border-l pl-6 border-gray-200">
            <X className="w-4 h-4 text-red-600" /> 紙切れ
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-purple-600" /> 盗難疑い
          </span>
          <span className="inline-flex items-center gap-1.5">
            <WrenchIcon className="w-4 h-4 text-orange-600" /> 障害検知
          </span>
          <span className="inline-flex items-center gap-1.5">
            <WifiOff className="w-4 h-4 text-gray-500" /> 通信断
          </span>
        </div>
      </div>
    </div>
  );
}