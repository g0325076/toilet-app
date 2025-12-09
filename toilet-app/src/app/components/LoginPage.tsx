"use client";

import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './ui/card';
import { ScrollText, Loader2, UserPlus, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, // 追加
  setPersistence, 
  browserSessionPersistence 
} from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore'; // 追加
import { auth, db } from '@/lib/firebase';

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [isRegistering, setIsRegistering] = useState(false); // 登録モード切替用
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // セッション設定 (タブを閉じたらログアウト)
      await setPersistence(auth, browserSessionPersistence);

      if (isRegistering) {
        // --- 新規登録処理 ---
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Firestoreにユーザー初期データを作成
        // 初期状態では role: 'viewer' (閲覧者) として登録し、書き込み権限を与えないのが安全です
        await setDoc(doc(db, "Users", user.uid), {
          email: user.email,
          role: 'viewer', // 管理者が後で 'admin' に変更する運用を想定
          createdAt: Timestamp.now(),
          notificationSettings: { // 通知設定の初期値
            theft: true,
            lowStock: true,
            malfunction: false,
          }
        });

        toast.success('アカウントを作成しました');
      } else {
        // --- ログイン処理 ---
        await signInWithEmailAndPassword(auth, email, password);
        toast.success('ログインしました');
      }
      
      onLogin();

    } catch (error: unknown) {
      console.error(error);
      const err = error as { code?: string };
      const message = err.code === 'auth/email-already-in-use' 
        ? 'このメールアドレスは既に登録されています。'
        : err.code === 'auth/weak-password'
        ? 'パスワードは6文字以上で入力してください。'
        : isRegistering 
          ? '登録に失敗しました。' 
          : 'ログインに失敗しました。メールアドレスとパスワードを確認してください。';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
             <div className="bg-blue-100 p-3 rounded-full">
               {isRegistering ? <UserPlus className="w-8 h-8 text-blue-600" /> : <ScrollText className="w-8 h-8 text-blue-600" />}
             </div>
          </div>
          <CardTitle>トイレットペーパー残量管理</CardTitle>
          <CardDescription>
            {isRegistering ? '新しい管理者アカウントを作成' : '管理者ログイン (Firebase Auth)'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegistering ? "6文字以上" : ""}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full bg-black text-white" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isRegistering ? "登録する" : "ログイン")}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button 
            variant="link" 
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-gray-500 text-sm"
          >
            {isRegistering ? "すでにアカウントをお持ちの方はこちら" : "新規アカウント作成はこちら"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}