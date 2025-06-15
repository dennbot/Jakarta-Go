// hooks/useRundown.js
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  saveRundownToFirebase, 
  updateRundown, 
  deleteRundown,
  validateRundownData,
  formatRundownForStorage,
  convertLocalStorageRundown
} from '../utils/rundownUtils';

/**
 * Custom hook for managing user rundowns
 * @param {string} userId - Current user ID
 */
export const useRundown = (userId) => {
  const [rundowns, setRundowns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Load rundowns from Firebase
  const loadRundowns = useCallback(async () => {
    if (!userId) {
      setRundowns([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const rundownsQuery = query(
        collection(db, 'savedRundowns'),
        where('userId', '==', userId),
        where('isActive', '==', true)
      );
      
      const querySnapshot = await getDocs(rundownsQuery);
      const rundownsList = [];
      
      querySnapshot.forEach((doc) => {
        rundownsList.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // Sort by creation date (newest first)
      rundownsList.sort((a, b) => {
        const timeA = a.createdAt?.toDate?.() || 0;
        const timeB = b.createdAt?.toDate?.() || 0;
        return timeB - timeA;
      });
      
      setRundowns(rundownsList);
    } catch (err) {
      console.error('Error loading rundowns:', err);
      setError('Failed to load rundowns');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Real-time listener for rundowns
  const setupRealtimeListener = useCallback(() => {
    if (!userId) return () => {};

    const rundownsQuery = query(
      collection(db, 'savedRundowns'),
      where('userId', '==', userId),
      where('isActive', '==', true)
    );

    const unsubscribe = onSnapshot(rundownsQuery, (snapshot) => {
      const rundownsList = [];
      snapshot.forEach((doc) => {
        rundownsList.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // Sort by creation date (newest first)
      rundownsList.sort((a, b) => {
        const timeA = a.createdAt?.toDate?.() || 0;
        const timeB = b.createdAt?.toDate?.() || 0;
        return timeB - timeA;
      });

      setRundowns(rundownsList);
    }, (err) => {
      console.error('Error in realtime listener:', err);
      setError('Failed to sync rundowns');
    });

    return unsubscribe;
  }, [userId]);

  // Save new rundown
  const saveRundown = useCallback(async (rundownData, customTitle = '') => {
    if (!userId) {
      throw new Error('User not authenticated');
    }
     console.log(rundownData) // debug
    setSaving(true);
    setError(null);

    try {
      // Validate data
      const validation = validateRundownData(rundownData); 
     
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      // Format data
      const formattedData = formatRundownForStorage(rundownData);
  
      
      // Save to Firebase
      const docId = await saveRundownToFirebase(formattedData, userId, customTitle);
      
      // Reload rundowns
      await loadRundowns();
      
      return docId;
    } catch (err) {
      console.error('Error saving rundown:', err);
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [userId, loadRundowns]);

  // Update existing rundown
  const updateExistingRundown = useCallback(async (rundownId, updateData) => {
    setSaving(true);
    setError(null);

    try {
      await updateRundown(rundownId, updateData);
      await loadRundowns();
    } catch (err) {
      console.error('Error updating rundown:', err);
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [loadRundowns]);

  // Delete rundown
  const removeRundown = useCallback(async (rundownId) => {
    setSaving(true);
    setError(null);

    try {
      await deleteRundown(rundownId);
      await loadRundowns();
    } catch (err) {
      console.error('Error deleting rundown:', err);
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [loadRundowns]);

  // Save rundown from localStorage
  const saveFromLocalStorage = useCallback(async (localStorageKey = 'generatedRundown', customTitle = '') => {
    try {
      const rundownData = convertLocalStorageRundown(localStorageKey);
      if (!rundownData) {
        throw new Error('No rundown data found in localStorage');
      }

      const docId = await saveRundown(rundownData, customTitle);
      
      // Clear localStorage after successful save
      localStorage.removeItem(localStorageKey);
      
      return docId;
    } catch (err) {
      console.error('Error saving from localStorage:', err);
      throw err;
    }
  }, [saveRundown]);

  // Check if there's a temp rundown in localStorage
  const checkTempRundown = useCallback((localStorageKey = 'generatedRundown') => {
    try {
      const tempData = localStorage.getItem(localStorageKey);
      return tempData ? JSON.parse(tempData) : null;
    } catch (err) {
      console.error('Error checking temp rundown:', err);
      return null;
    }
  }, []);

  // Get rundown by ID
  const getRundownById = useCallback((rundownId) => {
    return rundowns.find(rundown => rundown.id === rundownId) || null;
  }, [rundowns]);

  // Get rundowns by tag
  const getRundownsByTag = useCallback((tag) => {
    return rundowns.filter(rundown => 
      rundown.tags && rundown.tags.includes(tag)
    );
  }, [rundowns]);

  // Get recent rundowns
  const getRecentRundowns = useCallback((limit = 5) => {
    return rundowns.slice(0, limit);
  }, [rundowns]);

  // Initialize hook
  useEffect(() => {
    if (userId) {
      loadRundowns();
      // Setup realtime listener
      const unsubscribe = setupRealtimeListener();
      return unsubscribe;
    }
  }, [userId, loadRundowns, setupRealtimeListener]);

  return {
    // Data
    rundowns,
    loading,
    error,
    saving,
    
    // Actions
    saveRundown,
    updateExistingRundown,
    removeRundown,
    saveFromLocalStorage,
    loadRundowns,
    
    // Utilities
    checkTempRundown,
    getRundownById,
    getRundownsByTag,
    getRecentRundowns,
    
    // Stats
    totalRundowns: rundowns.length,
    hasRundowns: rundowns.length > 0
  };
};