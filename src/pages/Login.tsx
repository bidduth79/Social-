import { useState } from 'react';
import { signInWithGoogle } from '../firebase';
import { Button } from '../components/ui/button';
import { LogIn, Users, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export default function Login() {
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await signInWithGoogle();
      toast.success('Successfully logged in!');
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.code !== 'auth/popup-closed-by-user') {
        toast.error('Failed to login. Please try again.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div 
      className="flex h-screen w-screen items-center justify-center bg-cover bg-center bg-no-repeat bg-fixed"
      style={{ 
        backgroundImage: "url('/background.jpg'), linear-gradient(to bottom right, #0f4c81, #1f3a60)",
        backgroundColor: "#0f4c81"
      }}
    >
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 text-center"
      >
        <div className="flex justify-center mb-6">
          <div className="bg-gradient-to-br from-[#13487a] to-blue-600 p-4 rounded-2xl shadow-lg">
            <Users className="h-12 w-12 text-white" />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Social Hub</h1>
        <p className="text-slate-600 mb-8">Manage your social media links securely in one place.</p>
        
        <div className="space-y-4">
          <Button 
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full bg-[#13487a] hover:bg-[#13487a]/90 text-white h-12 text-lg gap-3 shadow-md"
          >
            {isLoggingIn ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <LogIn className="h-5 w-5" />
            )}
            Sign in with Google
          </Button>
          
          <div className="flex items-center gap-2 justify-center text-xs text-slate-500 mt-6">
            <ShieldCheck className="h-4 w-4" />
            <span>Secure authentication via Google</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
