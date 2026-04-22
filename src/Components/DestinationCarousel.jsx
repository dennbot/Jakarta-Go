import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DestinationCarousel = ({ activeCategory, searchQuery }) => {
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewsData, setReviewsData] = useState({});
  const [currentSlide, setCurrentSlide] = useState(0);
  const carouselRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const destinasiRef = collection(db, "destinasi");
        const querySnapshot = await getDocs(destinasiRef);

        const destinationArray = [];
        querySnapshot.forEach((doc) => {
          destinationArray.push({ ...doc.data(), key: doc.id });
        });

        const sortedDestinations = destinationArray.sort((a, b) => (b.featured || 0) - (a.featured || 0));
        setDestinations(sortedDestinations);
        await fetchReviews();
        setLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to load destinations");
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line
  }, []);

  const fetchReviews = async () => {
    try {
      const reviewsRef = collection(db, "reviews");
      const reviewsSnapshot = await getDocs(reviewsRef);
      const reviewsMap = {};

      reviewsSnapshot.forEach((doc) => {
        const reviewData = doc.data();
        const destinationId = reviewData.destinationId;
        if (!reviewsMap[destinationId]) {
          reviewsMap[destinationId] = { totalRating: 0, count: 0, reviews: [] };
        }
        const ratingValue = parseFloat(reviewData.rating) || 0;
        reviewsMap[destinationId].totalRating += ratingValue;
        reviewsMap[destinationId].count += 1;
        reviewsMap[destinationId].reviews.push({ id: doc.id, ...reviewData, rating: ratingValue });
      });

      Object.keys(reviewsMap).forEach((destinationId) => {
        const { totalRating, count } = reviewsMap[destinationId];
        reviewsMap[destinationId].averageRating = count > 0 ? totalRating / count : 0;
      });

      setReviewsData(reviewsMap);
    } catch (error) {
      console.error("Error fetching reviews:", error);
    }
  };

  const filteredDestinations = destinations.filter(destination => {
    const matchCategory = activeCategory ? destination.category === activeCategory : true;
    const matchSearch = searchQuery ? destination.name.toLowerCase().includes(searchQuery.toLowerCase()) : true;
    return matchCategory && matchSearch;
  });

  useEffect(() => {
    setCurrentSlide(0);
    if (carouselRef.current) {
      carouselRef.current.scrollLeft = 0;
    }
  }, [activeCategory, searchQuery]);

  // Handle navigation with error handling
  const handleLearnMore = (destinationId) => {
    try {
      navigate(`/destination/${destinationId}`);
    } catch (error) {
      console.error("Navigation error:", error);
      window.location.href = `/destination/${destinationId}`;
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center">
        <h2 className="text-3xl font-bold mb-4">Loading Destinations...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center">
        <h2 className="text-3xl font-bold mb-4">Popular Destinations</h2>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <section className="py-16 relative bg-gradient-to-b from-cyan-50 to-white">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">Top Destinations in Jakarta</h2>
        </div>

        {filteredDestinations.length === 0 ? (
          <p className="text-center text-gray-500">No destinations found.</p>
        ) : (
          <div className="relative group">
            <button 
              onClick={() => {
                if (carouselRef.current) {
                  carouselRef.current.scrollBy({ left: -carouselRef.current.offsetWidth, behavior: 'smooth' });
                  setCurrentSlide(prev => Math.max(prev - 1, 0));
                }
              }}
              className="absolute left-0 top-1/2 -translate-y-1/2 -ml-4 z-10 bg-white/80 hover:bg-white text-gray-800 p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft size={24} />
            </button>

            <div
              ref={carouselRef}
              className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar gap-4 pb-4"
              style={{ scrollSnapType: 'x mandatory', scrollBehavior: 'smooth' }}
            >
              {filteredDestinations.map((destination) => (
                <div key={destination.key} className="flex-none snap-start w-80 overflow-hidden rounded-xl shadow-lg transform hover:scale-105 transition-all duration-300">
                  <div className="relative h-48">
                    {destination.imgurl ? (
                      <img 
                        src={destination.imgurl} 
                        alt={destination.name} 
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-200">
                        <span className="text-gray-400">No Image</span>
                      </div>
                    )}
                    {destination.category && (
                      <div className="absolute top-3 right-3 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                        {destination.category}
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-white">
                    <h3 className="text-gray-800 font-semibold text-lg mb-2">{destination.name}</h3>
                    <p className="text-gray-600 text-sm line-clamp-2">
                      {destination.description || "Explore this amazing destination in Jakarta!"}
                    </p>
                    <div className="mt-4 flex justify-between items-center">
                      <button
                        onClick={() => handleLearnMore(destination.key)}
                        className="text-blue-500 hover:text-blue-700 text-sm font-medium transition-colors duration-200 hover:underline"
                      >
                        Learn More
                      </button>
                      {destination.price && (
                        <div className="text-sm font-semibold text-gray-700">
                          {typeof destination.price === 'number'
                            ? `Rp ${destination.price.toLocaleString('id-ID')}`
                            : destination.price}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={() => {
                if (carouselRef.current) {
                  carouselRef.current.scrollBy({ left: carouselRef.current.offsetWidth, behavior: 'smooth' });
                  setCurrentSlide(prev => Math.min(prev + 1, Math.ceil(filteredDestinations.length / 3) - 1));
                }
              }}
              className="absolute right-0 top-1/2 -translate-y-1/2 -mr-4 z-10 bg-white/80 hover:bg-white text-gray-800 p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default DestinationCarousel;
