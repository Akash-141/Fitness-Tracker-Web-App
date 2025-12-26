// ===== App State =====
let currentUser = null;
let workouts = [];
let weeklyChart = null;
let distributionChart = null;
let isSignUpMode = false;

// ===== DOM Elements =====
const elements = {
    themeToggle: document.getElementById('themeToggle'),
    authBtn: document.getElementById('authBtn'),
    authModal: document.getElementById('authModal'),
    modalBackdrop: document.getElementById('modalBackdrop'),
    closeModal: document.getElementById('closeModal'),
    authForm: document.getElementById('authForm'),
    toggleAuthMode: document.getElementById('toggleAuthMode'),
    modalTitle: document.getElementById('modalTitle'),
    workoutForm: document.getElementById('workoutForm'),
    activityList: document.getElementById('activityList'),
    totalWorkouts: document.getElementById('totalWorkouts'),
    totalMinutes: document.getElementById('totalMinutes'),
    currentStreak: document.getElementById('currentStreak'),
    caloriesBurned: document.getElementById('caloriesBurned'),
    goalDays: document.getElementById('goalDays'),
    goalMinutes: document.getElementById('goalMinutes'),
    goalDaysProgress: document.getElementById('goalDaysProgress'),
    goalMinutesProgress: document.getElementById('goalMinutesProgress')
};

