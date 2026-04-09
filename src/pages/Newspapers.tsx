import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, deleteDoc, doc, addDoc, serverTimestamp, updateDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Plus, Edit, Trash2, ExternalLink, Search, Newspaper as NewspaperIcon, Loader2, LayoutGrid, List, Filter, CheckSquare, Square, X, Settings, Check, ArrowUp, ArrowDown, Sparkles, Settings2, GripVertical, ImagePlus, Upload, FolderInput, ClipboardPaste, Link as LinkIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { compressImage, extractImageUrlFromHtml } from '../lib/image-utils';
import { cn } from '../lib/utils';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useCategories } from '../hooks/useCategories';
import CategoryManager from '../components/CategoryManager';
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
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface Newspaper {
  id: string;
  name: string;
  url: string;
  thumbnail?: string;
  category?: string;
  order?: number;
  authorUid: string;
  createdAt: any;
  updatedAt: any;
}

const SortableNewspaperItem = React.memo(({ 
  newspaper, 
  isEditMode, 
  selectedIds, 
  toggleSelect, 
  handleOpenModal, 
  setIsDeleteModalOpen, 
  setCurrentNewspaper,
  viewMode
}: any) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: newspaper.id, disabled: !isEditMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  if (viewMode === 'grid') {
    return (
      <motion.div
        ref={setNodeRef}
        style={style}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "group relative flex flex-col bg-white dark:bg-slate-800 rounded-2xl border transition-all overflow-hidden",
          selectedIds.includes(newspaper.id) ? "border-blue-500 ring-2 ring-blue-500/20 shadow-lg" : "border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl"
        )}
      >
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
          <Button 
            size="icon" 
            variant="ghost" 
            className={cn(
              "h-6 w-6 rounded-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border transition-all",
              selectedIds.includes(newspaper.id) ? "border-blue-500 text-blue-500" : "border-slate-200 dark:border-slate-700 text-slate-400 opacity-0 group-hover:opacity-100"
            )}
            onClick={(e) => {
              e.stopPropagation();
              toggleSelect(newspaper.id);
            }}
          >
            {selectedIds.includes(newspaper.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          </Button>
          {isEditMode && (
            <div 
              {...attributes} 
              {...listeners}
              className="h-6 w-6 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-md text-slate-400 cursor-grab active:cursor-grabbing hover:text-blue-500 hover:border-blue-200 transition-colors"
            >
              <GripVertical className="h-3 w-3" />
            </div>
          )}
        </div>

        <div className="aspect-video relative bg-white dark:bg-slate-900 p-2 flex items-center justify-center overflow-hidden border-b border-slate-50 dark:border-slate-800">
          <div 
            className={cn(
              "w-full h-full flex items-center justify-center cursor-pointer transition-transform hover:scale-105",
              isEditMode ? "opacity-50" : ""
            )}
            onClick={() => !isEditMode && window.open(newspaper.url, '_blank')}
          >
            {newspaper.thumbnail ? (
              <img 
                src={newspaper.thumbnail} 
                alt={newspaper.name}
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.src.includes('google.com/s2/favicons')) {
                    const domain = new URL(newspaper.url).hostname;
                    target.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
                  }
                }}
              />
            ) : (
              <NewspaperIcon className="h-12 w-12 text-slate-200 dark:text-slate-700" />
            )}
          </div>
          
          {isEditMode && (
            <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px] flex items-center justify-center gap-2">
              <Button 
                size="icon" 
                variant="secondary" 
                className="h-9 w-9 rounded-full shadow-lg border border-white/20"
                onClick={() => handleOpenModal(newspaper)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button 
                size="icon" 
                variant="destructive" 
                className="h-9 w-9 rounded-full shadow-lg border border-white/20"
                onClick={() => {
                  setCurrentNewspaper(newspaper);
                  setIsDeleteModalOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        
        <div className="p-3 text-center">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{newspaper.name}</h3>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider font-semibold">{newspaper.category}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border transition-colors group",
        selectedIds.includes(newspaper.id) ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/10" : "border-slate-100 dark:border-slate-700 hover:border-blue-200"
      )}
    >
      <div className="flex items-center gap-4">
        {isEditMode && (
          <div 
            {...attributes} 
            {...listeners}
            className="text-slate-300 hover:text-blue-500 cursor-grab active:cursor-grabbing p-1"
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}
        <Button 
          size="icon" 
          variant="ghost" 
          className={cn(
            "h-6 w-6 rounded-md",
            selectedIds.includes(newspaper.id) ? "text-blue-500" : "text-slate-300"
          )}
          onClick={() => toggleSelect(newspaper.id)}
        >
          {selectedIds.includes(newspaper.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
        </Button>
        <div className="h-10 w-10 flex-none bg-slate-50 dark:bg-slate-900 rounded-lg p-1 flex items-center justify-center overflow-hidden">
          {newspaper.thumbnail ? (
            <img src={newspaper.thumbnail} alt="" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
          ) : (
            <NewspaperIcon className="h-5 w-5 text-slate-300" />
          )}
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{newspaper.name}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{newspaper.url}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <span className="hidden sm:inline px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider">
          {newspaper.category}
        </span>
        <div className="flex items-center gap-1">
          {isEditMode ? (
            <>
              <Button variant="ghost" size="icon" onClick={() => handleOpenModal(newspaper)} className="h-8 w-8 text-slate-500">
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => { setCurrentNewspaper(newspaper); setIsDeleteModalOpen(true); }} className="h-8 w-8 text-red-500">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => window.open(newspaper.url, '_blank')} className="h-8 w-8 text-blue-600">
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

SortableNewspaperItem.displayName = 'SortableNewspaperItem';

export default function Newspapers() {
  const [newspapers, setNewspapers] = useState<Newspaper[]>([]);
  const { categories, loading: categoriesLoading } = useCategories('newspapers');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentNewspaper, setCurrentNewspaper] = useState<Newspaper | null>(null);
  const [formData, setFormData] = useState({ name: '', url: '', thumbnail: '', category: 'National' });
  const [isSaving, setIsSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkCategoryModalOpen, setIsBulkCategoryModalOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('National');
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'newspapers'),
      where('authorUid', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Newspaper[];
      
      data.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          if (a.order !== b.order) return a.order - b.order;
        }
        return a.name.localeCompare(b.name);
      });
      setNewspapers(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'newspapers');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
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
        return filteredNewspapers.findIndex(acc => acc.id === a) - filteredNewspapers.findIndex(acc => acc.id === b);
      });

      const remainingNewspapers = filteredNewspapers.filter(acc => !sortedItemsToMove.includes(acc.id));
      let insertIndex = remainingNewspapers.findIndex(acc => acc.id === overId);

      const activeOriginalIndex = filteredNewspapers.findIndex(acc => acc.id === activeId);
      const overOriginalIndex = filteredNewspapers.findIndex(acc => acc.id === overId);

      if (activeOriginalIndex < overOriginalIndex) {
        insertIndex += 1;
      }

      const itemsToInsert = sortedItemsToMove.map(id => newspapers.find(acc => acc.id === id)!);
      const globalRemaining = newspapers.filter(acc => !sortedItemsToMove.includes(acc.id));
      let globalInsertIndex = globalRemaining.findIndex(acc => acc.id === overId);
      
      const activeGlobalIndex = newspapers.findIndex(acc => acc.id === activeId);
      const overGlobalIndex = newspapers.findIndex(acc => acc.id === overId);

      if (activeGlobalIndex < overGlobalIndex) {
        globalInsertIndex += 1;
      }

      globalRemaining.splice(globalInsertIndex, 0, ...itemsToInsert);

      // Batch update orders
      const batches = [];
      let currentBatch = writeBatch(db);
      let operationCount = 0;
      let updateCount = 0;

      globalRemaining.forEach((acc, index) => {
        // Only update if the order has actually changed
        if (acc.order !== index) {
          const docRef = doc(db, 'newspapers', acc.id);
          currentBatch.update(docRef, { order: index });
          operationCount++;
          updateCount++;

          if (operationCount === 490) {
            batches.push(currentBatch.commit());
            currentBatch = writeBatch(db);
            operationCount = 0;
          }
        }
      });

      if (operationCount > 0) {
        batches.push(currentBatch.commit());
      }

      if (updateCount > 0) {
        setIsSaving(true);
        const toastId = toast.loading("Updating order...");
        try {
          await Promise.all(batches);
          toast.success("Order updated", { id: toastId });
        } catch (error) {
          console.error("Error updating order:", error);
          toast.error("Failed to update order", { id: toastId });
        } finally {
          setIsSaving(false);
        }
      }
    }
  };

  const filteredNewspapers = useMemo(() => {
    return newspapers.filter(n => {
      const matchesSearch = n.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          n.url.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === "All Categories" || n.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [newspapers, searchTerm, selectedCategory]);

  const handleOpenModal = (newspaper?: Newspaper) => {
    if (newspaper) {
      setCurrentNewspaper(newspaper);
      setFormData({ 
        name: newspaper.name, 
        url: newspaper.url, 
        thumbnail: newspaper.thumbnail || '', 
        category: newspaper.category || 'National' 
      });
    } else {
      setCurrentNewspaper(null);
      setFormData({ name: '', url: '', thumbnail: '', category: 'National' });
    }
    setIsModalOpen(true);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredNewspapers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredNewspapers.map(n => n.id));
    }
  };

  const handleBulkOpen = () => {
    const selectedNewspapers = newspapers.filter(n => selectedIds.includes(n.id));
    selectedNewspapers.forEach(n => window.open(n.url, '_blank'));
    toast.success(`Opening ${selectedIds.length} newspapers...`);
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.delete(doc(db, 'newspapers', id));
      });
      await batch.commit();
      
      const count = selectedIds.length;
      setSelectedIds([]);
      setIsBulkDeleteModalOpen(false);
      toast.success(`${count} newspapers deleted successfully`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'newspapers');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleCleanDuplicates = async () => {
    setIsSaving(true);
    try {
      const seen = new Map<string, string>(); // url -> id
      const duplicates: string[] = [];
      
      // Sort by createdAt to keep the oldest one
      const sorted = [...newspapers].sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeA - timeB;
      });
      
      sorted.forEach(n => {
        const url = n.url.toLowerCase().trim().replace(/\/$/, "");
        const name = n.name.toLowerCase().trim();
        const key = `${url}|${name}`;
        
        if (seen.has(key)) {
          duplicates.push(n.id);
        } else {
          seen.set(key, n.id);
        }
      });

      if (duplicates.length === 0) {
        toast.info('No duplicates found');
        return;
      }

      const batch = writeBatch(db);
      duplicates.forEach(id => {
        batch.delete(doc(db, 'newspapers', id));
      });
      
      await batch.commit();
      toast.success(`Deleted ${duplicates.length} duplicate newspapers`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'newspapers');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) { // 3MB limit for Base64
      toast.error('Image size should be less than 3MB');
      return;
    }

    setIsUploading(true);
    try {
      const compressed = await compressImage(file);
      setFormData(prev => ({ ...prev, thumbnail: compressed }));
      toast.success('Logo uploaded and optimized');
    } catch (err) {
      console.error('Compression error:', err);
      toast.error('Failed to process image');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePaste = React.useCallback(async (e: React.ClipboardEvent | ClipboardEvent) => {
    const clipboardData = (e as React.ClipboardEvent).clipboardData || (e as ClipboardEvent).clipboardData;
    const items = clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (!file) continue;

        if (file.size > 3 * 1024 * 1024) {
          toast.error('Pasted image size should be less than 3MB');
          return;
        }

        setIsUploading(true);
        try {
          const compressed = await compressImage(file);
          setFormData(prev => ({ ...prev, thumbnail: compressed }));
          toast.success('Logo pasted and optimized');
        } catch (err) {
          console.error('Compression error:', err);
          toast.error('Failed to process pasted image');
        } finally {
          setIsUploading(false);
        }
        e.preventDefault();
        return;
      }
    }

    // Check for HTML (often contains image source when copying from website)
    const html = clipboardData?.getData('text/html');
    if (html) {
      const extractedUrl = extractImageUrlFromHtml(html);
      if (extractedUrl) {
        setIsUploading(true);
        try {
          const compressed = await compressImage(extractedUrl);
          setFormData(prev => ({ ...prev, thumbnail: compressed }));
          toast.success('Logo pasted from website');
          setIsUploading(false);
          e.preventDefault();
          return;
        } catch (err) {
          setFormData(prev => ({ ...prev, thumbnail: extractedUrl }));
          toast.success('Logo pasted from website');
          setIsUploading(false);
          e.preventDefault();
          return;
        }
      }
    }

    // If no image file or HTML image, check for image URL in text
    const pastedText = clipboardData?.getData('text');
    if (pastedText && (pastedText.startsWith('http') || pastedText.startsWith('data:image'))) {
      const isImageUrl = (pastedText.startsWith('http') || pastedText.startsWith('data:image')) && 
        (/\.(jpg|jpeg|png|webp|gif|svg|avif|bmp|ico|tiff)(\?.*)?$/i.test(pastedText) || 
         pastedText.startsWith('data:image') ||
         pastedText.includes('fbcdn.net') || 
         pastedText.includes('googleusercontent.com') ||
         pastedText.includes('yt3.ggpht.com') ||
         pastedText.includes('images.unsplash.com') ||
         pastedText.includes('cloudinary.com'));

      if (isImageUrl || pastedText.startsWith('http')) {
        setIsUploading(true);
        try {
          const compressed = await compressImage(pastedText);
          setFormData(prev => ({ ...prev, thumbnail: compressed }));
          toast.success('Logo URL pasted and optimized');
        } catch (err) {
          if (isImageUrl) {
            setFormData(prev => ({ ...prev, thumbnail: pastedText }));
            toast.success('Logo URL pasted');
          }
        } finally {
          setIsUploading(false);
        }
        e.preventDefault();
      }
    }
  }, []);

  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // If modal is open, handle paste inside modal
      if (isModalOpen) {
        const items = e.clipboardData?.items;
        let hasImage = false;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
              hasImage = true;
              break;
            }
          }
        }

        const pastedText = e.clipboardData?.getData('text');
        const isImageUrl = pastedText && (pastedText.startsWith('http') || pastedText.startsWith('data:image')) && 
          (/\.(jpg|jpeg|png|webp|gif|svg|avif|bmp|ico|tiff)(\?.*)?$/i.test(pastedText) || 
           pastedText.startsWith('data:image') ||
           pastedText.includes('fbcdn.net') || 
           pastedText.includes('googleusercontent.com') ||
           pastedText.includes('yt3.ggpht.com'));

        if (hasImage || isImageUrl) {
          handlePaste(e);
        }
        return;
      }

      // If no modal is open, handle bulk paste for selected items
      if (selectedIds.length > 0 && !isBulkCategoryModalOpen && !isBulkDeleteModalOpen && !isCategoryManagerOpen && !isDeleteModalOpen) {
        // Don't trigger if user is typing in an input
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
          return;
        }

        const items = e.clipboardData?.items;
        if (!items) return;

        (async () => {
          let imageData: string | null = null;
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
              const file = items[i].getAsFile();
              if (file) {
                setIsUploading(true);
                try {
                  imageData = await compressImage(file);
                } catch (err) {
                  const reader = new FileReader();
                  imageData = await new Promise((resolve) => {
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(file);
                  });
                } finally {
                  setIsUploading(false);
                }
                break;
              }
            }
          }

          if (!imageData) {
            const html = e.clipboardData?.getData('text/html');
            if (html) {
              const extractedUrl = extractImageUrlFromHtml(html);
              if (extractedUrl) {
                setIsUploading(true);
                try {
                  imageData = await compressImage(extractedUrl);
                } catch (err) {
                  imageData = extractedUrl;
                } finally {
                  setIsUploading(false);
                }
              }
            }
          }

          if (!imageData) {
            const pastedText = e.clipboardData?.getData('text');
            if (pastedText && (pastedText.startsWith('http') || pastedText.startsWith('data:image'))) {
              const isImageUrl = /\.(jpg|jpeg|png|webp|gif|svg|avif|bmp|ico|tiff)(\?.*)?$/i.test(pastedText) || 
                               pastedText.startsWith('data:image') ||
                               pastedText.includes('fbcdn.net') || 
                               pastedText.includes('googleusercontent.com') ||
                               pastedText.includes('yt3.ggpht.com');
              
              if (isImageUrl || pastedText.startsWith('http')) {
                setIsUploading(true);
                try {
                  imageData = await compressImage(pastedText);
                } catch (err) {
                  if (isImageUrl) imageData = pastedText;
                } finally {
                  setIsUploading(false);
                }
              }
            }
          }

          if (imageData) {
            const toastId = toast.loading(`Updating logo for ${selectedIds.length} newspapers...`);
            try {
              const batch = writeBatch(db);
              selectedIds.forEach(id => {
                batch.update(doc(db, 'newspapers', id), {
                  thumbnail: imageData,
                  updatedAt: serverTimestamp()
                });
              });
              await batch.commit();
              toast.success(`Logo updated for ${selectedIds.length} newspapers`, { id: toastId });
              setSelectedIds([]);
            } catch (error) {
              handleFirestoreError(error, OperationType.UPDATE, 'newspapers');
              toast.error('Failed to update logos', { id: toastId });
            }
          }
        })();
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [isModalOpen, selectedIds, isBulkCategoryModalOpen, isBulkDeleteModalOpen, isCategoryManagerOpen, isDeleteModalOpen, handlePaste]);

  const handleBulkCategoryChange = async () => {
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.update(doc(db, 'newspapers', id), { 
          category: bulkCategory,
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
      
      const count = selectedIds.length;
      setSelectedIds([]);
      setIsBulkCategoryModalOpen(false);
      toast.success(`Updated category for ${count} newspapers`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'newspapers');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.url) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    try {
      if (currentNewspaper) {
        await updateDoc(doc(db, 'newspapers', currentNewspaper.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        toast.success('Newspaper updated successfully');
      } else {
        await addDoc(collection(db, 'newspapers'), {
          ...formData,
          authorUid: auth.currentUser?.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        toast.success('Newspaper added successfully');
      }
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'newspapers');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentNewspaper) return;
    setIsSaving(true);
    try {
      await deleteDoc(doc(db, 'newspapers', currentNewspaper.id));
      toast.success('Newspaper deleted successfully');
      setIsDeleteModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'newspapers');
    } finally {
      setIsSaving(false);
    }
  };

  const seedData = async () => {
    if (!auth.currentUser) {
      toast.error('You must be logged in to import data');
      return;
    }

    setIsSaving(true);
    try {
      const initialData = [
      // National Newspapers (from the image provided)
      { name: "Prothom Alo", url: "https://www.prothomalo.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/prothom-alo.jpg", category: "National" },
      { name: "Bangladesh Pratidin", url: "https://www.bd-pratidin.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/bangladesh-pratidin.jpg", category: "National" },
      { name: "Ittefaq", url: "https://www.ittefaq.com.bd/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/daily-ittefaq.jpg", category: "National" },
      { name: "Kaler Kantho", url: "https://www.kalerkantho.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/kaler-kantho.jpg", category: "National" },
      { name: "Naya Diganta", url: "https://www.dailynayadiganta.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/naya-diganta.jpg", category: "National" },
      { name: "Amar Sangbad", url: "https://www.amarsangbad.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/amar-sangbad.jpg", category: "National" },
      { name: "Protidiner Sangbad", url: "https://www.protidinersangbad.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/protidiner-sangbad.jpg", category: "National" },
      { name: "Jugantor", url: "https://www.jugantor.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/daily-jugantor.jpg", category: "National" },
      { name: "Sangram", url: "https://www.dailysangram.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/daily-sangram.jpg", category: "National" },
      { name: "Manab Zamin", url: "https://www.mzamin.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/manab-zamin.jpg", category: "National" },
      { name: "Amader Shomoy", url: "https://www.dainikamadershomoy.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/dainik-amader-shomoy.jpg", category: "National" },
      { name: "Bonik Barta", url: "https://bonikbarta.net/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/bonik-barta.jpg", category: "National" },
      { name: "Samakal", url: "https://samakal.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/daily-samakal.jpg", category: "National" },
      { name: "Janakantha", url: "https://www.dailyjanakantha.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/daily-janakantha.jpg", category: "National" },
      { name: "Jai Jai Din", url: "https://www.jaijaidinbd.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/jai-jai-din.jpg", category: "National" },
      { name: "Bhorer Kagoj", url: "https://www.bhorerkagoj.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/bhorer-kagoj.jpg", category: "National" },
      { name: "Arthoniteer Kagoj", url: "https://www.arthoniteerkagoj.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/arthoniteer-kagoj.jpg", category: "Business" },
      { name: "Inqilab", url: "https://www.dailyinqilab.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/daily-inqilab.jpg", category: "National" },
      { name: "Sangbad", url: "https://sangbad.net.bd/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/daily-sangbad.jpg", category: "National" },
      { name: "Manob Kantha", url: "https://www.manobkantha.com.bd/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/manob-kantha.jpg", category: "National" },
      { name: "Suprobhat", url: "https://suprobhat.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/suprobhat-bangladesh.jpg", category: "National" },
      { name: "Bangladesh Journal", url: "https://www.bdjournal.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/bangladesh-journal.jpg", category: "National" },
      { name: "Dinkal", url: "https://www.dailydinkal.net/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/daily-dinkal.jpg", category: "National" },
      { name: "Alokito Bangladesh", url: "https://www.alokitobangladesh.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/alokito-bangladesh.jpg", category: "National" },
      { name: "Ajker Bazar", url: "https://www.ajkerbazar.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/ajker-bazar.jpg", category: "Business" },
      { name: "Amader Orthoneeti", url: "https://www.amaderorthoneeti.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/amader-orthoneeti.jpg", category: "Business" },
      { name: "Bangladesh Post", url: "https://bangladeshpost.net/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/bangladesh-post.jpg", category: "English" },
      { name: "Sorejomin Barta", url: "https://www.sorejominbarta.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/sorejomin-barta.jpg", category: "National" },
      { name: "Khabar Patra", url: "https://www.khabarpatra.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/dainik-khabarpatra.jpg", category: "National" },
      { name: "Vorer Pata", url: "https://www.vorerpata.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/vorer-pata.jpg", category: "National" },
      { name: "Shomoyer Alo", url: "https://www.shomoyeralo.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/shomoyer-alo.jpg", category: "National" },
      { name: "Kal Bela", url: "https://www.kalbela.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/kalbela.jpg", category: "National" },
      { name: "Share biz", url: "https://sharebiz.net/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/share-biz.jpg", category: "Business" },
      { name: "Bartoman", url: "https://www.dailybartoman.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/daily-bartoman.jpg", category: "National" },
      { name: "Ajkaler Khobor", url: "https://www.ajkalerkhobor.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/ajkaler-khobor.jpg", category: "National" },
      { name: "Sangbad Konika", url: "https://www.sangbadkonika.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/sangbad-konika.jpg", category: "National" },
      { name: "Khola Kagoj", url: "https://www.kholakagojbd.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/khola-kagoj.jpg", category: "National" },
      { name: "Gonokantho", url: "https://www.gonokantho.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/gonokantho.jpg", category: "National" },
      { name: "Daily Star", url: "https://www.thedailystar.net/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/the-daily-star.jpg", category: "English" },
      { name: "Daily Observer", url: "https://www.observerbd.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/daily-observer.jpg", category: "English" },
      { name: "Financial Express", url: "https://thefinancialexpress.com.bd/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/financial-express.jpg", category: "Business" },
      { name: "Desh Rupantor", url: "https://www.deshrupantor.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/desh-rupantor.jpg", category: "National" },
      { name: "Bangladesher Khabor", url: "https://www.bangladesherkhabor.net/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/bangladesher-khabor.jpg", category: "National" },
      { name: "Bd Bulletin", url: "https://www.bdbulletin.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/bd-bulletin.jpg", category: "National" },
      { name: "Daily Jagran", url: "https://www.dailyjagaran.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/daily-jagran.jpg", category: "National" },
      { name: "Business Standard", url: "https://www.tbsnews.net/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/business-standard.jpg", category: "Business" },
      { name: "Dhaka Tribune", url: "https://www.dhakatribune.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/dhaka-tribune.jpg", category: "English" },
      { name: "Business Post", url: "https://businesspostbd.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/business-post.jpg", category: "Business" },
      { name: "Ajker Patrika", url: "https://www.ajkerpatrika.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/ajker-patrika.jpg", category: "National" },
      { name: "Dainik Bangla", url: "https://www.dainikbangla.com.bd/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/dainik-bangla.jpg", category: "National" },
      { name: "Desh Rupantor", url: "https://www.deshrupantor.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/desh-rupantor.jpg", category: "National" },
      { name: "Amader Shomoy", url: "https://www.dainikamadershomoy.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/dainik-amader-shomoy.jpg", category: "National" },
      { name: "Bhorer Kagoj", url: "https://www.bhorerkagoj.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/bhorer-kagoj.jpg", category: "National" },
      { name: "Sangbad", url: "https://sangbad.net.bd/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/daily-sangbad.jpg", category: "National" },
      { name: "Manob Kantha", url: "https://www.manobkantha.com.bd/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/manob-kantha.jpg", category: "National" },
      { name: "Alokito Bangladesh", url: "https://www.alokitobangladesh.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/alokito-bangladesh.jpg", category: "National" },
      { name: "Dinkal", url: "https://www.dailydinkal.net/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/daily-dinkal.jpg", category: "National" },
      
      // TV Channels
      { name: "Channel i", url: "https://www.channelionline.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/channel-i.jpg", category: "TV Channels" },
      { name: "Independent TV", url: "https://www.independent24.tv/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/independent-tv.jpg", category: "TV Channels" },
      { name: "Somoy News", url: "https://www.somoynews.tv/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/somoy-tv.jpg", category: "TV Channels" },
      { name: "NTV BD", url: "https://www.ntvbd.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/ntv-online.jpg", category: "TV Channels" },
      { name: "Channel 24 BD", url: "https://www.channel24bd.tv/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/channel-24.jpg", category: "TV Channels" },
      { name: "RTV", url: "https://www.rtvonline.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/rtv-online.jpg", category: "TV Channels" },
      { name: "Ekattor TV", url: "https://www.ekattor.tv/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/ekattor-tv.jpg", category: "TV Channels" },
      { name: "Jamuna TV", url: "https://www.jamuna.tv/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/jamuna-tv.jpg", category: "TV Channels" },
      { name: "DBC News", url: "https://www.dbcnews.tv/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/dbc-news.jpg", category: "TV Channels" },
      { name: "News24", url: "https://www.news24bd.tv/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/news24.jpg", category: "TV Channels" },
      { name: "Bangla Vision", url: "https://www.banglavision.tv/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/bangla-vision.jpg", category: "TV Channels" },
      { name: "Maasranga TV", url: "https://www.maasranga.tv/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/maasranga-tv.jpg", category: "TV Channels" },
      { name: "ATN Bangla", url: "https://www.atnbangla.tv/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/atn-bangla.jpg", category: "TV Channels" },
      { name: "ATN News", url: "https://www.atnnewsltd.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/atn-news.jpg", category: "TV Channels" },
      
      // Online Only
      { name: "bdnews24.com", url: "https://bangla.bdnews24.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/bdnews24.jpg", category: "Online Only" },
      { name: "banglanews24.com", url: "https://www.banglanews24.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/banglanews24.jpg", category: "Online Only" },
      { name: "jagonews24.com", url: "https://www.jagonews24.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/jagonews24.jpg", category: "Online Only" },
      { name: "Bangla Tribune", url: "https://www.banglatribune.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/bangla-tribune.jpg", category: "Online Only" },
      { name: "Dhaka Post", url: "https://www.dhakapost.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/dhaka-post.jpg", category: "Online Only" },
      { name: "Risingbd", url: "https://www.risingbd.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/risingbd.jpg", category: "Online Only" },
      { name: "Dhaka Times", url: "https://www.dhakatimes24.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/dhakatimes24.jpg", category: "Online Only" },
      { name: "Barta24", url: "https://barta24.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/barta24.jpg", category: "Online Only" },
      { name: "Sarabangla", url: "https://sarabangla.net/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/sarabangla.jpg", category: "Online Only" },
      
      // English Newspapers
      { name: "Daily Star", url: "https://www.thedailystar.net/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/the-daily-star.jpg", category: "International English Newspaper" },
      { name: "Dhaka Tribune", url: "https://www.dhakatribune.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/dhaka-tribune.jpg", category: "International English Newspaper" },
      { name: "Financial Express", url: "https://thefinancialexpress.com.bd/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/financial-express.jpg", category: "International English Newspaper" },
      { name: "Daily Observer", url: "https://www.observerbd.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/daily-observer.jpg", category: "International English Newspaper" },
      { name: "Business Standard", url: "https://www.tbsnews.net/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/business-standard.jpg", category: "International English Newspaper" },
      { name: "New Age", url: "https://www.newagebd.net/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/new-age.jpg", category: "International English Newspaper" },
      { name: "Independent (English)", url: "http://www.theindependentbd.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/independent.jpg", category: "International English Newspaper" },
      
      // International
      { name: "BBC Bangla", url: "https://www.bbc.com/bengali", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/bbc-bangla.jpg", category: "International" },
      { name: "VOA Bangla", url: "https://www.voabangla.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/voa-bangla.jpg", category: "International" },
      { name: "DW Bangla", url: "https://www.dw.com/bn/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/dw-bangla.jpg", category: "International" },
      { name: "Al Jazeera", url: "https://www.aljazeera.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/al-jazeera.jpg", category: "International" },
      { name: "Anandabazar Patrika", url: "https://www.anandabazar.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/anandabazar-patrika.jpg", category: "International" },
      { name: "Times of India", url: "https://timesofindia.indiatimes.com/", thumbnail: "https://www.allbanglanewspaper.xyz/wp-content/uploads/2014/12/times-of-india.jpg", category: "International" },
    ];

    // Get current newspapers to check for duplicates
    const normalize = (s: string) => s.toLowerCase().trim().replace(/\/$/, "");
      const existingUrls = new Set(newspapers.map(n => normalize(n.url)));
      const existingNames = new Set(newspapers.map(n => n.name.toLowerCase().trim()));

      const itemsToAdd = initialData.filter(item => 
        !existingUrls.has(normalize(item.url)) && 
        !existingNames.has(item.name.toLowerCase().trim())
      );

      if (itemsToAdd.length === 0) {
        toast.info('All newspapers are already in your collection');
        setIsSaving(false);
        return;
      }

      // Use batches for large imports
      const batchSize = 450;
      for (let i = 0; i < itemsToAdd.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = itemsToAdd.slice(i, i + batchSize);
        
        chunk.forEach(item => {
          const newDocRef = doc(collection(db, 'newspapers'));
          batch.set(newDocRef, {
            ...item,
            authorUid: auth.currentUser?.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        });
        
        await batch.commit();
      }
      
      toast.success(`${itemsToAdd.length} new newspapers imported successfully`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'newspapers');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImportFromForeignAccounts = async () => {
    if (!auth.currentUser) {
      toast.error('You must be logged in to import data');
      return;
    }

    setIsSaving(true);
    try {
      // Fetch accounts with category 'Foreign English Newspaper'
      const q = query(
        collection(db, 'accounts'), 
        where('authorUid', '==', auth.currentUser.uid),
        where('category', '==', 'Foreign English Newspaper')
      );
      const querySnapshot = await getDocs(q);
      const foreignAccounts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (foreignAccounts.length === 0) {
        toast.info('No newspapers found in "Foreign English Newspaper" category');
        setIsSaving(false);
        return;
      }

      // Get current newspapers to check for duplicates
      const normalize = (s: string) => s.toLowerCase().trim().replace(/\/$/, "");
      const existingUrls = new Set(newspapers.map(n => normalize(n.url)));
      const existingNames = new Set(newspapers.map(n => n.name.toLowerCase().trim()));

      const itemsToAdd = foreignAccounts.filter((item: any) => 
        !existingUrls.has(normalize(item.url)) && 
        !existingNames.has(item.name.toLowerCase().trim())
      );

      if (itemsToAdd.length === 0) {
        toast.info('All newspapers from "Foreign English Newspaper" are already in your collection');
        setIsSaving(false);
        return;
      }

      // Use batches for imports
      const batchSize = 450;
      for (let i = 0; i < itemsToAdd.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = itemsToAdd.slice(i, i + batchSize);
        
        chunk.forEach((item: any) => {
          const newDocRef = doc(collection(db, 'newspapers'));
          batch.set(newDocRef, {
            name: item.name,
            url: item.url,
            thumbnail: '', // Default empty thumbnail
            category: 'International English Newspaper',
            authorUid: auth.currentUser?.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        });
        
        await batch.commit();
      }
      
      toast.success(`${itemsToAdd.length} newspapers imported to "International English Newspaper" successfully`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'newspapers');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4 max-w-7xl mx-auto w-full">
      {/* Header Section */}
      <div className="flex-none flex flex-col lg:flex-row items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border border-white/20 dark:border-slate-800 shadow-sm gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-600 to-[#13487a] p-2.5 rounded-xl shadow-lg">
            <NewspaperIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Newspapers</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">All Bangladesh & International News</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search newspapers..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-48 sm:w-64 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
          
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-40 sm:w-48 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-400" />
                <SelectValue placeholder="Category" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All Categories">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setViewMode('grid')}
              className={cn("h-8 w-8", viewMode === 'grid' ? "bg-white dark:bg-slate-700 shadow-sm" : "")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setViewMode('list')}
              className={cn("h-8 w-8", viewMode === 'list' ? "bg-white dark:bg-slate-700 shadow-sm" : "")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          <Button 
            onClick={() => setIsEditMode(!isEditMode)} 
            variant={isEditMode ? "default" : "outline"}
            className={cn(
              "gap-2 transition-all",
              isEditMode 
                ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-500" 
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            {isEditMode ? <Check className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
            <span className="hidden sm:inline">{isEditMode ? "Done Editing" : "Edit"}</span>
          </Button>

          {isEditMode && (
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={handleImportFromForeignAccounts}
                disabled={isSaving}
                className="border-slate-200 text-slate-600 hover:bg-blue-50 gap-2"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderInput className="h-4 w-4" />}
                <span className="hidden sm:inline">Import Foreign</span>
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsCategoryManagerOpen(true)}
                className="border-slate-200 text-slate-600 hover:bg-slate-50 gap-2"
              >
                <Settings2 className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
            </div>
          )}

          <Button onClick={() => handleOpenModal()} className="bg-[#13487a] hover:bg-[#13487a]/90 text-white gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add New</span>
          </Button>
        </div>
      </div>

      {/* Content Section */}
      <div className="flex-1 overflow-y-auto bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-[#13487a] text-white rounded-2xl flex items-center justify-between shadow-lg sticky top-0 z-20"
          >
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={toggleSelectAll}
                className="text-white hover:bg-white/10 gap-2"
              >
                {selectedIds.length === filteredNewspapers.length ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
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

                    if (imageData) {
                      toast.loading(`Updating ${selectedIds.length} logos...`, { id: toastId });
                      const batch = writeBatch(db);
                      selectedIds.forEach(id => {
                        batch.update(doc(db, 'newspapers', id), {
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

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-[#13487a]" />
            <p className="mt-2 text-slate-500">Loading newspapers...</p>
          </div>
        ) : filteredNewspapers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <NewspaperIcon className="h-12 w-12 opacity-20 mb-4" />
            <p>No newspapers found in this category.</p>
          </div>
        ) : (
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <AnimatePresence mode="wait">
              {viewMode === 'grid' ? (
                <motion.div 
                  key="grid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8"
                >
                  <SortableContext 
                    items={filteredNewspapers.map(n => n.id)}
                    strategy={rectSortingStrategy}
                  >
                    {filteredNewspapers.map((newspaper) => (
                      <SortableNewspaperItem
                        key={newspaper.id}
                        newspaper={newspaper}
                        isEditMode={isEditMode}
                        selectedIds={selectedIds}
                        toggleSelect={toggleSelect}
                        handleOpenModal={handleOpenModal}
                        setIsDeleteModalOpen={setIsDeleteModalOpen}
                        setCurrentNewspaper={setCurrentNewspaper}
                        viewMode="grid"
                      />
                    ))}
                  </SortableContext>
                </motion.div>
              ) : (
                <motion.div 
                  key="list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  <SortableContext 
                    items={filteredNewspapers.map(n => n.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {filteredNewspapers.map((newspaper) => (
                      <SortableNewspaperItem
                        key={newspaper.id}
                        newspaper={newspaper}
                        isEditMode={isEditMode}
                        selectedIds={selectedIds}
                        toggleSelect={toggleSelect}
                        handleOpenModal={handleOpenModal}
                        setIsDeleteModalOpen={setIsDeleteModalOpen}
                        setCurrentNewspaper={setCurrentNewspaper}
                        viewMode="list"
                      />
                    ))}
                  </SortableContext>
                </motion.div>
              )}
            </AnimatePresence>
          </DndContext>
        )}
      </div>

      <CategoryManager 
        isOpen={isCategoryManagerOpen} 
        onClose={() => setIsCategoryManagerOpen(false)} 
        type="newspapers"
        extraActions={
          <>
            <Button 
              onClick={handleCleanDuplicates} 
              variant="outline" 
              className="border-blue-200 text-[#13487a] hover:bg-blue-50 gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Clean Duplicates
            </Button>
            <Button 
              onClick={seedData} 
              variant="outline" 
              className="border-blue-200 text-[#13487a] hover:bg-blue-50 gap-2"
            >
              <NewspaperIcon className="h-4 w-4" />
              Import Defaults
            </Button>
          </>
        }
      />

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{currentNewspaper ? 'Edit Newspaper' : 'Add Newspaper'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Name</label>
              <Input 
                value={formData.name} 
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Prothom Alo"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">URL</label>
              <Input 
                value={formData.url} 
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Logo</label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
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

                      if (imageData) {
                        setFormData(prev => ({ ...prev, thumbnail: imageData! }));
                        toast.success('Image pasted!', { id: toastId });
                      } else {
                        toast.error('No image found in clipboard', { id: toastId });
                      }
                    } catch (err) {
                      toast.error('Clipboard access denied. Try Ctrl+V.', { id: toastId });
                    }
                  }}
                  className="h-16 w-16 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-500 flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-800 transition-colors group relative"
                  title="Click to paste from clipboard"
                >
                  {formData.thumbnail ? (
                    <>
                      <img 
                        src={formData.thumbnail} 
                        alt="Preview" 
                        className="h-full w-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <ClipboardPaste className="h-5 w-5 text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-slate-400 group-hover:text-blue-500">
                      <NewspaperIcon className="h-6 w-6" />
                      <span className="text-[8px] font-bold uppercase">Paste</span>
                    </div>
                  )}
                </button>
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => document.getElementById('logo-upload')?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Upload
                    </Button>
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm"
                      className="flex-1 gap-2"
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

                          if (imageData) {
                            setFormData(prev => ({ ...prev, thumbnail: imageData! }));
                            toast.success('Image pasted!', { id: toastId });
                          } else {
                            toast.error('No image found in clipboard', { id: toastId });
                          }
                        } catch (err) {
                          toast.error('Clipboard access denied. Try Ctrl+V.', { id: toastId });
                        }
                      }}
                      disabled={isUploading}
                    >
                      <ClipboardPaste className="h-4 w-4" />
                      Paste
                    </Button>
                    {formData.thumbnail && (
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => setFormData({ ...formData, thumbnail: '' })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <input 
                    id="logo-upload"
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleImageUpload}
                  />
                  <p className="text-[10px] text-slate-500">
                    Max size: 3MB. <span className="text-blue-500 font-medium underline cursor-pointer" onClick={() => document.getElementById('newspaper-logo-url-input')?.focus()}>Paste URL below</span> or <span className="text-blue-500 font-medium">press Ctrl+V</span>.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Logo URL (Alternative to Paste)</label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  id="newspaper-logo-url-input"
                  className="pl-9"
                  placeholder="Paste image URL here..." 
                  value={formData.thumbnail.startsWith('data:') ? '' : formData.thumbnail} 
                  onChange={async (e) => {
                    const val = e.target.value;
                    setFormData(prev => ({ ...prev, thumbnail: val }));
                    if (val && (val.startsWith('http') || val.startsWith('data:image'))) {
                      try {
                        const compressed = await compressImage(val);
                        setFormData(prev => ({ ...prev, thumbnail: compressed }));
                      } catch (err) {
                        // Keep original URL if compression fails
                      }
                    }
                  }}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Category</label>
              <Select 
                value={formData.category} 
                onValueChange={(val) => setFormData({ ...formData, category: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-[#13487a] text-white">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkCategoryModalOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkCategoryChange} disabled={isSaving} className="bg-[#13487a] hover:bg-[#13487a]/90 text-white">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Update Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Delete Newspaper"
        description={`Are you sure you want to delete "${currentNewspaper?.name}"? This action cannot be undone.`}
      />

      <DeleteConfirmationModal 
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        title="Delete Selected Newspapers"
        description={`Are you sure you want to delete ${selectedIds.length} selected newspapers? This action cannot be undone.`}
      />
    </div>
  );
}
