import { useState, useEffect, useCallback } from 'react';
import { 
  Search, ExternalLink, Calendar, History, Trash2, Clock, Facebook, Info, 
  ChevronRight, LayoutGrid, MousePointer2, MapPin, Video, Image, Link as LinkIcon,
  User, Users, Globe, Twitter, Instagram, Youtube, Save, Plus, X as CloseIcon,
  ChevronDown, ChevronUp, Layers, ListChecks, Tag, X, Music, GripVertical, Sparkles, Zap, Bot, Loader2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { generateSearchQuery, getRelatedKeywords } from '../services/geminiService';

// Firebase imports
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';

// dnd-kit imports
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SearchHistoryItem {
  id: string;
  keyword: string;
  date: string;
  filters?: Record<string, string>;
  timestamp: number;
}

interface SearchTemplate {
  id: string;
  name: string;
  keyword: string;
  location: string;
  postType: string;
  source: string;
}

const SEARCH_HISTORY_KEY = 'fb_search_history_v2';
const SEARCH_TEMPLATES_KEY = 'fb_search_templates';
const SEARCH_KEYWORDS_KEY = 'fb_search_keywords';

export default function SearchTool() {
  const [activeTab, setActiveTab] = useState<'custom' | 'iframe' | 'batch'>('custom');
  const [keyword, setKeyword] = useState('');
  const [batchKeywords, setBatchKeywords] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState('');
  const [postType, setPostType] = useState('all');
  const [source, setSource] = useState('all');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [history, setHistory] = useState<SearchHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Error parsing search history:", e);
      return [];
    }
  });

  const [templates, setTemplates] = useState<SearchTemplate[]>(() => {
    try {
      const saved = localStorage.getItem(SEARCH_TEMPLATES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Error parsing search templates:", e);
      return [];
    }
  });

  const [savedKeywords, setSavedKeywords] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(SEARCH_KEYWORDS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Error parsing search keywords:", e);
      return [];
    }
  });

  const [newKeywordInput, setNewKeywordInput] = useState('');

  const [showHistory, setShowHistory] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true); // Default to true until first check is done
  const [hasInitialLoaded, setHasInitialLoaded] = useState(false);
  
  const [aiSearchInput, setAiSearchInput] = useState('');
  const [aiSearchLoading, setAiSearchLoading] = useState(false);
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  
  const [relatedKeywords, setRelatedKeywords] = useState<string[]>([]);
  const [isFetchingRelated, setIsFetchingRelated] = useState(false);

  // Sync with Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsSyncing(true);
        try {
          const userSettingsRef = doc(db, 'userSettings', user.uid);
          const userSettingsSnap = await getDoc(userSettingsRef);
          
          if (userSettingsSnap.exists()) {
            const data = userSettingsSnap.data();
            if (data.quickKeywords && Array.isArray(data.quickKeywords)) {
              // Only update if different to avoid infinite loop
              setSavedKeywords(prev => {
                if (JSON.stringify(prev) !== JSON.stringify(data.quickKeywords)) {
                  return data.quickKeywords;
                }
                return prev;
              });
            }
          }
        } catch (error) {
          console.error("Error fetching keywords from Firestore:", error);
        } finally {
          setIsSyncing(false);
          setHasInitialLoaded(true);
        }
      } else {
        setIsSyncing(false);
        setHasInitialLoaded(true);
      }
    });

    return () => unsubscribe();
  }, []);

  const saveToFirestore = useCallback(async (keywords: string[]) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const userSettingsRef = doc(db, 'userSettings', user.uid);
      const userSettingsSnap = await getDoc(userSettingsRef);
      
      if (userSettingsSnap.exists()) {
        await updateDoc(userSettingsRef, {
          quickKeywords: keywords,
          updatedAt: serverTimestamp()
        });
      } else {
        await setDoc(userSettingsRef, {
          quickKeywords: keywords,
          authorUid: user.uid,
          updatedAt: serverTimestamp(),
          categories: []
        });
      }
    } catch (error) {
      console.error("Error saving keywords to Firestore:", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(SEARCH_TEMPLATES_KEY, JSON.stringify(templates));
  }, [templates]);

  useEffect(() => {
    localStorage.setItem(SEARCH_KEYWORDS_KEY, JSON.stringify(savedKeywords));
    if (!isSyncing && hasInitialLoaded) {
      saveToFirestore(savedKeywords);
    }
  }, [savedKeywords, isSyncing, hasInitialLoaded, saveToFirestore]);

  const constructFBUrl = (k: string, d: string, loc?: string, pType?: string, src?: string) => {
    const filterObj: any = {};
    
    // 1. Date Filter
    if (d) {
      const [year, month, day] = d.split('-');
      const dateArgs = {
        start_year: year,
        start_month: `${year}-${month}`,
        end_month: `${year}-${month}`,
        start_day: `${year}-${month}-${day}`,
        end_day: `${year}-${month}-${day}`,
        recent: true
      };

      filterObj["rp_creation_time:0"] = JSON.stringify({
        "name": "creation_time",
        "args": JSON.stringify(dateArgs)
      });
    }

    // 2. Post Type Filter
    if (pType && pType !== 'all') {
      const typeMap: Record<string, string> = {
        'video': 'posts_video',
        'photo': 'posts_photo',
        'link': 'posts_links'
      };
      
      filterObj["rp_post_type:0"] = JSON.stringify({
        "name": "post_type",
        "args": typeMap[pType] || pType
      });
    }

    // 3. Source/Author Type Filter
    if (src && src !== 'all') {
      // Facebook expects 'group' (singular) for the groups filter
      const sourceValue = src === 'groups' ? 'group' : src;
      filterObj["interactor:0"] = JSON.stringify({
        "name": "interactor",
        "args": sourceValue
      });
    }

    let finalKeyword = k.trim();
    if (loc && loc.trim()) {
      finalKeyword += ` ${loc.trim()}`;
    }

    if (Object.keys(filterObj).length === 0) {
      return `https://www.facebook.com/search/posts/?q=${encodeURIComponent(finalKeyword)}`;
    }

    // Standard Base64 encoding for the filter object
    const jsonStr = JSON.stringify(filterObj);
    // Use a robust Base64 encoding that handles special characters
    const encodedFilter = btoa(unescape(encodeURIComponent(jsonStr)));
    
    return `https://www.facebook.com/search/posts/?q=${encodeURIComponent(finalKeyword)}&filters=${encodeURIComponent(encodedFilter)}`;
  };

  const handleSearch = (e?: React.FormEvent, searchKeyword?: string, searchDate?: string) => {
    if (e) e.preventDefault();
    
    const k = searchKeyword || keyword;
    const d = searchDate || date;

    if (!k.trim()) {
      toast.error('Please enter a keyword');
      return;
    }

    const url = constructFBUrl(k, d, location, postType, source);
    window.open(url, '_blank');

    // Add to history
    const newItem: SearchHistoryItem = {
      id: Math.random().toString(36).substr(2, 9),
      keyword: k.trim(),
      date: d,
      filters: { location, postType, source },
      timestamp: Date.now()
    };
    setHistory(prev => [newItem, ...prev.filter(h => h.keyword !== k.trim() || h.date !== d)].slice(0, 15));
  };

  const handleBatchSearch = () => {
    const keywords = batchKeywords.split('\n').map(k => k.trim()).filter(k => k);
    if (keywords.length === 0) {
      toast.error('Please enter at least one keyword');
      return;
    }

    if (keywords.length > 10) {
      toast.warning('Opening too many tabs might slow down your browser. Limiting to 10.');
    }

    keywords.slice(0, 10).forEach(k => {
      const url = constructFBUrl(k, date, location, postType, source);
      window.open(url, '_blank');
    });

    toast.success(`Opened ${Math.min(keywords.length, 10)} search tabs`);
  };

  const handleOtherPlatform = (platform: 'x' | 'ig' | 'yt' | 'tiktok') => {
    if (!keyword.trim()) {
      toast.error('Please enter a keyword first');
      return;
    }
    
    let url = '';
    const k = encodeURIComponent(keyword.trim());
    
    switch(platform) {
      case 'x': url = `https://x.com/search?q=${k}&f=live`; break;
      case 'ig': url = `https://www.instagram.com/explore/tags/${k.replace(/%20/g, '')}/`; break;
      case 'yt': url = `https://www.youtube.com/results?search_query=${k}&sp=CAI%253D`; break;
      case 'tiktok': url = `https://www.tiktok.com/search?q=${k}&type=video&sort_type=1`; break;
    }
    
    window.open(url, '_blank');
  };

  const fetchRelatedKeywords = async (k: string) => {
    if (!k || k.length < 3) {
      setRelatedKeywords([]);
      return;
    }
    setIsFetchingRelated(true);
    try {
      const suggestions = await getRelatedKeywords(k);
      setRelatedKeywords(suggestions);
    } catch (error) {
      console.error(error);
    } finally {
      setIsFetchingRelated(false);
    }
  };

  // Debounce related keywords fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      if (keyword.trim()) {
        fetchRelatedKeywords(keyword);
      } else {
        setRelatedKeywords([]);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [keyword]);

  const saveTemplate = () => {
    if (!keyword.trim()) {
      toast.error('Enter a keyword to save as template');
      return;
    }
    const name = prompt('Enter a name for this template:');
    if (!name) return;

    const newTemplate: SearchTemplate = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      keyword,
      location,
      postType,
      source
    };
    setTemplates(prev => [...prev, newTemplate]);
    toast.success('Template saved');
  };

  const applyTemplate = (t: SearchTemplate) => {
    setKeyword(t.keyword);
    setLocation(t.location);
    setPostType(t.postType);
    setSource(t.source);
    toast.success(`Applied template: ${t.name}`);
  };

  const deleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast.success('Template deleted');
  };

  const addSavedKeyword = () => {
    const k = newKeywordInput.trim();
    if (!k) return;
    if (savedKeywords.includes(k)) {
      toast.error('Keyword already exists');
      return;
    }
    setSavedKeywords(prev => [...prev, k]);
    setNewKeywordInput('');
    toast.success('Keyword added');
  };

  const removeSavedKeyword = (k: string) => {
    setSavedKeywords(prev => prev.filter(item => item !== k));
    toast.success('Keyword removed');
  };

  const resetFilters = () => {
    setKeyword('');
    setDate(new Date().toISOString().split('T')[0]);
    setLocation('');
    setPostType('all');
    setSource('all');
    toast.success('Filters reset');
  };

  const clearDate = () => {
    setDate('');
    toast.success('Date filter cleared');
  };

  const clearHistory = () => {
    setHistory([]);
    toast.success('Search history cleared');
  };

  const setQuickDate = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    setDate(d.toISOString().split('T')[0]);
  };

  const handleAiQuery = async () => {
    if (!aiSearchInput.trim()) {
      toast.error('Please describe what you are looking for');
      return;
    }
    setAiSearchLoading(true);
    try {
      const refinedQuery = await generateSearchQuery(aiSearchInput);
      setKeyword(refinedQuery);
      setAiSearchInput('');
      setShowAiAssistant(false);
      toast.success('AI refined your search query');
    } catch (error) {
      toast.error('Failed to generate AI query');
    } finally {
      setAiSearchLoading(false);
    }
  };

  const handleIntelBlast = () => {
    if (!keyword.trim()) {
      toast.error('Enter a keyword to blast across platforms');
      return;
    }
    const platforms: ('x' | 'ig' | 'yt' | 'tiktok')[] = ['x', 'yt', 'tiktok'];
    platforms.forEach(p => handleOtherPlatform(p));
    handleSearch(); // Also open Facebook
    toast.success('Blasting search across all platforms!');
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required before drag starts to allow clicks
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setSavedKeywords((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const SortableKeyword = ({ k, onSelect, onRemove }: { k: string, onSelect: (k: string) => void, onRemove: (k: string) => void }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging
    } = useSortable({ id: k });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: isDragging ? 50 : 0,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div 
        ref={setNodeRef} 
        style={style}
        className="relative flex items-center"
      >
        <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm hover:border-[#13487a] transition-colors group">
          <div 
            {...attributes} 
            {...listeners}
            className="cursor-grab active:cursor-grabbing px-1.5 py-1.5 bg-slate-50 dark:bg-slate-900 border-r border-slate-100 dark:border-slate-700 text-slate-300 group-hover:text-slate-500 transition-colors"
          >
            <GripVertical className="h-3 w-3" />
          </div>
          <button
            onClick={() => onSelect(k)}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-[#13487a] hover:text-white transition-all"
          >
            {k}
          </button>
          <button 
            onClick={() => onRemove(k)}
            className="p-1.5 text-slate-300 hover:text-red-500 transition-colors border-l border-slate-100 dark:border-slate-700"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  };

  const renderQuickKeywords = (onSelect: (k: string) => void) => (
    <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-[#13487a]" />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Quick Keywords</span>
        </div>
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Add new..." 
            value={newKeywordInput}
            onChange={(e) => setNewKeywordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSavedKeyword()}
            className="px-3 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:border-[#13487a]"
          />
          <Button size="sm" variant="ghost" onClick={addSavedKeyword} className="h-7 w-7 p-0 rounded-lg bg-[#13487a] text-white hover:bg-[#13487a]/90">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={savedKeywords}
          strategy={rectSortingStrategy}
        >
          <div className="flex flex-wrap gap-2">
            {savedKeywords.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">No quick keywords added yet.</p>
            ) : (
              savedKeywords.map((k) => (
                <SortableKeyword 
                  key={k} 
                  k={k} 
                  onSelect={onSelect} 
                  onRemove={removeSavedKeyword} 
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );

  return (
    <div className="h-full flex flex-col space-y-4 max-w-6xl mx-auto w-full">
      {/* Header & Tab Switcher */}
      <div className="flex-none flex flex-col lg:flex-row items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-white/20 dark:border-slate-800 shadow-sm gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-600 to-[#13487a] p-2.5 rounded-xl shadow-lg">
            <Facebook className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Power Search Pro</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Advanced Social Intelligence Tool</p>
          </div>
        </div>

        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('custom')}
            className={cn(
              "px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 whitespace-nowrap",
              activeTab === 'custom' 
                ? "bg-white dark:bg-slate-700 text-[#13487a] dark:text-[#13487a] shadow-sm" 
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            Custom Tool
          </button>
          <button
            onClick={() => setActiveTab('batch')}
            className={cn(
              "px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 whitespace-nowrap",
              activeTab === 'batch' 
                ? "bg-white dark:bg-slate-700 text-[#13487a] dark:text-[#13487a] shadow-sm" 
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            <ListChecks className="h-4 w-4" />
            Batch Search
          </button>
          <button
            onClick={() => setActiveTab('iframe')}
            className={cn(
              "px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 whitespace-nowrap",
              activeTab === 'iframe' 
                ? "bg-white dark:bg-slate-700 text-[#13487a] dark:text-[#13487a] shadow-sm" 
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            <MousePointer2 className="h-4 w-4" />
            Iframe View
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
        <AnimatePresence mode="wait">
          {activeTab === 'custom' || activeTab === 'batch' ? (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 pb-8"
            >
              {/* Search Card */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 lg:p-8 shadow-xl shadow-[#13487a]/5">
                <div className="max-w-3xl mx-auto space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                          {activeTab === 'custom' ? 'Advanced Discovery' : 'Batch Discovery'}
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">
                          {activeTab === 'custom' ? 'Precision search with deep filters' : 'Search multiple keywords at once'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-end">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setShowAiAssistant(!showAiAssistant)}
                          className={cn(
                            "gap-2 rounded-xl border border-indigo-100 dark:border-indigo-900/30 font-bold transition-all",
                            showAiAssistant ? "bg-indigo-600 text-white hover:bg-indigo-700" : "text-indigo-600 hover:bg-indigo-50"
                          )}
                        >
                          <Bot className="h-4 w-4" />
                          AI Assistant
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={resetFilters}
                          className="text-slate-500 gap-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Trash2 className="h-4 w-4" />
                          Reset
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={saveTemplate}
                          className="text-[#13487a] dark:text-[#13487a] gap-2 hover:bg-[#13487a]/10 dark:hover:bg-[#13487a]/20 font-bold"
                        >
                          <Save className="h-4 w-4" />
                          Save Template
                        </Button>
                      </div>
                    </div>

                  {/* AI Search Assistant Block */}
                  <AnimatePresence>
                    {showAiAssistant && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: -10 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -10 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 space-y-3">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-indigo-600" />
                            <span className="text-sm font-bold text-indigo-900 dark:text-indigo-300">Tell AI what to find...</span>
                          </div>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              placeholder="e.g. 'খুলনায় অগ্নিকাণ্ডের খবর গত ৩ দিনের'..." 
                              value={aiSearchInput}
                              onChange={(e) => setAiSearchInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleAiQuery()}
                              className="flex-1 px-4 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                            <Button 
                              onClick={handleAiQuery}
                              disabled={aiSearchLoading}
                              className="bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl px-4"
                            >
                              {aiSearchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refine Query'}
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-6">
                    {activeTab === 'custom' ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Keyword(s)</label>
                          <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-[#13487a] transition-colors" />
                            <input 
                              type="text" 
                              placeholder="e.g. 'technology' AND 'future' NOT 'crypto'..." 
                              value={keyword}
                              onChange={(e) => setKeyword(e.target.value)}
                              className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-4 focus:ring-[#13487a]/10 focus:border-[#13487a] outline-none transition-all text-lg"
                            />
                          </div>
                          
                          {/* Related Keywords Suggestions */}
                          <AnimatePresence>
                            {relatedKeywords.length > 0 && (
                              <motion.div 
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                className="flex flex-wrap gap-2 mt-2 ml-1"
                              >
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 w-full">Related Keywords:</span>
                                {relatedKeywords.map((rk, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => setKeyword(rk)}
                                    className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-[10px] sm:text-xs font-semibold border border-indigo-100 dark:border-indigo-800/30 hover:bg-indigo-100 transition-colors"
                                  >
                                    + {rk}
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                          <p className="text-[10px] text-slate-400 ml-2">Tip: Use AND, OR, NOT for boolean search logic</p>
                        </div>

                        {renderQuickKeywords((k) => setKeyword(k))}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Keywords (One per line)</label>
                          <textarea 
                            placeholder="Enter multiple keywords here..." 
                            value={batchKeywords}
                            onChange={(e) => setBatchKeywords(e.target.value)}
                            rows={4}
                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-4 focus:ring-[#13487a]/10 focus:border-[#13487a] outline-none transition-all text-base resize-none"
                          />
                        </div>

                        {renderQuickKeywords((k) => {
                          setBatchKeywords(prev => {
                            const lines = prev.split('\n').map(l => l.trim()).filter(l => l);
                            if (lines.includes(k)) return prev;
                            return prev ? `${prev}\n${k}` : k;
                          });
                        })}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1 flex items-center justify-between">
                          <span className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Date</span>
                          {date && (
                            <button onClick={clearDate} className="text-[10px] text-red-500 hover:underline">Clear</button>
                          )}
                        </label>
                        <input 
                          type="date" 
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#13487a] outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1 flex items-center gap-2">
                          <MapPin className="h-4 w-4" /> Location (Optional)
                        </label>
                        <input 
                          type="text" 
                          placeholder="City, Country..." 
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#13487a] outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <button 
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-[#13487a] transition-colors"
                      >
                        {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        Advanced Filters
                      </button>
                      
                      <AnimatePresence>
                        {showAdvanced && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Post Type</label>
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { id: 'all', label: 'All Posts', icon: Globe },
                                    { id: 'video', label: 'Videos', icon: Video },
                                    { id: 'photo', label: 'Photos', icon: Image },
                                    { id: 'link', label: 'Links', icon: LinkIcon },
                                  ].map(t => (
                                    <button
                                      key={t.id}
                                      type="button"
                                      onClick={() => setPostType(t.id)}
                                      className={cn(
                                        "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all",
                                        postType === t.id 
                                          ? "bg-[#13487a] border-[#13487a] text-white shadow-md" 
                                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-[#13487a]/30"
                                      )}
                                    >
                                      <t.icon className="h-3.5 w-3.5" />
                                      {t.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Source</label>
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { id: 'all', label: 'Anywhere', icon: Globe },
                                    { id: 'public', label: 'Public Only', icon: Users },
                                    { id: 'friends', label: 'Friends', icon: User },
                                    { id: 'groups', label: 'Groups', icon: Layers },
                                  ].map(s => (
                                    <button
                                      key={s.id}
                                      type="button"
                                      onClick={() => setSource(s.id)}
                                      className={cn(
                                        "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all",
                                        source === s.id 
                                          ? "bg-[#13487a] border-[#13487a] text-white shadow-md" 
                                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-[#13487a]/30"
                                      )}
                                    >
                                      <s.icon className="h-3.5 w-3.5" />
                                      {s.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-center">
                      <Button type="button" variant="outline" size="sm" onClick={() => setQuickDate(0)} className="rounded-full px-4">Today</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setQuickDate(1)} className="rounded-full px-4">Yesterday</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setQuickDate(7)} className="rounded-full px-4">7 Days Ago</Button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                      <Button 
                        onClick={activeTab === 'custom' ? () => handleSearch() : handleBatchSearch}
                        className="py-4 rounded-xl bg-[#13487a] hover:bg-[#13487a]/90 text-white text-xs sm:text-sm font-bold shadow-lg shadow-[#13487a]/20 transition-all hover:scale-[1.01] active:scale-[0.99] gap-2"
                      >
                        <Facebook className="h-4 w-4" />
                        <span className="truncate">{activeTab === 'custom' ? 'Facebook' : 'Batch FB'}</span>
                      </Button>
                      
                      {activeTab === 'custom' && (
                        <>
                          <Button 
                            onClick={() => handleOtherPlatform('yt')} 
                            className="py-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-bold shadow-lg shadow-red-600/20 transition-all hover:scale-[1.01] active:scale-[0.99] gap-2"
                          >
                            <Youtube className="h-4 w-4" />
                            <span className="truncate">YouTube</span>
                          </Button>
                          <Button 
                            onClick={() => handleOtherPlatform('x')} 
                            className="py-4 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs sm:text-sm font-bold shadow-lg shadow-sky-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] gap-2"
                          >
                            <Twitter className="h-4 w-4" />
                            <span className="truncate">Twitter</span>
                          </Button>
                          <Button 
                            onClick={() => handleOtherPlatform('tiktok')} 
                            className="py-4 rounded-xl bg-black hover:bg-slate-900 text-white text-xs sm:text-sm font-bold shadow-lg shadow-black/20 transition-all hover:scale-[1.01] active:scale-[0.99] gap-2"
                          >
                            <Music className="h-4 w-4" />
                            <span className="truncate">TikTok</span>
                          </Button>
                          <Button 
                            onClick={() => handleOtherPlatform('ig')} 
                            className="py-4 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs sm:text-sm font-bold shadow-lg shadow-pink-600/20 transition-all hover:scale-[1.01] active:scale-[0.99] gap-2"
                          >
                            <Instagram className="h-4 w-4" />
                            <span className="truncate">Instagram</span>
                          </Button>
                          
                          <Button 
                            onClick={handleIntelBlast}
                            className="py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs sm:text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.05] border-none gap-2 col-span-2 sm:col-span-1"
                          >
                            <Zap className="h-4 w-4 text-yellow-300" />
                            <span className="truncate uppercase tracking-tighter">Intel Blast</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Templates Section */}
              {templates.length > 0 && (
                <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
                  <div className="flex items-center gap-2 mb-4 px-2">
                    <Save className="h-5 w-5 text-[#13487a]" />
                    <h3 className="font-bold text-slate-900 dark:text-white">Saved Templates</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {templates.map((t) => (
                      <div key={t.id} className="group relative">
                        <button
                          onClick={() => applyTemplate(t)}
                          className="w-full flex flex-col p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-[#13487a] dark:hover:border-[#13487a] transition-all text-left shadow-sm"
                        >
                          <p className="font-bold text-slate-900 dark:text-white truncate">{t.name}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate italic">"{t.keyword}"</p>
                        </button>
                        <button 
                          onClick={() => deleteTemplate(t.id)}
                          className="absolute top-2 right-2 p-1.5 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* History Section */}
              {history.length > 0 && (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <Button
                      onClick={() => setShowHistory(!showHistory)}
                      variant="outline"
                      className={cn(
                        "rounded-full px-8 py-6 gap-3 border-2 transition-all shadow-lg",
                        showHistory 
                          ? "bg-[#13487a] text-white border-[#13487a] hover:bg-[#13487a]/90" 
                          : "bg-white dark:bg-slate-900 text-[#13487a] border-[#13487a] hover:bg-[#13487a]/5"
                      )}
                    >
                      <History className={cn("h-5 w-5 transition-transform duration-300", showHistory && "rotate-180")} />
                      <span className="text-lg font-bold">Recent Activity</span>
                      {showHistory ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </Button>
                  </div>

                  <AnimatePresence>
                    {showHistory && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: -20 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -20 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-slate-400/30 dark:bg-slate-800/50 backdrop-blur-sm rounded-[2rem] border border-slate-300 dark:border-slate-700 p-6 lg:p-8 shadow-inner">
                          <div className="flex items-center justify-between mb-6 px-2">
                            <div className="flex items-center gap-3">
                              <div className="bg-[#13487a] p-2 rounded-xl shadow-lg">
                                <History className="h-5 w-5 text-white" />
                              </div>
                              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Recent Activity</h3>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={clearHistory} 
                              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 gap-2 font-bold"
                            >
                              <Trash2 className="h-4 w-4" />
                              Clear All History
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {history.map((item) => (
                              <button
                                key={item.id}
                                onClick={() => handleSearch(undefined, item.keyword, item.date)}
                                className="flex items-center justify-between p-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-[#13487a] dark:hover:border-[#13487a] transition-all group text-left shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                              >
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900 dark:text-white truncate text-lg">{item.keyword}</p>
                                  <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 mt-1.5">
                                    <Clock className="h-3.5 w-3.5" />
                                    {item.date}
                                  </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-[#13487a] transition-colors shrink-0" />
                              </button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="iframe"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="h-full flex flex-col space-y-4"
            >
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 p-4 rounded-2xl flex items-start gap-3">
                <Info className="h-5 w-5 text-[#13487a] shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-bold">Full Website View</p>
                  <p className="opacity-80">You are viewing the full whopostedwhat.com website. If the iframe is blocked or doesn't load, please use our <strong>Custom Tool</strong> for a faster experience.</p>
                </div>
              </div>

              <div className="flex-1 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden relative shadow-2xl min-h-[700px]">
                <iframe 
                  src="https://whopostedwhat.com/" 
                  className="w-full h-full border-none"
                  title="Who Posted What Search Tool"
                />
              </div>
              
              <div className="flex justify-center">
                <Button 
                  variant="outline" 
                  className="gap-2 rounded-full px-8"
                  onClick={() => window.open('https://whopostedwhat.com/', '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in New Tab
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}


