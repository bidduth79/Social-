import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export const DEFAULT_ACCOUNT_CATEGORIES = [
  'BGB', 'BSF', 'Influencer', 'EX BGB', 'EX BDR', 'BDR Group/Page', 
  'Talk show', 'Terrorists', 'Hill News', 'Defense Page', 
  'BNP', 'Awami League', 'Jamat e Islami', 'NCP', 'Other\'s Party',
  'Newspaper Facebook Page', 'Online Newspaper Facebook Page', 
  'TV Channel Facebook Page', 'Indian Bangla Newspaper', 
  'Foreign Newspaper Facebook Page', 'Foreign English Newspaper',
  'Interim Advisors', 'Coordinator', 'High Commission in Dhaka',
  'Other\'s'
];

export const DEFAULT_NEWSPAPER_CATEGORIES = [
  "National", "Online Only", "English", "TV Channels", "Local", "International", "International English Newspaper", "Sports", "Business", "Technology"
];

export function useCategories(type: 'accounts' | 'newspapers' = 'accounts') {
  const fieldName = type === 'accounts' ? 'categories' : 'newspaperCategories';
  const defaultCats = type === 'accounts' ? DEFAULT_ACCOUNT_CATEGORIES : DEFAULT_NEWSPAPER_CATEGORIES;
  
  const [categories, setCategories] = useState<string[]>(defaultCats);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, 'settings', 'global');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data()[fieldName]) {
        setCategories(docSnap.data()[fieldName]);
      } else {
        // Initialize with default categories if not exists
        setCategories(defaultCats);
        if (auth.currentUser) {
          setDoc(docRef, {
            [fieldName]: defaultCats,
            updatedAt: serverTimestamp()
          }, { merge: true }).catch((error) => {
            handleFirestoreError(error, OperationType.WRITE, 'settings/global');
          });
        }
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fieldName]);

  const updateCategories = async (newCategories: string[]) => {
    const docRef = doc(db, 'settings', 'global');
    await setDoc(docRef, {
      [fieldName]: newCategories,
      updatedAt: serverTimestamp()
    }, { merge: true });
  };

  return { categories, loading, updateCategories };
}
