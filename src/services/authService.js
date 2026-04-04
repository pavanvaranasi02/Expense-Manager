import {
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    sendPasswordResetEmail,
    signInWithCredential,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
} from 'firebase/auth';
import {
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';

// ============ REGISTER WITH EMAIL ============
export const registerWithEmail = async (name, email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await updateProfile(user, { displayName: name });

    // Create user document in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      name,
      email,
      phone: null,
      role: 'USER',
      currency: 'INR',
      authProvider: 'email',
      profileImage: null,
      onboardingComplete: false,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });

    console.log('✅ User registered & profile created:', user.uid);
    return { success: true, user };
  } catch (error) {
    console.log('❌ Register error:', error.code, error.message);
    return { success: false, error: getErrorMessage(error.code) };
  }
};

// ============ LOGIN WITH EMAIL ============
export const loginWithEmail = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Check if profile exists, if not create one
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (!userDoc.exists()) {
      await setDoc(doc(db, 'users', user.uid), {
        name: user.displayName || 'User',
        email: user.email,
        role: 'USER',
        onboardingComplete: false,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'users', user.uid), {
        lastLoginAt: serverTimestamp(),
      }, { merge: true });
    }

    console.log('✅ User logged in:', user.uid);
    return { success: true, user };
  } catch (error) {
    console.log('❌ Login error:', error.code);
    return { success: false, error: getErrorMessage(error.code) };
  }
};

// ============ GOOGLE SIGN IN ============
export const signInWithGoogle = async (idToken) => {
  try {
    const credential = GoogleAuthProvider.credential(idToken);
    const userCredential = await signInWithCredential(auth, credential);
    const user = userCredential.user;

    // Check if profile exists
    const userDoc = await getDoc(doc(db, 'users', user.uid));

    if (!userDoc.exists()) {
      // First time — create profile
      await setDoc(doc(db, 'users', user.uid), {
        name: user.displayName || 'User',
        email: user.email,
        role: 'USER',
        authProvider: 'google',
        profileImage: user.photoURL,
        onboardingComplete: false,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });
    } else {
      // Ensure existing profile has the onboardingComplete field if it's missing
      const data = userDoc.data();
      const updates = { lastLoginAt: serverTimestamp() };
      
      if (data.onboardingComplete === undefined) {
          updates.onboardingComplete = false;
      }

      await setDoc(doc(db, 'users', user.uid), updates, { merge: true });
    }

    return { success: true, user };
  } catch (error) {
    return { success: false, error: getErrorMessage(error.code) };
  }
};

// ============ GET USER PROFILE ============
export const getUserProfile = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return { success: true, profile: { id: userId, ...userDoc.data() } };
    }
    return { success: false, error: 'Profile not found' };
  } catch (error) {
    console.log('❌ Get profile error:', error);
    return { success: false, error: error.message };
  }
};

// ============ UPDATE USER PROFILE ============
export const updateUserProfile = async (userId, data) => {
  try {
    await setDoc(doc(db, 'users', userId), {
      ...data,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    console.log('✅ Profile updated for:', userId);
    return { success: true };
  } catch (error) {
    console.log('❌ Update profile error:', error);
    return { success: false, error: error.message };
  }
};

// ============ COMPLETE ONBOARDING ============
export const completeOnboarding = async (userId) => {
  try {
    await setDoc(doc(db, 'users', userId), {
      onboardingComplete: true,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    console.log('✅ Onboarding completed for:', userId);
    return { success: true };
  } catch (error) {
    console.log('❌ Complete onboarding error:', error);
    return { success: false, error: error.message };
  }
};

// ============ LOGOUT ============
export const logoutUser = async () => {
  try {
    await signOut(auth);
    console.log('✅ User logged out');
    return { success: true };
  } catch (error) {
    console.log('❌ Logout error:', error);
    return { success: false, error: error.message };
  }
};

// ============ FORGOT PASSWORD ============
export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error.code) };
  }
};

// ============ ERROR MESSAGES ============
const getErrorMessage = (errorCode) => {
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return 'This email is already registered. Try logging in.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/user-not-found':
      return 'No account found with this email.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection.';
    default:
      return 'Something went wrong. Please try again.';
  }
};