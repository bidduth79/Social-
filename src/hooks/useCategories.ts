import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export const DEFAULT_ACCOUNT_CATEGORIES = [
  'BGB',
  'BSF',
  'Influencer',
  'EX BGB',
  'EX BDR',
  'BDR Group/Page',
  'Talk show',
  'Terrorists',
  'Hill News',
  'Defense Page',
  'BNP',
  'Awami League',
  'Jamat e Islami',
  'NCP',
  'Other\'s Party',
  'Newspaper Facebook Page',
  'Online Newspaper Facebook Page',
  'TV Channel Facebook Page',
  'Indian Bangla Newspaper',
  'Foreign Newspaper Facebook Page',
  'Foreign English Newspaper',
  'High Commission in Dhaka',
  'Other\'s',
  'BDR',
  'BGP',
  'Chatra Dal',
  'Chatra League',
  'Chatra shibir',
  'Influencer (Defense)'
];

export const DEFAULT_NEWSPAPER_CATEGORIES = [
  "National Newspaper", 
  "Online Newspaper", 
  "TV Channels", 
  "International English Newspaper", 
  "International English Newspaper > Indian Newspaper",
  "International English Newspaper > Myanmar Newspaper",
  "International English Newspaper > Pakistan Newspaper",
  "International English Newspaper > Other's",
  "Indian Bangla",
  "Amar Desh"
];

export function useCategories(type: 'accounts' | 'newspapers' = 'accounts') {
  const fieldName = type === 'accounts' ? 'categories' : 'newspaperCategories';
  const defaultCats = type === 'accounts' ? DEFAULT_ACCOUNT_CATEGORIES : DEFAULT_NEWSPAPER_CATEGORIES;
  
  const [categories, setCategories] = useState<string[]>(defaultCats);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    const docRef = doc(db, 'userSettings', auth.currentUser.uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data()[fieldName]) {
        setCategories(docSnap.data()[fieldName]);
      } else {
        // Initialize with default categories if not exists
        setCategories(defaultCats);
        setDoc(docRef, {
          [fieldName]: defaultCats,
          authorUid: auth.currentUser?.uid,
          updatedAt: serverTimestamp()
        }, { merge: true }).catch((error) => {
          handleFirestoreError(error, OperationType.WRITE, `userSettings/${auth.currentUser?.uid}`);
        });
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `userSettings/${auth.currentUser?.uid}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fieldName, auth.currentUser]);

  const updateCategories = async (newCategories: string[]) => {
    if (!auth.currentUser) return;
    const docRef = doc(db, 'userSettings', auth.currentUser.uid);
    await setDoc(docRef, {
      [fieldName]: newCategories,
      authorUid: auth.currentUser.uid,
      updatedAt: serverTimestamp()
    }, { merge: true });
  };

  return { categories, loading, updateCategories };
}
