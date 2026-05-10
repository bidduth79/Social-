import React, { useState } from 'react';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { GripVertical, Trash2, Edit2, Plus, ArrowUp, ArrowDown, ChevronRight, ChevronDown } from 'lucide-react';
import { useCategories } from '../hooks/useCategories';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
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

function SortableCategoryItem({ 
  cat, 
  index, 
  categoriesLength, 
  editingIndex, 
  editingValue, 
  setEditingValue, 
  handleEditSave, 
  setEditingIndex, 
  handleEditStart, 
  handleDelete,
  isSelected,
  onToggleSelect,
  isParent,
  isExpanded,
  onToggleExpand,
  isSub
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: cat });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn(
      "flex items-center gap-2 p-2 bg-slate-50 border border-slate-100 rounded-md group hover:bg-[#13487a] hover:border-[#13487a] transition-all duration-200",
      isDragging && "shadow-md relative",
      isSub && "ml-8 bg-slate-50/50 border-dashed"
    )}>
      <input 
        type="checkbox" 
        checked={isSelected} 
        onChange={() => onToggleSelect(cat)}
        className="w-4 h-4 rounded border-slate-300 text-[#13487a] focus:ring-[#13487a] cursor-pointer group-hover:border-white/50"
      />
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-slate-400 group-hover:text-white/70 hover:text-white">
        <GripVertical className="h-5 w-5" />
      </div>
      
      {editingIndex === index ? (
        <div className="flex-1 flex gap-2">
          <Input 
            value={editingValue} 
            onChange={(e) => setEditingValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleEditSave(index)}
            autoFocus
            className="h-8 bg-white text-slate-900"
          />
          <Button size="sm" onClick={() => handleEditSave(index)} className="h-8 bg-white text-[#13487a] hover:bg-white/90">Save</Button>
          <Button size="sm" variant="outline" onClick={() => setEditingIndex(null)} className="h-8 border-white/50 text-white hover:bg-white/10">Cancel</Button>
        </div>
      ) : (
        <>
          <div className="flex-1 flex items-center gap-2">
            <span className={cn(
              "font-medium transition-colors",
              isDragging ? "text-slate-700" : "text-slate-700 group-hover:text-white",
              isParent && "font-bold"
            )}>
              {isSub ? cat.split(' > ').pop() : cat}
            </span>
            {isParent && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 ml-auto text-slate-400 group-hover:text-white hover:bg-white/20"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleExpand(cat);
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5 transition-transform duration-200" />
                ) : (
                  <ChevronRight className="h-5 w-5 transition-transform duration-200" />
                )}
              </Button>
            )}
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-white hover:bg-white/20 group-hover:text-white/80" onClick={() => handleEditStart(index, cat)}>
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-white hover:bg-red-500 group-hover:text-white/80" onClick={() => handleDelete(index)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

interface CategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  type?: 'accounts' | 'newspapers';
  extraActions?: React.ReactNode;
}