// ===== Utility Functions =====
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</div>
        <div>${message}</div>
    `;
    document.getElementById('toastContainer').appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function calculateCalories(type, duration, intensity) {
    const baseCalories = {
        cardio: 10,
        strength: 8,
        yoga: 4,
        sports: 9,
        cycling: 8,
        swimming: 11,
        other: 6
    };

    const intensityMultiplier = {
        light: 0.8,
        moderate: 1.0,
        intense: 1.3
    };

    return Math.round(baseCalories[type] * duration * intensityMultiplier[intensity]);
}

function calculateStreak() {
    if (workouts.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sortedWorkouts = [...workouts].sort((a, b) => new Date(b.date) - new Date(a.date));
    let streak = 0;
    let currentDate = new Date(today);

    for (const workout of sortedWorkouts) {
        const workoutDate = new Date(workout.date);
        workoutDate.setHours(0, 0, 0, 0);

        if (workoutDate.getTime() === currentDate.getTime()) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
        } else if (workoutDate.getTime() < currentDate.getTime()) {
            break;
        }
    }

    return streak;
}

// ===== Theme Toggle =====
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        elements.themeToggle.innerHTML = '<span class="theme-icon">☀️</span>';
    } else {
        document.documentElement.removeAttribute('data-theme');
        elements.themeToggle.innerHTML = '<span class="theme-icon">🌙</span>';
    }
    localStorage.setItem('theme', theme);
}

elements.themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
});

// ===== Auth Modal =====
function openAuthModal() {
    elements.authModal.classList.add('active');
}

function closeAuthModal() {
    elements.authModal.classList.remove('active');
}

elements.authBtn.addEventListener('click', () => {
    if (currentUser) {
        signOut();
    } else {
        openAuthModal();
    }
});

elements.closeModal.addEventListener('click', closeAuthModal);
elements.modalBackdrop.addEventListener('click', closeAuthModal);

elements.toggleAuthMode.addEventListener('click', () => {
    isSignUpMode = !isSignUpMode;
    elements.modalTitle.textContent = isSignUpMode ? 'Create Account' : 'Welcome Back';
    elements.authForm.querySelector('button[type="submit"]').textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
    elements.toggleAuthMode.textContent = isSignUpMode ? 'Already have an account?' : 'Create new account';

    // Show/hide Full Name field
    const fullNameGroup = document.getElementById('fullNameGroup');
    const fullNameInput = document.getElementById('authFullName');
    if (isSignUpMode) {
        fullNameGroup.classList.remove('hidden');
        fullNameInput.required = true;
    } else {
        fullNameGroup.classList.add('hidden');
        fullNameInput.required = false;
    }
});

elements.authForm.addEventListener('submit', async(e) => {
    e.preventDefault();
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const fullName = document.getElementById('authFullName').value.trim();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;

    if (!window.firebase || !firebase.auth) {
        showToast('Firebase not configured. Using local mode.', 'info');
        localSignIn(email, fullName);
        return;
    }

    // Disable button and show loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Processing...</span>';

    try {
        if (isSignUpMode) {
            // Create user account
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Save user profile to Firestore
            await firebase.firestore().collection('users').doc(user.uid).set({
                fullName: fullName,
                email: email,
                createdAt: new Date().toISOString()
            });

            // Update display name in Firebase Auth
            await user.updateProfile({ displayName: fullName });

            // Manually set currentUser with displayName to ensure immediate display
            currentUser = user;
            currentUser.displayName = fullName;

            // Force auth state refresh
            await user.reload();

            showToast('Account created successfully! 🎉', 'success');
        } else {
            await firebase.auth().signInWithEmailAndPassword(email, password);
            showToast('Signed in successfully! Welcome back! 👋', 'success');
        }
        closeAuthModal();
    } catch (error) {
        // Better error messages
        let errorMessage = error.message;
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'This email is already registered. Please sign in instead.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address format.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password should be at least 6 characters.';
        } else if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email.';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password. Please try again.';
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage = 'Network error. Please check your connection.';
        }
        showToast(errorMessage, 'error');
    } finally {
        // Re-enable button
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
});

function localSignIn(email, fullName = 'User') {
    currentUser = { email, uid: 'local-' + Date.now(), displayName: fullName };
    updateAuthUI();
    loadWorkoutsFromLocal();
    closeAuthModal();
    showToast('Signed in locally (data saved to browser)', 'success');
}

function signOut() {
    if (firebase && firebase.auth && firebase.auth().currentUser) {
        firebase.auth().signOut();
    } else {
        currentUser = null;
        updateAuthUI();
        workouts = [];
        updateDashboard();
    }
    showToast('Signed out successfully', 'info');
}

function updateAuthUI() {
    const welcomeMessageEl = document.getElementById('welcomeMessage');
    const authBtn = document.getElementById('authBtn');

    if (currentUser) {
        if (authBtn) {
            authBtn.textContent = 'Sign Out';
            authBtn.classList.add('btn-primary');
        }

        // Display welcome message
        if (welcomeMessageEl) {
            const displayName = currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'User');
            console.log('Display name:', displayName, 'currentUser.displayName:', currentUser.displayName);
            welcomeMessageEl.textContent = `Welcome, ${displayName}`;
            welcomeMessageEl.classList.remove('hidden');
            welcomeMessageEl.classList.add('visible');
        }
    } else {
        if (authBtn) {
            authBtn.textContent = 'Sign In';
        }
        if (welcomeMessageEl) {
            welcomeMessageEl.classList.add('hidden');
            welcomeMessageEl.classList.remove('visible');
        }
    }
}

// ===== Firebase Integration =====
if (window.firebase && firebase.auth) {
    firebase.auth().onAuthStateChanged(async(user) => {
        if (!user) {
            // User signed out
            currentUser = null;
            updateAuthUI();
            loadGuestWorkouts();
            return;
        }

        // Create a user object with displayName property
        currentUser = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            emailVerified: user.emailVerified
        };

        // Load user profile from Firestore to get full name
        if (firebase.firestore) {
            try {
                const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
                console.log('User document exists:', userDoc.exists);
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    console.log('User data from Firestore:', userData);
                    if (userData && userData.fullName) {
                        // Set displayName to full name from Firestore
                        currentUser.displayName = userData.fullName;
                        console.log('Set displayName to:', userData.fullName);
                    }
                } else {
                    console.log('No user document found in Firestore for uid:', user.uid);
                }
            } catch (error) {
                console.error('Error loading user profile:', error);
            }
        }

        // Call updateAuthUI AFTER loading profile
        updateAuthUI();
        await loadWorkoutsFromFirebase();
    });
}

async function loadWorkoutsFromFirebase() {
    if (!currentUser || !firebase.firestore) return;

    try {
        const db = firebase.firestore();
        const snapshot = await db.collection('users')
            .doc(currentUser.uid)
            .collection('workouts')
            .orderBy('date', 'desc')
            .limit(100)
            .get();

        workouts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Also save to localStorage as backup
        saveWorkoutsToLocal();

        updateDashboard();
        console.log(`✓ Loaded ${workouts.length} workouts from cloud`);
    } catch (error) {
        console.error('Error loading workouts:', error);

        // Fallback to local storage
        loadWorkoutsFromLocal();
    }
}

async function saveWorkoutToFirebase(workout) {
    if (!currentUser || !firebase.firestore) {
        console.log('Firebase not available, using local storage only');
        return;
    }

    try {
        const db = firebase.firestore();
        const docRef = await db.collection('users')
            .doc(currentUser.uid)
            .collection('workouts')
            .add(workout);

        // Update the workout with Firebase ID
        workout.id = docRef.id;

        console.log('✓ Workout synced to cloud');
    } catch (error) {
        console.error('Error saving workout:', error);
        showToast('Saved locally, cloud sync failed', 'error');
    }
}

async function deleteWorkoutFromFirebase(id) {
    if (!currentUser || !firebase.firestore) return;

    try {
        const db = firebase.firestore();
        await db.collection('users')
            .doc(currentUser.uid)
            .collection('workouts')
            .doc(id)
            .delete();
    } catch (error) {
        console.error('Error deleting workout:', error);
    }
}

// ===== Local Storage Functions =====
function loadWorkoutsFromLocal() {
    const stored = localStorage.getItem(`workouts_${currentUser.uid}`);
    if (stored) {
        workouts = JSON.parse(stored);
        updateDashboard();
    }
}

function saveWorkoutsToLocal() {
    if (currentUser) {
        localStorage.setItem(`workouts_${currentUser.uid}`, JSON.stringify(workouts));
    }
}

// ===== Workout Form =====
elements.workoutForm.addEventListener('submit', async(e) => {
    e.preventDefault();

    // Allow guest mode without requiring sign in
    if (!currentUser || (!currentUser.isGuest && !firebase.auth)) {
        showToast('Please sign in to sync workouts to cloud', 'info');
        // Still allow local storage
        currentUser = { email: 'guest@local', uid: 'guest-local', isGuest: true };
    }

    const workout = {
        type: document.getElementById('workoutType').value,
        duration: parseInt(document.getElementById('duration').value),
        intensity: document.getElementById('intensity').value,
        notes: document.getElementById('notes').value,
        date: new Date().toISOString(),
        calories: 0
    };

    workout.calories = calculateCalories(workout.type, workout.duration, workout.intensity);

    // Save to Firebase if user is authenticated (not guest)
    if (currentUser && !currentUser.isGuest) {
        await saveWorkoutToFirebase(workout);
        // Reload from Firebase to ensure sync
        await loadWorkoutsFromFirebase();
    } else {
        // For guest mode, add to local array
        workouts.unshift(workout);
        // Save to local storage
        saveWorkoutsToLocal();
        // Update UI
        updateDashboard();
    }

    elements.workoutForm.reset();

    const syncMessage = currentUser && !currentUser.isGuest ?
        'Workout added & synced to cloud! 🎉' :
        'Workout added locally! 📱 Sign in to sync to cloud.';

    showToast(syncMessage, 'success');
});

// ===== Dashboard Updates =====
function updateDashboard() {
    updateStats();
    updateActivityFeed();
    updateGoals();
    updateCharts();
}

function updateStats() {
    const totalWorkoutsCount = workouts.length;
    const totalMinutesCount = workouts.reduce((sum, w) => sum + w.duration, 0);
    const totalCalories = workouts.reduce((sum, w) => sum + (w.calories || 0), 0);
    const streak = calculateStreak();

    // Get fresh element references to ensure they exist
    const totalWorkoutsEl = document.getElementById('totalWorkouts');
    const totalMinutesEl = document.getElementById('totalMinutes');
    const currentStreakEl = document.getElementById('currentStreak');
    const caloriesBurnedEl = document.getElementById('caloriesBurned');

    // Directly set values without animation to prevent flickering
    if (totalWorkoutsEl) totalWorkoutsEl.textContent = totalWorkoutsCount;
    if (totalMinutesEl) totalMinutesEl.textContent = totalMinutesCount;
    if (currentStreakEl) currentStreakEl.textContent = streak;
    if (caloriesBurnedEl) caloriesBurnedEl.textContent = totalCalories;

    console.log('Stats updated:', { totalWorkoutsCount, totalMinutesCount, streak, totalCalories });
}

function animateValue(element, start, end, duration) {
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;

    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            current = end;
            clearInterval(timer);
        }
        element.textContent = Math.round(current);
    }, 16);
}

function updateActivityFeed() {
    if (workouts.length === 0) {
        elements.activityList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📊</div>
                <p>No workouts yet. Start tracking your fitness journey!</p>
            </div>
        `;
        return;
    }

    const typeEmojis = {
        cardio: '🏃',
        strength: '💪',
        yoga: '🧘',
        sports: '⚽',
        cycling: '🚴',
        swimming: '🏊',
        other: '🎯'
    };

    elements.activityList.innerHTML = workouts.slice(0, 10).map((workout, index) => `
        <div class="activity-item">
            <div class="activity-icon">${typeEmojis[workout.type]}</div>
            <div class="activity-content">
                <div class="activity-title">${workout.type.charAt(0).toUpperCase() + workout.type.slice(1)} • ${workout.duration} min</div>
                <div class="activity-meta">${workout.notes || 'No notes'} • ${formatDate(workout.date)} • ${workout.calories} cal</div>
            </div>
            <button class="activity-delete btn-icon" onclick="deleteWorkout(${index})" title="Delete">×</button>
        </div>
    `).join('');
}

