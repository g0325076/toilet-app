import { Timestamp } from "firebase/firestore";

// ... (Floors定義は変更なし) ...
export interface FirestoreArea {
  id: string;
  name: string;
  toiletIds: string[]; 
}

export interface FirestoreFloor {
  id: string; 
  name: string;
  mapImageUri?: string;
  areas: FirestoreArea[];
}

// Toilets コレクション
export interface FirestoreToilet {
  id: string; 
  name: string;
  floorId?: string; // 【変更】未設定（undefined）を許容する
  areaId?: string;  // 【変更】未設定（undefined）を許容する
  gender: 'male' | 'female' | 'accessible';
  paperRemaining: boolean;
  hasPaper: boolean;
  reserveCount: number;
  isOnline: boolean;
  status: 'normal' | 'empty' | 'theft' | 'error' | 'offline';
  lastChecked: Timestamp;
}

// Alerts コレクション (変更なし)
export type AlertType = 'theft' | 'malfunction' | 'low-stock' | 'empty';
export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface FirestoreAlert {
  id: string;
  toiletId: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  location: string;
  timestamp: Timestamp;
  isResolved: boolean;
  isNotified: boolean;
}

// ... (UI用型定義) ...

export interface ToiletUI extends FirestoreToilet {
  lastCheckedStr: string; 
}

export interface AreaUI extends Omit<FirestoreArea, 'toiletIds'> {
  percentage: number; 
  toilets: ToiletUI[]; 
}

export interface FloorUI extends Omit<FirestoreFloor, 'areas'> {
  areas: AreaUI[];
}

export interface AlertUI extends Omit<FirestoreAlert, 'timestamp'> {
  timestamp: string; 
}

export interface FacilityData {
  floors: FloorUI[];
  alerts: AlertUI[];
  unconfiguredToilets: ToiletUI[]; // 【追加】場所未定のトイレリスト
}