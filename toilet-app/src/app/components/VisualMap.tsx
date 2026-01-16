"use client";

import React from 'react';
import { AreaUI } from '@/types/schema';
import { AlertTriangle, ShieldAlert, WrenchIcon, WifiOff } from 'lucide-react';

interface VisualMapProps {
  areas: AreaUI[];
  imageUrl?: string;
  onAreaClick: (area: AreaUI) => void;
}

export default function VisualMap({ areas, imageUrl, onAreaClick }: VisualMapProps) {
  return (
    <div className="relative w-full aspect-video bg-gray-100 rounded-lg overflow-hidden border shadow-inner">
      {imageUrl ? (
        <img src={imageUrl} alt="Map" className="w-full h-full object-contain pointer-events-none select-none" />
      ) : (
        <div className="flex items-center justify-center w-full h-full text-gray-400">マップ画像未設定</div>
      )}

      {areas.map((area) => {
        const x = area.coordinates?.x ?? 50;
        const y = area.coordinates?.y ?? 50;

        // ★修正箇所: 色分けロジック (20%以下を赤にする)
        const isTheft = area.toilets.some(t => t.status === 'theft');
        const isMalfunction = area.toilets.some(t => t.status === 'malfunction');
        const isOffline = area.toilets.some(t => t.status === 'offline');
        const isEmpty = area.toilets.some(t => t.status === 'empty');
        
        const isCriticalLow = area.percentage <= 20; // 20%以下
        const isWarningLow = area.percentage <= 50;  // 50%以下

        let bgColor = "bg-green-500 hover:bg-green-600";
        let Icon = null;

        if (isTheft) {
            bgColor = "bg-purple-600 hover:bg-purple-700 animate-pulse";
            Icon = ShieldAlert;
        } else if (isOffline) {
            bgColor = "bg-gray-500 hover:bg-gray-600";
            Icon = WifiOff;
        } else if (isMalfunction) {
            bgColor = "bg-orange-500 hover:bg-orange-600";
            Icon = WrenchIcon;
        } else if (isEmpty || isCriticalLow) {
            // ★20%以下または空なら赤
            bgColor = "bg-red-500 hover:bg-red-600 animate-pulse";
            Icon = AlertTriangle;
        } else if (isWarningLow) {
            // ★21~50%なら黄色
            bgColor = "bg-yellow-400 hover:bg-yellow-500";
        }

        return (
          <div
            key={area.id}
            onClick={() => onAreaClick(area)}
            className={`absolute flex flex-col items-center justify-center rounded shadow-md text-white cursor-pointer transition-transform hover:scale-110 ${bgColor}`}
            style={{
              left: `${x}%`, top: `${y}%`,
              width: '12%', minWidth: '100px', aspectRatio: '16/9',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span className="font-bold text-xs truncate w-full text-center px-1 drop-shadow-md">{area.name}</span>
            <span className="text-xl sm:text-2xl font-black drop-shadow-md">{area.percentage}%</span>
            {Icon && (
              <div className="absolute -top-2 -right-2 bg-white text-red-600 rounded-full p-0.5 shadow-sm">
                <Icon size={16} className={isTheft ? "text-purple-600" : isOffline ? "text-gray-600" : "text-red-600"} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}