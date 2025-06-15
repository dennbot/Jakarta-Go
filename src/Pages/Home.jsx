import React, { useState, useEffect } from 'react';
import Navbar2 from '../Components/Navbar2';
import Footer from '../Components/Footer';
import DestinationCarousel from '../Components/DestinationCarousel';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import YourTripPopup from '../Components/YourTrip';
import SearchBar from '../Components/SearchBar'; 

function Home() {
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const [categories, setCategories] = useState([]);
  const navigate = useNavigate();

  const handleCategoryClick = (category) => {
    setActiveCategory(category === activeCategory ? null : category);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearchQuery(searchTerm.trim());
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleProfileClick = () => navigate('/profile');
  const handleLoginClick = () => navigate('/login');

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const destinasiRef = collection(db, 'destinasi');
        const snapshot = await getDocs(destinasiRef);

        const uniqueCategories = new Set();
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.category) {
            uniqueCategories.add(data.category);
          }
        });

        setCategories(Array.from(uniqueCategories).sort());
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    fetchCategories();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsLoggedIn(!!currentUser);

      if (currentUser) {
        try {
          const userDocRef = doc(db, 'Users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            setUsername(userDoc.data().username);
            console.log('Username fetched:', userDoc.data().username);
          } else {
            console.log("User document doesn't exist");
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
    });

    return () => unsubscribe();
  }, []);

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
        handleCategoryClick={handleCategoryClick}
      />

      <section
        id="hero"
        className="w-full h-screen pt-[400px] bg-cover bg-center bg-no-repeat bg-fixed flex items-center justify-center relative"
        style={{ backgroundImage: "url('/552468.jpg')" }}
      >
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="text-center relative z-10">
          <h1 className="text-white text-6xl md:text-8xl font-bold">Welcome To Jakarta, Indonesia.</h1>
        </div>
      </section>

      {/* ✅ Ganti form search manual dengan komponen */}
      <SearchBar
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        onSearchSubmit={handleSearchSubmit}
      />

      {renderCategoryFilters()}

      <DestinationCarousel
        searchQuery={searchQuery}
        activeCategory={activeCategory}
      />

      <YourTripPopup />
      <Footer />
    </>
  );
}

export default Home;
