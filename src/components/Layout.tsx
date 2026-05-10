import { User } from 'firebase/auth';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Menu, X, ChevronDown, ChevronRight, ExternalLink, UserCircle, Sun, Moon, Search, Newspaper, Sparkles, Brain } from 'lucide-react';
import { db, auth, loginWithGoogle } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Account } from '../pages/Accounts';
import { useCategories } from '../hooks/useCategories';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function Layout({ user }: { user: User | null }) {
  const { categories } = useCategories();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const currentCategory = searchParams.get('category');

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const q = query(collection(db, 'accounts'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Account[];
      setAccounts(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'accounts');
    });
    return () => unsubscribe();
  }, []);

  const accountsByCategory = useMemo(() => {
    const accByCategory: Record<string, Account[]> = {};
    
    // Group by defined categories
    categories.forEach(category => {
      const catAccounts = accounts.filter(account => account.category === category);
      if (catAccounts.length > 0) {
        accByCategory[category] = catAccounts;
      }
    });
    
    // Find accounts that don't match any defined category
    const categorizedIds = new Set(Object.values(accByCategory).flat().map(a => a.id));
    const uncategorized = accounts.filter(a => !categorizedIds.has(a.id));
    
    if (uncategorized.length > 0) {
      accByCategory['Uncategorized'] = uncategorized;
    }
    
    return accByCategory;
  }, [categories, accounts]);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Search Tool', href: '/search', icon: Search },
    { name: 'AI Intelligence', href: '/ai-intelligence', icon: Brain, premium: true },
    { name: 'Newspaper', href: '/newspapers', icon: Newspaper },
  ];

  const handleGoogleLogin = async () => {
    try {
      setIsLoggingIn(true);
      await loginWithGoogle();
      toast.success("Logged in successfully");
    } catch (error) {
      console.error("Login failed:", error);
      toast.error("Login failed", {
        description: "Could not sign in with Google."
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div 
      className={cn(
        "h-[100dvh] bg-cover bg-center bg-no-repeat bg-fixed flex flex-col overflow-hidden transition-colors duration-300",
        isDarkMode ? "dark" : ""
      )}
      style={{ 
        backgroundImage: isDarkMode 
          ? "linear-gradient(to bottom right, #020617, #0f172a)" 
          : "url('/background.jpg'), linear-gradient(to bottom right, #0f4c81, #1f3a60)",
        backgroundColor: isDarkMode ? "#020617" : "#0f4c81"
      }}
    >
      {/* Header */}
      <header className="flex-none z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-white/20 dark:border-slate-800 shadow-sm">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="md:hidden p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-br from-[#13487a] to-blue-600 p-1.5 rounded-md shadow-sm">
                <Users className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#13487a] to-blue-600 hidden sm:block">Social Hub</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {!user && (
              <Button
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="bg-gradient-to-r from-[#13487a] to-blue-600 text-white h-9 px-4 font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95"
              >
                {isLoggingIn ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : (
                  <>
                    <img src="https://www.google.com/favicon.ico" className="h-4 w-4 mr-2" alt="" />
                    Login
                  </>
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <nav
          className={cn(
            "fixed inset-y-0 left-0 z-30 w-96 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-r border-white/20 dark:border-slate-800 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 pt-16 md:pt-0 flex flex-col shadow-sm",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex flex-col pt-6 pb-4 px-6 gap-2 shrink-0 border-b border-white/20 dark:border-slate-800">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center justify-between pl-3 pr-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 group relative overflow-hidden",
                    isActive
                      ? "bg-gradient-to-r from-[#13487a] to-blue-600 text-white shadow-lg shadow-blue-500/20"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-[#13487a] dark:hover:text-blue-400"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3 relative z-10">
                      <item.icon className={cn("h-5 w-5 transition-transform group-hover:scale-110", isActive ? "text-white" : "text-slate-400 group-hover:text-[#13487a]")} />
                      {item.name}
                    </div>
                    {item.premium && (
                      <Sparkles className={cn("h-3.5 w-3.5 relative z-10", isActive ? "text-yellow-300" : "text-yellow-500")} />
                    )}
                    {isActive && (
                      <motion.div 
                        layoutId="activeNav"
                        className="absolute inset-0 bg-gradient-to-r from-[#13487a] to-blue-600"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}

            <button
              onClick={() => {
                setIsProfileExpanded(!isProfileExpanded);
                navigate('/profile');
              }}
              className={cn(
                "flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 w-full mt-1 cursor-pointer group",
                (isProfileExpanded || location.pathname === '/profile') 
                  ? "bg-gradient-to-r from-[#13487a] to-blue-600 text-white shadow-lg shadow-blue-500/20" 
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-[#13487a] dark:hover:text-blue-400"
              )}
            >
              <div className="flex items-center gap-3">
                <UserCircle className={cn("h-5 w-5", (isProfileExpanded || location.pathname === '/profile') ? "text-white" : "text-slate-400 group-hover:text-[#13487a]")} />
                All Facebook Profiles
              </div>
              {isProfileExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pt-2 pb-4 px-6">
            <AnimatePresence>
              {isProfileExpanded && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="ml-4 space-y-1 border-l border-slate-200 dark:border-slate-800 pl-2 overflow-hidden"
                >
                  {Object.entries(accountsByCategory)
                    .filter(([category]) => category !== 'Foreign English Newspaper' && category !== 'Uncategorized')
                    .sort(([a], [b]) => {
                      const indexA = categories.indexOf(a);
                      const indexB = categories.indexOf(b);
                      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                      if (indexA !== -1) return -1;
                      if (indexB !== -1) return 1;
                      return a.localeCompare(b);
                    })
                    .map(([category, catAccounts]: [string, Account[]]) => (
                      <div key={category} className="space-y-1">
                        <button
                          onClick={() => {
                            navigate(`/profile?category=${encodeURIComponent(category)}`);
                            if (window.innerWidth < 768) setIsMobileMenuOpen(false);
                          }}
                          className={cn(
                            "flex items-center justify-between pl-3 pr-4 py-2 text-sm font-medium rounded-md transition-all duration-200 w-full text-left cursor-pointer",
                            currentCategory === category && location.pathname === '/profile'
                              ? "bg-[#13487a]/10 text-[#13487a] dark:text-[#13487a] shadow-sm font-bold"
                              : "text-slate-600 dark:text-slate-400 hover:bg-[#13487a] hover:text-white dark:hover:bg-[#13487a] dark:hover:text-white"
                          )}
                        >
                          <span className="truncate">{category}</span>
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-semibold",
                            currentCategory === category && location.pathname === '/profile'
                              ? "bg-[#13487a] text-white"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                          )}>
                            {catAccounts.length}
                          </span>
                        </button>
                      </div>
                    ))}
                  {accounts.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-slate-400 italic">No accounts added yet.</p>
                  ) : Object.keys(accountsByCategory).length === 0 && (
                    <p className="px-3 py-2 text-sm text-slate-400 italic">No categorized accounts found.</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
          <Outlet />
        </main>
      </div>
      
      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-4 px-6 text-center text-sm text-slate-500 dark:text-slate-400">
        &copy; {new Date().getFullYear()} Social Hub. All rights reserved.
      </footer>
    </div>
  );
}
