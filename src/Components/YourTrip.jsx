import { useState, useEffect, useRef } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import RundownGenerator from "./YourTripComponents/RundownGenerator";
import SaveRundownModel from "./SaveRundownModel";
import { Link } from "react-router-dom";
import { Save, Check, User } from "lucide-react";

const YourTripPopup = () => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isRundownGeneratorOpen, setIsRundownGeneratorOpen] = useState(false);
  const [selectedDestinations, setSelectedDestinations] = useState([]);
  const [generatedRundown, setGeneratedRundown] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [popupSize, setPopupSize] = useState("normal");
  const [animateRundown, setAnimateRundown] = useState(false);
  const [hasNewRundown, setHasNewRundown] = useState(false); 
  const popupRef = useRef(null);

  // Authentication and Save Modal States
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Load saved destinations from localStorage on component mount
  useEffect(() => {
    loadSavedTrip();
  }, []);

  // Authentication listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoggedIn(!!currentUser);
    });

    return () => unsubscribe();
  }, []);

  // Add event listener for trip updates
  useEffect(() => {
    const handleTripUpdate = () => {
      loadSavedTrip();
    };

    document.addEventListener("tripUpdated", handleTripUpdate);

    return () => {
      document.removeEventListener("tripUpdated", handleTripUpdate);
    };
  }, []);

  useEffect(() => {
    const handleRundownGenerated = (e) => {
      const newRundown = e.detail.rundown;
      setGeneratedRundown(newRundown);
      setIsSaved(false);
      setHasNewRundown(true); // Set notification when rundown is generated
    };

    document.addEventListener("rundownGenerated", handleRundownGenerated);

    return () => {
      document.removeEventListener("rundownGenerated", handleRundownGenerated);
    };
  }, []);

  // Listen for successful rundown saves from other components
  useEffect(() => {
    const handleRundownSaved = (e) => {
      const { docId, title } = e.detail;
      setIsSaved(true);
      setSaveError(null);
      setHasNewRundown(false); // Clear notification when saved

      setTimeout(() => {
        setIsSaved(false);
      }, 5000);
    };

    document.addEventListener("rundownSaved", handleRundownSaved);

    return () => {
      document.removeEventListener("rundownSaved", handleRundownSaved);
    };
  }, []);

  // Animate rundown when it's generated
  useEffect(() => {
    if (generatedRundown) {
      setAnimateRundown(true);
      const timeout = setTimeout(() => {
        setAnimateRundown(false);
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [generatedRundown]);

  // Function to load saved trip from localStorage
  const loadSavedTrip = async () => {
    try {
      const savedTrip = localStorage.getItem("yourTrip");
      if (savedTrip) {
        const parsedTrip = JSON.parse(savedTrip);

        if (parsedTrip.every((trip) => trip.label && trip.price)) {
          setSelectedDestinations(parsedTrip);
          return;
        }

        setIsLoading(true);
        const updatedTrip = await Promise.all(
          parsedTrip.map(async (item) => {
            try {
              const destDoc = await getDoc(doc(db, "destinasi", item.id));

              if (destDoc.exists()) {
                const destData = destDoc.data();
                console.log("Destinasi Data: ", destData); // Log data untuk memeriksa harga
                return {
                  id: item.id,
                  label: `${getCategoryEmoji(destData.category)} ${
                    destData.category
                  } - ${destData.name}`,
                  price: destData.price ? `Rp ${Number(destData.price).toLocaleString('id-ID')}` : "Free",
                  original: destData,
                };
              } else {
                return {
                  id: item.id,
                  label: item.label || `Destinasi #${item.id.substring(0, 5)}`,
                  price: item.price || "-",
                  original: null,
                };
              }
            } catch (error) {
              console.error(`Error fetching destination ${item.id}:`, error);
              return {
                id: item.id,
                label: item.label || `Destinasi #${item.id.substring(0, 5)}`,
                price: item.price || "-",
                error: true,
              };
            }
          })
        );

        setSelectedDestinations(updatedTrip.filter(Boolean));
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error loading saved trip:", error);
      setError("Gagal memuat data perjalanan tersimpan.");
      setIsLoading(false);
    }
  };

  // Save destinations to localStorage when they change
  useEffect(() => {
    if (selectedDestinations.length > 0) {
      localStorage.setItem("yourTrip", JSON.stringify(selectedDestinations));
    }
  }, [selectedDestinations]);

  // Check if there's a saved rundown in localStorage on component mount
  useEffect(() => {
    try {
      const savedRundown = localStorage.getItem("generatedRundown");
      if (savedRundown) {
        const parsedRundown = JSON.parse(savedRundown);

        const validatedRundown = {
          title: parsedRundown?.title || "Your Trip Rundown",
          itinerary: Array.isArray(parsedRundown?.itinerary)
            ? parsedRundown.itinerary
            : [],
          budgetEstimation:
            parsedRundown?.budgetEstimation || calculateBudgetEstimation(),
          tripDetails: parsedRundown?.tripDetails || { categories: [] },
          error: parsedRundown?.error || null,
        };

        setGeneratedRundown(validatedRundown);
      }
    } catch (error) {
      console.error("Error loading saved rundown:", error);
    }
  }, []);

  // Opening rundown generator
  const openRundownGenerator = () => {
    setIsRundownGeneratorOpen(true);
  };

  // Closing rundown generator
  const closeRundownGenerator = () => {
    setIsRundownGeneratorOpen(false);
  };

  // Fixed handleGenerateRundown - preserve existing price if available
  const handleGenerateRundown = (rundown) => {
    console.log("Generated rundown raw:", rundown);
    console.log("Selected destinations:", selectedDestinations);

    // Enhanced itinerary with prices from Firebase data
    const enhancedItinerary = rundown.itinerary.map((item, index) => {
      console.log(`Processing item ${index}:`, item);
      
      // First check if price already exists in the item
      if (item.price && item.price !== '-') {
        console.log(`✅ Price already exists: "${item.activity}" -> ${item.price}`);
        return item; // Return as is if price already exists
      }
      
      let matchedPrice = '-';
      
      // Create multiple search patterns for better matching
      const activityLower = item.activity.toLowerCase();
      
      // Try to find matching destination with multiple strategies
      for (const dest of selectedDestinations) {
        let found = false;
        
        // Strategy 1: Check with original name from Firebase
        if (dest.original?.name) {
          const originalName = dest.original.name.toLowerCase();
          if (activityLower.includes(originalName) || originalName.includes(activityLower.split(' ')[0])) {
            matchedPrice = dest.original.price 
              ? `Rp ${Number(dest.original.price).toLocaleString('id-ID')}`
              : dest.price || '-';
            found = true;
          }
        }
        
        // Strategy 2: Check with cleaned label name
        if (!found) {
          const cleanedLabel = dest.label.replace(/^[^\w]*\s*[^-]+\s*-\s*/, '').trim().toLowerCase();
          if (activityLower.includes(cleanedLabel) || cleanedLabel.includes(activityLower.split(' ')[0])) {
            matchedPrice = dest.original?.price 
              ? `Rp ${Number(dest.original.price).toLocaleString('id-ID')}`
              : dest.price || '-';
            found = true;
          }
        }
        
        // Strategy 3: Check for partial matches with key words
        if (!found) {
          const activityWords = activityLower.split(' ');
          const destWords = (dest.original?.name || dest.label).toLowerCase().split(' ');
          
          const commonWords = activityWords.filter(word => 
            word.length > 3 && destWords.some(destWord => destWord.includes(word) || word.includes(destWord))
          );
          
          if (commonWords.length > 0) {
            matchedPrice = dest.original?.price 
              ? `Rp ${Number(dest.original.price).toLocaleString('id-ID')}`
              : dest.price || '-';
            found = true;
          }
        }
        
        if (found) {
          console.log(`✅ Matched: "${item.activity}" -> "${dest.original?.name || dest.label}" -> ${matchedPrice}`);
          break;
        }
      }

      if (matchedPrice === '-') {
        console.log(`❌ No match found for: "${item.activity}"`);
      }

      return {
        ...item,
        price: matchedPrice
      };
    });

    // Create final rundown with enhanced itinerary
    const validatedRundown = {
      title: rundown?.title || "Your Trip Rundown",
      itinerary: enhancedItinerary,
      budgetEstimation: rundown?.budgetEstimation || calculateBudgetEstimation(),
      tripDetails: rundown?.tripDetails || { categories: [] },
      error: rundown?.error || null,
    };

    console.log("Final rundown:", validatedRundown);
    setGeneratedRundown(validatedRundown);
    setIsSaved(false);
    setHasNewRundown(true); // Set notification badge
    localStorage.setItem("generatedRundown", JSON.stringify(validatedRundown));
  };

  // Handle successful save
  const handleSaveSuccess = (docId) => {
    setIsSaved(true);
    setSaveError(null);
    setShowSaveModal(false);
    setHasNewRundown(false); // Clear notification badge when saved

    localStorage.removeItem("generatedRundown");

    const event = new CustomEvent("rundownSaved", {
      detail: { docId, title: generatedRundown?.title },
    });
    document.dispatchEvent(event);

    setTimeout(() => {
      setIsSaved(false);
    }, 5000);
  };

  // Handle save error
  const handleSaveError = (error) => {
    setSaveError(error);
    console.error("Save error:", error);
  };

  // Remove a destination from the trip
  const removeDestination = (id) => {
    setSelectedDestinations((prev) => prev.filter((dest) => dest.id !== id));

    if (selectedDestinations.length <= 1) {
      setGeneratedRundown(null);
      localStorage.removeItem("generatedRundown");
      setHasNewRundown(false); // Clear notification if no destinations left
    }

    const updatedTrip = selectedDestinations.filter((dest) => dest.id !== id);
    localStorage.setItem("yourTrip", JSON.stringify(updatedTrip));

    const tripUpdateEvent = new CustomEvent("tripUpdated", {
      bubbles: true,
      detail: { source: "YourTripPopup" },
    });
    document.dispatchEvent(tripUpdateEvent);
  };

  // Clear the entire trip
  const clearTrip = () => {
    setSelectedDestinations([]);
    setGeneratedRundown(null);
    setIsSaved(false);
    setHasNewRundown(false); // Clear notification when trip is cleared
    localStorage.removeItem("yourTrip");
    localStorage.removeItem("generatedRundown");

    const tripUpdateEvent = new CustomEvent("tripUpdated", {
      bubbles: true,
      detail: { source: "YourTripPopup" },
    });
    document.dispatchEvent(tripUpdateEvent);
  };

  // Function to get emoji based on category
  const getCategoryEmoji = (category) => {
    switch (category) {
      case "Kuliner":
        return "🍜";
      case "Rekreasi":
        return "🎡";
      case "Sejarah":
        return "🏛️";
      case "Belanja":
        return "🛍️";
      case "Edukasi":
        return "📚";
      case "Alam":
        return "🌳";
      case "Cafe":
        return "☕";
      case "Venue":
        return "🏞️";
      default:
        return "📍";
    }
  };

  // Calculate budget estimation
  const calculateBudgetEstimation = () => {
    let totalLow = 0;
    let totalHigh = 0;

    selectedDestinations.forEach((dest) => {
      const priceValue = dest.original?.price || 
                       (dest.price && dest.price.match(/\d+/) ? dest.price.replace(/\D/g, '') : 0);
      
      const numericPrice = parseInt(priceValue, 10) || 0;
      
      totalLow += numericPrice;
      totalHigh += numericPrice * 1.1; // Add 10% buffer
    });

    // Add transportation buffer
    totalLow += 0;
    totalHigh += 10000;

    const formatNumber = (num) => {
      return Math.round(num)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    return `Rp ${formatNumber(totalLow)} - ${formatNumber(totalHigh)}/pax`;
  };

  // Toggle popup size between normal and large
  const togglePopupSize = () => {
    setPopupSize((size) => {
      return size === "normal" ? "large" : "normal";
    });
  };

  // Get popup size class
  const getPopupSizeClass = () => {
    switch (popupSize) {
      case "normal":
        return "w-[24rem] h-[500px]";
      case "large":
        return "w-[32rem] h-[80vh]";
      default:
        return "w-[24rem] h-[500px]";
    }
  };

  // Render Save Rundown Button
  const renderSaveButton = () => {
    if (
      selectedDestinations.length === 0 &&
      (!generatedRundown ||
        !generatedRundown.itinerary ||
        generatedRundown.itinerary.length === 0)
    ) {
      return null;
    }

    if (!isLoggedIn) {
      return (
        <button
          onClick={() => (window.location.href = "/login")}
          className="flex items-center gap-2 px-4 py-2 bg-gray-400 text-white text-sm font-medium rounded-lg cursor-not-allowed transition-colors"
          title="Login diperlukan untuk menyimpan rundown"
        >
          <User size={16} />
          Login untuk Simpan
        </button>
      );
    }

    if (isSaved) {
      return (
        <button
          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg cursor-default"
          disabled
        >
          <Check size={20} />
          Tersimpan!
        </button>
      );
    }

    return (
      <button
        onClick={() => setShowSaveModal(true)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm hover:shadow-md"
      >
        <Save size={16} />
        Simpan Rundown
      </button>
    );
  };

  return (
    <>
      {/* Floating Button with notification badges */}
      <button
        onClick={() => {
          setIsPopupOpen(!isPopupOpen);
          setHasNewRundown(false); // Clear notification when popup is opened
        }}
        className="fixed bottom-8 right-8 bg-white border border-blue-500 text-blue-500 font-semibold py-2 px-4 rounded-full shadow-lg hover:bg-blue-100 transition-all duration-500 z-[999]"
        style={{ position: "fixed", bottom: "32px", right: "32px" }}
      >
        Your trip
        {/* Destination count badge */}
        {selectedDestinations.length > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full animate-pulse">
            {selectedDestinations.length}
          </span>
        )}
        {/* Rundown notification badge */}
        {hasNewRundown && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full animate-pulse">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        )}
      </button>

      {/* Popup */}
      {isPopupOpen && (
        <div
          ref={popupRef}
          className={`fixed bottom-20 right-8 bg-white rounded-xl shadow-2xl overflow-hidden z-50 transition-all duration-300 ${getPopupSizeClass()} flex flex-col`}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 flex justify-between items-center">
            <div className="flex items-center">
              <h3 className="font-bold text-lg">Your Trip</h3>
              {selectedDestinations.length > 0 && (
                <span className="ml-2 bg-white text-blue-600 text-xs px-2 py-0.5 rounded-full font-medium">
                  {selectedDestinations.length} items
                </span>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={togglePopupSize}
                className="text-white hover:text-blue-200 transition-colors"
                title={popupSize === "normal" ? "Maximize" : "Minimize"}
              >
                {popupSize === "normal" ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 12H4"
                    />
                  </svg>
                )}
              </button>
              <button
                onClick={() => setIsPopupOpen(false)}
                className="text-white hover:text-blue-200 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-grow overflow-auto p-6">
            {/* Action Buttons */}
            <div className="flex gap-2 mb-5 flex-wrap">
              {selectedDestinations.length > 0 && (
                <button
                  onClick={clearTrip}
                  className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-600 text-sm font-medium rounded-lg hover:bg-red-200 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Clear All
                </button>
              )}

              <button
                onClick={openRundownGenerator}
                className="flex-grow px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-sm font-medium rounded-lg transition-all duration-300 shadow-sm hover:shadow-md flex items-center justify-center gap-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                Generate Smart Rundown
              </button>

              {/* Save Rundown Button */}
              {renderSaveButton()}
            </div>

            {/* Save Error Display */}
            {saveError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">
                  <strong>Gagal menyimpan:</strong> {saveError}
                </p>
              </div>
            )}

            {isLoading ? (
              <div className="text-center py-10">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-3 text-sm text-gray-600">
                  Memuat destinasi...
                </p>
              </div>
            ) : error ? (
              <div className="text-center py-10 text-red-500 text-sm">
                {error}
              </div>
            ) : generatedRundown ? (
              // Show generated rundown with save functionality
              <div
                className={`space-y-5 ${animateRundown ? "animate-pulse" : ""}`}
              >
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-blue-700 text-lg">
                    {generatedRundown.title || "Your Trip Rundown"}
                  </h4>
                  <div className="flex items-center gap-2">
                    {isSaved && (
                      <span className="text-green-600 text-sm flex items-center gap-1">
                        <Check size={14} />
                        Tersimpan
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setGeneratedRundown(null);
                        setIsSaved(false);
                        setHasNewRundown(false); // Clear notification when reset
                        localStorage.removeItem("generatedRundown");
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-red-500 text-xs font-medium rounded-md transition-colors"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      Reset
                    </button>
                  </div>
                </div>

                {generatedRundown.itinerary &&
                generatedRundown.itinerary.length > 0 ? (
                  <div className="border-l-3 border-blue-500 pl-4 space-y-4">
                    {generatedRundown.itinerary.map((item, index) => (
                      <div
                        key={index}
                        className="bg-white p-3 rounded-md shadow-sm hover:shadow-md hover:bg-blue-50 transition-all duration-300"
                      >
                        <div className="flex items-center">
                          <span className="font-semibold text-blue-800 text-base">
                            {item.time || `Activity ${index + 1}`}
                          </span>
                          <span className="mx-2">-</span>
                          <span className="font-medium">
                            {item.activity || "Planned activity"}
                          </span>
                        </div>
                        <div className="flex justify-between items-start mt-1">
                          <div className="text-sm text-gray-600 ml-1">
                            {item.duration && item.notes
                              ? `${item.duration} • ${item.notes}`
                              : item.duration || item.notes}
                          </div>
                          <div className="text-sm font-medium text-green-600">
                            {item.price || '-'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 bg-blue-50 rounded-lg">
                    <p className="text-blue-600">
                      Rundown was generated but contains no itinerary items.
                    </p>
                  </div>
                )}

                {generatedRundown.error && (
                  <div className="text-sm text-red-500 mt-3 p-3 bg-red-50 rounded-lg">
                    {generatedRundown.error}
                  </div>
                )}
              </div>
            ) : (
              // Show selected destinations
              <ul className="space-y-4 text-sm max-h-[calc(100%-100px)] overflow-y-auto pr-2">
                {selectedDestinations.length > 0 ? (
                  selectedDestinations.map((item, index) => (
                    <li
                      key={index}
                      className="flex justify-between items-center bg-white p-4 rounded-lg border border-gray-100 hover:shadow-lg transition-all duration-300 hover:border-blue-300 animate-fadeIn"
                    >
                      <div>
                        <p className="font-medium text-base">{item.label}</p>
                        <p className="text-gray-600 mt-1">{item.price}</p>
                      </div>
                      <div className="flex space-x-3">
                        <Link
                          to={`/destination/${item.id}`}
                          className="flex items-center gap-1 text-blue-500 hover:text-blue-700 hover:underline text-sm font-medium transition-colors"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                          Detail
                        </Link>
                        <button
                          onClick={() => removeDestination(item.id)}
                          className="text-red-500 hover:text-red-700 transition-colors p-1 hover:bg-red-50 rounded-full"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    </li>
                  ))
                ) : (
                  <div className="text-center py-12 px-4">
                    <div className="mx-auto w-24 h-24 flex items-center justify-center bg-blue-50 rounded-full mb-5">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-12 w-12 text-blue-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                        />
                      </svg>
                    </div>
                    <p className="text-gray-700 font-medium text-lg">
                      Belum ada destinasi yang dipilih
                    </p>
                    <p className="text-gray-500 mt-2">
                      Tambahkan destinasi dari halaman utama atau gunakan Smart
                      Rundown Generator
                    </p>
                    <button
                      onClick={openRundownGenerator}
                      className="mt-6 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-full flex items-center justify-center gap-2 mx-auto transition-colors shadow-md hover:shadow-lg"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                      Buat Trip Baru
                    </button>
                  </div>
                )}
              </ul>
            )}
          </div>

          {/* Budget Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-700 font-medium">
                Budget Estimasi
              </p>
              <div className="bg-white border-2 border-blue-500 text-blue-600 rounded-lg px-4 py-2 text-sm font-bold shadow-sm">
                {generatedRundown
                  ? generatedRundown.budgetEstimation
                  : selectedDestinations.length > 0
                  ? calculateBudgetEstimation()
                  : "Rp 0"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Rundown Modal */}
      {showSaveModal && (generatedRundown||selectedDestinations.length !== 0) && (
        <SaveRundownModel
          isOpen={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          rundownData={generatedRundown}
          userId={user?.uid}
          onSaveSuccess={handleSaveSuccess}
          onSaveError={handleSaveError}
          selectedrundown={selectedDestinations}
        />
      )}

      {/* Rundown Generator */}
      {isRundownGeneratorOpen && (
        <RundownGenerator
          isOpen={isRundownGeneratorOpen}
          onClose={closeRundownGenerator}
          onGenerateRundown={handleGenerateRundown}
          selectedDestinations={selectedDestinations}
        />
      )}

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out;
        }

        .border-l-3 {
          border-left-width: 3px;
        }
      `}</style>
    </>
  );
};

export default YourTripPopup;