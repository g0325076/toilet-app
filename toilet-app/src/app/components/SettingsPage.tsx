"use client";

import { useState } from 'react'; 
import { db } from "@/lib/firebase";
import { doc, setDoc, updateDoc, deleteDoc, getDoc, Timestamp, arrayUnion, deleteField } from "firebase/firestore";
import { FloorUI, ToiletUI, FirestoreFloor, FirestoreToilet, FirestoreArea } from "@/types/schema";
import { toast } from 'sonner';
import { useFacilityData } from '@/hooks/useFirebaseData';

// UIコンポーネント
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { ArrowLeft, Plus, Trash2, Edit2, Save, Building2, BellRing, Map, MapPin, PlugZap, CheckCircle2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { Badge } from './ui/badge';

// 通知設定コンポーネント
import NotificationSettings from './NotificationSettings';

interface SettingsPageProps {
  floors?: FloorUI[]; 
  onBack: () => void;
}

// ID生成ヘルパー
const generateId = (prefix: string) => {
  return `${prefix}-${Date.now().toString().slice(-4)}`;
};

type GenderType = 'male' | 'female' | 'accessible';

export default function SettingsPage({ onBack }: SettingsPageProps) {
  // データ取得
  const { data, loading } = useFacilityData();
  const floors = data.floors;
  const unconfiguredToilets = data.unconfiguredToilets; // 【追加】未設定リスト

  // 選択状態
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const activeFloorId = selectedFloorId || (floors.length > 0 ? floors[0].id : '');

  // ダイアログ状態
  const [isToiletDialogOpen, setIsToiletDialogOpen] = useState(false);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false); // 【追加】紐付け用ダイアログ
  const [isFloorDialogOpen, setIsFloorDialogOpen] = useState(false);
  const [isAreaDialogOpen, setIsAreaDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // 編集対象
  const [editingToilet, setEditingToilet] = useState<ToiletUI | null>(null);
  
  // フォーム状態
  const [toiletFormData, setToiletFormData] = useState({
    id: '',
    name: '',
    floorId: '',
    areaId: '',
    hasPaper: true,
    gender: 'male' as GenderType,
  });

  const [floorFormData, setFloorFormData] = useState({ id: '', name: '' });
  const [areaFormData, setAreaFormData] = useState({ id: '', name: '' });

  // --- ハンドラ: 通常のトイレ追加・編集 ---

  const handleOpenAddToilet = (floorId: string, areaId: string) => {
    if (!areaId) {
      toast.error("エリアIDが設定されていません。");
      return;
    }
    setEditingToilet(null);
    setToiletFormData({
      id: generateId(areaId),
      name: '個室',
      floorId,
      areaId,
      hasPaper: true,
      gender: 'male',
    });
    setIsToiletDialogOpen(true);
  };

  const handleOpenEditToilet = (toilet: ToiletUI) => {
    setEditingToilet(toilet);
    setToiletFormData({
      id: toilet.id,
      name: toilet.name,
      floorId: toilet.floorId || '',
      areaId: toilet.areaId || '',
      hasPaper: toilet.hasPaper,
      gender: toilet.gender || 'male',
    });
    setIsToiletDialogOpen(true);
  };

  // --- ハンドラ: 未設定デバイスの紐付け ---

  const handleOpenConfigToilet = (toilet: ToiletUI) => {
    setEditingToilet(toilet);
    // 初期値として、現在選択中のフロアがあればそれをセット
    setToiletFormData({
      id: toilet.id,
      name: toilet.name || '個室',
      floorId: activeFloorId, 
      areaId: '',
      hasPaper: toilet.hasPaper,
      gender: toilet.gender || 'male',
    });
    setIsConfigDialogOpen(true);
  };

  const handleOpenDeleteToilet = (toilet: ToiletUI) => {
    setEditingToilet(toilet);
    setIsDeleteDialogOpen(true);
  };

  // --- ハンドラ: フロア・エリア ---
  const handleOpenAddFloor = () => {
    setFloorFormData({ id: '', name: '' });
    setIsFloorDialogOpen(true);
  };

  const handleOpenAddArea = () => {
    if (!activeFloorId) {
      toast.error("フロアを選択してください");
      return;
    }
    const suggestedId = `${activeFloorId.toLowerCase()}-area-${Date.now().toString().slice(-3)}`;
    setAreaFormData({ id: suggestedId, name: '' });
    setIsAreaDialogOpen(true);
  };

  // --- 保存処理 ---

  // トイレ保存（新規・更新・紐付け共通）
  const handleSaveToilet = async (isConfigMode = false) => {
    if (!toiletFormData.id || !toiletFormData.name) {
      toast.error("IDと名前は必須です");
      return;
    }
    // 紐付けモードの場合は場所選択必須
    if (isConfigMode && (!toiletFormData.floorId || !toiletFormData.areaId)) {
      toast.error("フロアとエリアを選択してください");
      return;
    }

    try {
      const toiletRef = doc(db, "Toilets", toiletFormData.id);

      const toiletData: FirestoreToilet = {
        id: toiletFormData.id,
        name: toiletFormData.name,
        floorId: toiletFormData.floorId,
        areaId: toiletFormData.areaId,
        gender: toiletFormData.gender,
        paperRemaining: toiletFormData.hasPaper ? 100 : 0,
        hasPaper: toiletFormData.hasPaper,
        reserveCount: 1,
        isOnline: true,
        status: 'normal',
        lastChecked: Timestamp.now()
      };

      // 1. Toilets更新
      await setDoc(toiletRef, toiletData, { merge: true });

      // 2. Floors紐付け更新
      // 紐付けモード、または新規作成の場合、または場所が変わった場合
      const targetFloorId = toiletFormData.floorId;
      const targetAreaId = toiletFormData.areaId;

      if (targetFloorId && targetAreaId) {
        // 既存の紐付けがあれば解除する処理が必要だが、今回は簡易的に「追加」のみ実装
        // (厳密には古いFloorからIDを消す処理も必要)
        
        const floorRef = doc(db, "Floors", targetFloorId);
        const floorSnap = await getDoc(floorRef);
        
        if (floorSnap.exists()) {
          const floorData = floorSnap.data() as FirestoreFloor;
          const updatedAreas = floorData.areas.map(area => {
            if (area.id === targetAreaId) {
              const currentIds = Array.isArray(area.toiletIds) ? area.toiletIds : [];
              const newIds = currentIds.includes(toiletFormData.id) 
                ? currentIds 
                : [...currentIds, toiletFormData.id];
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

    } catch (error) {
      console.error(error);
      toast.error("保存に失敗しました");
    }
  };

  // ... (Floor/Area/Delete のハンドラは変更なし) ...
  const handleSaveFloor = async () => {
    if (!floorFormData.id || !floorFormData.name) {
      toast.error("IDと名前は必須です");
      return;
    }
    try {
      const newFloor: FirestoreFloor = {
        id: floorFormData.id,
        name: floorFormData.name,
        mapImageUri: "",
        areas: [] 
      };
      await setDoc(doc(db, "Floors", floorFormData.id), newFloor);
      toast.success("フロアを追加しました");
      setIsFloorDialogOpen(false);
      setSelectedFloorId(floorFormData.id); 
    } catch (error) {
      console.error(error);
      toast.error("フロアの追加に失敗しました");
    }
  };

  const handleSaveArea = async () => {
    if (!areaFormData.id || !areaFormData.name) {
      toast.error("IDと名前は必須です");
      return;
    }
    if (!activeFloorId) return;
    try {
      const floorRef = doc(db, "Floors", activeFloorId);
      const newArea: FirestoreArea = {
        id: areaFormData.id,
        name: areaFormData.name,
        toiletIds: [] 
      };
      await updateDoc(floorRef, {
        areas: arrayUnion(newArea)
      });
      toast.success("エリアを追加しました");
      setIsAreaDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("エリアの追加に失敗しました");
    }
  };

  // 削除処理（実態は「配置の解除」に変更）
  const handleDeleteToilet = async () => {
    if (!editingToilet || !editingToilet.id) {
      toast.error("対象のIDが無効です");
      setIsDeleteDialogOpen(false);
      return;
    }

    try {
      // 1. Toiletsコレクション: 削除せず、場所情報だけを消す (未設定状態に戻す)
      const toiletRef = doc(db, "Toilets", editingToilet.id);
      await updateDoc(toiletRef, {
        floorId: deleteField(), // フィールドを削除
        areaId: deleteField(),  // フィールドを削除
        name: `${editingToilet.name} (未設定)`, // 名前を分かりやすく変更（任意）
        // status, paperRemaining, isOnline などは保持する
      });

      // 2. Floorsコレクション: 参照リストからIDを削除 (ここは既存のまま)
      if (editingToilet.floorId) {
        const floorRef = doc(db, "Floors", editingToilet.floorId);
        const floorSnap = await getDoc(floorRef);

        if (floorSnap.exists()) {
          const floorData = floorSnap.data() as FirestoreFloor;
          const updatedAreas = floorData.areas.map(area => {
            // 元々所属していたエリアからIDを抜く
            if (area.id === editingToilet.areaId) {
              const currentIds = Array.isArray(area.toiletIds) ? area.toiletIds : [];
              return {
                ...area,
                toiletIds: currentIds.filter(id => id !== editingToilet.id)
              };
            }
            return area;
          });
          
          await updateDoc(floorRef, { areas: updatedAreas });
        }
      }

      toast.success("個室の配置を解除し、未設定リストに戻しました");
      setIsDeleteDialogOpen(false);

    } catch (error) {
      console.error(error);
      toast.error("解除に失敗しました");
    }
  };

  if (loading) return <div className="p-8 text-center">データを読み込み中...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 px-4 py-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">管理画面・設定</h1>
          <p className="text-xs text-gray-500">施設構造の管理および通知設定</p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <Tabs defaultValue="facilities" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
            <TabsTrigger value="facilities" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" /> 施設・個室管理
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <BellRing className="w-4 h-4" /> 通知設定
            </TabsTrigger>
          </TabsList>

          <TabsContent value="facilities" className="space-y-6">
            
            {/* 【追加】未設定デバイスのリスト */}
            {unconfiguredToilets.length > 0 && (
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-orange-800 flex items-center gap-2 text-lg">
                    <PlugZap className="w-5 h-5" /> 未設定のデバイス ({unconfiguredToilets.length})
                  </CardTitle>
                  <CardDescription className="text-orange-700/80">
                    通信が確認されていますが、場所が割り当てられていないデバイスです。
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {unconfiguredToilets.map(toilet => (
                      <div key={toilet.id} className="bg-white p-3 rounded-lg border border-orange-200 shadow-sm flex items-center justify-between">
                        <div>
                          <div className="font-mono font-bold text-sm">{toilet.id}</div>
                          <div className="text-xs text-gray-500">最終通信: {toilet.lastCheckedStr}</div>
                        </div>
                        <Button size="sm" onClick={() => handleOpenConfigToilet(toilet)} className="bg-orange-600 hover:bg-orange-700 text-white">
                          設定する
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 以下、既存のフロア・エリア管理UI */}
            <div className="flex flex-col md:flex-row gap-6">
              {/* 左側: フロア選択 */}
              <div className="w-full md:w-64 flex-shrink-0">
                <div className="sticky top-24">
                  <h3 className="text-sm font-medium text-gray-500 mb-2 px-1">フロア一覧</h3>
                  <div className="space-y-2">
                    {floors.map(floor => (
                      <Button
                        key={floor.id}
                        variant={activeFloorId === floor.id ? "default" : "outline"}
                        className={`w-full justify-between ${activeFloorId === floor.id ? "bg-blue-600 text-white" : "bg-white"}`}
                        onClick={() => setSelectedFloorId(floor.id)}
                      >
                        <span className="truncate">{floor.name}</span>
                      </Button>
                    ))}
                    
                    <Button 
                      variant="ghost" 
                      className="w-full border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-blue-600"
                      onClick={handleOpenAddFloor}
                    >
                      <Plus className="w-4 h-4 mr-2" /> フロアを追加
                    </Button>
                  </div>
                </div>
              </div>

              {/* 右側: エリア・個室リスト */}
              <div className="flex-1 space-y-6">
                {floors.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="pt-6 text-center text-gray-500 py-12">
                      <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                      <p>フロアがまだ登録されていません。</p>
                      <p className="text-sm">左下の「フロアを追加」から作成してください。</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold text-gray-800">
                        {floors.find(f => f.id === activeFloorId)?.name} のエリア
                      </h2>
                      <Button size="sm" variant="outline" onClick={handleOpenAddArea} className="bg-white">
                        <MapPin className="w-4 h-4 mr-2" /> 新しいエリアを追加
                      </Button>
                    </div>

                    {floors.find(f => f.id === activeFloorId)?.areas.map(area => (
                      <Card key={area.id} className="overflow-hidden border-l-4 border-l-blue-500">
                        <CardHeader className="bg-gray-50/50 border-b py-3 px-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Map className="w-4 h-4 text-gray-500" />
                              <span className="font-bold text-gray-700">{area.name}</span>
                              <span className="text-xs text-gray-400 font-mono">({area.id})</span>
                            </div>
                            <Button size="sm" onClick={() => handleOpenAddToilet(activeFloorId, area.id)} className="h-8 gap-1 bg-white text-blue-600 border border-blue-200 hover:bg-blue-50">
                              <Plus className="w-3 h-3" /> 個室追加
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          {area.toilets.length === 0 ? (
                            <div className="p-6 text-center text-gray-400 text-sm bg-white">
                              個室がありません。「個室追加」ボタンから登録してください。
                            </div>
                          ) : (
                            <div className="divide-y">
                              {area.toilets.map(toilet => (
                                <div key={toilet.id} className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors bg-white">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-2.5 h-2.5 rounded-full ${toilet.hasPaper ? 'bg-green-500' : 'bg-red-500'}`} />
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm">{toilet.name}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                          toilet.gender === 'female' ? 'bg-red-50 text-red-600 border-red-100' :
                                          toilet.gender === 'male' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                          'bg-green-50 text-green-600 border-green-100'
                                        }`}>
                                          {toilet.gender === 'male' ? '男性' : toilet.gender === 'female' ? '女性' : '多目的'}
                                        </span>
                                      </div>
                                      <p className="text-xs text-gray-400 font-mono">{toilet.id}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEditToilet(toilet)}>
                                      <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDeleteToilet(toilet)}>
                                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                    
                    {floors.find(f => f.id === activeFloorId)?.areas.length === 0 && (
                      <div className="text-center py-10 border-2 border-dashed rounded-lg">
                        <p className="text-gray-500 mb-2">このフロアにはまだエリア（場所）がありません。</p>
                        <Button onClick={handleOpenAddArea}>
                          <Plus className="w-4 h-4 mr-2" /> 最初のエリアを追加する
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationSettings />
          </TabsContent>
        </Tabs>
      </div>

      {/* --- トイレ追加・編集ダイアログ (既存) --- */}
      <Dialog open={isToiletDialogOpen} onOpenChange={setIsToiletDialogOpen}>
        <DialogContent className="bg-white sm:max-w-lg z-[100]">
          <DialogHeader>
            <DialogTitle>{editingToilet ? '個室を編集' : '新しい個室を追加'}</DialogTitle>
            <DialogDescription>個室の情報を入力してください。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="id">個室ID</Label>
              <Input 
                id="id" 
                value={toiletFormData.id} 
                onChange={(e) => setToiletFormData({...toiletFormData, id: e.target.value})}
                disabled={!!editingToilet}
                className="font-mono"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">表示名</Label>
              <Input 
                id="name" 
                value={toiletFormData.name} 
                placeholder="例: 個室1"
                onChange={(e) => setToiletFormData({...toiletFormData, name: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="gender">性別タイプ</Label>
              <Select 
                value={toiletFormData.gender} 
                onValueChange={(value: GenderType) => setToiletFormData({...toiletFormData, gender: value})}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="性別を選択" />
                </SelectTrigger>
                <SelectContent className='bg-white z-[110]'>
                  <SelectItem value="male">男性用</SelectItem>
                  <SelectItem value="female">女性用</SelectItem>
                  <SelectItem value="accessible">多目的</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between border p-3 rounded-md">
              <Label htmlFor="hasPaper">初期在庫状態 (紙あり)</Label>
              <Switch 
                id="hasPaper" 
                checked={toiletFormData.hasPaper}
                onCheckedChange={(checked) => setToiletFormData({...toiletFormData, hasPaper: checked})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsToiletDialogOpen(false)}>キャンセル</Button>
            <Button onClick={() => handleSaveToilet(false)} className="gap-2"><Save className="w-4 h-4" /> 保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- 【追加】デバイス割り当てダイアログ --- */}
      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
        <DialogContent className="bg-white sm:max-w-lg z-[100]">
          <DialogHeader>
            <DialogTitle>デバイスの設定と割り当て</DialogTitle>
            <DialogDescription>
              ID: <span className="font-mono font-bold">{editingToilet?.id}</span> を設置する場所を選択してください。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            
            <div className="grid gap-2">
              <Label>設置フロア</Label>
              <Select 
                value={toiletFormData.floorId} 
                onValueChange={(value) => setToiletFormData({...toiletFormData, floorId: value, areaId: ''})}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="フロアを選択" />
                </SelectTrigger>
                <SelectContent className='bg-white z-[110]'>
                  {floors.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>設置エリア（場所）</Label>
              <Select 
                value={toiletFormData.areaId} 
                onValueChange={(value) => setToiletFormData({...toiletFormData, areaId: value})}
                disabled={!toiletFormData.floorId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={toiletFormData.floorId ? "エリアを選択" : "先にフロアを選択してください"} />
                </SelectTrigger>
                <SelectContent className='bg-white z-[110]'>
                  {floors.find(f => f.id === toiletFormData.floorId)?.areas.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="config-name">表示名</Label>
              <Input 
                id="config-name" 
                value={toiletFormData.name} 
                placeholder="例: 個室1"
                onChange={(e) => setToiletFormData({...toiletFormData, name: e.target.value})}
              />
            </div>

            <div className="grid gap-2">
              <Label>性別タイプ</Label>
              <Select 
                value={toiletFormData.gender} 
                onValueChange={(value: GenderType) => setToiletFormData({...toiletFormData, gender: value})}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="性別を選択" />
                </SelectTrigger>
                <SelectContent className='bg-white z-[110]'>
                  <SelectItem value="male">男性用</SelectItem>
                  <SelectItem value="female">女性用</SelectItem>
                  <SelectItem value="accessible">多目的</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfigDialogOpen(false)}>キャンセル</Button>
            <Button onClick={() => handleSaveToilet(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
              <CheckCircle2 className="w-4 h-4" /> 設定して割り当て
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- フロア・エリア・削除ダイアログ (既存) --- */}
      <Dialog open={isFloorDialogOpen} onOpenChange={setIsFloorDialogOpen}>
        <DialogContent className="bg-white z-[100]">
          <DialogHeader>
            <DialogTitle>新しいフロアを追加</DialogTitle>
            <DialogDescription>フロアIDと表示名を入力してください。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="floorId">フロアID (例: 1F, 2F)</Label>
              <Input 
                id="floorId" 
                value={floorFormData.id} 
                placeholder="例: 3F"
                onChange={(e) => setFloorFormData({...floorFormData, id: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="floorName">表示名 (例: 3階)</Label>
              <Input 
                id="floorName" 
                value={floorFormData.name} 
                placeholder="例: 3階"
                onChange={(e) => setFloorFormData({...floorFormData, name: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFloorDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSaveFloor}>追加する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAreaDialogOpen} onOpenChange={setIsAreaDialogOpen}>
        <DialogContent className="bg-white z-[100]">
          <DialogHeader>
            <DialogTitle>新しいエリアを追加</DialogTitle>
            <DialogDescription>このフロアに追加する場所（トイレ）の名前を入力してください。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="areaId">エリアID (自動生成可)</Label>
              <Input 
                id="areaId" 
                value={areaFormData.id} 
                onChange={(e) => setAreaFormData({...areaFormData, id: e.target.value})}
                className="font-mono"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="areaName">場所名 (例: 南側トイレ)</Label>
              <Input 
                id="areaName" 
                value={areaFormData.name} 
                placeholder="例: 南側トイレ"
                onChange={(e) => setAreaFormData({...areaFormData, name: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAreaDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSaveArea}>追加する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- 削除確認ダイアログ --- */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-white z-[100]">
          <AlertDialogHeader>
            <AlertDialogTitle>配置を解除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              個室「{editingToilet?.name}」をこのエリアから削除します。<br/>
              <strong>デバイスデータは削除されず、「未設定のデバイス」リストに戻ります。</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteToilet} className="bg-red-600 hover:bg-red-700 text-white">
              解除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}