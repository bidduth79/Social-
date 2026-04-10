import { useState, useEffect, useRef, useMemo, memo, useDeferredValue, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, onSnapshot, query, where, deleteDoc, doc, writeBatch, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Plus, Edit, Trash2, ExternalLink, Search, Settings2, GripVertical, FolderInput, AlertCircle, Loader2, ClipboardPaste, CheckSquare, Square, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import AccountModal from '../components/AccountModal';
import CategoryManager from '../components/CategoryManager';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useCategories } from '../hooks/useCategories';
import { useVisitedLinks } from '../hooks/useVisitedLinks';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { compressImage, extractImageUrlFromHtml } from '../lib/image-utils';
import * as Tooltip from '@radix-ui/react-tooltip';
import { cn } from '../lib/utils';
import { useInView } from 'react-intersection-observer';
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
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface Account {
  id: string;
  name: string;
  platform: 'Facebook' | 'YouTube';
  url: string;
  thumbnail?: string;
  category: string;
  notes?: string;
  order?: number;
  status?: 'Active' | 'Broken' | 'Unknown';
  lastChecked?: any;
  authorUid: string;
  createdAt: any;
  updatedAt: any;
}

function ActionTooltip({ children, content }: { children: React.ReactNode, content: string }) {
  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          {children}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="z-50 overflow-hidden rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-50 animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
            sideOffset={5}
          >
            {content}
            <Tooltip.Arrow className="fill-slate-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

const SortableAccountRow = memo(({ 
  account, 
  openEditModal, 
  handleDelete,
  isSelected,
  onToggleSelect,
  categories,
  onMove,
  isVisited,
  onVisit,
  getVisitCount,
  onVerify
}: { 
  account: Account, 
  openEditModal: (acc: Account) => void, 
  handleDelete: (id: string) => void,
  isSelected: boolean,
  onToggleSelect: (id: string) => void,
  categories: string[],
  onMove: (id: string, newCategory: string) => void,
  isVisited: (id: string) => boolean,
  onVisit: (id: string) => void,
  getVisitCount: (id: string) => number,
  onVerify: (id: string, status: 'Active' | 'Broken') => void
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: account.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
    position: 'relative' as const,
  };

  const visited = isVisited(account.id);
  const visitCount = getVisitCount(account.id);

  return (
    <TableRow 
      ref={setNodeRef} 
      style={style} 
      className={`group transition-colors hover:bg-[#13487a] hover:text-white ${isDragging ? "bg-blue-50/50 shadow-md" : ""}`}
    >
      <TableCell className="w-10 px-2">
        <input 
          type="checkbox" 
          checked={isSelected} 
          onChange={() => onToggleSelect(account.id)}
          className="w-4 h-4 rounded border-slate-300 text-[#13487a] focus:ring-[#13487a] cursor-pointer group-hover:border-white/50"
        />
      </TableCell>
      <TableCell className="w-10 px-2">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-slate-400 group-hover:text-white/80 hover:text-white">
          <GripVertical className="h-5 w-5" />
        </div>
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
      <TableCell className="font-medium text-slate-900 group-hover:text-white">
        <div className="flex items-center gap-2">
          <a 
            href={account.url} 
            target="_blank" 
            rel="noopener noreferrer"
            onClick={() => onVisit(account.id)}
            className={cn(
              "hover:text-purple-600 group-hover:text-white hover:underline flex items-center gap-2 transition-colors inline-flex",
              visited ? "text-slate-400" : "text-[#13487a]"
            )}
          >
            {account.name}
            {visitCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-[#13487a] dark:text-blue-400 group-hover:bg-white/20 group-hover:text-white transition-colors">
                {visitCount}
              </span>
            )}
            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
          {account.status && (
            <Badge 
              variant="outline" 
              className={cn(
                "text-[10px] h-4 px-1.5 border-0",
                account.status === 'Active' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              )}
            >
              {account.status}
            </Badge>
          )}
        </div>
        {account.notes && (
          <p className="text-xs text-slate-500 font-normal mt-1 truncate max-w-xs group-hover:text-blue-100">
            {account.notes}
          </p>
        )}
      </TableCell>
      <TableCell className="text-right w-32">
        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <ActionTooltip content="Verify Link Status">
            <div className="flex gap-0.5">
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 text-emerald-500 group-hover:text-emerald-300 hover:bg-emerald-500/20" 
                onClick={() => onVerify(account.id, 'Active')}
              >
                <CheckSquare className="h-4 w-4" />
              </Button>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 text-red-500 group-hover:text-red-300 hover:bg-red-500/20" 
                onClick={() => onVerify(account.id, 'Broken')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </ActionTooltip>
          <ActionTooltip content="Move to Category">
            <div>
              <Select onValueChange={(val) => onMove(account.id, val)}>
                <SelectTrigger className="h-8 w-8 p-0 border-0 bg-transparent hover:bg-white/20 text-slate-500 group-hover:text-white focus:ring-0 shadow-none">
                  <FolderInput className="h-4 w-4" />
                </SelectTrigger>
                <SelectContent align="end">
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat} disabled={cat === account.category}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </ActionTooltip>
          <ActionTooltip content="Edit Link">
            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 group-hover:text-white hover:bg-white/20" onClick={() => openEditModal(account)}>
              <Edit className="h-4 w-4" />
            </Button>
          </ActionTooltip>
          <ActionTooltip content="Delete Link">
            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 group-hover:text-white hover:bg-red-500" onClick={() => handleDelete(account.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </ActionTooltip>
        </div>
      </TableCell>
    </TableRow>
  );
});

SortableAccountRow.displayName = 'SortableAccountRow';

export default function Accounts() {
  const { categories } = useCategories();
  const { markAsVisited, isVisited, getVisitCount } = useVisitedLinks();
  const [accounts, setAccounts] = useState<Account[]>(() => {
    try {
      const cached = localStorage.getItem('cached_accounts');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      console.error("Error parsing cached accounts:", e);
      return [];
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_accounts');
      return !cached;
    } catch (e) {
      return true;
    }
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryQuery = searchParams.get('category');
  const [selectedCategory, setSelectedCategory] = useState(categoryQuery || 'All Categories');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkCategoryModalOpen, setIsBulkCategoryModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('');
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const [isUpdating, setIsUpdating] = useState(false);

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    if (selectedIds.length === 0 || isModalOpen || isCategoryManagerOpen || isDeleteModalOpen) return;
    
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
          // Fallback to original reader if compression fails
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
      const html = e.clipboardData?.getData('text/html');
      if (html) {
        const extractedUrl = extractImageUrlFromHtml(html);
        if (extractedUrl) {
          setIsUpdating(true);
          try {
            imageData = await compressImage(extractedUrl);
          } catch (err) {
            imageData = extractedUrl;
          } finally {
            setIsUpdating(false);
          }
        }
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

  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => {
      const matchesSearch = (acc.name || '').toLowerCase().includes(deferredSearchTerm.toLowerCase()) || 
                            (acc.url || '').toLowerCase().includes(deferredSearchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All Categories' || acc.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [accounts, deferredSearchTerm, selectedCategory]);

  const [visibleCount, setVisibleCount] = useState(50);
  const [isScrolling, setIsScrolling] = useState(false);
  const visibleAccounts = useMemo(() => {
    return filteredAccounts.slice(0, visibleCount);
  }, [filteredAccounts, visibleCount]);

  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: '200px',
  });

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    if (selectedIds.length === filteredAccounts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAccounts.map(a => a.id));
    }
  }, [selectedIds.length, filteredAccounts]);

  // Reset visible count when search or category changes
  useEffect(() => {
    setVisibleCount(50);
  }, [deferredSearchTerm, selectedCategory]);

  // Load more when scrolling to bottom
  useEffect(() => {
    if (inView && visibleCount < filteredAccounts.length && !isScrolling) {
      setIsScrolling(true);
      // Artificial delay to make the loading indicator visible and smooth
      const timer = setTimeout(() => {
        setVisibleCount(prev => Math.min(prev + 50, filteredAccounts.length));
        setIsScrolling(false);
      }, 800); // Increased delay for better visibility
      return () => clearTimeout(timer);
    }
  }, [inView, filteredAccounts.length, visibleCount, isScrolling]);

  const allCategories = useMemo(() => {
    // Start with official categories
    const uniqueCategories = new Set(categories);
    
    // Add any categories from accounts that are NOT in the official list
    accounts.forEach(acc => {
      if (acc.category) uniqueCategories.add(acc.category);
    });

    return Array.from(uniqueCategories).sort((a, b) => {
      const indexA = categories.indexOf(a);
      const indexB = categories.indexOf(b);
      
      // If both are in official list, use their order in the list
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      
      // If only one is in official list, it comes first
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      
      // If neither is in official list, sort alphabetically
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
      
      // Sort by order ascending, then createdAt descending
      data.sort((a, b) => {
        const orderA = a.order ?? 0;
        const orderB = b.order ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        
        const timeA = typeof a.createdAt?.toMillis === 'function' ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const timeB = typeof b.createdAt?.toMillis === 'function' ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        
        return timeB - timeA;
      });
      
      setAccounts(data);
      // Use a small delay for caching to avoid blocking the main thread during snapshot updates
      setTimeout(() => {
        localStorage.setItem('cached_accounts', JSON.stringify(data));
      }, 100);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'accounts');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = (id: string) => {
    setAccountToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!accountToDelete) return;
    try {
      await deleteDoc(doc(db, 'accounts', accountToDelete));
      toast.success("Account deleted successfully");
      setAccountToDelete(null);
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error("Failed to delete account");
    }
  };

  const openEditModal = (account: Account) => {
    setEditingAccount(account);
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingAccount(null);
    setIsModalOpen(true);
  };

  const handleMove = async (id: string, newCategory: string) => {
    try {
      await updateDoc(doc(db, 'accounts', id), {
        category: newCategory,
        updatedAt: serverTimestamp()
      });
      toast.success(`Moved to ${newCategory}`);
    } catch (error) {
      console.error("Error moving account:", error);
      toast.error("Failed to move account");
    }
  };

  const handleVerify = async (id: string, status: 'Active' | 'Broken') => {
    try {
      await updateDoc(doc(db, 'accounts', id), {
        status,
        lastChecked: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      toast.success(`Marked as ${status}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `accounts/${id}`);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const activeId = active.id as string;
      const overId = over.id as string;

      const isMultiDrag = selectedIds.includes(activeId) && selectedIds.length > 1;
      const itemsToMoveIds = isMultiDrag ? selectedIds : [activeId];

      if (itemsToMoveIds.includes(overId)) return;

      const sortedItemsToMove = itemsToMoveIds.sort((a, b) => {
        return filteredAccounts.findIndex(acc => acc.id === a) - filteredAccounts.findIndex(acc => acc.id === b);
      });

      const remainingAccounts = filteredAccounts.filter(acc => !sortedItemsToMove.includes(acc.id));
      let insertIndex = remainingAccounts.findIndex(acc => acc.id === overId);

      const activeOriginalIndex = filteredAccounts.findIndex(acc => acc.id === activeId);
      const overOriginalIndex = filteredAccounts.findIndex(acc => acc.id === overId);

      if (activeOriginalIndex < overOriginalIndex) {
        insertIndex += 1;
      }

      const itemsToInsert = sortedItemsToMove.map(id => filteredAccounts.find(acc => acc.id === id)!);
      remainingAccounts.splice(insertIndex, 0, ...itemsToInsert);

      // Batch update orders
      const batches = [];
      let currentBatch = writeBatch(db);
      let operationCount = 0;

      remainingAccounts.forEach((acc, index) => {
        const docRef = doc(db, 'accounts', acc.id);
        currentBatch.update(docRef, { order: index });
        operationCount++;

        if (operationCount === 490) {
          batches.push(currentBatch.commit());
          currentBatch = writeBatch(db);
          operationCount = 0;
        }
      });

      if (operationCount > 0) {
        batches.push(currentBatch.commit());
      }

      try {
        await Promise.all(batches);
        toast.success("Order updated");
      } catch (error) {
        console.error("Error updating order:", error);
        toast.error("Failed to update order");
      }
    }
  };

  const handleBulkOpen = () => {
    selectedIds.forEach(id => {
      const acc = accounts.find(a => a.id === id);
      if (acc) {
        window.open(acc.url, '_blank');
        markAsVisited(acc.id);
      }
    });
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.delete(doc(db, 'accounts', id));
      });
      await batch.commit();
      toast.success(`Deleted ${selectedIds.length} accounts`);
      setSelectedIds([]);
      setIsBulkDeleteModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'accounts');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkCategoryChange = async () => {
    if (!bulkCategory) {
      toast.error('Please select a category');
      return;
    }
    setIsUpdating(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.update(doc(db, 'accounts', id), {
          category: bulkCategory,
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
      toast.success(`Moved ${selectedIds.length} accounts to ${bulkCategory}`);
      setSelectedIds([]);
      setIsBulkCategoryModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'accounts');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full overflow-y-auto pt-4 sm:pt-6 lg:pt-8 pb-8 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
    >
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h1 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-md">All Links Directory</h1>
            <p className="text-blue-100 mt-1 drop-shadow">Manage Facebook and YouTube links.</p>
          </motion.div>
          <div className="flex flex-wrap items-center gap-2">
            <ActionTooltip content="Manage Categories">
              <Button 
                variant="outline" 
                className="gap-2 bg-white/90 backdrop-blur-sm border-0 text-[#13487a] hover:bg-white hover:text-[#13487a]/90 shadow-sm" 
                onClick={() => setIsCategoryManagerOpen(true)}
              >
                <Settings2 className="h-4 w-4" />
                Categories
              </Button>
            </ActionTooltip>
            <Button 
              variant="outline"
              onClick={openAddModal} 
              className="gap-2 bg-white/90 backdrop-blur-sm border-0 text-[#13487a] hover:bg-white hover:text-[#13487a]/90 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Add Link
            </Button>
          </div>
        </div>

        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-[#13487a] text-white rounded-2xl flex items-center justify-between shadow-lg sticky top-0 z-20"
          >
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleToggleSelectAll}
                className="text-white hover:bg-white/10 gap-2"
              >
                {selectedIds.length === filteredAccounts.length ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                {selectedIds.length} Selected
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleBulkOpen} className="text-white hover:bg-white/10 gap-2">
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">Open All</span>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-white hover:bg-white/10 gap-2"
                onClick={async () => {
                  const toastId = toast.loading('Reading clipboard...');
                  try {
                    let imageData: string | null = null;
                    if (navigator.clipboard && navigator.clipboard.read) {
                      try {
                        const items = await navigator.clipboard.read();
                        for (const item of items) {
                          for (const type of item.types) {
                            if (type.startsWith('image/')) {
                              const blob = await item.getType(type);
                              imageData = await compressImage(blob);
                              break;
                            }
                          }
                          if (imageData) break;
                        }
                      } catch (e) {
                        console.warn('read() failed', e);
                      }
                    }

                    if (!imageData && navigator.clipboard && navigator.clipboard.readText) {
                      const text = await navigator.clipboard.readText();
                      if (text && (text.startsWith('http') || text.startsWith('data:image'))) {
                        try {
                          imageData = await compressImage(text);
                        } catch (err) {
                          imageData = text;
                        }
                      }
                    }

                    // Fallback to HTML if available (though navigator.clipboard.read usually handles it)
                    // But we can't easily get HTML from navigator.clipboard.read() without more complex logic
                    // So we rely on the global Ctrl+V listener for HTML paste mostly

                    if (imageData) {
                      toast.loading(`Updating ${selectedIds.length} logos...`, { id: toastId });
                      const batch = writeBatch(db);
                      selectedIds.forEach(id => {
                        batch.update(doc(db, 'accounts', id), {
                          thumbnail: imageData,
                          updatedAt: serverTimestamp()
                        });
                      });
                      await batch.commit();
                      toast.success('Logos updated successfully!', { id: toastId });
                      setSelectedIds([]);
                    } else {
                      toast.error('No image found in clipboard', { id: toastId });
                    }
                  } catch (err) {
                    toast.error('Clipboard access denied. Try Ctrl+V.', { id: toastId });
                  }
                }}
              >
                <ClipboardPaste className="h-4 w-4" />
                <span className="hidden sm:inline">Paste Logo</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setIsBulkCategoryModalOpen(true)} className="text-white hover:bg-white/10 gap-2">
                <Edit className="h-4 w-4" />
                <span className="hidden sm:inline">Change Category</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setIsBulkDeleteModalOpen(true)} disabled={isBulkDeleting} className="text-white hover:bg-red-500/20 text-red-200 gap-2">
                {isBulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                <span className="hidden sm:inline">Delete</span>
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setSelectedIds([])} className="text-white hover:bg-white/10">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-4 bg-white/90 backdrop-blur-md p-4 rounded-xl border border-blue-100 shadow-sm"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#13487a]/60" />
            <Input 
              placeholder="Search by name or URL..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 border-blue-100 focus-visible:ring-[#13487a]"
            />
          </div>
          <div className="w-full sm:w-64">
            <Select value={selectedCategory} onValueChange={handleCategoryChange}>
              <SelectTrigger className="border-blue-100 focus:ring-[#13487a]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All Categories">All Categories</SelectItem>
                {allCategories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-blue-100 bg-white/90 backdrop-blur-md shadow-sm overflow-hidden"
        >
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <Table>
              <TableHeader>
                <TableRow className="bg-blue-50/50 hover:bg-blue-50/50">
                  <TableHead className="w-10 px-2">
                    <input 
                      type="checkbox" 
                      checked={filteredAccounts.length > 0 && selectedIds.length === filteredAccounts.length}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-[#13487a] focus:ring-[#13487a] cursor-pointer"
                    />
                  </TableHead>
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="text-[#13487a] font-semibold">Name</TableHead>
                  <TableHead className="w-32 text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-20">
                      <div className="flex flex-col items-center gap-3 text-slate-400">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#13487a] border-t-transparent"></div>
                        <p className="text-sm font-medium">Loading links...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-20">
                      <div className="flex flex-col items-center gap-4 max-w-xs mx-auto text-slate-400">
                        <div className="p-4 bg-slate-50 rounded-full">
                          <AlertCircle className="h-10 w-10 text-slate-300" />
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-slate-600">No links found</p>
                          <p className="text-sm">Try adjusting your search or category filter to find what you're looking for.</p>
                        </div>
                        <Button variant="outline" onClick={() => { setSearchTerm(''); handleCategoryChange('All Categories'); }}>
                          Clear Filters
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <SortableContext 
                    items={visibleAccounts.map(a => a.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <AnimatePresence mode="popLayout">
                      {visibleAccounts.map((account) => (
                        <SortableAccountRow 
                          key={account.id} 
                          account={account} 
                          openEditModal={openEditModal} 
                          handleDelete={handleDelete} 
                          isSelected={selectedIds.includes(account.id)}
                          onToggleSelect={handleToggleSelect}
                          categories={allCategories}
                          onMove={handleMove}
                          isVisited={isVisited}
                          onVisit={markAsVisited}
                          getVisitCount={getVisitCount}
                          onVerify={handleVerify}
                        />
                      ))}
                    </AnimatePresence>
                  </SortableContext>
                )}
                
                {/* Load More Row */}
                {visibleCount < filteredAccounts.length && (
                  <TableRow ref={loadMoreRef} className="hover:bg-transparent border-0">
                    <TableCell colSpan={4} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center gap-3 text-[#13487a]/60">
                        <div className="relative">
                          <Loader2 className="h-8 w-8 animate-spin" />
                          <div className="absolute inset-0 h-8 w-8 rounded-full border-2 border-blue-100/50 animate-pulse"></div>
                        </div>
                        <span className="text-sm font-semibold tracking-wide animate-pulse">
                          Loading more links...
                        </span>
                        <p className="text-xs text-slate-400 font-normal">
                          Showing {visibleCount} of {filteredAccounts.length} links
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </motion.div>
      </div>

      <AccountModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        account={editingAccount} 
      />

      <CategoryManager 
        isOpen={isCategoryManagerOpen} 
        onClose={() => setIsCategoryManagerOpen(false)} 
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setAccountToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Account"
        description="Are you sure you want to delete this account? This action cannot be undone."
      />

      <Dialog open={isBulkCategoryModalOpen} onOpenChange={setIsBulkCategoryModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Change Category for {selectedIds.length} Items</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Select New Category</label>
              <Select 
                value={bulkCategory} 
                onValueChange={setBulkCategory}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {allCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkCategoryModalOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkCategoryChange} disabled={isUpdating} className="bg-[#13487a] hover:bg-[#13487a]/90 text-white">
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Update Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationModal 
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        title="Delete Selected Accounts"
        description={`Are you sure you want to delete ${selectedIds.length} selected accounts? This action cannot be undone.`}
      />
    </motion.div>
  );
}
