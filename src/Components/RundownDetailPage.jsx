import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MapPin, Calendar, ArrowLeft, Clock, Star, DollarSign } from 'lucide-react';

const RundownDetailPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [rundown, setRundown] = useState(location.state?.rundown || null);
  const [loading, setLoading] = useState(!location.state?.rundown);
  const [error, setError] = useState(null);

  

  const parsePrice = (price) => {
    if (price === undefined || price === null) return 0;
    if (typeof price === 'number') return price;
    if (typeof price === 'string') {
      // Handle both formatted strings ("Rp 100.000") and raw numbers ("100000")
      const numericString = price.replace(/[^0-9]/g, '');
      const parsed = parseFloat(numericString);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const formatSinglePrice = (price) => {
    const numericPrice = parsePrice(price);
    if (numericPrice === 0) return '-';
    
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(numericPrice).replace('IDR', 'Rp');
  };


  const formatPriceRange = (minPrice, maxPrice) => {
    const min = parsePrice(minPrice);
    const max = parsePrice(maxPrice);
    
    if (min === 0 && max === 0) return '-';
    if (min === max) return `${formatSinglePrice(min)}/pax`;
    
    return `${formatSinglePrice(min)} - ${formatSinglePrice(max)}/pax`;
  };

 

  useEffect(() => {
    if (!location.state?.rundown) {
      const fetchRundown = async () => {
        try {
          const docRef = doc(db, 'savedRundowns', id);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            setRundown(docSnap.data());
          } else {
            setError('Rundown tidak ditemukan');
          }
        } catch (err) {
          console.error('Error fetching rundown:', err);
          setError('Gagal memuat rundown');
        } finally {
          setLoading(false);
        }
      };
      
      fetchRundown();
    }
  }, [id, location.state]);

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Tanggal tidak tersedia';
    
    try {
      let date;
      
      if (timestamp.seconds !== undefined) {
        date = new Date(timestamp.seconds * 1000);
      } else if (typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      } else {
        date = new Date(timestamp);
      }
      
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Tanggal tidak tersedia';
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    return `${hours}:${minutes}`;
  };


  const calculateBudgetEstimation = (itinerary) => {
    let totalLow = 0;
    let totalHigh = 0;

    itinerary.forEach(day => {
      if (day.destinations) {
        day.destinations.forEach(dest => {
          // Get price from either price string or min/max prices
          let priceValue;
          if (dest.price && typeof dest.price === 'string' && dest.price.includes('Rp')) {
            // Handle formatted price strings like "Rp 100.000"
            priceValue = dest.price;
          } else {
            // Use minPrice if available, otherwise fall back to price/cost/estimatedCost
            priceValue = dest.minPrice || dest.price || dest.cost || dest.estimatedCost || 0;
          }
          
          const numericPrice = parsePrice(priceValue);
          
          totalLow += numericPrice;
          totalHigh += numericPrice * 1.1; // Add 10% buffer
        });
      }
    });

    // Add transportation buffer - exactly like YourTripPopup
    totalLow += 0;
    totalHigh += 10000;


    return formatPriceRange(totalLow, totalHigh);
  };

  // Enhanced itinerary normalization - ensures consistent data structure
  const normalizeItinerary = (itinerary) => {
    if (!itinerary) return [];
    
    // Handle array of days with destinations
    if (Array.isArray(itinerary) && itinerary[0]?.destinations) {
      return itinerary.map(day => ({
        ...day,
        destinations: day.destinations.map(dest => ({
          ...dest,
          name: dest.name || dest.destinationName || `Aktivitas ${dest.order}`,
     
          price: dest.price || (dest.minPrice ? formatSinglePrice(dest.minPrice) : '-'),
          minPrice: parsePrice(dest.minPrice || dest.price || dest.cost || dest.estimatedCost),
          maxPrice: parsePrice(dest.maxPrice || dest.price || dest.cost || dest.estimatedCost),
          time: dest.time || dest.startTime,
          description: dest.description || dest.notes
        }))
      }));
    }
    
    // Handle flat array of destinations (like in auto-generated rundown)
    if (Array.isArray(itinerary) && (itinerary[0]?.activity || itinerary[0]?.destinationName || itinerary[0]?.name)) {
      return [{
        dayNumber: 1,
        destinations: itinerary.map(item => ({
          name: item.destinationName || item.name || item.activity || `Aktivitas`,
          description: item.notes || item.description,
          order: item.order || 0,
          // Preserve the exact price string from auto-generated rundown
          price: item.price || '-',
          minPrice: parsePrice(item.minPrice || item.price || item.cost || item.estimatedCost),
          maxPrice: parsePrice(item.maxPrice || item.price || item.cost || item.estimatedCost),
          time: item.time || item.startTime,
          rating: item.rating,
          category: item.category
        }))
      }];
    }
    
    return [];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/profile')}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
          >
            Kembali ke Profil
          </button>
        </div>
      </div>
    );
  }

  if (!rundown) return null;

  const normalizedItinerary = normalizeItinerary(rundown.itinerary);
  
  // Use existing budgetEstimation if available, otherwise calculate
  const budgetEstimation = rundown.budgetEstimation || calculateBudgetEstimation(normalizedItinerary);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-gray-800 mb-6 transition-colors"
        >
          <ArrowLeft size={20} className="mr-2" />
          Kembali
        </button>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-8 text-white">
            <h1 className="text-2xl font-bold mb-2">{rundown.title}</h1>
            <p className="text-blue-100 mb-4">{rundown.description}</p>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center">
                <MapPin size={16} className="mr-1" />
                <span>{rundown.totalDestinations || normalizedItinerary.reduce((total, day) => total + (day.destinations?.length || 0), 0)} Destinasi</span>
              </div>
              <div className="flex items-center">
                <Calendar size={16} className="mr-1" />
                <span>Dibuat: {formatDate(rundown.createdAt)}</span>
              </div>
              <div className="flex items-center">
                <DollarSign size={16} className="mr-1" />
                <span>Estimasi Budget: {budgetEstimation}</span>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Itinerary Perjalanan</h2>
              <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                Total: {budgetEstimation}
              </div>
            </div>
            
            {normalizedItinerary.length > 0 ? (
              <div className="space-y-6">
                {normalizedItinerary.map((day, dayIndex) => (
                  <div key={dayIndex} className="border-l-2 border-blue-500 pl-4">
                    <div className="flex items-center mb-4">
                      <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3">
                        {day.dayNumber || dayIndex + 1}
                      </div>
                      
                    </div>
                    
                    {day.destinations?.length > 0 ? (
                      <div className="space-y-4">
                        {day.destinations
                          .sort((a, b) => (a.order || 0) - (b.order || 0))
                          .map((dest, destIndex) => (
                            <div key={destIndex} className="bg-gray-50 rounded-lg p-4">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-medium text-gray-800">
                                      {dest.name}
                                    </h4>
                                    <div className="ml-4">
                                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium">
                                        {/* Use consistent price display logic */}
                                        {dest.price && dest.price !== '-' && dest.price !== '-' 
                                          ? dest.price 
                                          : dest.minPrice || dest.maxPrice 
                                            ? formatPriceRange(dest.minPrice, dest.maxPrice)
                                            : '-'
                                        }
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {dest.description && (
                                    <p className="text-sm text-gray-600 mb-2">{dest.description}</p>
                                  )}
                                  
                                  <div className="flex items-center text-sm text-gray-500 space-x-4">
                                    {dest.time && (
                                      <span className="flex items-center">
                                        <Clock size={14} className="mr-1" />
                                        {formatTime(dest.time)}
                                      </span>
                                    )}
                                    {dest.rating && (
                                      <span className="flex items-center">
                                        <Star size={14} className="mr-1" />
                                        {dest.rating}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                
                                {dest.category && (
                                  <div className="text-right ml-4">
                                    <p className="text-sm font-medium text-blue-600">{dest.category}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">Tidak ada destinasi untuk hari ini</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">Tidak ada itinerary yang tersedia</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RundownDetailPage;