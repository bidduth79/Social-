import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, where, getDocs, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { useCallback } from 'react';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Table, TableBody, TableCell, TableRow } from '../components/ui/table';
import { ExternalLink, Search, UserCircle, LayoutGrid, List, ShieldCheck, ClipboardPaste, Users } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useCategories } from '../hooks/useCategories';
import { useVisitedLinks } from '../hooks/useVisitedLinks';
import { Account } from './Accounts';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { compressImage } from '../lib/image-utils';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function Profile() {
  const navigate = useNavigate();
  const { categories } = useCategories();
  const { markAsVisited, isVisited, getVisitCount } = useVisitedLinks();
  const [accounts, setAccounts] = useState<Account[]>(() => {
    const cached = localStorage.getItem('cached_accounts');
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = localStorage.getItem('cached_accounts');
    return !cached;
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryQuery = searchParams.get('category');
  const [selectedCategory, setSelectedCategory] = useState(categoryQuery || 'All Categories');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    if (selectedIds.length === 0) return;
    
    // Don't trigger if user is typing in an input
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
      return;
    }

    const items = e.clipboardData?.items;
    if (!items) return;

    let imageData: string | null = null;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (!file) continue;

        if (file.size > 3 * 1024 * 1024) {
          toast.error('Pasted image size should be less than 3MB');
          return;
        }

        setIsUpdating(true);
        try {
          imageData = await compressImage(file);
        } catch (err) {
          console.error('Compression error:', err);
          const reader = new FileReader();
          imageData = await new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
        } finally {
          setIsUpdating(false);
        }
        break;
      }
    }

    if (!imageData) {
      const pastedText = e.clipboardData?.getData('text');
      if (pastedText && (pastedText.startsWith('http') || pastedText.startsWith('data:image'))) {
        const isLikelyImage = /\.(jpg|jpeg|png|webp|gif|svg|avif|bmp|ico|tiff)(\?.*)?$/i.test(pastedText) || 
                             pastedText.startsWith('data:image') ||
                             pastedText.includes('fbcdn.net') || 
                             pastedText.includes('googleusercontent.com') ||
                             pastedText.includes('yt3.ggpht.com') ||
                             pastedText.includes('images.unsplash.com') ||
                             pastedText.includes('cloudinary.com');

        if (isLikelyImage || pastedText.startsWith('http')) {
          setIsUpdating(true);
          try {
            imageData = await compressImage(pastedText);
          } catch (err) {
            if (isLikelyImage) {
              imageData = pastedText;
            }
          } finally {
            setIsUpdating(false);
          }
        }
      }
    }

    if (imageData) {
      setIsUpdating(true);
      const toastId = toast.loading(`Updating logo for ${selectedIds.length} accounts...`);
      try {
        const batch = writeBatch(db);
        selectedIds.forEach(id => {
          batch.update(doc(db, 'accounts', id), {
            thumbnail: imageData,
            updatedAt: serverTimestamp()
          });
        });
        await batch.commit();
        toast.success(`Logo updated for ${selectedIds.length} accounts`, { id: toastId });
        setSelectedIds([]); // Clear selection after bulk update
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'accounts');
        toast.error('Failed to update logos', { id: toastId });
      } finally {
        setIsUpdating(false);
      }
    }
  }, [selectedIds]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleCategorySelect = (categoryAccounts: Account[]) => {
    const categoryIds = categoryAccounts.map(a => a.id);
    const allSelected = categoryIds.every(id => selectedIds.includes(id));
    
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !categoryIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...categoryIds])]);
    }
  };

  const handleVisitSelected = () => {
    if (selectedIds.length === 0) return;
    
    const toVisit = selectedIds.slice(0, 15);
    if (selectedIds.length > 15) {
      toast.warning(`Opening first 15 links. Opening too many tabs can slow down your browser.`);
    }

    let openedCount = 0;
    toVisit.forEach((id, index) => {
      const account = accounts.find(acc => acc.id === id);
      if (account?.url) {
        // Use a slight delay for each tab to help bypass some popup blockers
        setTimeout(() => {
          const newWindow = window.open(account.url, '_blank');
          if (newWindow) {
            markAsVisited(id);
            openedCount++;
          } else if (index === 0) {
            toast.error("Pop-ups are blocked! Please allow pop-ups for this site to open multiple links.");
          }
        }, index * 300); // 300ms delay between each tab
      }
    });
    
    toast.success(`Attempting to open ${toVisit.length} links...`);
    setSelectedIds([]);
  };

  useEffect(() => {
    if (!auth.currentUser || loading || accounts.length === 0 || categories.length === 0) return;

    const syncCategories = async () => {
      const legacyMapping: Record<string, string> = {
        'EX BDR': 'BDR'
      };

      const batch = writeBatch(db);
      let hasChanges = false;

      accounts.forEach(account => {
        if (legacyMapping[account.category] && categories.includes(legacyMapping[account.category])) {
          const accountRef = doc(db, 'accounts', account.id);
          batch.update(accountRef, { category: legacyMapping[account.category] });
          hasChanges = true;
        }
      });

      if (hasChanges) {
        try {
          await batch.commit();
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'accounts');
        }
      }
    };

    syncCategories();
  }, [accounts, categories, loading]);

  const allCategories = useMemo(() => {
    const uniqueCategories = new Set(categories);
    accounts.forEach(acc => {
      if (acc.category) uniqueCategories.add(acc.category);
    });

    return Array.from(uniqueCategories).sort((a, b) => {
      const indexA = categories.indexOf(a);
      const indexB = categories.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [categories, accounts]);

  useEffect(() => {
    if (categoryQuery && allCategories.includes(categoryQuery)) {
      setSelectedCategory(categoryQuery);
    } else if (!categoryQuery) {
      setSelectedCategory('All Categories');
    }
  }, [categoryQuery, allCategories]);

  const handleCategoryChange = (val: string) => {
    setSelectedCategory(val);
    if (val === 'All Categories') {
      searchParams.delete('category');
    } else {
      searchParams.set('category', val);
    }
    setSearchParams(searchParams);
  };

  useEffect(() => {
    const q = query(collection(db, 'accounts'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Account[];
      
      data.sort((a, b) => {
        const orderA = a.order ?? 0;
        const orderB = b.order ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        const timeA = typeof a.createdAt?.toMillis === 'function' ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const timeB = typeof b.createdAt?.toMillis === 'function' ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return timeB - timeA;
      });
      
      setAccounts(data);
      localStorage.setItem('cached_accounts', JSON.stringify(data));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'accounts');
    });

    return () => unsubscribe();
  }, []);

  const filteredAccounts = useMemo(() => {
    let filtered = accounts;
    if (selectedCategory !== 'All Categories') {
      filtered = filtered.filter(acc => acc.category === selectedCategory);
    }
    if (searchTerm) {
      filtered = filtered.filter(acc => 
        acc.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        acc.url.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return filtered;
  }, [accounts, selectedCategory, searchTerm]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Fixed Header Section */}
      <div className="flex-none bg-white/80 dark:bg-slate-900/80 backdrop-blur-md pt-2 sm:pt-3 lg:pt-4 pb-2 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 border-b border-blue-100/50 dark:border-slate-800 shadow-sm z-20">
        <div className="max-w-6xl mx-auto space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
            <div className="text-center sm:text-left">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#13487a] to-blue-600">
                {auth.currentUser?.isAnonymous ? 'Profile' : `${auth.currentUser?.displayName}'s Profile`}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0">
                {auth.currentUser?.isAnonymous ? 'View your saved social media links.' : `Signed in as ${auth.currentUser?.email}`}
              </p>
            </div>
            <div className="flex items-center justify-center sm:justify-end gap-2">
              <Button
                onClick={() => navigate('/accounts')}
                className="bg-gradient-to-r from-[#13487a] to-blue-600 hover:from-blue-700 hover:to-[#13487a] text-white gap-2 shadow-lg shadow-blue-500/20 h-9 px-4 font-bold border-none transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <Users className="h-4 w-4" />
                Edit
              </Button>
              <AnimatePresence>
                {selectedIds.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center gap-2"
                  >
                    <Button 
                      onClick={handleVisitSelected}
                      className="bg-[#13487a] hover:bg-[#13487a]/90 text-white gap-2 shadow-md h-8"
                      size="sm"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Visit ({selectedIds.length})
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button 
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-[#13487a] dark:text-[#13487a] shadow-sm' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                >
                  <List className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-[#13487a] dark:text-[#13487a] shadow-sm' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#13487a]/60" />
              <Input 
                placeholder="Search by name or URL..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 border-blue-100 dark:border-slate-800 focus-visible:ring-[#13487a] bg-white/50 dark:bg-slate-900/50 dark:text-white"
              />
            </div>
            <div className="w-full sm:w-64">
              <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                <SelectTrigger className="border-blue-100 dark:border-slate-800 focus:ring-[#13487a] bg-white/50 dark:bg-slate-900/50 dark:text-white">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                  <SelectItem value="All Categories">All Categories</SelectItem>
                  {allCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content Section */}
      <div className="flex-1 overflow-y-auto py-6 px-4 sm:px-6 lg:px-8 -mx-4 sm:-mx-6 lg:-mx-8 scroll-smooth">
        <div className="max-w-6xl mx-auto w-full pb-8">
          {loading ? (
            <div className="text-center py-20 text-slate-500 dark:text-slate-400 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl border border-blue-100 dark:border-slate-800 shadow-sm">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="inline-block mb-4"
              >
                <Search className="h-8 w-8 text-[#13487a]" />
              </motion.div>
              <p>Loading links...</p>
            </div>
          ) : filteredAccounts.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-20 text-slate-500 dark:text-slate-400 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl border border-blue-100 dark:border-slate-800 shadow-sm"
            >
              <UserCircle className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
              <p className="text-lg font-medium">No links found</p>
              <p className="text-sm">{categoryQuery ? `Nothing saved in ${categoryQuery}` : 'Start by adding some links in the All Links page'}.</p>
            </motion.div>
          ) : (
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-8"
            >
              {allCategories
                .filter(category => selectedCategory === 'All Categories' || category === selectedCategory)
                .map(category => {
                  const categoryAccounts = filteredAccounts.filter(acc => acc.category === category);
                  if (categoryAccounts.length === 0) return null;
                  
                  return (
                    <motion.div 
                      key={category} 
                      variants={itemVariants}
                      className="rounded-xl border border-blue-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"
                    >
                      <div className="bg-blue-50/80 dark:bg-blue-900/20 px-6 py-3 border-b border-blue-100 dark:border-slate-800 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-[#13487a] dark:text-blue-400">{category}</h2>
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 cursor-pointer flex items-center gap-2">
                            <input 
                              type="checkbox"
                              checked={categoryAccounts.every(id => selectedIds.includes(id.id))}
                              onChange={() => handleToggleCategorySelect(categoryAccounts)}
                              className="w-4 h-4 rounded border-slate-300 text-[#13487a] focus:ring-[#13487a] cursor-pointer"
                            />
                            Select All
                          </label>
                        </div>
                      </div>
                      
                      {viewMode === 'list' ? (
                        <Table>
                          <TableBody>
                            {categoryAccounts.map((account) => (
                              <TableRow 
                                key={account.id} 
                                className={cn(
                                  "group transition-colors hover:bg-[#13487a] hover:text-white dark:hover:bg-blue-800",
                                  selectedIds.includes(account.id) && "bg-blue-50/50 dark:bg-blue-900/20"
                                )}
                              >
                                <TableCell className="w-10 pl-6 pr-0">
                                  <input 
                                    type="checkbox"
                                    checked={selectedIds.includes(account.id)}
                                    onChange={() => handleToggleSelect(account.id)}
                                    className="w-4 h-4 rounded border-slate-300 text-[#13487a] focus:ring-[#13487a] cursor-pointer group-hover:border-white/50"
                                  />
                                </TableCell>
                                <TableCell className="w-12 px-2">
                                  <div className="h-10 w-10 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 overflow-hidden flex items-center justify-center group-hover:border-white/30">
                                    {account.thumbnail ? (
                                      <img 
                                        src={account.thumbnail} 
                                        alt="" 
                                        className="h-full w-full object-cover"
                                        referrerPolicy="no-referrer"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = 'none';
                                          target.parentElement!.innerHTML = `<div class="text-[10px] font-bold text-slate-400">${account.name.charAt(0)}</div>`;
                                        }}
                                      />
                                    ) : (
                                      <div className="text-xs font-bold text-slate-400 group-hover:text-white/50">
                                        {account.name.charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium px-6 py-4">
                                  <div className="flex flex-col">
                                    <a 
                                      href={account.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      onClick={() => markAsVisited(account.id)}
                                      className={cn(
                                        "group-hover:text-white hover:underline inline-flex items-center gap-2 transition-colors text-base",
                                        isVisited(account.id) ? "text-slate-400" : "text-[#13487a] dark:text-blue-400"
                                      )}
                                    >
                                      {account.name}
                                      {getVisitCount(account.id) > 0 && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-[#13487a] dark:text-blue-400 group-hover:bg-white/20 group-hover:text-white transition-colors">
                                          {getVisitCount(account.id)}
                                        </span>
                                      )}
                                      <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </a>
                                    {account.notes && (
                                      <p className="text-sm text-slate-500 dark:text-slate-400 group-hover:text-blue-100 font-normal mt-1 truncate max-w-2xl">
                                        {account.notes}
                                      </p>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                          {categoryAccounts.map((account) => (
                            <div key={account.id} className="relative group">
                              <div className="absolute top-3 left-3 z-10">
                                <input 
                                  type="checkbox"
                                  checked={selectedIds.includes(account.id)}
                                  onChange={() => handleToggleSelect(account.id)}
                                  className="w-4 h-4 rounded border-slate-300 text-[#13487a] focus:ring-[#13487a] cursor-pointer"
                                />
                              </div>
                              <motion.a
                                href={account.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => markAsVisited(account.id)}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className={cn(
                                  "flex flex-col p-4 pl-10 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-[#1e4b7a] hover:text-white transition-all h-full",
                                  selectedIds.includes(account.id) ? "bg-blue-50 dark:bg-blue-900/40 border-blue-200" : (isVisited(account.id) ? "bg-slate-100/30 dark:bg-slate-800/30" : "bg-slate-50/50 dark:bg-slate-800/50")
                                )}
                              >
                                <div className="flex items-center gap-3 mb-2">
                                  <div className="h-10 w-10 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 overflow-hidden flex items-center justify-center shrink-0 group-hover:border-white/30">
                                    {account.thumbnail ? (
                                      <img 
                                        src={account.thumbnail} 
                                        alt="" 
                                        className="h-full w-full object-cover"
                                        referrerPolicy="no-referrer"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = 'none';
                                          target.parentElement!.innerHTML = `<div class="text-[10px] font-bold text-slate-400">${account.name.charAt(0)}</div>`;
                                        }}
                                      />
                                    ) : (
                                      <div className="text-xs font-bold text-slate-400 group-hover:text-white/50">
                                        {account.name.charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className={cn(
                                        "font-bold truncate group-hover:text-white flex items-center gap-2",
                                        isVisited(account.id) ? "text-slate-400" : "text-[#13487a] dark:text-blue-300"
                                      )}>
                                        {account.name}
                                        {getVisitCount(account.id) > 0 && (
                                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-[#13487a] dark:text-blue-400 group-hover:bg-white/20 group-hover:text-white transition-colors">
                                            {getVisitCount(account.id)}
                                          </span>
                                        )}
                                      </span>
                                      <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-white shrink-0" />
                                    </div>
                                  </div>
                                </div>
                                {account.notes && (
                                  <p className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-blue-100 line-clamp-2">
                                    {account.notes}
                                  </p>
                                )}
                              </motion.a>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
