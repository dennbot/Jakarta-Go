import React, { useState, useEffect } from 'react';

const AddToTripButton = ({ destination }) => {
  const [isAdded, setIsAdded] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Cek apakah destinasi sudah ditambahkan ke trip
  const checkIfAdded = () => {
    try {
      const savedTrip = localStorage.getItem('yourTrip');
      if (!savedTrip) {
        setIsAdded(false);
        return;
      }
      const parsedTrip = JSON.parse(savedTrip);
      const exists = parsedTrip.some(item => item.id === (destination.id || destination.key));
      setIsAdded(exists);
    } catch (error) {
      console.error('Error checking if destination is in trip:', error);
      setIsAdded(false);
    }
  };

  // Cek setiap destination.id berubah, atau saat event tripUpdated
  useEffect(() => {
    checkIfAdded();
    // Handler untuk event tripUpdated
    const handleTripUpdate = () => {
      checkIfAdded();
    };
    document.addEventListener('tripUpdated', handleTripUpdate);
    // Cleanup
    return () => {
      document.removeEventListener('tripUpdated', handleTripUpdate);
    };
    // eslint-disable-next-line
  }, [destination.id]);

  // Emoji kategori
  const getCategoryEmoji = (category) => {
    switch (category) {
      case 'Kuliner': return '🍜';
      case 'Rekreasi': return '🎡';
      case 'Sejarah': return '🏛';
      case 'Belanja': return '🛍';
      case 'Edukasi': return '📚';
      case 'Alam': return '🌳';
      case 'Cafe': return '☕';
      case 'Venue': return '🏞';
      default: return '📍';
    }
  };

  // Dispatch event trip update
  const dispatchTripUpdateEvent = () => {
    const tripUpdateEvent = new CustomEvent('tripUpdated', {
      bubbles: true,
      detail: { source: 'AddToTripButton' }
    });
    document.dispatchEvent(tripUpdateEvent);
  };

  // Tambah destinasi ke trip
  const handleAddToTrip = () => {
    try {
      setIsLoading(true);

      if (isAdded) {
        setShowFeedback(true);
        setIsLoading(false);
        setTimeout(() => setShowFeedback(false), 3000);
        return;
      }

      const tripItem = {
        id: destination.id || destination.key,
        label: `${getCategoryEmoji(destination.category)} ${destination.category} - ${destination.name}`,
        price: destination.price ? `Rp ${destination.price}` : 'Free',
        category: destination.category,
        location: destination.location,
        operatingHours: destination.operatingHours,
        indoorOutdoor: destination.indoorOutdoor
      };

      const savedTrip = localStorage.getItem('yourTrip');
      let newTrip = [];

      if (savedTrip) {
        newTrip = JSON.parse(savedTrip);
        if (newTrip.some(item => item.id === tripItem.id)) {
          setIsAdded(true);
          setShowFeedback(true);
          setIsLoading(false);
          setTimeout(() => setShowFeedback(false), 3000);
          return;
        }
      }

      newTrip.push(tripItem);
      localStorage.setItem('yourTrip', JSON.stringify(newTrip));

      setIsAdded(true);
      setShowFeedback(true);
      setIsLoading(false);
      setTimeout(() => setShowFeedback(false), 3000);

      localStorage.removeItem('generatedRundown');
      dispatchTripUpdateEvent();

    } catch (error) {
      console.error('Error adding destination to trip:', error);
      setIsLoading(false);
      alert('Gagal menambahkan destinasi ke trip. Silakan coba lagi.');
    }
  };

  // Hapus destinasi dari trip
  const handleRemoveFromTrip = () => {
    try {
      setIsLoading(true);

      const savedTrip = localStorage.getItem('yourTrip');
      if (savedTrip) {
        const parsedTrip = JSON.parse(savedTrip);
        const newTrip = parsedTrip.filter(item => item.id !== (destination.id || destination.key));
        localStorage.setItem('yourTrip', JSON.stringify(newTrip));
        setIsAdded(false);
        setIsLoading(false);
        setShowFeedback(true);
        setTimeout(() => setShowFeedback(false), 3000);

        localStorage.removeItem('generatedRundown');
        dispatchTripUpdateEvent();
      }
    } catch (error) {
      console.error('Error removing destination from trip:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="relative">
      {isAdded ? (
        <button
          onClick={handleRemoveFromTrip}
          disabled={isLoading}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md flex items-center transition-colors"
        >
          {isLoading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              <span>Processing...</span>
            </div>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Added to Trip
            </>
          )}
        </button>
      ) : (
        <button
          onClick={handleAddToTrip}
          disabled={isLoading}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md flex items-center transition-colors"
        >
          {isLoading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              <span>Processing...</span>
            </div>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add to Trip
            </>
          )}
        </button>
      )}

      {/* Feedback toast */}
      {showFeedback && (
        <div
          className="absolute top-full mt-2 right-0 bg-white rounded-md shadow-md px-3 py-2 text-sm border-l-4 z-10 animate-fade-in whitespace-nowrap"
          style={{
            borderColor: isAdded ? '#22c55e' : '#ef4444',
            color: isAdded ? '#16a34a' : '#dc2626'
          }}
        >
          {isAdded
            ? 'Destinasi berhasil ditambahkan ke trip!'
            : 'Destinasi dihapus dari trip!'
          }
        </div>
      )}
    </div>
  );
};

export default AddToTripButton;
