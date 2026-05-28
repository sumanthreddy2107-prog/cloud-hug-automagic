import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBbpf9p8WZcvXMbP028Dip3Mzg9NtTBJG4",
    authDomain: "kaaizens-library.firebaseapp.com",
      projectId: "kaaizens-library",
        storageBucket: "kaaizens-library.firebasestorage.app",
          messagingSenderId: "755416177452",
            appId: "1:755416177452:web:3fa0f6dde47dbeb39fea89",
            };

            const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
            export const auth = getAuth(app);
