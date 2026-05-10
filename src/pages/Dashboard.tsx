import { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Users, Facebook, Youtube, Activity, PieChart as PieChartIcon, Download, FileJson, Sparkles, Clock, Newspaper, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../components/ui/button';
import Papa from 'papaparse';
import { toast } from 'sonner';

import { useCategories, DEFAULT_ACCOUNT_CATEGORIES, DEFAULT_NEWSPAPER_CATEGORIES } from '../hooks/useCategories';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  Legend
} from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState({
    total: 0,
    facebook: 0,
    youtube: 0,
    newspapers: 0,
  });
  const [categoryData, setCategoryData] = useState<{ name: string; value: number }[]>([]);
  const [recentAccounts, setRecentAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rawAccounts, setRawAccounts] = useState<any[]>([]);
  const [rawNewspapers, setRawNewspapers] = useState<any[]>([]);

  useEffect(() => {
    const qAccounts = query(collection(db, 'accounts'));
    const qNewspapers = query(collection(db, 'newspapers'));

    let accountsSnapshot: any = null;
    let newspapersSnapshot: any = null;

    const updateStats = () => {
      if (!accountsSnapshot || !newspapersSnapshot) return;

      let fbCount = 0;
      let ytCount = 0;
      const catMap: Record<string, number> = {};
      const allAccs: any[] = [];

      accountsSnapshot.docs.forEach((doc: any) => {
        const data = { id: doc.id, ...doc.data() };
        allAccs.push(data);
        if (data.platform === 'Facebook') fbCount++;
        if (data.platform === 'YouTube') ytCount++;
        
        const cat = data.category || 'Uncategorized';
        catMap[cat] = (catMap[cat] || 0) + 1;
      });

      setRawAccounts(allAccs);
      
      const allNews: any[] = [];
      newspapersSnapshot.docs.forEach((doc: any) => {
        allNews.push({ id: doc.id, ...doc.data() });
      });
      setRawNewspapers(allNews);
      
      // Get 5 most recent
      const sorted = [...allAccs].sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      }).slice(0, 5);
      setRecentAccounts(sorted);

      setStats({
        total: fbCount + ytCount,
        facebook: fbCount,
        youtube: ytCount,
        newspapers: newspapersSnapshot.docs.length,
      });

      const formattedCatData = Object.entries(catMap)
        .filter(([name]) => name !== 'Foreign English Newspaper' && name !== 'Uncategorized')
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

      setCategoryData(formattedCatData);
      setLoading(false);
    };

    const unsubAccounts = onSnapshot(qAccounts, (snapshot) => {
      accountsSnapshot = snapshot;
      updateStats();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'accounts');
    });

    const unsubNewspapers = onSnapshot(qNewspapers, (snapshot) => {
      newspapersSnapshot = snapshot;
      updateStats();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'newspapers');
    });

    return () => {
      unsubAccounts();
      unsubNewspapers();
    };
  }, []);

  const platformData = [
    { name: 'Facebook', value: stats.facebook, color: '#2563eb' },
    { name: 'YouTube', value: stats.youtube, color: '#dc2626' },
    { name: 'Newspapers', value: stats.newspapers, color: '#13487a' },
  ];

  const statCards = [
    { name: 'Newspapers', value: stats.newspapers, icon: Newspaper, color: 'text-[#13487a] dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-100 dark:border-blue-900/50' },
    { name: 'Facebook Pages', value: stats.facebook, icon: Facebook, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-100 dark:border-blue-900/50' },
    { name: 'YouTube Channels', value: stats.youtube, icon: Youtube, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', border: 'border-red-100 dark:border-red-900/50' },
  ];

  const exportToCSV = () => {
    if (rawAccounts.length === 0 && rawNewspapers.length === 0) {
      toast.error('No data to export');
      return;
    }

    // Sort accounts by category
    const sortedAccounts = [...rawAccounts].sort((a, b) => {
      const indexA = DEFAULT_ACCOUNT_CATEGORIES.indexOf(a.category || '');
      const indexB = DEFAULT_ACCOUNT_CATEGORIES.indexOf(b.category || '');
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return (a.category || '').localeCompare(b.category || '');
    });

    // Sort newspapers by category
    const sortedNewspapers = [...rawNewspapers].sort((a, b) => {
      const indexA = DEFAULT_NEWSPAPER_CATEGORIES.indexOf(a.category || '');
      const indexB = DEFAULT_NEWSPAPER_CATEGORIES.indexOf(b.category || '');
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return (a.category || '').localeCompare(b.category || '');
    });

    const accountData = sortedAccounts.map(acc => ({
      Type: 'Facebook/YouTube',
      Name: acc.name,
      URL: acc.url,
      Category: acc.category || 'Uncategorized',
      Platform: acc.platform || '',
      Notes: acc.notes || ''
    }));

    const newspaperData = sortedNewspapers.map(news => ({
      Type: 'Newspaper',
      Name: news.name,
      URL: news.url,
      Category: news.category || 'Uncategorized',
      Platform: 'Newspaper',
      Notes: ''
    }));

    const combinedData = [...accountData, ...newspaperData];
    const csv = Papa.unparse(combinedData);
    // Add UTF-8 BOM for Excel compatibility with Bengali characters
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `social_hub_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV Exported successfully');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full overflow-y-auto pt-4 sm:pt-6 lg:pt-8 pb-8 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 custom-scrollbar"
    >
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-3 mb-1">
              <Sparkles className="h-6 w-6 text-yellow-400 animate-pulse" />
              <h1 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-md">Intelligence Center</h1>
            </div>
            <p className="text-blue-100 dark:text-slate-400 drop-shadow">Advanced visual overview of your media assets.</p>
          </motion.div>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportToCSV}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 gap-2 backdrop-blur-sm"
            >
              <FileJson className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-xl bg-white/50 dark:bg-slate-800/50 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {statCards.map((stat, index) => (
              <motion.div 
                key={stat.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 + 0.2 }}
                className={`rounded-xl border ${stat.border} bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden group`}
              >
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <stat.icon className={`h-24 w-24 ${stat.color}`} />
                </div>
                <div className="flex items-center gap-4 relative z-10">
                  <div className={`p-3 rounded-lg ${stat.bg}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.name}</p>
                    <h3 className="text-3xl font-bold text-slate-900 dark:text-white font-mono tracking-tighter">{stat.value}</h3>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {!loading && (
          <div className="grid gap-6 lg:grid-cols-2">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="rounded-xl border border-blue-100 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-6 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <PieChartIcon className="h-5 w-5 text-[#13487a] dark:text-blue-400" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Platform Distribution</h2>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={platformData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {platformData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: '8px', 
                        border: 'none', 
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        color: '#1e293b'
                      }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="rounded-xl border border-blue-100 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-6 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Activity className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Top Categories</h2>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={100} 
                      fontSize={12} 
                      tick={{ fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(248, 250, 252, 0.1)' }}
                      contentStyle={{ 
                        borderRadius: '8px', 
                        border: 'none', 
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        color: '#1e293b'
                      }}
                    />
                    <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

          </div>
        )}
      </div>
    </motion.div>
  );
}
