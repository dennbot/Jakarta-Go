import React, { useState, useEffect, useRef } from "react";
import { Link, useMatch, useResolvedPath } from "react-router-dom";
import clsx from "clsx";
import RundownGenerator from "./YourTripComponents/RundownGenerator";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";

const Navbar2 = ({
  isLoggedIn,
  username,
  handleLogout,
  handleLoginClick,
  handleProfileClick,
  activeCategory,
  handleCategoryClick
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isRundownGeneratorOpen, setIsRundownGeneratorOpen] = useState(false);
  const [selectedDestinations, setSelectedDestinations] = useState([]);
  const [categories, setCategories] = useState([]);

  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const destinasiRef = collection(db, "destinasi");
        const snapshot = await getDocs(destinasiRef);
        const uniqueCategories = new Set();
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.category) uniqueCategories.add(data.category);
        });
        setCategories(Array.from(uniqueCategories));
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const loadSavedTrip = () => {
      try {
        const savedTrip = localStorage.getItem('yourTrip');
        if (savedTrip) {
          const parsedTrip = JSON.parse(savedTrip);
          setSelectedDestinations(parsedTrip);
        }
      } catch (error) {
        console.error('Error loading saved trip:', error);
      }
    };
    loadSavedTrip();
    const handleTripUpdate = () => loadSavedTrip();
    document.addEventListener('tripUpdated', handleTripUpdate);
    return () => document.removeEventListener('tripUpdated', handleTripUpdate);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const openRundownGenerator = () => setIsRundownGeneratorOpen(true);
  const closeRundownGenerator = () => setIsRundownGeneratorOpen(false);

  const handleGenerateRundown = (rundown) => {
    const validatedRundown = {
      title: rundown?.title || 'Your Trip Rundown',
      itinerary: Array.isArray(rundown?.itinerary) ? rundown.itinerary : [],
      budgetEstimation: rundown?.budgetEstimation || calculateBudgetEstimation(),
      tripDetails: rundown?.tripDetails || { categories: [] },
      error: rundown?.error || null
    };
    localStorage.setItem('generatedRundown', JSON.stringify(validatedRundown));
    const rundownEvent = new CustomEvent('rundownGenerated', {
      bubbles: true,
      detail: { rundown: validatedRundown }
    });
    document.dispatchEvent(rundownEvent);
  };

  const calculateBudgetEstimation = () => {
    const formatNumber = (num) => Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `Rp ${formatNumber(0)} - ${formatNumber(0)}/pax`;
  };

  return (
    <header className={`fixed top-0 left-0 right-0 w-full z-50 transition-all duration-300 ${isScrolled ? "bg-yellow-200 shadow-md" : "bg-transparent"}`}>
      <nav className="flex items-center justify-between px-6 md:px-36 py-4 md:py-6">
        <a href="/" className={`text-2xl font-medium border-b-4 border-transparent hover:border-cyan-300 transition-all ${isScrolled ? "text-black" : "text-white"}`}>
          Jakarta-GO
        </a>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden flex flex-col justify-center items-center w-8 h-8 relative z-50"
          aria-label="Toggle Menu"
        >
          <span className={`absolute h-0.5 w-6 transform transition duration-300 ease-in-out origin-center ${isScrolled ? "bg-black" : "bg-white"} ${isMobileMenuOpen ? "rotate-45" : "-translate-y-2"}`} />
          <span className={`absolute h-0.5 w-6 transition-opacity duration-300 ease-in-out ${isScrolled ? "bg-black" : "bg-white"} ${isMobileMenuOpen ? "opacity-0" : "opacity-100"}`} />
          <span className={`absolute h-0.5 w-6 transform transition duration-300 ease-in-out origin-center ${isScrolled ? "bg-black" : "bg-white"} ${isMobileMenuOpen ? "rotate-45" : "translate-y-2"}`} />
        </button>

        <ul className={`absolute md:static top-full left-0 w-full md:w-auto ${isScrolled ? "bg-white" : "bg-white"} md:bg-transparent flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-12 px-6 md:px-0 py-4 md:py-0 transition-all duration-300 z-40 ${isMobileMenuOpen ? "block" : "hidden md:flex"}`}>
          <li>
            <button onClick={openRundownGenerator} className={`text-lg font-medium border-b-4 border-transparent hover:border-cyan-300 transition-all ${isScrolled ? "text-black" : "text-white"} hover:text-cyan-300`}>
              Generate Rundown
            </button>
          </li>

          <li className="relative">
            <button
              ref={buttonRef}
              onClick={() => setIsCategoryDropdownOpen(prev => !prev)}
              className={`text-lg font-medium border-b-4 border-transparent hover:border-cyan-300 transition-all flex items-center gap-1 ${isScrolled ? "text-black" : "text-white"} hover:text-cyan-300`}
            >
              Kategori <span>▾</span>
            </button>
            <div
              ref={dropdownRef}
              className={clsx(
                "absolute left-0 mt-2 w-64 bg-white rounded-md shadow-lg overflow-hidden z-50 transition-all duration-300",
                {
                  "opacity-100 visible": isCategoryDropdownOpen,
                  "opacity-0 invisible": !isCategoryDropdownOpen,
                }
              )}
            >
              <div className="py-2">
                {categories.length === 0 ? (
                  <div className="px-4 py-2 text-sm text-gray-400">Memuat kategori...</div>
                ) : (
                  categories.map((category) => (
                    <a
                      key={category}
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handleCategoryClick(category);
                      }}
                      className={`block px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                        activeCategory === category ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-700"
                      }`}
                    >
                      {category}
                    </a>
                  ))
                )}
              </div>
            </div>
          </li>

          <li>
            <Link to="/rekomendasi" className={`text-lg font-medium border-b-4 border-transparent hover:border-cyan-300 transition-all ${isScrolled ? "text-black" : "text-white"} hover:text-cyan-300`}>
              Rekomendasi
            </Link>
          </li>
          <li>
            <Link to="/about" className={`text-lg font-medium border-b-4 border-transparent hover:border-cyan-300 transition-all ${isScrolled ? "text-black" : "text-white"} hover:text-cyan-300`}>
              Tentang Kami
            </Link>
          </li>

          {isLoggedIn ? (
            <>
              <li>
                <button onClick={handleProfileClick} className={`text-lg font-medium border-b-4 border-transparent hover:border-cyan-300 transition-all ${isScrolled ? "text-black" : "text-white"} hover:text-cyan-300 flex items-center gap-2`}>
                  {username || "Profile"}
                </button>
              </li>
              <li>
                <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded transition-colors">
                  Logout
                </button>
              </li>
            </>
          ) : (
            <li>
              <button onClick={handleLoginClick} className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded transition-colors">
                Sign In
              </button>
            </li>
          )}
        </ul>
      </nav>

      {isRundownGeneratorOpen && (
        <RundownGenerator
          isOpen={isRundownGeneratorOpen}
          onClose={closeRundownGenerator}
          onGenerateRundown={handleGenerateRundown}
          selectedDestinations={selectedDestinations}
        />
      )}
    </header>
  );
};

export default Navbar2;