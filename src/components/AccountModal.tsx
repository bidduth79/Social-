import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Account } from '../pages/Accounts';
import { useCategories } from '../hooks/useCategories';
import { Loader2, Upload, X, User, Youtube, Facebook, ClipboardPaste, Plus, LayoutGrid, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { compressImage, extractImageUrlFromHtml } from '../lib/image-utils';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
}

export default function AccountModal({ isOpen, onClose, account }: AccountModalProps) {
  const { categories } = useCategories();
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState<'Facebook' | 'YouTube'>('Facebook');
  const [url, setUrl] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const displayCategories = React.useMemo(() => {
    if (account && account.category && !categories.includes(account.category)) {
      return [...categories, account.category];
    }
    return categories;
  }, [categories, account]);

  useEffect(() => {
    if (account) {
      setName(account.name);
      setPlatform(account.platform);
      setUrl(account.url);
      setThumbnail(account.thumbnail || '');
      setCategory(account.category);
      setNotes(account.notes || '');
    } else {
      setName('');
      setPlatform('Facebook');
      setUrl('');
      setThumbnail('');
      setCategory('');
      setNotes('');
    }
    setError('');
  }, [account, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url || !category) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setError('URL must start with http:// or https://');
      return;
    }

    if (!auth.currentUser) {
      setError('You must be logged in.');
      return;
    }

    setLoading(true);
    setError('');
    const toastId = toast.loading(account ? 'Updating link...' : 'Saving link...');

    const accountData: any = {
      name,
      platform,
      url,
      thumbnail,
      category,
      ...(notes ? { notes } : {}),
      updatedAt: serverTimestamp(),
    };

    try {
      if (account) {
        // Update
        const docRef = doc(db, 'accounts', account.id);
        await updateDoc(docRef, accountData);
        toast.success('Save Successfully', { id: toastId });
      } else {
        // Create
        await addDoc(collection(db, 'accounts'), {
          ...accountData,
          authorUid: auth.currentUser.uid,
          createdAt: serverTimestamp(),
        });
        toast.success('Save Successfully', { id: toastId });
      }
      onClose();
    } catch (err: any) {
      handleFirestoreError(err, account ? OperationType.UPDATE : OperationType.WRITE, account ? `accounts/${account.id}` : 'accounts');
      toast.error('Failed to save link', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const getYouTubeThumbnail = (url: string) => {
    try {
      let videoId = '';
      if (url.includes('youtube.com/watch?v=')) {
        videoId = url.split('v=')[1].split('&')[0];
      } else if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1].split('?')[0];
      } else if (url.includes('youtube.com/embed/')) {
        videoId = url.split('embed/')[1].split('?')[0];
      } else if (url.includes('youtube.com/v/')) {
        videoId = url.split('v/')[1].split('?')[0];
      }

      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      }
      
      // For channels, we can't easily get the profile pic without API, 
      // but we can try to guess if it's a specific format or just leave it for manual paste
      return '';
    } catch (e) {
      return '';
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      toast.error('Image size should be less than 3MB');
      return;
    }

    setIsUploading(true);
    try {
      const compressed = await compressImage(file);
      setThumbnail(compressed);
      toast.success('Profile picture uploaded and optimized');
    } catch (err) {
      console.error('Compression error:', err);
      // Fallback to original Base64 if compression fails
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnail(reader.result as string);
        toast.success('Profile picture uploaded');
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploading(false);
    }
  };

  const handlePaste = React.useCallback(async (e: React.ClipboardEvent | ClipboardEvent) => {
    const clipboardData = (e as React.ClipboardEvent).clipboardData || (e as ClipboardEvent).clipboardData;
    const items = clipboardData?.items;
    if (!items) return;

    let handled = false;

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
          setThumbnail(compressed);
          toast.success('Profile picture pasted and optimized');
        } catch (err) {
          console.error('Compression error:', err);
          // Fallback to original Base64 if compression fails
          const reader = new FileReader();
          reader.onloadend = () => {
            setThumbnail(reader.result as string);
            toast.success('Profile picture pasted');
          };
          reader.readAsDataURL(file);
        } finally {
          setIsUploading(false);
        }
        handled = true;
        break;
      }
    }

    if (!handled) {
      const html = clipboardData?.getData('text/html');
      if (html) {
        const extractedUrl = extractImageUrlFromHtml(html);
        if (extractedUrl) {
          setIsUploading(true);
          try {
            const compressed = await compressImage(extractedUrl);
            setThumbnail(compressed);
            toast.success('Image pasted from website');
            handled = true;
          } catch (err) {
            setThumbnail(extractedUrl);
            toast.success('Image pasted from website');
            handled = true;
          } finally {
            setIsUploading(false);
          }
        }
      }
    }

    if (!handled) {
      const pastedText = clipboardData?.getData('text');
      if (pastedText && (pastedText.startsWith('http') || pastedText.startsWith('data:image'))) {
        // More permissive check for image URLs - if it starts with http, we'll try it
        const isLikelyImage = /\.(jpg|jpeg|png|webp|gif|svg|avif|bmp|ico|tiff)(\?.*)?$/i.test(pastedText) || 
                             pastedText.startsWith('data:image') ||
                             pastedText.includes('fbcdn.net') || 
                             pastedText.includes('googleusercontent.com') ||
                             pastedText.includes('yt3.ggpht.com') ||
                             pastedText.includes('images.unsplash.com') ||
                             pastedText.includes('cloudinary.com');

        if (isLikelyImage || pastedText.startsWith('http')) {
          setIsUploading(true);
          try {
            const compressed = await compressImage(pastedText);
            setThumbnail(compressed);
            toast.success('Image URL pasted and optimized');
            handled = true;
          } catch (err) {
            // If compression fails (e.g. CORS), use original URL if it looks like an image
            if (isLikelyImage) {
              setThumbnail(pastedText);
              toast.success('Image URL pasted');
              handled = true;
            }
          } finally {
            setIsUploading(false);
          }
        }
      }
    }

    if (handled && e.cancelable) {
      e.preventDefault();
    }
  }, []);

  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (!isOpen) return;
      handlePaste(e);
    };
    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [isOpen, handlePaste]);

  useEffect(() => {
    if (platform === 'YouTube' && url && !thumbnail) {
      const ytThumb = getYouTubeThumbnail(url);
      if (ytThumb) {
        setThumbnail(ytThumb);
      }
    }
  }, [url, platform]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{account ? 'Edit Link' : 'Add New Link'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {error && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">{error}</div>}
          
          <div className="space-y-2">
            <label className="text-sm font-bold text-[#13487a]">Name *</label>
            <Input 
              className="border-[#13487a]/30 focus:border-[#13487a] focus-visible:ring-[#13487a]"
              placeholder="e.g. John Doe Official" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-[#13487a]">Platform *</label>
              <Select value={platform} onOpenChange={() => setError('')} onValueChange={(v: any) => setPlatform(v)}>
                <SelectTrigger className="border-[#13487a]/30 focus:ring-[#13487a]">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Facebook">Facebook</SelectItem>
                  <SelectItem value="YouTube">YouTube</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-[#13487a]">Category *</label>
              <Select value={category} onOpenChange={() => setError('')} onValueChange={setCategory}>
                <SelectTrigger className="border-[#13487a]/30 focus:ring-[#13487a]">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {displayCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-[#13487a]">Profile Picture</label>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={async () => {
                  try {
                    // Try to read images from clipboard first
                    let handled = false;
                    
                    // Check if clipboard API is available
                    if (navigator.clipboard && navigator.clipboard.read) {
                      try {
                        const items = await navigator.clipboard.read();
                        for (const item of items) {
                          for (const type of item.types) {
                            if (type.startsWith('image/')) {
                              const blob = await item.getType(type);
                              if (blob.size > 3 * 1024 * 1024) {
                                toast.error('Image size should be less than 3MB');
                                return;
                              }
                              const reader = new FileReader();
                              reader.onloadend = async () => {
                                try {
                                  const compressed = await compressImage(reader.result as string);
                                  setThumbnail(compressed);
                                  toast.success('Profile picture pasted and optimized');
                                } catch (err) {
                                  setThumbnail(reader.result as string);
                                  toast.success('Profile picture pasted');
                                }
                              };
                              reader.readAsDataURL(blob);
                              handled = true;
                              break;
                            }
                          }
                          if (handled) break;
                        }
                      } catch (e) {
                        console.warn('Clipboard read failed, falling back to readText', e);
                      }
                    }

                    if (!handled && navigator.clipboard && navigator.clipboard.readText) {
                      // Try to read text (URL)
                      const text = await navigator.clipboard.readText();
                      if (text && (text.startsWith('http') || text.startsWith('data:image'))) {
                        const isLikelyImage = /\.(jpg|jpeg|png|webp|gif|svg|avif|bmp|ico|tiff)(\?.*)?$/i.test(text) || 
                                             text.startsWith('data:image') ||
                                             text.includes('fbcdn.net') || 
                                             text.includes('googleusercontent.com') ||
                                             text.includes('yt3.ggpht.com') ||
                                             text.includes('images.unsplash.com') ||
                                             text.includes('cloudinary.com');
                        
                        if (isLikelyImage || text.startsWith('http')) {
                          try {
                            const compressed = await compressImage(text);
                            setThumbnail(compressed);
                            toast.success('Image URL pasted and optimized');
                            handled = true;
                          } catch (err) {
                            if (isLikelyImage) {
                              setThumbnail(text);
                              toast.success('Image URL pasted');
                              handled = true;
                            }
                          }
                        }
                      }
                    }

                    if (!handled) {
                      toast.info('No image found in clipboard. Copy an image or image URL first.');
                    }
                  } catch (err) {
                    // Fallback if clipboard API is completely blocked
                    toast.info('Press Ctrl+V to paste or use the Upload button');
                  }
                }}
                className="group relative h-20 w-20 rounded-full border-2 border-dashed border-[#13487a]/30 hover:border-[#13487a] flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-800 transition-all"
                title="Click to paste from clipboard"
              >
                {thumbnail ? (
                  <>
                    <img 
                      src={thumbnail} 
                      alt="Preview" 
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <ClipboardPaste className="h-6 w-6 text-white" />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-slate-400 group-hover:text-[#13487a]">
                    <User className="h-8 w-8" />
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
                    className="flex-1 gap-2 border-[#13487a]/30 text-[#13487a]"
                    onClick={() => document.getElementById('account-logo-upload')?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Upload
                  </Button>
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm"
                    className="flex-1 gap-2 border-[#13487a]/30 text-[#13487a]"
                    onClick={async () => {
                      const toastId = toast.loading('Reading clipboard...');
                      try {
                        let handled = false;
                        if (navigator.clipboard && navigator.clipboard.read) {
                          try {
                            const items = await navigator.clipboard.read();
                            for (const item of items) {
                              for (const type of item.types) {
                                if (type.startsWith('image/')) {
                                  const blob = await item.getType(type);
                                  const reader = new FileReader();
                                  reader.onloadend = async () => {
                                    try {
                                      const compressed = await compressImage(reader.result as string);
                                      setThumbnail(compressed);
                                      toast.success('Image pasted!', { id: toastId });
                                    } catch (err) {
                                      setThumbnail(reader.result as string);
                                      toast.success('Image pasted!', { id: toastId });
                                    }
                                  };
                                  reader.readAsDataURL(blob);
                                  handled = true;
                                  break;
                                }
                              }
                              if (handled) break;
                            }
                          } catch (e) {
                            console.warn('read() failed', e);
                          }
                        }

                        if (!handled && navigator.clipboard && navigator.clipboard.readText) {
                          const text = await navigator.clipboard.readText();
                          if (text && (text.startsWith('http') || text.startsWith('data:image'))) {
                            try {
                              const compressed = await compressImage(text);
                              setThumbnail(compressed);
                              toast.success('Image URL pasted!', { id: toastId });
                              handled = true;
                            } catch (err) {
                              setThumbnail(text);
                              toast.success('Image URL pasted!', { id: toastId });
                              handled = true;
                            }
                          }
                        }

                        if (!handled) {
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
                  {thumbnail && (
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => setThumbnail('')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <input 
                  id="account-logo-upload"
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleImageUpload}
                />
                <p className="text-[10px] text-slate-500">
                  Max size: 3MB. <span className="text-[#13487a] font-medium underline cursor-pointer" onClick={() => document.getElementById('account-logo-url-input')?.focus()}>Paste URL below</span> or <span className="text-[#13487a] font-medium">press Ctrl+V</span>.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-[#13487a]">Logo URL (Alternative to Paste)</label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#13487a]/60" />
              <Input 
                id="account-logo-url-input"
                className="pl-9 border-[#13487a]/30 focus:border-[#13487a] focus-visible:ring-[#13487a]"
                placeholder="Paste image URL here..." 
                value={thumbnail.startsWith('data:') ? '' : thumbnail} 
                onChange={async (e) => {
                  const val = e.target.value;
                  setThumbnail(val);
                  if (val && (val.startsWith('http') || val.startsWith('data:image'))) {
                    try {
                      const compressed = await compressImage(val);
                      setThumbnail(compressed);
                    } catch (err) {
                      // Keep original URL if compression fails
                    }
                  }
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-[#13487a]">URL *</label>
            <Input 
              className="border-[#13487a]/30 focus:border-[#13487a] focus-visible:ring-[#13487a]"
              type="url"
              placeholder="https://facebook.com/..." 
              value={url} 
              onChange={(e) => setUrl(e.target.value)} 
              maxLength={1000}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-[#13487a]">Notes (Optional)</label>
            <Input 
              className="border-[#13487a]/30 focus:border-[#13487a] focus-visible:ring-[#13487a]"
              placeholder="Additional details..." 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              maxLength={2000}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="border-blue-200 text-[#13487a] hover:bg-blue-50">Cancel</Button>
            <Button type="submit" disabled={loading} className="bg-[#13487a] hover:bg-[#13487a]/90 text-white shadow-md hover:shadow-lg transition-all">
              {loading ? 'Saving...' : account ? 'Update Link' : 'Save Link'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
