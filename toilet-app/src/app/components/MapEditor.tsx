"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Upload, Save, X } from 'lucide-react';

interface EditableArea {
  id: string;
  name: string;
  coordinates?: { x: number; y: number };
}

interface MapEditorProps {
  imageUrl?: string;
  areas: EditableArea[];
  onSave: (img: string, areas: EditableArea[]) => void;
  onCancel: () => void;
}

export default function MapEditor({ imageUrl: initialImg, areas: initialAreas, onSave, onCancel }: MapEditorProps) {
  const [img, setImg] = useState(initialImg || "");
  const [areas, setAreas] = useState<EditableArea[]>(JSON.parse(JSON.stringify(initialAreas)));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // ★追加: 親コンポーネントから渡されるエリアデータが変わったら(フロア切替など)、内部状態も更新する
  useEffect(() => {
    setAreas(JSON.parse(JSON.stringify(initialAreas)));
  }, [initialAreas]);

  // ★追加: 画像が変わった場合も更新
  useEffect(() => {
    setImg(initialImg || "");
  }, [initialImg]);

  // 画像アップロード処理
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setImg(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // ドラッグ処理 (マウス移動時)
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingId || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // 0~100% の範囲に制限
    const clampedX = Math.max(0, Math.min(100, x));
    const clampedY = Math.max(0, Math.min(100, y));

    setAreas(prev => prev.map(a => 
      a.id === draggingId ? { ...a, coordinates: { x: clampedX, y: clampedY } } : a
    ));
  };

  return (
    <div className="space-y-4 border p-4 rounded-lg bg-white" onMouseUp={() => setDraggingId(null)} onMouseLeave={() => setDraggingId(null)}>
      
      <div className="flex justify-between items-center mb-2">
        <div>
          <h3 className="font-bold text-lg">マップ配置モード</h3>
          <p className="text-sm text-gray-500">エリアをドラッグして位置を調整し、保存してください。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} className="gap-2">
            <X size={16}/> キャンセル
          </Button>
          <Button onClick={() => onSave(img, areas)} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Save size={16}/> 保存して終了
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-gray-50 p-3 rounded border">
        <label className="cursor-pointer inline-flex items-center gap-2 bg-white border border-gray-300 px-4 py-2 rounded shadow-sm hover:bg-gray-100 transition">
          <Upload size={16} className="text-gray-600" />
          <span className="text-sm font-medium text-gray-700">背景画像を変更...</span>
          <input type="file" hidden accept="image/*" onChange={handleFileChange} />
        </label>
        {!img && <span className="text-xs text-red-500 font-bold">※ 画像が未設定です</span>}
      </div>

      {/* 編集エリア (ドラッグ可能領域) */}
      <div 
        ref={containerRef}
        className="relative w-full aspect-video bg-gray-100 border-2 border-dashed border-gray-300 rounded overflow-hidden select-none"
        onMouseMove={handleMouseMove}
      >
        {img ? (
          <img src={img} className="w-full h-full object-contain opacity-60 pointer-events-none" alt="Background" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 pointer-events-none">
            画像をアップロードしてください
          </div>
        )}

        {areas.map(area => {
          // 初期位置がない場合は中央(50%)に
          const x = area.coordinates?.x ?? 50;
          const y = area.coordinates?.y ?? 50;

          return (
            <div
              key={area.id}
              onMouseDown={(e) => { e.preventDefault(); setDraggingId(area.id); }}
              className={`absolute flex items-center justify-center p-2 rounded cursor-move text-xs font-bold shadow-lg transition-all
                ${draggingId === area.id ? 'bg-blue-600 scale-110 z-50 ring-2 ring-yellow-400' : 'bg-blue-500 hover:bg-blue-600 z-10'}
                text-white
              `}
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: '100px',
                height: '60px',
                transform: 'translate(-50%, -50%)',
              }}
            >
              {area.name}
            </div>
          );
        })}
      </div>
    </div>
  );
}