window.deleteWorkout = async function(index) {
    const workout = workouts[index];
    workouts.splice(index, 1);

    if (workout.id) {
        await deleteWorkoutFromFirebase(workout.id);
    }

    saveWorkoutsToLocal();
    updateDashboard();
    showToast('Workout deleted', 'info');
};

function updateGoals() {
    const thisWeek = getThisWeekWorkouts();
    const workoutDays = new Set(thisWeek.map(w => new Date(w.date).toDateString())).size;
    const weekMinutes = thisWeek.reduce((sum, w) => sum + w.duration, 0);

    const dayGoal = 5;
    const minuteGoal = 150;

    elements.goalDays.textContent = `${workoutDays}/${dayGoal}`;
    elements.goalMinutes.textContent = `${weekMinutes}/${minuteGoal}`;

    const dayProgress = Math.min((workoutDays / dayGoal) * 100, 100);
    const minuteProgress = Math.min((weekMinutes / minuteGoal) * 100, 100);

    elements.goalDaysProgress.style.width = `${dayProgress}%`;
    elements.goalMinutesProgress.style.width = `${minuteProgress}%`;
}

function getThisWeekWorkouts() {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    return workouts.filter(w => new Date(w.date) >= weekStart);
}

// ===== Charts =====
function updateCharts() {
    updateWeeklyChart();
    updateDistributionChart();
}

