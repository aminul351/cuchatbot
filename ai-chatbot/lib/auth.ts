import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

const googleProvider = new GoogleAuthProvider();

export const ADMIN_EMAILS = ['aminul157246@gmail.com']; // ← change this

export function isAdmin(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email);
}

// Called separately (non-blocking) — does NOT block sign-in
export async function upsertUserInFirestore(user: User) {
  try {
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName ?? '',
        photoURL: user.photoURL ?? '',
        role: isAdmin(user.email) ? 'admin' : 'user',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        messageCount: 0,
      });
    } else {
      await setDoc(ref, { lastLogin: serverTimestamp() }, { merge: true });
    }
  } catch (e) {
    console.warn('Firestore upsert failed (non-critical):', e);
  }
}

export async function signUpWithEmail(email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  upsertUserInFirestore(cred.user); // intentionally NOT awaited
  return cred;
}

export async function signInWithEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  upsertUserInFirestore(cred.user); // intentionally NOT awaited
  return cred;
}

export async function signInWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  upsertUserInFirestore(cred.user); // intentionally NOT awaited
  return cred;
}

export async function signOut() {
  await firebaseSignOut(auth);
}

export { onAuthStateChanged, auth };