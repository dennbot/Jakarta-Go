// utils/rundownUtils.js
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

/**
 * Save a generated rundown to Firebase
 * @param {Object} rundownData - The rundown data to save
 * @param {string} userId - Current user ID
 * @param {string} customTitle - Optional custom title
 * @returns {Promise<string>} - Document ID of saved rundown
 */
export const saveRundownToFirebase = async (rundownData, userId, customTitle = '') => {
  try {
    const rundownToSave = {
      userId: userId,
      title: customTitle || rundownData.title || 'My Jakarta Trip',
      description: rundownData.description || 'Generated rundown for Jakarta trip',
      itinerary: rundownData.itinerary || [],
      budgetEstimation: rundownData.budgetEstimation || 'Belum dihitung',
      totalDestinations: rundownData.itinerary?.length || 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isActive: true,
      tags: rundownData.tags || ['jakarta', 'wisata'],
      // Additional metadata
      generatedFrom: 'auto-generator', // To track source
      tripType: rundownData.tripType || 'general',
      estimatedDuration: rundownData.estimatedDuration || '1 day'
    };

    const docRef = await addDoc(collection(db, 'savedRundowns'), rundownToSave);
    return docRef.id;
  } catch (error) {
    console.error('Error saving rundown:', error);
    throw error;
  }
};

/**
 * Update an existing rundown
 * @param {string} rundownId - Document ID to update
 * @param {Object} updateData - Data to update
 * @returns {Promise<void>}
 */
export const updateRundown = async (rundownId, updateData) => {
  try {
    const rundownRef = doc(db, 'savedRundowns', rundownId);
    await updateDoc(rundownRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating rundown:', error);
    throw error;
  }
};

/**
 * Soft delete a rundown
 * @param {string} rundownId - Document ID to delete
 * @returns {Promise<void>}
 */
export const deleteRundown = async (rundownId) => {
  try {
    const rundownRef = doc(db, 'savedRundowns', rundownId);
    await updateDoc(rundownRef, {
      isActive: false,
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error deleting rundown:', error);
    throw error;
  }
};

/**
 * Validate rundown data before saving
 * @param {Object} rundownData - Rundown data to validate
 * @returns {Object} - Validation result
 */
export const validateRundownData = (rundownData) => {
  const errors = [];
  
  if (!rundownData) {
    errors.push('Rundown data is required');
    return { isValid: false, errors };
  }
  
  if (!rundownData.itinerary || !Array.isArray(rundownData.itinerary)) {
    errors.push('Itinerary must be an array');
  }
  
  if (rundownData.itinerary && rundownData.itinerary.length === 0) {
    errors.push('Itinerary cannot be empty');
  }
  
  // Validate each itinerary item
  if (rundownData.itinerary && rundownData.itinerary.length > 0) {
    rundownData.itinerary.forEach((item, index) => {
      if (!item.activity) {
        errors.push(`Destination name is required for item ${index + 1}`);
      }
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Format rundown data for consistent storage
 * @param {Object} rawRundownData - Raw rundown data from generator
 * @returns {Object} - Formatted rundown data
 */

export const formatRundownForStorage = (rawRundownData) => {
  return {
    title: rawRundownData.title || 'My Jakarta Trip',
    description: rawRundownData.description || '',
    itinerary: (rawRundownData.itinerary || []).map((item, index) => ({
      order: index + 1,
      destinationName: item.activity || item.name || item.destinationName || 'Unknown Destination',
      location: item.location || '',
      estimatedCost: item.estimatedCost || item.price || 0,
      category: item.category || 'wisata',
      notes: item.notes || '',
      price: item.price || 0
    })),
    budgetEstimation: rawRundownData.budgetEstimation || 'Belum dihitung',
    totalDestinations: (rawRundownData.itinerary || []).length,
    tags: rawRundownData.tags || [],
    tripType: rawRundownData.tripType || 'general',
    // Handle both auto-generated and manual trip durations
    estimatedDuration: rawRundownData.estimatedDuration || 
                     rawRundownData.tripDetails?.preferences?.duration || 
                     '1 day'
  };
};

/**
 * Convert localStorage rundown to Firebase format
 * @param {string} localStorageKey - Key to retrieve from localStorage
 * @returns {Object|null} - Formatted rundown data or null
 */
export const convertLocalStorageRundown = (localStorageKey = 'generatedRundown') => {
  try {
    const localData = localStorage.getItem(localStorageKey);
    if (!localData) return null;
    
    const parsedData = JSON.parse(localData);
    return formatRundownForStorage(parsedData);
  } catch (error) {
    console.error('Error converting localStorage rundown:', error);
    return null;
  }
};


/**
 * Calculate total estimated cost from itinerary
 * @param {Array} itinerary - Array of destination objects
 * @returns {number} - Total estimated cost
 */
export const calculateTotalCost = (itinerary) => {
  if (!Array.isArray(itinerary)) return 0;
  
  return itinerary.reduce((total, item) => {
    const cost = typeof item.estimatedCost === 'number' ? item.estimatedCost : 0;
    return total + cost;
  }, 0);
};

/**
 * Format currency in Indonesian Rupiah
 * @param {number} amount - Amount to format
 * @returns {string} - Formatted currency string
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};