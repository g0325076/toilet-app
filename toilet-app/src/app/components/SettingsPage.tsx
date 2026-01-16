"use client";

import { useState } from 'react'; 
import { db } from "@/lib/firebase";
import { doc, setDoc, updateDoc, getDoc, Timestamp, arrayUnion, deleteField } from "firebase/firestore";
import { ToiletUI, FirestoreToilet, FirestoreFloor, FirestoreArea } from "@/types/schema";
import { toast } from 'sonner';
import { useFacilityData } from '@/hooks/useFirebaseData';
import MapEditor from './MapEditor';

// UIコンポーネント
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { ArrowLeft, Plus, Trash2, Edit2, Map, MapPin, PlugZap, Building2, BellRing } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import NotificationSettings from './NotificationSettings';

interface SettingsPageProps {
  onBack: () => void;
}

const generateId = (prefix: string) => `${prefix}-${Date.now().toString().slice(-4)}`;

type GenderType = 'male' | 'female' | 'accessible';

export default function SettingsPage({ onBack }: SettingsPageProps) {
  const { data, loading } = useFacilityData();
  const floors = data.floors;
  const unconfiguredToilets = data.unconfiguredToilets;

  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const activeFloorId = selectedFloorId || (floors.length > 0 ? floors[0].id : '');

  const [isToiletDialogOpen, setIsToiletDialogOpen] = useState(false);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [isFloorDialogOpen, setIsFloorDialogOpen] = useState(false);
  const [isAreaDialogOpen, setIsAreaDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const [isMapEditorOpen, setIsMapEditorOpen] = useState(false);

  const [editingToilet, setEditingToilet] = useState<ToiletUI | null>(null);
  
  const [toiletFormData, setToiletFormData] = useState({
    id: '', name: '', floorId: '', areaId: '', hasPaper: true, gender: 'male' as GenderType,
  });
  const [floorFormData, setFloorFormData] = useState({ id: '', name: '' });
  const [areaFormData, setAreaFormData] = useState({ id: '', name: '' });

  // --- マップ保存処理 ---
  const handleSaveMapConfiguration = async (imageUrl: string, updatedAreas: { id: string; coordinates?: { x: number; y: number } }[]) => {
    if (!activeFloorId) return;

    try {
      const floorRef = doc(db, "Floors", activeFloorId);
      
      // 1. 画像URLの更新
      await updateDoc(floorRef, { mapImageUri: imageUrl });

      // 2. エリア座標の更新
      const floorSnap = await getDoc(floorRef);
      if(floorSnap.exists()){
          const currentData = floorSnap.data() as FirestoreFloor;
          const newAreas = currentData.areas.map(original => {
              const updated = updatedAreas.find(u => u.id === original.id);
              if(updated && updated.coordinates){
                  return { ...original, coordinates: updated.coordinates };
              }
              return original;
          });

          await updateDoc(floorRef, { areas: newAreas });
      }

      toast.success("マップ配置を保存しました");
      setIsMapEditorOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("保存に失敗しました");
    }
  };

  // --- ハンドラ群 ---
  const handleOpenAddToilet = (floorId: string, areaId: string) => {
    if (!areaId) { toast.error("エリアID設定エラー"); return; }
    setEditingToilet(null);
    setToiletFormData({ id: generateId(areaId), name: '個室', floorId, areaId, hasPaper: true, gender: 'male' });
    setIsToiletDialogOpen(true);
  };
  const handleOpenEditToilet = (toilet: ToiletUI) => {
    setEditingToilet(toilet);
    setToiletFormData({ id: toilet.id, name: toilet.name, floorId: toilet.floorId || '', areaId: toilet.areaId || '', hasPaper: toilet.hasPaper, gender: toilet.gender || 'male' });
    setIsToiletDialogOpen(true);
  };
  const handleOpenConfigToilet = (toilet: ToiletUI) => {
    setEditingToilet(toilet);
    setToiletFormData({ id: toilet.id, name: toilet.name || '個室', floorId: activeFloorId, areaId: '', hasPaper: toilet.hasPaper, gender: toilet.gender || 'male' });
    setIsConfigDialogOpen(true);
  };
  const handleOpenDeleteToilet = (toilet: ToiletUI) => {
    setEditingToilet(toilet);
    setIsDeleteDialogOpen(true);
  };
  const handleOpenAddFloor = () => {
    setFloorFormData({ id: '', name: '' });
    setIsFloorDialogOpen(true);
  };
  const handleOpenAddArea = () => {
    if (!activeFloorId) { toast.error("フロアを選択してください"); return; }
    const suggestedId = `${activeFloorId.toLowerCase()}-area-${Date.now().toString().slice(-3)}`;
    setAreaFormData({ id: suggestedId, name: '' });
    setIsAreaDialogOpen(true);
  };

  const handleSaveToilet = async (isConfigMode = false) => {
    if (!toiletFormData.id || !toiletFormData.name) { toast.error("IDと名前は必須"); return; }
    try {
      const toiletRef = doc(db, "Toilets", toiletFormData.id);
      const toiletData: FirestoreToilet = {
        id: toiletFormData.id, name: toiletFormData.name, floorId: toiletFormData.floorId, areaId: toiletFormData.areaId,
        gender: toiletFormData.gender, paperRemaining: toiletFormData.hasPaper, hasPaper: toiletFormData.hasPaper,
        reserveCount: 1, isOnline: true, status: 'normal', lastChecked: Timestamp.now()
      };
      await setDoc(toiletRef, toiletData, { merge: true });

      const targetFloorId = toiletFormData.floorId;
      const targetAreaId = toiletFormData.areaId;
      if (targetFloorId && targetAreaId) {
        const floorRef = doc(db, "Floors", targetFloorId);
        const floorSnap = await getDoc(floorRef);
        if (floorSnap.exists()) {
          const floorData = floorSnap.data() as FirestoreFloor;
          const updatedAreas = floorData.areas.map(area => {
            if (area.id === targetAreaId) {
              const currentIds = Array.isArray(area.toiletIds) ? area.toiletIds : [];
              const newIds = currentIds.includes(toiletFormData.id) ? currentIds : [...currentIds, toiletFormData.id];
              return { ...area, toiletIds: newIds };
            }
            return area;
          });
          await updateDoc(floorRef, { areas: updatedAreas });
        }
      }
      toast.success("設定を保存しました");
      setIsToiletDialogOpen(false);
      setIsConfigDialogOpen(false);
    } catch (error) { console.error(error); toast.error("保存失敗"); }
  };

  const handleSaveFloor = async () => {
    if (!floorFormData.id || !floorFormData.name) return;
    try {
      const newFloor: FirestoreFloor = { id: floorFormData.id, name: floorFormData.name, mapImageUri: "", areas: [] };
      await setDoc(doc(db, "Floors", floorFormData.id), newFloor);
      toast.success("フロアを追加しました");
      setIsFloorDialogOpen(false);
      setSelectedFloorId(floorFormData.id);
    } catch (e) { toast.error("追加失敗"); }
  };

  const handleSaveArea = async () => {
    if (!areaFormData.id || !areaFormData.name || !activeFloorId) return;
    try {
      const floorRef = doc(db, "Floors", activeFloorId);
      const newArea: FirestoreArea = { id: areaFormData.id, name: areaFormData.name, toiletIds: [] };
      await updateDoc(floorRef, { areas: arrayUnion(newArea) });
      toast.success("エリアを追加しました");
      setIsAreaDialogOpen(false);
    } catch (e) { toast.error("追加失敗"); }
  };

  const handleDeleteToilet = async () => {
    if (!editingToilet || !editingToilet.id) return;
    try {
      const toiletRef = doc(db, "Toilets", editingToilet.id);
      await updateDoc(toiletRef, { floorId: deleteField(), areaId: deleteField(), name: `${editingToilet.name} (未設定)` });
      if (editingToilet.floorId) {
        const floorRef = doc(db, "Floors", editingToilet.floorId);
        const floorSnap = await getDoc(floorRef);
        if (floorSnap.exists()) {
          const floorData = floorSnap.data() as FirestoreFloor;
          const updatedAreas = floorData.areas.map(area => {
            if (area.id === editingToilet.areaId) {
              return { ...area, toiletIds: (area.toiletIds || []).filter(id => id !== editingToilet.id) };
            }
            return area;
          });
          await updateDoc(floorRef, { areas: updatedAreas });
        }
      }
      toast.success("解除しました");
      setIsDeleteDialogOpen(false);
    } catch (e) { toast.error("失敗しました"); }
  };

  if (loading) return <div>読み込み中...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              戻る
            </Button>
            <h1 className="text-xl font-bold">管理画面・設定</h1>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <Tabs defaultValue="facilities" className="space-y-6">
          <TabsList>
            <TabsTrigger value="facilities"><Building2 className="w-4 h-4 mr-2" /> 施設・個室管理</TabsTrigger>
            <TabsTrigger value="notifications"><BellRing className="w-4 h-4 mr-2" /> 通知設定</TabsTrigger>
          </TabsList>

          <TabsContent value="facilities" className="space-y-6">
            {unconfiguredToilets.length > 0 && (
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader><CardTitle className="text-orange-800 flex items-center gap-2"><PlugZap /> 未設定のデバイス ({unconfiguredToilets.length})</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {unconfiguredToilets.map(t => (
                      <div key={t.id} className="bg-white p-3 rounded border border-orange-200 flex justify-between">
                        <span className="font-mono text-sm">{t.id}</span>
                        <Button size="sm" onClick={() => handleOpenConfigToilet(t)} className="bg-orange-600 text-white">設定</Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {isMapEditorOpen ? (
              <MapEditor 
                imageUrl={floors.find(f => f.id === activeFloorId)?.mapImageUri}
                areas={floors.find(f => f.id === activeFloorId)?.areas || []}
                onSave={handleSaveMapConfiguration}
                onCancel={() => setIsMapEditorOpen(false)}
              />
            ) : (
              <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-64 flex-shrink-0">
                  <div className="space-y-2">
                    {floors.map(f => (
                      <Button key={f.id} variant={activeFloorId === f.id ? "default" : "outline"} className={`w-full justify-between ${activeFloorId === f.id ? "bg-blue-600 text-white" : ""}`} onClick={() => setSelectedFloorId(f.id)}>{f.name}</Button>
                    ))}
                    <Button variant="ghost" className="w-full border border-dashed" onClick={handleOpenAddFloor}><Plus className="mr-2"/> フロア追加</Button>
                    
                    {activeFloorId && (
                       <Button variant="secondary" className="w-full mt-6 border-2 border-blue-100 bg-blue-50 text-blue-700" onClick={() => setIsMapEditorOpen(true)}>
                         <Map className="w-4 h-4 mr-2" /> マップ配置を設定
                       </Button>
                    )}
                  </div>
                </div>

                <div className="flex-1 space-y-6">
                  {floors.length === 0 ? <div>フロアを追加してください</div> : (
                    <>
                      <div className="flex justify-between">
                         <h2 className="text-lg font-bold">{floors.find(f => f.id === activeFloorId)?.name} のエリア</h2>
                         <Button size="sm" variant="outline" onClick={handleOpenAddArea}><MapPin className="mr-2"/> エリア追加</Button>
                      </div>
                      {floors.find(f => f.id === activeFloorId)?.areas.map(area => (
                        <Card key={area.id} className="border-l-4 border-l-blue-500">
                          <CardHeader className="py-3 px-4 bg-gray-50 flex flex-row items-center justify-between">
                             <div className="font-bold">{area.name}</div>
                             <Button size="sm" variant="outline" onClick={() => handleOpenAddToilet(activeFloorId, area.id)}><Plus className="w-3 h-3"/> 個室追加</Button>
                          </CardHeader>
                          <CardContent className="p-0">
                            {area.toilets.length === 0 ? <div className="p-4 text-sm text-gray-400">個室なし</div> : (
                              <div className="divide-y">
                                {area.toilets.map(t => (
                                  <div key={t.id} className="flex justify-between p-3 hover:bg-gray-50">
                                    <div className="flex gap-3 items-center">
                                      <div className={`w-2.5 h-2.5 rounded-full ${t.hasPaper ? 'bg-green-500' : 'bg-red-500'}`} />
                                      <div><div className="font-medium text-sm">{t.name}</div><div className="text-xs text-gray-400">{t.id}</div></div>
                                    </div>
                                    <div className="flex gap-1">
                                      <Button variant="ghost" size="icon" onClick={() => handleOpenEditToilet(t)}><Edit2 className="w-3.5 h-3.5"/></Button>
                                      <Button variant="ghost" size="icon" onClick={() => handleOpenDeleteToilet(t)}><Trash2 className="w-3.5 h-3.5 text-red-500"/></Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationSettings />
          </TabsContent>
        </Tabs>
      </div>

      {/* ダイアログ類 */}
      <Dialog open={isToiletDialogOpen} onOpenChange={setIsToiletDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>個室編集</DialogTitle></DialogHeader>
          <div className="space-y-4">
             <div><Label>名前</Label><Input value={toiletFormData.name} onChange={e => setToiletFormData({...toiletFormData, name: e.target.value})}/></div>
             <div><Label>性別</Label>
               <Select value={toiletFormData.gender} onValueChange={(v: GenderType) => setToiletFormData({...toiletFormData, gender: v})}>
                 <SelectTrigger><SelectValue /></SelectTrigger>
                 <SelectContent><SelectItem value="male">男性</SelectItem><SelectItem value="female">女性</SelectItem><SelectItem value="accessible">多目的</SelectItem></SelectContent>
               </Select>
             </div>
             <div className="flex justify-between items-center border p-2 rounded"><Label>紙あり</Label><Switch checked={toiletFormData.hasPaper} onCheckedChange={c => setToiletFormData({...toiletFormData, hasPaper: c})}/></div>
          </div>
          <DialogFooter>
            {/* ★修正: variant="outline" を追加して枠線を表示 */}
            <Button onClick={() => handleSaveToilet(false)} variant="outline">保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>デバイス紐付け</DialogTitle></DialogHeader>
          <div className="space-y-4">
             <div><Label>フロア</Label>
                <Select value={toiletFormData.floorId} onValueChange={v => setToiletFormData({...toiletFormData, floorId: v, areaId: ''})}>
                  <SelectTrigger><SelectValue placeholder="選択"/></SelectTrigger>
                  <SelectContent>{floors.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
             </div>
             <div><Label>エリア</Label>
                <Select value={toiletFormData.areaId} onValueChange={v => setToiletFormData({...toiletFormData, areaId: v})} disabled={!toiletFormData.floorId}>
                  <SelectTrigger><SelectValue placeholder="選択"/></SelectTrigger>
                  <SelectContent>{floors.find(f => f.id === toiletFormData.floorId)?.areas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
             </div>
             <div><Label>名前</Label><Input value={toiletFormData.name} onChange={e => setToiletFormData({...toiletFormData, name: e.target.value})}/></div>
          </div>
          <DialogFooter>
            {/* ★修正: variant="outline" を追加 */}
            <Button onClick={() => handleSaveToilet(true)} variant="outline">設定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isFloorDialogOpen} onOpenChange={setIsFloorDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>フロア追加</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>ID</Label><Input value={floorFormData.id} onChange={e => setFloorFormData({...floorFormData, id: e.target.value})}/></div>
            <div><Label>名前</Label><Input value={floorFormData.name} onChange={e => setFloorFormData({...floorFormData, name: e.target.value})}/></div>
          </div>
          <DialogFooter>
            {/* ★修正: variant="outline" を追加 */}
            <Button onClick={handleSaveFloor} variant="outline">追加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAreaDialogOpen} onOpenChange={setIsAreaDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>エリア追加</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>ID</Label><Input value={areaFormData.id} onChange={e => setAreaFormData({...areaFormData, id: e.target.value})}/></div>
            <div><Label>名前</Label><Input value={areaFormData.name} onChange={e => setAreaFormData({...areaFormData, name: e.target.value})}/></div>
          </div>
          <DialogFooter>
            {/* ★修正: variant="outline" を追加 */}
            <Button onClick={handleSaveArea} variant="outline">追加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>解除しますか？</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>キャンセル</AlertDialogCancel><AlertDialogAction onClick={handleDeleteToilet}>解除</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}