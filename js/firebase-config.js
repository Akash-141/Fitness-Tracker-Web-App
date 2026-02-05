// ===== Firebase Configuration =====
// 🔥 SETUP INSTRUCTIONS:
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project or select existing one
// 3. Click Settings (⚙️) > Project Settings
// 4. Scroll to "Your apps" section, click Web icon (</>)
// 5. Register your app and copy the config below
// 6. Enable Authentication: Authentication > Sign-in method > Email/Password
// 7. Enable Firestore: Firestore Database > Create database (Start in production mode)
// 8. Update Firestore rules (see firestore.rules file)

const firebaseConfig = {
    apiKey: "AIzaSyAJ5H1GLQpTUlki150m6FWz9i8FLTjnvOA",
    authDomain: "fitnesstrackerwebapp-95928.firebaseapp.com",
    projectId: "fitnesstrackerwebapp-95928",
    storageBucket: "fitnesstrackerwebapp-95928.firebasestorage.app",
    messagingSenderId: "1027615945306",
    appId: "1:1027615945306:web:9a2cc1826e66a7ca079e63"
};

// Initialize Firebase
try {
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log('✓ Firebase initialized successfully');

        // Enable offline persistence for Firestore
        if (firebase.firestore) {
            firebase.firestore().enablePersistence()
                .catch((err) => {
                    if (err.code === 'failed-precondition') {
                        console.warn('Persistence failed: Multiple tabs open');
                    } else if (err.code === 'unimplemented') {
                        console.warn('Persistence not available in this browser');
                    }
                });
        }
    }
} catch (error) {
    console.warn('Firebase initialization error:', error.message);
    console.info('App will work in local-only mode. Sign in to sync across devices.');

}
