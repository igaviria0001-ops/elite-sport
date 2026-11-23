// Subconjunto de Firebase que usa Elite Sport (se empaqueta en js/vendor/firebase.js)
export { initializeApp } from 'firebase/app';
export { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
export {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache,
  doc, collection, query, where, orderBy, limit, onSnapshot, getDoc, getDocs,
  setDoc, updateDoc, deleteDoc, writeBatch, deleteField, arrayUnion, arrayRemove
} from 'firebase/firestore';
