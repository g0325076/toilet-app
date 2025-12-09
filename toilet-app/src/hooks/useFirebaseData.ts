"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, query, orderBy, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  FirestoreFloor, 
  FirestoreToilet, 
  FirestoreAlert, 
  FacilityData, 
  FloorUI, 
  ToiletUI,
  AlertUI 
} from "@/types/schema";

export function useFacilityData() {
  const [loading, setLoading] = useState(true);

  // Firestoreからの生データを保持するState
  const [rawFloors, setRawFloors] = useState<FirestoreFloor[]>([]);
  const [rawToilets, setRawToilets] = useState<FirestoreToilet[]>([]);
  const [rawAlerts, setRawAlerts] = useState<AlertUI[]>([]);

  useEffect(() => {
    // ローディング完了判定用のフラグ
    let floorsLoaded = false;
    let toiletsLoaded = false;
    let alertsLoaded = false;

    const checkLoading = () => {
      if (floorsLoaded && toiletsLoaded && alertsLoaded) {
        setLoading(false);
      }
    };

    // 1. フロアの監視
    const unsubscribeFloors = onSnapshot(collection(db, "Floors"), (snapshot) => {
      const floorsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FirestoreFloor[];
      setRawFloors(floorsData);
      floorsLoaded = true;
      checkLoading();
    });

    // 2. トイレの監視
    const unsubscribeToilets = onSnapshot(collection(db, "Toilets"), (snapshot) => {
      const toiletsData = snapshot.docs.map(doc => ({ 
        id: doc.id, ...doc.data() 
      } as FirestoreToilet));
      setRawToilets(toiletsData);
      toiletsLoaded = true;
      checkLoading();
    });

    // 3. アラートの監視
    const q = query(collection(db, "Alerts"), orderBy("timestamp", "desc"));
    const unsubscribeAlerts = onSnapshot(q, (snapshot) => {
      const alertsData = snapshot.docs.map(doc => {
        const d = doc.data() as Omit<FirestoreAlert, 'id'>;
        return {
          id: doc.id,
          ...d,
          timestamp: formatTimestamp(d.timestamp)
        } as AlertUI;
      });
      setRawAlerts(alertsData);
      alertsLoaded = true;
      checkLoading();
    });

    return () => {
      unsubscribeFloors();
      unsubscribeToilets();
      unsubscribeAlerts();
    };
  }, []);

  // useMemoを使って、レンダリング中にデータを結合・計算する
  // (useEffect + setState を使うと再レンダリングが連鎖するため、こちらが推奨されます)
  const data = useMemo<FacilityData>(() => {
    // トイレデータのマップ化
    const toiletMap = new Map<string, FirestoreToilet>();
    rawToilets.forEach(t => toiletMap.set(t.id, t));
    const configuredToiletIds = new Set<string>();

    // フロアとトイレの結合
    const mergedFloors: FloorUI[] = rawFloors.map(floor => {
      const areasList = Array.isArray(floor.areas) ? floor.areas : [];
      
      const processedAreas = areasList.map(area => {
        const toiletIdsList = Array.isArray(area.toiletIds) ? area.toiletIds : [];
        
        const areaToilets: ToiletUI[] = toiletIdsList.map(toiletId => {
          configuredToiletIds.add(toiletId);
          const tData = toiletMap.get(toiletId);
          if (!tData) return createDummyToilet(toiletId, floor.id, area.id);
          return {
            ...tData,
            lastCheckedStr: formatTimestamp(tData.lastChecked)
          };
        });

        // 統計計算
        const totalToilets = areaToilets.length;
        const MAX_SPARES_PER_TOILET = 2;
        const currentTotalSpares = areaToilets.reduce((sum, t) => sum + (t.reserveCount || 0), 0);
        const maxAreaCapacity = totalToilets * MAX_SPARES_PER_TOILET;
        const percentageCalc = maxAreaCapacity > 0 ? (currentTotalSpares / maxAreaCapacity) * 100 : 0;
        const percentage = Math.min(Math.round(percentageCalc), 100);

        return {
          id: area.id,
          name: area.name,
          percentage,
          toilets: areaToilets
        };
      });

      return { ...floor, areas: processedAreas };
    });

    // 未設定トイレの抽出
    const unconfiguredList: ToiletUI[] = [];
    rawToilets.forEach(toilet => {
      if (!configuredToiletIds.has(toilet.id)) {
        unconfiguredList.push({
          ...toilet,
          lastCheckedStr: formatTimestamp(toilet.lastChecked)
        });
      }
    });

    return { 
      floors: mergedFloors, 
      alerts: rawAlerts, 
      unconfiguredToilets: unconfiguredList 
    };
  }, [rawFloors, rawToilets, rawAlerts]);

  return { data, loading };
}

// --- ヘルパー関数 ---

function formatTimestamp(ts: Timestamp | Date | null | undefined): string {
  if (!ts) return "-";
  try {
    const date = (ts instanceof Timestamp) ? ts.toDate() : new Date(ts as Date);
    const diffMins = Math.floor((new Date().getTime() - date.getTime()) / 60000);
    if (diffMins < 1) return "たった今";
    if (diffMins < 60) return `${diffMins}分前`;
    if (diffMins < 1440) return `${Math.floor(diffMins/60)}時間前`;
    return `${Math.floor(diffMins/1440)}日前`;
  } catch (e) {
    return "-";
  }
}

function createDummyToilet(id: string, floorId: string, areaId: string): ToiletUI {
  return {
    id, floorId, areaId, name: "不明な個室",
    gender: 'male', paperRemaining: 0, hasPaper: false, reserveCount: 0,
    isOnline: false, 
    status: 'offline', 
    lastChecked: Timestamp.fromMillis(0), 
    lastCheckedStr: "-"
  };
}