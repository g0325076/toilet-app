"use client";

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import SettingsPage from './components/SettingsPage';
import AlertLogPage from './components/AlertLogPage';
import AlertNotifier from './components/AlertNotifier'; // 【追加】インポート
import { Toaster } from './components/ui/sonner';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster />
      
      {!user ? (
        <LoginPage onLogin={() => {}} />
      ) : (
        <>
          {/* 【追加】ログイン中なら常にここにおいて監視させる */}
          <AlertNotifier /> 

          {/* 画面切り替えロジック */}
          {showSettings ? (
            <SettingsPage onBack={() => setShowSettings(false)} /> 
          ) : showLogs ? (
            <AlertLogPage onBack={() => setShowLogs(false)} />
          ) : (
            <Dashboard 
              onLogout={() => auth.signOut()} 
              onOpenSettings={() => setShowSettings(true)}
              onOpenLogs={() => setShowLogs(true)}
            />
          )}
        </>
      )}
    </div>
  );
}