import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, query, where, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import YourTripPopup from '../Components/YourTrip';
import AddToTripButton from '../Components/YourTripComponents/AddToTripButton';
import DestinationCarousel from '../Components/DestinationCarousel';
import Navbar2 from '../Components/Navbar2';




function DestinationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [destination, setDestination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // User authentication state
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  
  // Reviews state
  const [reviews, setReviews] = useState([]);
  const [newReview, setNewReview] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  const [ratingCounts, setRatingCounts] = useState({1: 0, 2: 0, 3: 0, 4: 0, 5: 0});
  const [averageRating, setAverageRating] = useState(0);
  const [userHasReviewed, setUserHasReviewed] = useState(false);
  const [userReview, setUserReview] = useState(null);
  

  // Check authentication status and fetch username
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsLoggedIn(!!currentUser);
      
      if (currentUser) {
        // Fetch the username from Firestore
        try {
          const userDocRef = doc(db, "Users", currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            setUsername(userDoc.data().username);
          } else {
            console.log("User document doesn't exist");
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }
    });
    
    return () => unsubscribe();
  }, []);

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };
  
  // Handle profile navigation
  const handleProfileClick = () => {
    navigate("/user-profile");
  };
  
  // Handle login navigation
  const handleLoginClick = () => {
    navigate("/login");
  };

  // Fetch destination details and reviews
  useEffect(() => {
    const fetchDestinationAndReviews = async () => {
      try {
        if (!id) {
          throw new Error("No destination ID provided");
        }
        
        const destinationRef = doc(db, "destinasi", id);
        const destinationSnap = await getDoc(destinationRef);
        
        if (destinationSnap.exists()) {
          setDestination({
            ...destinationSnap.data(),
            id: destinationSnap.id
          });
        } else {
          throw new Error("Destination not found");
        }
        
        // Fetch reviews
        await fetchReviews(id);
        
        setLoading(false);
      } catch (error) {
        console.error("Error fetching destination details:", error);
        setError("Failed to load destination details. Please try again later.");
        setLoading(false);
      }
    };
    
    fetchDestinationAndReviews();
  }, [id]);

  // Check if current user has already reviewed this destination
  useEffect(() => {
    const checkUserReview = async () => {
      if (user && reviews.length > 0) {
        const userReviewObj = reviews.find(review => review.userId === user.uid);
        if (userReviewObj) {
          setUserHasReviewed(true);
          setUserReview(userReviewObj);
        } else {
          setUserHasReviewed(false);
          setUserReview(null);
        }
      }
    };
    
    checkUserReview();
  }, [user, reviews]);

  // Fetch reviews for this destination
  const fetchReviews = async (destId) => {
    try {
      const reviewsQuery = query(
        collection(db, "reviews"),
        where("destinationId", "==", destId)
      );
      
      const reviewsSnapshot = await getDocs(reviewsQuery);
      const reviewsList = [];
      
      reviewsSnapshot.forEach((doc) => {
        reviewsList.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setReviews(reviewsList);
      calculateRatingStats(reviewsList);
      
    } catch (error) {
      console.error("Error fetching reviews:", error);
    }
  };
  
  // Calculate rating distribution and average
  const calculateRatingStats = (reviewsList) => {
    if (!reviewsList || reviewsList.length === 0) {
      setAverageRating(0);
      setRatingCounts({1: 0, 2: 0, 3: 0, 4: 0, 5: 0});
      return;
    }
    
    // Count ratings
    const counts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
    let total = 0;
    
    reviewsList.forEach(review => {
      const rating = Number(review.rating);
      if (rating >= 1 && rating <= 5) {
        counts[rating]++;
        total += rating;
      }
    });
    
    // Calculate average
    const avg = total / reviewsList.length;
    setAverageRating(avg.toFixed(1));
    setRatingCounts(counts);
  };
  
  // Format price in Rupiah
  const formatPrice = (price) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };
  
  // Submit a new review
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    
    if (!isLoggedIn) {
      navigate("/login");
      return;
    }
    
    if (newReview.trim() === "") {
      setReviewError("Please enter a review comment");
      return;
    }
    
    setSubmittingReview(true);
    setReviewError(null);
    
    try {
      const reviewData = {
        destinationId: id,
        userId: user.uid,
        username: username || "Anonymous User",
        comment: newReview,
        rating: newRating,
        timestamp: serverTimestamp()
      };
      
      if (userHasReviewed && userReview) {
        // Update existing review
        const reviewRef = doc(db, "reviews", userReview.id);
        await updateDoc(reviewRef, {
          comment: newReview,
          rating: newRating,
          updatedAt: serverTimestamp()
        });
      } else {
        // Add new review
        await addDoc(collection(db, "reviews"), reviewData);
      }
      
      // Refresh reviews
      await fetchReviews(id);
      
      // Update destination average rating
      if (destination) {
        const destinationRef = doc(db, "destinasi", id);
        await updateDoc(destinationRef, {
          averageRating: averageRating
        });
      }
      
      // Reset form
      setNewReview("");
      setNewRating(5);
      setShowReviewForm(false);
      
    } catch (error) {
      console.error("Error submitting review:", error);
      setReviewError("Failed to submit review. Please try again.");
    } finally {
      setSubmittingReview(false);
    }
  };
  
  // Edit existing review
  const handleEditReview = () => {
    if (userReview) {
      setNewReview(userReview.comment);
      setNewRating(userReview.rating);
      setShowReviewForm(true);
    }
  };
  
  const handleBackClick = () => {
    navigate('/rekomendasi');
  };

  // Helper function to format date
  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  // Determine price type (entry only or all-inclusive)
  const getPriceType = (destination) => {
    if (!destination || !destination.priceType) {
      return "Tiket masuk";
    }
    return destination.priceType === "all-in" ? "Harga all-inclusive" : "Tiket masuk saja";
  };


  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded">
          <p className="font-bold">Error</p>
          <p>{error}</p>
          <button 
            onClick={handleBackClick} 
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  if (!destination) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-xl text-gray-600">Destinasi tidak ditemukan</p>
          <button 
            onClick={handleBackClick} 
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
        <Navbar2 
        isLoggedIn={isLoggedIn}
        username={username}
        handleLogout={handleLogout}
        handleLoginClick={handleLoginClick}
        handleProfileClick={handleProfileClick}
        // activeCategory={activeCategory}
        // handleCategoryClick={handleCategoryClick}
        />
      
      {/* Hero Image Section */}
        <div className="h-96 relative overflow-hidden">
          <div 
            className="absolute inset-0"
            style={{
              backgroundColor: '#f3f4f6',
            }}
          >
            {destination && destination.imgurl && (
              <img 
                src={destination.imgurl}
                alt={destination?.name || "Palm Bay Waterpark"}
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.error("Image failed to load:", e);
                  e.target.onerror = null;
                  e.target.src = '/placeholder-img.jpg';
                }}
              />
            )}
          </div>
          
          <div className="absolute inset-0 bg-opacity-40"></div>
          <div className="container mx-auto px-6 relative h-full flex items-end pb-12">
            <div className="text-white">
              <h1 className="text-4xl font-bold mb-2">{destination?.name || "Destination Name"}</h1>
              <div className="flex items-center mb-4">
                <div className="flex items-center mr-4">
                  {/* Category Badge */}
                  <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm">
                    {destination?.category || "Wisata"}
                  </span>
                </div>
                
                {/* Rating display */}
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <svg 
                      key={i}
                      className={`w-5 h-5 ${i < Math.round(averageRating) ? 'text-yellow-400' : 'text-gray-300'}`}
                      fill="currentColor" 
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.799-2.034c-.784-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                  <span className="ml-1 text-white">{averageRating || "0"}</span>
                  <span className="ml-1 text-gray-300">({reviews?.length || 0} ulasan)</span>
                </div>
              </div>
              
              <div className="flex space-x-4">
                {/* Back button */}
                <button 
                  onClick={handleBackClick} 
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 flex items-center"
                >
                  <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Kembali
                </button>
                
                {/* Add to Trip Button */}
                <AddToTripButton destination={destination} />
              </div>
            </div>
          </div>
        </div>

      {/* Content Section */}
      <div className="container mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Left Column - Details */}
            <div className="md:col-span-2">
              <h2 className="text-2xl font-semibold mb-4">Tentang Destinasi</h2>
              <p className="text-gray-700 mb-6">{destination.description || 'Tidak ada deskripsi tersedia.'}</p>
              
              {/* Location */}
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-2">Lokasi</h3>
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-blue-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-gray-700">{destination.location || 'Lokasi tidak tersedia'}</span>
                </div>
              </div>
              
              {/* Operating Hours */}
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-2">Jam Operasional</h3>
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-blue-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-gray-700">{destination.operatingHours || 'Jam operasional tidak tersedia'}</span>
                </div>
              </div>
            </div>
            
            {/* Right Column - Cost & Actions */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <h3 className="text-xl font-semibold mb-4">Info Harga</h3>
              <div className="mb-6">
                <div className="text-2xl font-bold text-blue-600 mb-2">
                  {destination.price ? formatPrice(destination.price) : 'Free'}
                </div>
                <p className="text-gray-500 text-sm">
                  *{getPriceType(destination)}
                </p>
                <p className="text-gray-500 text-sm mt-1">
                  {destination?.priceDescription || "Harga dapat berubah sewaktu-waktu. Silakan konfirmasi harga terbaru di lokasi."}
                </p>
              </div>
              
              {/* Featured Amenities */}
              <div className="mb-6">
                <h4 className="font-medium mb-2">Fasilitas</h4>
                <ul className="grid grid-cols-2 gap-2">
                  <li className="flex items-center text-sm">
                    <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{destination.indoorOutdoor || 'Indoor/Outdoor'}</span>
                  </li>
                  <li className="flex items-center text-sm">
                    <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Parkir</span>
                  </li>
                  <li className="flex items-center text-sm">
                    <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Toilet</span>
                  </li>
                  <li className="flex items-center text-sm">
                    <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Makanan</span>
                  </li>
                </ul>
              </div>
              {/* Website URL Banner */}
              {destination?.websiteurl && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-5 rounded-xl border border-blue-100 shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 mt-6 mb-8">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg p-3 mr-4 shadow-md">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 text-lg mb-1">Pesan Tiketmu Sekarang!!</h3>
                      <p className="text-gray-600 text-sm mb-2">Dapatkan informasi lebih lengkap dan terkini di situs resmi destinasi ini</p>
                      <a 
                        href={destination.websiteurl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-lg text-sm hover:from-blue-600 hover:to-indigo-700 transition-colors group"
                      >
                        <span>Buka Website</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rating Summary Chart */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Rating Overview</h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="text-yellow-400 text-3xl">★</div>
            <div className="text-xl font-bold">{averageRating || "0"}/5</div>
            <div className="text-sm text-gray-500">({reviews.length} ulasan)</div>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="w-24">Sangat Puas</span>
              <div className="flex-1 bg-gray-300 rounded-full overflow-hidden h-3 mx-2">
                <div 
                  className="bg-blue-500 h-full" 
                  style={{ width: `${reviews.length > 0 ? (ratingCounts[5] / reviews.length) * 100 : 0}%` }}
                ></div>
              </div>
              <span className="w-8 text-right">{ratingCounts[5]}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="w-24">Puas</span>
              <div className="flex-1 bg-gray-300 rounded-full overflow-hidden h-3 mx-2">
                <div 
                  className="bg-blue-500 h-full" 
                  style={{ width: `${reviews.length > 0 ? (ratingCounts[4] / reviews.length) * 100 : 0}%` }}
                ></div>
              </div>
              <span className="w-8 text-right">{ratingCounts[4]}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="w-24">Rata-rata</span>
              <div className="flex-1 bg-gray-300 rounded-full overflow-hidden h-3 mx-2">
                <div 
                  className="bg-blue-500 h-full" 
                  style={{ width: `${reviews.length > 0 ? (ratingCounts[3] / reviews.length) * 100 : 0}%` }}
                ></div>
              </div>
              <span className="w-8 text-right">{ratingCounts[3]}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="w-24">Kurang Puas</span>
              <div className="flex-1 bg-gray-300 rounded-full overflow-hidden h-3 mx-2">
                <div 
                  className="bg-blue-500 h-full" 
                  style={{ width: `${reviews.length > 0 ? (ratingCounts[2] / reviews.length) * 100 : 0}%` }}
                ></div>
              </div>
              <span className="w-8 text-right">{ratingCounts[2]}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="w-24">Buruk</span>
              <div className="flex-1 bg-gray-300 rounded-full overflow-hidden h-3 mx-2">
                <div 
                  className="bg-blue-500 h-full" 
                  style={{ width: `${reviews.length > 0 ? (ratingCounts[1] / reviews.length) * 100 : 0}%` }}
                ></div>
              </div>
              <span className="w-8 text-right">{ratingCounts[1]}</span>
            </div>
          </div>
        </div>
        
        {/* Reviews Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">Ulasan ({reviews.length})</h2>
            {isLoggedIn ? (
              userHasReviewed ? (
                <button 
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md text-sm flex items-center"
                  onClick={handleEditReview}
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Ulasanmu
                </button>
              ) : (
                <button 
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm flex items-center"
                  onClick={() => setShowReviewForm(!showReviewForm)}
                >
                  {showReviewForm ? (
                    <>
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Batal
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Berikan Ulasanmu
                    </>
                  )}
                </button>
              )
            ) : (
              <button 
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm flex items-center"
                onClick={() => navigate("/login")}
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Login untuk Ulasan
              </button>
            )}
          </div>
          
          {/* Review Form */}
          {showReviewForm && isLoggedIn && (
            <div className="bg-blue-50 p-6 rounded-lg mb-8 shadow-sm">
              <form onSubmit={handleSubmitReview}>
                <h3 className="font-medium text-lg mb-4">
                  {userHasReviewed ? "Edit Ulasanmu" : "Berikan Ulasan Baru"}
                </h3>
                
                {/* Rating selection */}
                <div className="mb-6">
                  <label className="block text-gray-700 font-medium mb-2">Rating</label>
                  <div className="flex gap-4">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <label key={rating} className="flex items-center cursor-pointer">
                        <input
                          type="radio"
                          name="rating"
                          value={rating}
                          checked={newRating === rating}
                          onChange={() => setNewRating(rating)}
                          className="sr-only"
                        />
                        <span className={`text-2xl ${newRating >= rating ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                {/* Review text */}
                <div className="mb-6">
                  <label className="block text-gray-700 font-medium mb-2">Komentar</label>
                  <textarea
                    value={newReview}
                    onChange={(e) => setNewReview(e.target.value)}
                    placeholder="Bagikan pengalaman Anda tentang tempat ini..."
                    className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                    required
                  />
                </div>
                
                {reviewError && (
                  <div className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded border border-red-200">
                    {reviewError}
                  </div>
                )}
                
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowReviewForm(false)}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-md mr-3 hover:bg-gray-100"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm disabled:bg-blue-300 flex items-center"
                  >
                    {submittingReview ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Mengirim...
                      </>
                    ) : userHasReviewed ? (
                      <>
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Perbarui Ulasan
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Kirim Ulasan
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
          
          {/* User's review (if exists) */}
          {userHasReviewed && userReview && !showReviewForm && (
            <div className="bg-blue-50 p-6 rounded-lg mb-8 border-l-4 border-blue-500 shadow-sm">
              <div className="flex justify-between items-start">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mr-3 text-white">
                    <span className="font-semibold">
                      {username ? username.charAt(0).toUpperCase() : 'U'}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-semibold">{username || "Anda"}</h4>
                    <div className="flex items-center mt-1">
                      {[...Array(5)].map((_, i) => (
                        <svg 
                          key={i}
                          className={`w-4 h-4 ${i < parseInt(userReview.rating) ? 'text-yellow-400' : 'text-gray-300'}`}
                          fill="currentColor" 
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.799-2.034c-.784-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(userReview.timestamp)} {userReview.updatedAt ? "(diperbarui)" : ""}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={handleEditReview}
                  className="text-blue-500 hover:text-blue-700 text-sm flex items-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
              </div>
              <div className="mt-4 text-gray-700">
                {userReview.comment}
              </div>
            </div>
          )}
          
          {/* List of reviews */}
          {reviews.length > 0 ? (
            <div className="space-y-8">
              {reviews
                .filter(review => !userHasReviewed || review.userId !== user?.uid)
                .sort((a, b) => (b.timestamp?.toDate?.() || 0) - (a.timestamp?.toDate?.() || 0))
                .map((review) => (
                  <div key={review.id} className="border-b border-gray-200 pb-8 last:border-b-0">
                    <div className="flex items-start">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                        <span className="text-gray-600 font-semibold">
                          {review.username ? review.username.charAt(0).toUpperCase() : 'U'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold">{review.username || "Anonymous"}</h4>
                            <div className="flex items-center mt-1">
                              {[...Array(5)].map((_, i) => (
                                <svg 
                                  key={i}
                                  className={`w-4 h-4 ${i < parseInt(review.rating) ? 'text-yellow-400' : 'text-gray-300'}`}
                                  fill="currentColor" 
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.799-2.034c-.784-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              ))}
                            </div>
                          </div>
                          <p className="text-sm text-gray-500">
                            {formatDate(review.timestamp)}
                            {review.updatedAt ? " (diperbarui)" : ""}
                          </p>
                        </div>
                        <p className="mt-3 text-gray-700">{review.comment || "No comment"}</p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <p className="mt-2 text-lg">Belum ada ulasan untuk destinasi ini.</p>
              <p className="mt-1">Jadilah yang pertama memberikan ulasan!</p>
              {!isLoggedIn && (
                <button 
                  onClick={() => navigate("/login")}
                  className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600"
                >
                  Login untuk menulis ulasan
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* Similar Destinations Section */}
        <DestinationCarousel />
        
      </div>
      
      
      
      {/* Footer */}
      <footer className="bg-gray-100 pt-10 pb-4 mt-10">
        <div className="container mx-auto px-4">
          {/* Footer Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Logo Column */}
            <div>
              <div className="text-xl font-bold mb-4">Jakarta-GO</div>
              <p className="text-gray-600 text-sm">
                Temukan tempat-tempat terbaik di Jakarta untuk dikunjungi. Dari wisata keluarga hingga kuliner legendaris!
              </p>
            </div>
            
            {/* Company Column */}
            <div>
              <div className="text-lg font-semibold mb-4">Company</div>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-blue-600 transition-colors">Tentang Kami</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">FAQ</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Rekomendasi</a></li>
              </ul>
            </div>

            {/* Contact Column */}
            <div>
              <div className="text-lg font-semibold mb-4">Contact Us</div>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-blue-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>desmond.connery@binus.ac.id</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-5 h-5 text-blue-500 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>reymen.sow@binus.ac.id</span>
                </li>
              </ul>
            </div>

            {/* Social Media Column */}
            <div>
              <div className="text-lg font-semibold mb-4">Follow Us</div>
              <ul className="space-y-2">
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                  <span>Instagram</span>
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z" />
                  </svg>
                  <span>Facebook</span>
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 1.281.24 2.33.892 3.112-1.009-.033-1.852-.362-2.476-.94-.004.017-.009.034-.009.052 0 1.794 1.269 3.293 2.958 3.633-.49.908-1.157.521-1.492.157.468 1.51 1.834 2.617 3.455 2.65-1.555 1.205-3.512 1.734-5.469 1.518 1.633 1.041 3.572 1.646 5.664 1.646 6.825 0 10.553-5.668 10.553-10.576 0-.161-.004-.323-.012-.485.71-.512 1.329-1.135 1.818-1.855z" />
                  </svg>
                  <span>Twitter</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
        
        {/* Copyright Section */}
        <div className="mt-8">
          <div className="border-t border-gray-300 my-4"></div>
          <div className="container mx-auto px-4 text-center text-sm text-gray-600">
            <p>Copyright &copy; 2025 Jakarta-GO. All Rights Reserved.</p>
          </div>
        </div>
      </footer>
      
      {/* Your Trip Popup */}
      <YourTripPopup />
    </div>
  );
};
export default DestinationDetail;

