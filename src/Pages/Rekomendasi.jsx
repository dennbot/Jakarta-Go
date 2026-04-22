
import React, { useState, useEffect } from 'react';
import Navbar2 from '../Components/Navbar2';
import SearchBar from '../Components/SearchBar';
import YourTripPopup from '../Components/YourTrip';
import Footer from '../Components/Footer';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';

function RekomendasiPage() {
  // State management for data loading
  const [loading, setLoading] = useState(true);
  const [destinasi, setDestinasi] = useState([]);
  const [filteredDestinasi, setFilteredDestinasi] = useState([]);
  const [error, setError] = useState(null);
  const [reviewsData, setReviewsData] = useState({});
  
  // User authentication state
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeCategory, setActiveCategory] = useState(null);
  const [categories, setCategories] = useState([]);
  const destinationsPerPage = 15;
  const navigate = useNavigate();

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
            console.log("Username fetched:", userDoc.data().username);
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

  // Fetch reviews data from Firebase
  const fetchReviews = async () => {
    try {
      console.log("Fetching reviews data...");
      const reviewsRef = collection(db, "reviews");
      const reviewsSnapshot = await getDocs(reviewsRef);
      
      const reviewsMap = {};
      
      reviewsSnapshot.forEach((doc) => {
        const reviewData = doc.data();
        const destinationId = reviewData.destinationId;
        
        if (!reviewsMap[destinationId]) {
          reviewsMap[destinationId] = {
            totalRating: 0,
            count: 0,
            reviews: []
          };
        }
        
        // Parse rating as a number 
        const ratingValue = parseFloat(reviewData.rating) || 0;
        
        reviewsMap[destinationId].totalRating += ratingValue;
        reviewsMap[destinationId].count += 1;
        reviewsMap[destinationId].reviews.push({
          id: doc.id,
          ...reviewData,
          rating: ratingValue
        });
      });
      
      // Calculate average ratings
      Object.keys(reviewsMap).forEach(destinationId => {
        const { totalRating, count } = reviewsMap[destinationId];
        reviewsMap[destinationId].averageRating = count > 0 ? totalRating / count : 0;
      });
      
      console.log("Reviews data processed:", reviewsMap);
      setReviewsData(reviewsMap);
      
    } catch (error) {
      console.error("Error fetching reviews:", error);
    }
  };

  // Fetch data from Firebase on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        console.log("Starting to fetch data...");
        
        // Fetch destinations
        const destinasiRef = collection(db, "destinasi");
        console.log("Collection reference created");
        
        const querySnapshot = await getDocs(destinasiRef);
        console.log("Query snapshot received:", querySnapshot.size, "documents");
        
        const destinationArray = [];
        const uniqueCategories = new Set();
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          console.log("Document ID:", doc.id, "Data:", data);
          
          // Add destination to array
          destinationArray.push({
            ...data,
            key: doc.id,
          });
          
          // Collect unique categories
          if (data.category) {
            uniqueCategories.add(data.category);
          }
        });
        
        console.log("Final destination array:", destinationArray);
        console.log("Unique categories:", uniqueCategories);
        
        // Convert Set to Array for categories
        setCategories(Array.from(uniqueCategories));
        setDestinasi(destinationArray);
        setFilteredDestinasi(destinationArray);
        
        // Fetch reviews after destinations are loaded
        await fetchReviews();
        
        setLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Gagal memuat data. Silakan coba lagi nanti.");
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Effect for handling search and category filtering
  useEffect(() => {
    let results = destinasi;
    
    // Filter by search term if provided
    if (searchTerm) {
      results = results.filter(destination =>
        destination.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Filter by category if selected
    if (activeCategory) {
      results = results.filter(destination =>
        destination.category === activeCategory
      );
    }
    
    setFilteredDestinasi(results);
    setCurrentPage(1); // Reset to first page when filters change
  }, [searchTerm, activeCategory, destinasi]);

  // Handler for category selection
  const handleCategoryClick = (category) => {
    console.log("Category clicked:", category);
    // Toggle category filter
    setActiveCategory(activeCategory === category ? null : category);
    // Reset search when changing category
    setSearchTerm('');
  };

  // Handler for clicking on a destination
  const handleDestinationClick = (destinationId) => {
    navigate(`/destination/${destinationId}`);
  };

  // Handler for search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Handler for search submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    // The search is already handled by the useEffect
  };
  
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
    navigate("/profile");
  };
  
  // Handle login navigation
  const handleLoginClick = () => {
    navigate("/login");
  };

  // Render star rating component
  const renderStarRating = (destinationId) => {
    const destinationReviews = reviewsData[destinationId];
    const rating = destinationReviews ? destinationReviews.averageRating : 0;
    const reviewCount = destinationReviews ? destinationReviews.count : 0;
    
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating - fullStars >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    return (
      <div className="flex items-center">
        {/* Full stars */}
        {[...Array(fullStars)].map((_, i) => (
          <svg key={`full-${i}`} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.799-2.034c-.784-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
        
        {/* Half star */}
        {hasHalfStar && (
          <div className="relative">
            {/* Gray background */}
            <svg className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.799-2.034c-.784-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {/* Half yellow overlay */}
            <div className="absolute inset-0 overflow-hidden w-1/2">
              <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.799-2.034c-.784-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
          </div>
        )}
        
        {/* Empty stars */}
        {[...Array(emptyStars)].map((_, i) => (
          <svg key={`empty-${i}`} className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.799-2.034c-.784-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
        
        {/* Display numerical rating */}
        <span className="ml-1 text-sm text-gray-600">
          {rating ? rating.toFixed(1) : "N/A"}
        </span>
        
        {/* Review count */}
        <span className="ml-1 text-xs text-gray-500">
          ({reviewCount} ulasan)
        </span>
      </div>
    );
  };

  // Pagination logic
  const indexOfLastDestination = currentPage * destinationsPerPage;
  const indexOfFirstDestination = indexOfLastDestination - destinationsPerPage;
  const currentDestinations = filteredDestinasi.slice(indexOfFirstDestination, indexOfLastDestination);
  const totalPages = Math.ceil(filteredDestinasi.length / destinationsPerPage);

  // Pagination navigation handlers
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToPage = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Error state handling
  if(error) {
    return <h1 className="text-2xl font-bold text-center py-10 text-red-500">{error}</h1>
  }

  // Pagination UI rendering
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pageNumbers = [];
    const maxPagesToShow = 3; // Show at most 3 page numbers
    
    let startPage = Math.max(1, currentPage - 1);
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    
    // Adjust start page if we're at the end
    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return (
      <div className="flex justify-center mt-8 mb-8">
        <button 
          onClick={goToPrevPage} 
          disabled={currentPage === 1}
          className={`mx-1 px-4 py-2 rounded-md ${currentPage === 1 ? 'bg-gray-200 text-gray-500' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'}`}
        >
          &lt;
        </button>
        
        {pageNumbers.map(number => (
          <button
            key={number}
            onClick={() => goToPage(number)}
            className={`mx-1 px-4 py-2 rounded-md ${
              number === currentPage 
                ? 'bg-orange-400 text-white' 
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
            }`}
          >
            {number}
          </button>
        ))}
        
        <button 
          onClick={goToNextPage} 
          disabled={currentPage === totalPages}
          className={`mx-1 px-4 py-2 rounded-md ${currentPage === totalPages ? 'bg-gray-200 text-gray-500' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'}`}
        >
          &gt;
        </button>
      </div>
    );
  };

  // Render category filter chips
  const renderCategoryFilters = () => {
    if (categories.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-2 container mx-auto px-6 py-4">
        {categories.map(category => (
          <button
            key={category}
            onClick={() => handleCategoryClick(category)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeCategory === category
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {category}
          </button>
        ))}
        {activeCategory && (
          <button
            onClick={() => setActiveCategory(null)}
            className="px-4 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center"
          >
            <span>Clear filters</span>
            <svg className="ml-1 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  };

  return (
    <>
    <Navbar2 
        isLoggedIn={isLoggedIn}
        username={username}
        handleLogout={handleLogout}
        handleLoginClick={handleLoginClick}
        handleProfileClick={handleProfileClick}
        activeCategory={activeCategory}
        handleCategoryClick={handleCategoryClick}/>

    <main className="pt-24">
      {/* Active Category Indicator */}
      {activeCategory && (
        <div className="bg-blue-50 py-3 px-6 border-t border-blue-100">
          <div className="container mx-auto flex justify-between items-center">
            <div className="flex items-center">
              <span className="mr-2 text-blue-700">Kategori:</span>
              <span className="font-medium text-blue-800">{activeCategory}</span>
            </div>
            <button 
              onClick={() => setActiveCategory(null)}
              className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
            >
              <span>Clear</span>
              <svg className="ml-1 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Search Bar Section */}
      <SearchBar
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        onSearchSubmit={handleSearchSubmit}/>

      {/* Category Filters */}
      {renderCategoryFilters()}

      {/* Destinations Grid Section*/}
      <div className="p-8 w-full">
        <div className="p-4">
          {/* Show results count */}
          <div className="mb-4 text-gray-600">
            {filteredDestinasi.length === 0 ? (
              <p>No destinations found</p>
            ) : (
              <p>
                Showing {filteredDestinasi.length} {filteredDestinasi.length === 1 ? 'destination' : 'destinations'}
                {activeCategory ? ` in ${activeCategory}` : ''}
                {searchTerm ? ` matching "${searchTerm}"` : ''}
              </p>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {currentDestinations.length > 0 ? (
              // Map through fetched destinations with enhanced styling
              currentDestinations.map((destinasi_iterasi) => {
                return (
                  <div 
                    key={destinasi_iterasi.key} 
                    className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-xl transform hover:-translate-y-2 transition-all duration-300 cursor-pointer border border-gray-100"
                    onClick={() => handleDestinationClick(destinasi_iterasi.key)}
                  >
                    {/* Image Container with Overlay */}
                    <div className="relative h-[180px] overflow-hidden group">
                      {destinasi_iterasi.imgurl ? (
                        <>
                          <img 
                            src={destinasi_iterasi.imgurl} 
                            alt={destinasi_iterasi.name || "Destination image"} 
                            className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100">
                          No Image
                        </div>
                      )}
                      
                      {/* Category Tag/Badge - If category exists */}
                      {destinasi_iterasi.category && (
                        <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                          {destinasi_iterasi.category}
                        </div>
                      )}
                    </div>
                    
                    {/* Content Section */}
                    <div className="p-5">
                      {/* Destination Name */}
                      <h3 className="font-medium text-base mb-1 text-gray-800 line-clamp-1">
                        {destinasi_iterasi.name || "Place Name"}
                      </h3>
                      
                      {/* Rating Stars */}
                      <div className="flex items-center mb-2">
                        {renderStarRating(destinasi_iterasi.key)}
                      </div>
                      
                      {/* Location - if available */}
                      {destinasi_iterasi.location && (
                        <div className="flex items-center text-xs text-gray-500 mt-2">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"></path>
                          </svg>
                          <span className="truncate">{destinasi_iterasi.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              searchTerm || activeCategory ? (
                <div className="col-span-full text-center py-8 text-gray-500">
                  No destinations found
                  {searchTerm ? ` matching "${searchTerm}"` : ''}
                  {activeCategory ? ` in category "${activeCategory}"` : ''}
                </div>
              ) : (
                // Enhanced fallback placeholders if no data
                [...Array(10)].map((_, index) => (
                  <div 
                    key={index} 
                    className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg animate-pulse"
                  >
                    <div className="h-[180px] bg-gray-200"></div>
                    <div className="p-4">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="flex items-center mb-2">
                        <div className="flex space-x-1">
                          {[...Array(5)].map((_, i) => (
                            <div key={i} className="w-4 h-4 bg-gray-200 rounded-full"></div>
                          ))}
                        </div>
                        <div className="h-3 bg-gray-200 rounded w-16 ml-2"></div>
                      </div>
                      <div className="h-3 bg-gray-200 rounded w-full mb-1"></div>
                      <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      </div>

      {/* Pagination */}
      {renderPagination()}

      {/* Footer Section */}
      <Footer />
      <YourTripPopup />
    </main>
    </>
  );
}

export default RekomendasiPage;
