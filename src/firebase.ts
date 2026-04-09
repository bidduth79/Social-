import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, GoogleAuthProvider, signInWithPopup, linkWithPopup } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();

export const loginAnonymously = async () => {
  try {
    return await signInAnonymously(auth);
  } catch (error) {
    console.error("Error signing in anonymously", error);
  }
};

export const signInWithGoogle = async () => {
  try {
    // If user is already logged in anonymously, we try to link the account
    if (auth.currentUser?.isAnonymous) {
      try {
        return await linkWithPopup(auth.currentUser, googleProvider);
      } catch (linkError: any) {
        // If the Google account is already linked to another user, 
        // we just sign in with that Google account instead.
        if (linkError.code === 'auth/credential-already-in-use') {
          return await signInWithPopup(auth, googleProvider);
        }
        throw linkError;
      }
    }
    return await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};