export default function CategoryManager({ isOpen, onClose, type = 'accounts', extraActions }: CategoryManagerProps) {
  const { categories, updateCategories } = useCategories(type);
  const [newCategory, setNewCategory] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<number | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  const toggleExpand = (cat: string) => {
    setExpandedCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleToggleSelect = (cat: string) => {
    setSelectedCategories(prev => 
      prev.includes(cat) ? prev.filter(x => x !== cat) : [...prev, cat]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedCategories.length === categories.length) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories([...categories]);
    }
  };

  const handleAdd = async () => {
    if (!newCategory.trim() || categories.includes(newCategory.trim())) return;
    await updateCategories([...categories, newCategory.trim()]);
    setNewCategory('');
    toast.success('Save Successfully');
  };

  const handleDelete = (index: number) => {
    setCategoryToDelete(index);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (categoryToDelete === null) return;
    const newCats = [...categories];
    newCats.splice(categoryToDelete, 1);
    await updateCategories(newCats);
    setCategoryToDelete(null);
    setIsDeleteModalOpen(false);
    toast.success('Save Successfully');
  };

  const handleEditStart = (index: number, value: string) => {
    setEditingIndex(index);
    setEditingValue(value);
  };

  const handleEditSave = async (index: number) => {
    const oldName = categories[index];
    const newName = editingValue.trim();

    if (!newName || (newName !== oldName && categories.includes(newName))) {
      setEditingIndex(null);
      return;
    }

    if (newName === oldName) {
      setEditingIndex(null);
      return;
    }

    try {
      // 1. Update the categories list in userSettings
      const newCats = [...categories];
      newCats[index] = newName;
      await updateCategories(newCats);
      toast.success('Save Successfully');

      // 2. Update all items that use this category
      if (auth.currentUser) {
        const collectionsToUpdate = ['accounts', 'newspapers'];
        
        for (const collName of collectionsToUpdate) {
          const ref = collection(db, collName);
          const q = query(
            ref, 
            where('category', '==', oldName),
            where('authorUid', '==', auth.currentUser.uid)
          );
          
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const batch = writeBatch(db);
            querySnapshot.docs.forEach((itemDoc) => {
              batch.update(itemDoc.ref, { category: newName });
            });
            await batch.commit();
          }
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'categories');
    }

    setEditingIndex(null);
  };

  const moveUp = async (index: number) => {
    if (index === 0) return;
    const newCats = [...categories];
    const temp = newCats[index];
    newCats[index] = newCats[index - 1];
    newCats[index - 1] = temp;
    await updateCategories(newCats);
  };

  const moveDown = async (index: number) => {
    if (index === categories.length - 1) return;
    const newCats = [...categories];
    const temp = newCats[index];
    newCats[index] = newCats[index + 1];
    newCats[index + 1] = temp;
    await updateCategories(newCats);
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

      const isMultiDrag = selectedCategories.includes(activeId) && selectedCategories.length > 1;
      const itemsToMoveIds = isMultiDrag ? selectedCategories : [activeId];

      if (itemsToMoveIds.includes(overId)) return;

      const sortedItemsToMove = itemsToMoveIds.sort((a, b) => {
        return categories.indexOf(a) - categories.indexOf(b);
      });

      const remainingCategories = categories.filter(cat => !sortedItemsToMove.includes(cat));
      let insertIndex = remainingCategories.indexOf(overId);

      const activeOriginalIndex = categories.indexOf(activeId);
      const overOriginalIndex = categories.indexOf(overId);

      if (activeOriginalIndex < overOriginalIndex) {
        insertIndex += 1;
      }

      remainingCategories.splice(insertIndex, 0, ...sortedItemsToMove);
      await updateCategories(remainingCategories);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#13487a] to-blue-600">Manage Categories</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4 flex-1 flex flex-col overflow-hidden">
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input 
                placeholder="New category name..." 
                value={newCategory} 
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                className="border-blue-100 focus-visible:ring-[#13487a]"
              />
              <Button onClick={handleAdd} className="bg-[#13487a] hover:bg-[#13487a]/90 text-white shrink-0">
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
            
            {type === 'newspapers' && (
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-[10px] h-7 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300"
                  onClick={async () => {
                    const subs = [
                      "International English Newspaper > Indian Newspaper",
                      "International English Newspaper > Myanmar Newspaper",
                      "International English Newspaper > Pakistan Newspaper",
                      "International English Newspaper > Other's"
                    ];
                    const newCats = [...categories];
                    let added = false;
                    subs.forEach(s => {
                      if (!newCats.includes(s)) {
                        newCats.push(s);
                        added = true;
                      }
                    });
                    if (added) {
                      await updateCategories(newCats);
                      toast.success('Standard subcategories added');
                    } else {
                      toast.info('Subcategories already exist');
                    }
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add International Subcategories
                </Button>
              </div>
            )}
          </div>

        <div className="mt-4 flex-1 overflow-y-auto pr-2 space-y-2">
          {categories.length > 0 && (
            <div className="flex items-center gap-2 px-2 py-1 mb-2">
              <input 
                type="checkbox" 
                checked={selectedCategories.length === categories.length}
                onChange={handleToggleSelectAll}
                className="w-4 h-4 rounded border-slate-300 text-[#13487a] focus:ring-[#13487a] cursor-pointer"
                id="selectAllCats"
              />
              <label htmlFor="selectAllCats" className="text-sm text-slate-600 cursor-pointer select-none font-medium">Select All</label>
            </div>
          )}
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={categories}
              strategy={verticalListSortingStrategy}
            >
              {(() => {
                const grouped: { [key: string]: string[] } = {};
                const topLevel: string[] = [];
                
                categories.forEach(cat => {
                  if (cat.includes(' > ')) {
                    const parent = cat.split(' > ')[0];
                    if (!grouped[parent]) grouped[parent] = [];
                    grouped[parent].push(cat);
                  } else {
                    topLevel.push(cat);
                  }
                });

                const visibleCats: { cat: string, isSub: boolean, parentCat: string | null }[] = [];
                topLevel.forEach(parent => {
                  visibleCats.push({ cat: parent, isSub: false, parentCat: null });
                  if (expandedCategories.includes(parent)) {
                    (grouped[parent] || []).forEach(child => {
                      visibleCats.push({ cat: child, isSub: true, parentCat: parent });
                    });
                  }
                });

                return visibleCats.map((item, idx) => {
                  const catIndex = categories.indexOf(item.cat);
                  const isParent = !!grouped[item.cat];
                  return (
                    <SortableCategoryItem
                      key={item.cat}
                      cat={item.cat}
                      index={catIndex}
                      categoriesLength={categories.length}
                      editingIndex={editingIndex}
                      editingValue={editingValue}
                      setEditingValue={setEditingValue}
                      handleEditSave={handleEditSave}
                      setEditingIndex={setEditingIndex}
                      handleEditStart={handleEditStart}
                      handleDelete={handleDelete}
                      isSelected={selectedCategories.includes(item.cat)}
                      onToggleSelect={handleToggleSelect}
                      isParent={isParent}
                      isExpanded={expandedCategories.includes(item.cat)}
                      onToggleExpand={toggleExpand}
                      isSub={item.isSub}
                    />
                  );
                });
              })()}
            </SortableContext>
          </DndContext>
          {categories.length === 0 && (
            <p className="text-center text-slate-500 py-4">No categories found.</p>
          )}
        </div>
        
        <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
          <Button onClick={onClose} variant="outline" className="border-blue-200 text-[#13487a] hover:bg-blue-50">Done</Button>
        </div>
        </div>
      </DialogContent>

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setCategoryToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Category"
        description="Are you sure you want to delete this category? Accounts with this category will keep it, but it won't appear in the list."
      />
    </Dialog>
  );
}
