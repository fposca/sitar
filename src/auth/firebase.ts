// src/auth/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
apiKey: "AIzaSyDTaH-irpmKWVPkb9MOpymDzKaRI3weTCM",
  authDomain: "neon-sitar.firebaseapp.com",
  projectId: "neon-sitar",
  storageBucket: "neon-sitar.firebasestorage.app",
  messagingSenderId: "632280473938",
  appId: "1:632280473938:web:a9d012aca28a8460201a8b"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