function updateWeeklyChart() {
    const ctx = document.getElementById('weeklyChart');
    if (!ctx) return;

    const last7Days = [...Array(7)].map((_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return date;
    });

    const data = last7Days.map(date => {
        const dayWorkouts = workouts.filter(w => {
            const wDate = new Date(w.date);
            return wDate.toDateString() === date.toDateString();
        });
        return dayWorkouts.reduce((sum, w) => sum + w.duration, 0);
    });

    const labels = last7Days.map(d => d.toLocaleDateString('en-US', { weekday: 'short' }));

    if (weeklyChart) {
        weeklyChart.data.labels = labels;
        weeklyChart.data.datasets[0].data = data;
        weeklyChart.update();
    } else {
        weeklyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Minutes',
                    data,
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderRadius: 8,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }
}

function updateDistributionChart() {
    const ctx = document.getElementById('distributionChart');
    if (!ctx) return;

    const typeCounts = {};
    workouts.forEach(w => {
        typeCounts[w.type] = (typeCounts[w.type] || 0) + 1;
    });

    const labels = Object.keys(typeCounts);
    const data = Object.values(typeCounts);

    if (distributionChart) {
        distributionChart.data.labels = labels;
        distributionChart.data.datasets[0].data = data;
        distributionChart.update();
    } else {
        distributionChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
                datasets: [{
                    data,
                    backgroundColor: [
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(240, 147, 251, 0.8)',
                        'rgba(79, 172, 254, 0.8)',
                        'rgba(67, 233, 123, 0.8)',
                        'rgba(245, 158, 11, 0.8)',
                        'rgba(139, 92, 246, 0.8)',
                        'rgba(236, 72, 153, 0.8)',
                    ],
                    borderWidth: 0,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
}

// ===== Guest Mode Functions =====
function loadGuestWorkouts() {
    const stored = localStorage.getItem('workouts_guest-local');
    if (stored) {
        try {
            workouts = JSON.parse(stored);
            console.log(`Loaded ${workouts.length} workouts from local storage`);
        } catch (error) {
            console.error('Error loading local workouts:', error);
            workouts = [];
        }
    }
}

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    initTheme();

    // Check if Firebase is configured
    const isFirebaseConfigured = window.firebase &&
        firebase.apps &&
        firebase.apps.length > 0;

    if (!isFirebaseConfigured) {
        console.log('📱 Running in local-only mode (Firebase not configured)');
        showToast('Running in offline mode. Sign in to enable cloud sync!', 'info');

        // Load from guest storage
        loadGuestWorkouts();
    }

    // If no user and no Firebase, allow guest mode
    if (!currentUser && !isFirebaseConfigured) {
        // Enable guest mode
        currentUser = { email: 'guest@local', uid: 'guest-local', isGuest: true };
    }

    updateDashboard();
});