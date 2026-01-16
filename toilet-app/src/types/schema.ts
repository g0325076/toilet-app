import { Timestamp } from "firebase/firestore";

// --- Areas ---
export interface FirestoreArea {
  id: string;
  name: string;
  toiletIds: string[];
  // ★追加: マップ上の座標 (パーセント 0-100)
  coordinates?: { x: number; y: number };
}

// --- Floors ---
export interface FirestoreFloor {
  id: string;
  name: string;
  mapImageUri?: string;
  areas: FirestoreArea[];
}

// --- Toilets ---
export interface FirestoreToilet {
  id: string;
  name: string;
  floorId?: string;
  areaId?: string;
  gender: 'male' | 'female' | 'accessible';
  paperRemaining: boolean;
  hasPaper: boolean;
  reserveCount: number;
  isOnline: boolean;
  status: 'normal' | 'empty' | 'theft' | 'error' | 'offline' | 'malfunction';
  lastChecked: Timestamp;
}

// --- Alerts ---
export type AlertType = 'theft' | 'malfunction' | 'low-stock' | 'empty' | 'offline' | 'error';
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

// --- UI用型定義 ---

export interface ToiletUI extends FirestoreToilet {
  lastCheckedStr: string;
}

export interface AreaUI extends Omit<FirestoreArea, 'toiletIds'> {
  percentage: number;
  toilets: ToiletUI[];
  // coordinatesはFirestoreAreaから継承されます
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
  unconfiguredToilets: ToiletUI[];
}