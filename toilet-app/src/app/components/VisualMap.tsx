import React from 'react';
import { FirestoreToilet } from '@/types/schema';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip";

interface VisualMapProps {
  floorId: string;
  toilets: FirestoreToilet[];
  imageUrl?: string; // フロア図の画像URL
}

export default function VisualMap({ floorId, toilets, imageUrl }: VisualMapProps) {
  
  // ステータスに応じた色クラスを返す
  const getStatusColor = (toilet: FirestoreToilet) => {
    if (toilet.status === 'offline') return "bg-gray-400 border-gray-500";
    if (toilet.status === 'theft') return "bg-red-600 border-red-800 animate-pulse";
    if (toilet.status === 'empty') return "bg-red-500 border-red-700";
    
    // 正常時：予備数で色分け
    if (toilet.reserveCount >= 2) return "bg-green-500 border-green-700";
    if (toilet.reserveCount === 1) return "bg-yellow-400 border-yellow-600";
    return "bg-yellow-500 border-yellow-700";
  };

  return (
    <div className="w-full space-y-4">
      <div className="bg-white p-4 rounded-lg shadow-md">
        <h3 className="text-lg font-bold mb-2">マップ表示: {floorId}</h3>
        
        <div className="relative w-full h-[600px] border rounded-lg bg-slate-50 overflow-hidden shadow-inner">
          {/* --- フロア図 (背景) --- */}
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt="Floor Map" 
              className="w-full h-full object-contain pointer-events-none select-none"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100">
              <div className="text-center">
                <p className="text-lg font-bold">マップ画像未設定</p>
                <p className="text-sm">({floorId})</p>
              </div>
            </div>
          )}

          {/* --- トイレのピン配置 --- */}
          {toilets.map((toilet) => {
            // 座標がない場合は表示しない（または左上に仮表示）
            if (typeof toilet.x === 'undefined' || typeof toilet.y === 'undefined') return null;

            return (
              <TooltipProvider key={toilet.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`absolute w-8 h-8 rounded-full border-2 shadow-md flex items-center justify-center cursor-pointer transition-transform hover:scale-110 z-10 ${getStatusColor(toilet)}`}
                      style={{
                        left: `${toilet.x}%`,
                        top: `${toilet.y}%`,
                        transform: 'translate(-50%, -50%)', // 中心合わせ
                      }}
                    >
                      <span className="text-xs font-bold text-white drop-shadow-md">
                        {toilet.status === 'offline' ? '?' : toilet.reserveCount}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm font-sans">
                      <p className="font-bold">{toilet.name}</p>
                      <p>状態: {toilet.status === 'normal' ? '正常' : 
                               toilet.status === 'empty' ? '紙切れ' :
                               toilet.status === 'theft' ? '盗難検知' : 'オフライン'}</p>
                      <p>予備: {toilet.reserveCount}個</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
        
        <div className="mt-4 flex gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500"></span> 正常(予備多)</div>
            <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400"></span> 予備少</div>
            <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500"></span> 紙切れ</div>
        </div>
      </div>
    </div>
  );
}