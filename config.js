// 1. Import Pustaka Firebase dari Server Google (CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// 2. Konfigurasi Kunci Rahasia (Dari data yang Bapak kirim)
const firebaseConfig = {
  apiKey: "AIzaSyAXM4yJgh9F7ajGQApB-Ux1itQ_3pkik_o",
  authDomain: "borsin-tenun-app.firebaseapp.com",
  projectId: "borsin-tenun-app",
  storageBucket: "borsin-tenun-app.firebasestorage.app",
  messagingSenderId: "718889934564",
  appId: "1:718889934564:web:c28a073e261d6783d096f1"
};

// 3. Menghidupkan Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);      // Menyiapkan fitur Login
const db = getFirestore(app);   // Menyiapkan Database

// 4. Kirim (Export) supaya bisa dipakai di main.js
export { auth, db };
