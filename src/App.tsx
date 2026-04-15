import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, loginAnonymously, loginWithGoogle } from './firebase';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Profile from './pages/Profile';
import SearchTool from './pages/SearchTool';
import Newspapers from './pages/Newspapers';
import AIAssistant from './pages/AIAssistant';
import { Toaster, toast } from 'sonner';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        try {
          await loginAnonymously();
        } catch (error: any) {
          if (error.code !== 'auth/admin-restricted-operation') {
            console.error("Auto-login failed:", error);
            toast.error("Authentication failed", {
              description: "Some features may be limited."
            });
          }
          setLoading(false);
        }
      } else {
        setUser(currentUser);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div 
        className="flex h-screen w-screen items-center justify-center bg-cover bg-center bg-no-repeat bg-fixed"
        style={{ 
          backgroundImage: "url('/background.jpg'), linear-gradient(to bottom right, #0f4c81, #1f3a60)",
          backgroundColor: "#0f4c81"
        }}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors closeButton />
      <Routes>
        <Route path="/" element={<Layout user={user} />}>
          <Route index element={<Dashboard />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="profile" element={<Profile />} />
          <Route path="search" element={<SearchTool />} />
          <Route path="newspapers" element={<Newspapers />} />
          <Route path="ai-intelligence" element={<AIAssistant />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
