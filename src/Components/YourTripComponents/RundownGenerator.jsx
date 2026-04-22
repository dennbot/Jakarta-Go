import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, limit, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { createPortal } from "react-dom";



const RundownGenerator = ({ isOpen, onClose, onGenerateRundown, selectedDestinations }) => {
  // Track current question index
  
  const [currentStep, setCurrentStep] = useState(0);
  
  // Store available categories from Firebase
  const [availableCategories, setAvailableCategories] = useState([]);
  
  // Store user responses
  const [responses, setResponses] = useState({
    environment: 'both', // Set a default value
    budget: 'medium', // Set a default value
    duration: 'full-day',
    category: [], // This remains empty until user selects categories
    mealPreference: 'both', // Set a default value
    transportMethod: 'private', // Set a default value
    startTime: '09:00',
    travelStyle: 'balanced',
    priority: 'experience' // Set a default value
  });

  

  // State for loading destinations by categories
  const [allDestinations, setAllDestinations] = useState([]);
  const [isLoadingDestinations, setIsLoadingDestinations] = useState(false);
  const [error, setError] = useState(null);
  
  // State for questions
  const [questions, setQuestions] = useState([]);

  // Geographic areas mapping for Jakarta
  const JAKARTA_AREAS = {
    'Jakarta Pusat': ['Jakarta Pusat', 'Pusat', 'Central Jakarta', 'Menteng', 'Gambir', 'Tanah Abang', 'Kemayoran', 'Sawah Besar', 'Cempaka Putih'],
    'Jakarta Utara': ['Jakarta Utara', 'Utara', 'North Jakarta', 'Ancol', 'Kelapa Gading', 'Sunter', 'Tanjung Priok', 'Penjaringan', 'Pademangan'],
    'Jakarta Barat': ['Jakarta Barat', 'Barat', 'West Jakarta', 'Grogol', 'Cengkareng', 'Kalideres', 'Kebon Jeruk', 'Kembangan', 'Palmerah', 'Taman Sari', 'Tambora'],
    'Jakarta Selatan': ['Jakarta Selatan', 'Selatan', 'South Jakarta', 'Kebayoran', 'Cilandak', 'Jagakarsa', 'Mampang', 'Pancoran', 'Pasar Minggu', 'Pesanggrahan', 'Setiabudi', 'Tebet'],
    'Jakarta Timur': ['Jakarta Timur', 'Timur', 'East Jakarta', 'Cakung', 'Cipayung', 'Ciracas', 'Duren Sawit', 'Jatinegara', 'Kramat Jati', 'Makasar', 'Matraman', 'Pasar Rebo', 'Pulogadung']
  };

  // Function to determine area from location string
  const getAreaFromLocation = (location) => {
    if (!location || typeof location !== 'string') return 'UNKNOWN';
    
    const locationLower = location.toLowerCase();
    
    for (const [area, keywords] of Object.entries(JAKARTA_AREAS)) {
      for (const keyword of keywords) {
        if (locationLower.includes(keyword.toLowerCase())) {
          return area;
        }
      }
    }
    
    return 'UNKNOWN';
  };

  // Function to calculate distance between areas
  const getAreaDistance = (area1, area2) => {
    if (area1 === area2) return 0;
    
    // Distance matrix berdasaarrkan daerah jakarta
    const distances = {
      'Jakarta Pusat': { 'Jakarta Pusat': 0, 'Jakarta Utara': 1, 'Jakarta Barat': 2, 'Jakarta Selatan': 2, 'Jakarta Timur': 2, 'UNKNOWN': 1 },
      'Jakarta Utara': { 'Jakarta Pusat': 1, 'Jakarta Utara': 0, 'Jakarta Barat': 2, 'Jakarta Selatan': 3, 'Jakarta Timur': 2, 'UNKNOWN': 1 },
      'Jakarta Barat': { 'Jakarta Pusat': 2, 'Jakarta Utara': 2, 'Jakarta Barat': 0, 'Jakarta Selatan': 2, 'Jakarta Timur': 4, 'UNKNOWN': 2 },
      'Jakarta Selatan': { 'Jakarta Pusat': 2, 'Jakarta Utara': 3, 'Jakarta Barat': 2, 'Jakarta Selatan': 0, 'Jakarta Timur': 2, 'UNKNOWN': 2 },
      'Jakarta Timur': { 'Jakarta Pusat': 2, 'Jakarta Utara': 2, 'Jakarta Barat': 4, 'Jakarta Selatan': 2, 'Jakarta Timur': 0, 'UNKNOWN': 2 },
      'UNKNOWN': { 'Jakarta Pusat': 1, 'Jakarta Utara': 1, 'Jakarta Barat': 2, 'Jakarta Selatan': 2, 'Jakarta Timur': 2, 'UNKNOWN': 0 }
    };
    
    return distances[area1]?.[area2] || 3;
  };

  // Function to optimize route using geographic routing
  const optimizeRouteByLocation = (destinations, startArea = null) => {
    if (destinations.length <= 1) return destinations;
    
    // Group destinations by area
    const destinationsByArea = {};
    destinations.forEach(dest => {
      const area = getAreaFromLocation(dest.original?.location || dest.location);
      if (!destinationsByArea[area]) {
        destinationsByArea[area] = [];
      }
      destinationsByArea[area].push({
        ...dest,
        area: area
      });
    });
    
    // If we have a starting area preference, start from there
    let currentArea = startArea;
    if (!currentArea) {
      // Find the area with the most destinations as starting point
      currentArea = Object.keys(destinationsByArea).reduce((a, b) => 
        destinationsByArea[a].length > destinationsByArea[b].length ? a : b
      );
    }
    
    const visited = new Set();
    const optimizedRoute = [];
    
    // Helper function to find next best area
    const findNextBestArea = (current) => {
      let bestArea = null;
      let bestScore = Infinity;
      
      for (const area of Object.keys(destinationsByArea)) {
        if (visited.has(area) || destinationsByArea[area].length === 0) continue;
        
        const distance = getAreaDistance(current, area);
        const destinationCount = destinationsByArea[area].length;
        
        // Score based on distance (lower is better) and number of destinations (higher is better)
        const score = distance - (destinationCount * 0.5);
        
        if (score < bestScore) {
          bestScore = score;
          bestArea = area;
        }
      }
      
      return bestArea;
    };
    
    // Start with destinations in the current area
    while (Object.keys(destinationsByArea).some(area => !visited.has(area) && destinationsByArea[area].length > 0)) {
      if (!visited.has(currentArea) && destinationsByArea[currentArea] && destinationsByArea[currentArea].length > 0) {
        // Add all destinations from current area
        optimizedRoute.push(...destinationsByArea[currentArea]);
        visited.add(currentArea);
      }
      
      // Find next best area to visit
      const nextArea = findNextBestArea(currentArea);
      if (nextArea) {
        currentArea = nextArea;
      } else {
        // Add any remaining destinations
        for (const area of Object.keys(destinationsByArea)) {
          if (!visited.has(area) && destinationsByArea[area].length > 0) {
            optimizedRoute.push(...destinationsByArea[area]);
            visited.add(area);
          }
        }
        break;
      }
    }
    
    return optimizedRoute;
  };

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      // Reset to first step when opened
      setCurrentStep(0);
      // Reset responses with default values
      setResponses({
        environment: 'both',
        budget: 'medium',
        duration: 'full-day',
        category: [],
        mealPreference: 'both',
        transportMethod: 'private',
        startTime: '09:00',
        travelStyle: 'balanced',
        priority: 'experience'
      });
      // Fetch destinations
      fetchDestinations();
    }
  }, [isOpen]);

  // Lock scroll when popup is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Update questions when categories are loaded
  useEffect(() => {
    if (availableCategories.length > 0) {
      setQuestions(getQuestions(availableCategories));
    }
  }, [availableCategories]);

  // Generate questions based on available categories
  const getQuestions = (categories) => [
    {
      id: 'environment',
      question: 'Apakah Anda lebih suka destinasi indoor atau outdoor?',
      options: [
        { value: 'indoor', label: 'Indoor' },
        { value: 'outdoor', label: 'Outdoor' },
        { value: 'both', label: 'Keduanya' },
      ],
      type: 'radio',
    },
    {
      id: 'duration',
      question: 'Berapa lama durasi trip yang Anda inginkan?',
      options: [
        { value: 'half-day', label: 'Setengah hari (4-5 jam)' },
        { value: 'full-day', label: 'Full day (8-10 jam)' },
      ],
      type: 'radio',
    },
    {
      id: 'category',
      question: 'Kategori destinasi apa yang Anda minati? (pilih semua yang sesuai)',
      options: categories.map(category => ({ value: category, label: category })),
      type: 'checkbox',
    },
    {
      id: 'priority',
      question: 'Apa prioritas utama dalam perjalanan Anda?',
      options: [
        { value: 'experience', label: 'Pengalaman unik' },
        { value: 'photo', label: 'Spot foto instagramable' },
        { value: 'culinary', label: 'Kuliner' },
        { value: 'relax', label: 'Relaksasi' },
        { value: 'activities', label: 'Banyak aktivitas' },
      ],
      type: 'radio',
    },
    {
      id: 'mealPreference',
      question: 'Preferensi makan Anda?',
      options: [
        { value: 'local', label: 'Makanan Lokal' },
        { value: 'international', label: 'Makanan Internasional' },
        { value: 'both', label: 'Keduanya' },
      ],
      type: 'radio',
    },
    {
      id: 'transportMethod',
      question: 'Metode transportasi yang digunakan?',
      options: [
        { value: 'private', label: 'Kendaraan Pribadi' },
        { value: 'public', label: 'Transportasi Umum' },
        { value: 'ride-sharing', label: 'Ride Sharing (Gojek, Grab)' },
      ],
      type: 'radio',
    },
    {
      id: 'travelStyle',
      question: 'Gaya perjalanan yang Anda inginkan?',
      options: [
        { value: 'relaxed', label: 'Santai - Lebih sedikit destinasi dengan waktu lebih lama' },
        { value: 'balanced', label: 'Seimbang - Jumlah destinasi standar' },
        { value: 'intensive', label: 'Intensif - Lebih banyak destinasi dengan waktu lebih singkat' }
      ],
      type: 'radio',
    },
    {
      id: 'startTime',
      question: 'Jam berapa Anda ingin memulai trip?',
      type: 'time',
    }
  ];

  // Fetch all destinations from Firebase
  const fetchDestinations = async () => {
    if (!isOpen) return;
    
    try {
      setIsLoadingDestinations(true);
      
      const destinasiRef = collection(db, "destinasi");
      const querySnapshot = await getDocs(destinasiRef);
      
      const destinationArray = [];
      const uniqueCategories = new Set();
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        destinationArray.push({
          ...data,
          id: doc.id,
        });
        
        // Collect all unique categories
        if (data.category) {
          uniqueCategories.add(data.category);
        }
      });
      
      // If there are no destinations from Firebase, create sample data for testing
      if (destinationArray.length === 0) {
        console.log("No destinations found in Firebase, creating sample data");
        
        // Create sample destinations with different categories and locations
        const sampleDestinations = [
          {
            id: 'sample-kuliner-1',
            name: 'Warung Makan Enak',
            category: 'Kuliner',
            price: '50000',
            indoorOutdoor: 'indoor',
            description: 'Tempat makan enak dan murah',
            location: 'Jakarta Selatan'
          },
          {
            id: 'sample-rekreasi-1',
            name: 'Taman Mini',
            category: 'Rekreasi',
            price: '100000',
            indoorOutdoor: 'outdoor',
            description: 'Tempat rekreasi keluarga',
            location: 'Jakarta Timur'
          },
          {
            id: 'sample-sejarah-1',
            name: 'Museum Nasional',
            category: 'Sejarah',
            price: '50000',
            indoorOutdoor: 'indoor',
            description: 'Museum dengan koleksi sejarah',
            location: 'Jakarta Pusat'
          },
          {
            id: 'sample-alam-1',
            name: 'Hutan Kota',
            category: 'Alam',
            price: '25000',
            indoorOutdoor: 'outdoor',
            description: 'Tempat refreshing di tengah kota',
            location: 'Jakarta Utara'
          },
          {
            id: 'sample-cafe-1',
            name: 'Kopi Kenangan',
            category: 'Cafe',
            price: '30000',
            indoorOutdoor: 'indoor',
            description: 'Tempat ngopi yang instagrammable',
            location: 'Jakarta Barat'
          }
        ];
        
        // Add sample destinations to array
        destinationArray.push(...sampleDestinations);
        
        // Add sample categories
        uniqueCategories.add('Kuliner');
        uniqueCategories.add('Rekreasi');
        uniqueCategories.add('Sejarah');
        uniqueCategories.add('Alam');
        uniqueCategories.add('Cafe');
      }
      
      setAllDestinations(destinationArray);
      setAvailableCategories(Array.from(uniqueCategories));
      setIsLoadingDestinations(false);
    } catch (error) {
      console.error("Error fetching destinations:", error);
      setError("Gagal memuat data destinasi. Silakan coba lagi nanti.");
      setIsLoadingDestinations(false);
    }
  };

  // Handle option selection
  const handleOptionSelect = (questionId, value, isCheckbox = false) => {
    if (isCheckbox) {
      // For checkboxes, we need to handle arrays
      setResponses(prev => {
        const currentValues = prev[questionId] || [];
        if (currentValues.includes(value)) {
          // Remove if already selected
          return {
            ...prev,
            [questionId]: currentValues.filter(item => item !== value)
          };
        } else {
          // Add if not already selected
          return {
            ...prev,
            [questionId]: [...currentValues, value]
          };
        }
      });
    } else {
      // For radio buttons and other single-value inputs
      setResponses(prev => ({
        ...prev,
        [questionId]: value
      }));
    }
  };

  // Handle time input change
  const handleTimeChange = (questionId, value) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  // Go to next question
  const handleNext = async () => {
    // Validate that current question is answered
    const currentQuestion = questions[currentStep];
    if (!currentQuestion) return; // Guard clause

    const response = responses[currentQuestion.id];
    
    // For checkbox type, ensure at least one option is selected
    if (currentQuestion.type === 'checkbox' && (!response || response.length === 0)) {
      // Don't require selections for categories, just use all available
      if (currentQuestion.id === 'category') {
        // If no categories selected, select all available
        setResponses(prev => ({
          ...prev,
          category: availableCategories
        }));
      } else {
        alert('Silakan pilih minimal satu opsi');
        return;
      }
    }
    
    // For other types, ensure a response exists
    if (!response && currentQuestion.type !== 'checkbox') {
      // Set default value based on question id
      let defaultValue;
      switch (currentQuestion.id) {
        case 'environment':
          defaultValue = 'both';
          break;
        case 'budget':
          defaultValue = 'medium';
          break;
        case 'priority':
          defaultValue = 'experience';
          break;
        case 'mealPreference':
          defaultValue = 'both';
          break;
        case 'transportMethod':
          defaultValue = 'private';
          break;
        default:
          // For startTime, default is already set
          if (currentQuestion.id === 'startTime') {
            defaultValue = '09:00';
          } else {
            alert('Silakan pilih salah satu opsi');
            return;
          }
      }
      
      // Set default value
      if (defaultValue) {
        setResponses(prev => ({
          ...prev,
          [currentQuestion.id]: defaultValue
        }));
      }
    }
    
    // Move to next question if not at the end
    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // At the end, generate rundown
      const generatedRundown = await generateRundown(responses);
      onGenerateRundown(generatedRundown);
      onClose();
    }
  };

  // Go to previous question
  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Close the popup
  const handleClose = () => {
    setCurrentStep(0);
    setResponses({
      environment: 'both',
      budget: 'medium',
      duration: 'full-day',
      category: [],
      mealPreference: 'both',
      transportMethod: 'private',
      startTime: '09:00',
      travelStyle: 'balanced',
      priority: 'experience'
    });
    onClose();
  };

  // Function to generate rundown based on preferences and destinations
  const generateRundown = async (preferences) => {
    try {
      console.log("Generating rundown with preferences:", preferences);
      console.log("Selected destinations:", selectedDestinations);
      console.log("All destinations:", allDestinations);
      
      // Start with preselected destinations if any
      let destinationsForTrip = [...selectedDestinations];
      
      // Ensure the destinations have all required properties
      destinationsForTrip = destinationsForTrip.map(dest => {
        return {
          ...dest,
          id: dest.id || `dest-${Math.random().toString(36).substring(7)}`,
          label: dest.label || dest.name || 'Unnamed Destination',
          category: dest.category || 'Lainnya',
          price: dest.price || 'Harga tidak tersedia',
        };
      });
      
      console.log("Processed destinations for trip:", destinationsForTrip);
      
      // Calculate how many additional destinations we need based on preferences and travel style
      let targetDestinationCount;
      switch (preferences.travelStyle) {
        case 'relaxed':
          targetDestinationCount = preferences.duration === 'half-day' ? 2 : preferences.duration === 'full-day' ? 3 : 5;
          break;
        case 'intensive':
          targetDestinationCount = preferences.duration === 'half-day' ? 4 : preferences.duration === 'full-day' ? 6 : 10;
          break;
        default: // balanced
          targetDestinationCount = preferences.duration === 'half-day' ? 3 : preferences.duration === 'full-day' ? 4 : 8;
      }
      
      console.log(`Target destination count: ${targetDestinationCount}`);
      
      // If we don't have enough destinations, add more from allDestinations
      if (destinationsForTrip.length < targetDestinationCount) {
        console.log("Need more destinations to reach target count");
        
        // Create a copy of all destinations to work with
        let additionalDestinations = [...allDestinations].map(dest => ({
          id: dest.id || `dest-${Math.random().toString(36).substring(7)}`,
          label: dest.name || 'Unnamed Destination',
          price: dest.price ? `Rp ${dest.price}` : 'Free',
          category: dest.category || 'Lainnya',
          indoorOutdoor: dest.indoorOutdoor || 'both',
          location: dest.location || 'Jakarta',
          original: dest
        }));
        
        console.log(`Found ${additionalDestinations.length} potential additional destinations`);
        
        // Get existing IDs to avoid duplicates
        const existingIds = new Set(destinationsForTrip.map(d => d.id));
        
        // Filter out destinations already in the trip
        additionalDestinations = additionalDestinations.filter(dest => !existingIds.has(dest.id));
        
        // Filter destinations by category if selected and not empty
        if (preferences.category && preferences.category.length > 0) {
          const categoryFilter = Array.isArray(preferences.category) 
            ? preferences.category 
            : [preferences.category];
          
          console.log(`Filtering by categories: ${categoryFilter.join(', ')}`);
          
          // Don't filter if all categories are selected
          if (categoryFilter.length < availableCategories.length) {
            additionalDestinations = additionalDestinations.filter(
              dest => dest.category && categoryFilter.includes(dest.category)
            );
          }
        }
        
        console.log(`After category filtering: ${additionalDestinations.length} destinations`);
        
        // Filter by indoor/outdoor if specified and not 'both'
        if (preferences.environment && preferences.environment !== 'both') {
          console.log(`Filtering by environment: ${preferences.environment}`);
          
          // Filter gently - if indoorOutdoor isn't specified, still include the destination
          additionalDestinations = additionalDestinations.filter(
            dest => !dest.indoorOutdoor || dest.indoorOutdoor === 'both' || 
                   dest.indoorOutdoor.toLowerCase() === preferences.environment
          );
        }
        
        console.log(`After environment filtering: ${additionalDestinations.length} destinations`);
        
        // Filter by budget - make this filter optional if results are too few
        if (preferences.budget && additionalDestinations.length > targetDestinationCount) {
          console.log(`Filtering by budget: ${preferences.budget}`);
          
          const budgetFilteredDestinations = additionalDestinations.filter(dest => {
            // Extract price from different possible formats
            let price = 0;
            if (typeof dest.price === 'number') {
              price = dest.price;
            } else if (typeof dest.price === 'string') {
              const priceMatch = dest.price.match(/(\d+[\d.,]*)/g);
              if (priceMatch && priceMatch.length > 0) {
                price = parseInt(priceMatch[0].replace(/[.,]/g, ''), 10) || 0;
              }
            } else if (dest.original && typeof dest.original.price === 'string') {
              const priceMatch = dest.original.price.match(/(\d+[\d.,]*)/g);
              if (priceMatch && priceMatch.length > 0) {
                price = parseInt(priceMatch[0].replace(/[.,]/g, ''), 10) || 0;
              }
            }
            
            // Apply budget filter
            if (preferences.budget === 'low') {
              return price < 100000;
            } else if (preferences.budget === 'medium') {
              return price >= 100000 && price <= 300000;
            } else {
              return price > 300000;
            }
          });
          
          // Only use budget filtering if it doesn't reduce destinations too much
          if (budgetFilteredDestinations.length >= Math.ceil(targetDestinationCount / 2)) {
            additionalDestinations = budgetFilteredDestinations;
          } else {
            console.log("Budget filtering would reduce destinations too much, skipping");
          }
        }
        
        console.log(`After budget filtering: ${additionalDestinations.length} destinations`);
        
        // Sort by priority if specified
        if (preferences.priority) {
          console.log(`Sorting by priority: ${preferences.priority}`);
          
          switch (preferences.priority) {
            case 'photo':
              // Prioritize destinations with "instagrammable" in description
              additionalDestinations.sort((a, b) => {
                const aDesc = (a.original?.description || '').toLowerCase();
                const bDesc = (b.original?.description || '').toLowerCase();
                const aHasInsta = aDesc.includes('instagrammable') || aDesc.includes('foto') || aDesc.includes('photo');
                const bHasInsta = bDesc.includes('instagrammable') || bDesc.includes('foto') || bDesc.includes('photo');
                return (bHasInsta ? 1 : 0) - (aHasInsta ? 1 : 0);
              });
              break;
            case 'culinary':
              // Put Kuliner destinations first
              additionalDestinations.sort((a, b) => {
                return (b.category === 'Kuliner' ? 1 : 0) - (a.category === 'Kuliner' ? 1 : 0);
              });
              break;
            case 'relax':
              // Prioritize parks, nature, or spas
              additionalDestinations.sort((a, b) => {
                const aDesc = (a.original?.description || '').toLowerCase();
                const bDesc = (b.original?.description || '').toLowerCase();
                const aIsRelaxing = a.category === 'Alam' || 
                                   aDesc.includes('relax') ||
                                   aDesc.includes('spa');
                const bIsRelaxing = b.category === 'Alam' || 
                                   bDesc.includes('relax') ||
                                   bDesc.includes('spa');
                return (bIsRelaxing ? 1 : 0) - (aIsRelaxing ? 1 : 0);
              });
              break;
            case 'activities':
              // Prioritize recreation and active places
              additionalDestinations.sort((a, b) => {
                const aDesc = (a.original?.description || '').toLowerCase();
                const bDesc = (b.original?.description || '').toLowerCase();
                const aIsActive = a.category === 'Rekreasi' || 
                                 aDesc.includes('aktivitas') ||
                                 aDesc.includes('activity');
                const bIsActive = b.category === 'Rekreasi' || 
                                 bDesc.includes('aktivitas') ||
                                 bDesc.includes('activity');
                return (bIsActive ? 1 : 0) - (aIsActive ? 1 : 0);
              });
              break;
            // Experience is default, no special sorting
          }
        }
        
        // Add additional destinations (avoiding duplicates)
        for (const dest of additionalDestinations) {
          if (!existingIds.has(dest.id) && destinationsForTrip.length < targetDestinationCount) {
            destinationsForTrip.push(dest);
            existingIds.add(dest.id);
          }
          
          // Break if we have enough destinations
          if (destinationsForTrip.length >= targetDestinationCount) {
            break;
          }
        }
      }
      
      console.log(`Final destination count: ${destinationsForTrip.length}`);
      
      // Make sure we have at least 1 culinary place for meals
      const hasCulinary = destinationsForTrip.some(dest => dest.category === 'Kuliner');
      if (!hasCulinary) {
        console.log("No culinary place found, adding one");
        
        // Find a culinary place from all destinations
        const culinaryPlace = allDestinations.find(dest => dest.category === 'Kuliner');
        if (culinaryPlace) {
          destinationsForTrip.push({
            id: culinaryPlace.id,
            label: culinaryPlace.name || "Tempat Makan",
            price: culinaryPlace.price ? `Rp ${culinaryPlace.price}` : 'Free',
            category: 'Kuliner',
            location: culinaryPlace.location || 'Jakarta',
            original: culinaryPlace
          });
        } else {
          // If no culinary place found in allDestinations, create a dummy one
          destinationsForTrip.push({
            id: 'dummy-culinary',
            label: 'Tempat Makan lokal',
            price: 'Rp 15000',
            category: 'Kuliner',
            location: 'Jakarta Pusat'
          });
        }
      }
      
      console.log("Final destinations for trip:", destinationsForTrip);
      
      // Extract start time
      const startTime = preferences.startTime || '09:00';
      
      // Parse hours and minutes
      const [startHours, startMinutes] = startTime.split(':').map(Number);
      
      // Calculate trip duration in hours based on preference
      let tripDurationHours;
      if (preferences.duration === 'half-day') {
        tripDurationHours = 5;
      } else if (preferences.duration === 'weekend') {
        tripDurationHours = 20; // Simplified for a 2-day trip
      } else {
        // full-day
        tripDurationHours = 10;
      }
      
      // Determine end time
      let endHours = startHours + tripDurationHours;
      let endMinutes = startMinutes;
      
      // Adjust for day overflow
      if (endHours >= 24) {
        endHours = endHours - 24;
      }
      
      // Format end time
      const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
      
      // Separate culinary and regular destinations
      const culinaryPlaces = destinationsForTrip.filter(dest => dest.category === 'Kuliner');
      const regularPlaces = destinationsForTrip.filter(dest => dest.category !== 'Kuliner');
      
      console.log(`Found ${culinaryPlaces.length} culinary places and ${regularPlaces.length} regular places`);
      
      // GEOGRAPHIC OPTIMIZATION: Apply route optimization based on location
      let optimizedDestinations = [];
      
      // Determine starting area from selected destinations or use Jakarta Pusat as default
      let startingArea = 'Jakarta Pusat';
      if (selectedDestinations.length > 0) {
        const firstDestArea = getAreaFromLocation(selectedDestinations[0].location || selectedDestinations[0].original?.location);
        if (firstDestArea !== 'UNKNOWN') {
          startingArea = firstDestArea;
        }
      }
      
      console.log(`Starting area: ${startingArea}`);
      
      // Optimize route based on geographic location
      if (preferences.travelStyle === 'relaxed') {
        // For relaxed travel, prioritize staying in one area
        optimizedDestinations = optimizeRouteByLocation(regularPlaces, startingArea);
      } else if (preferences.travelStyle === 'intensive') {
        // For intensive travel, we can afford to travel more but still optimize
        optimizedDestinations = optimizeRouteByLocation(regularPlaces, startingArea);
      } else {
        // Balanced approach: optimize for geographic efficiency
        optimizedDestinations = optimizeRouteByLocation(regularPlaces, startingArea);
      }
      
      console.log("Optimized destinations by location:", optimizedDestinations.map(d => `${d.label} (${d.area || getAreaFromLocation(d.location)})`));
      
      // Create itinerary
      let itinerary = [];
      
      // Helper function to format time
      const formatTime = (h, m) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      
      // Helper function to add time
      const addTime = (h, m, addHours, addMinutes) => {
        m += addMinutes;
        if (m >= 60) {
          h += Math.floor(m / 60);
          m = m % 60;
        }
        h += addHours;
        if (h >= 24) h -= 24;
        return [h, m];
      };
      
      // Used destinations tracker
      const usedDestinations = new Set();
      
      // Calculate activity durations based on travel style and transport method
      let defaultActivityDuration;
      let transportTimeBetweenDestinations;
      let mealDuration;
      
      switch (preferences.travelStyle) {
        case 'relaxed':
          defaultActivityDuration = 120; // 2 hours
          transportTimeBetweenDestinations = preferences.transportMethod === 'private' ? 35 : 45; // Longer for relaxed
          mealDuration = 90; // Longer meals
          break;
        case 'intensive':
          defaultActivityDuration = 60; // 1 hour
          transportTimeBetweenDestinations = preferences.transportMethod === 'private' ? 15 : 25; // Quicker transitions
          mealDuration = 45; // Quick meals
          break;
        default: // balanced
          defaultActivityDuration = 90; // 1.5 hours
          transportTimeBetweenDestinations = preferences.transportMethod === 'private' ? 25 : 35; // Standard travel time
          mealDuration = 60; // Standard meal time
      }
      
      // Adjust transport time based on area changes
      const getTransportTimeForDestinations = (currentDest, nextDest) => {
        if (!currentDest || !nextDest) return transportTimeBetweenDestinations;
        
        const currentArea = currentDest.area || getAreaFromLocation(currentDest.location);
        const nextArea = nextDest.area || getAreaFromLocation(nextDest.location);
        
        const areaDistance = getAreaDistance(currentArea, nextArea);
        
        // Base transport time + extra time for area changes
        let extraTime = 0;
        if (areaDistance === 0) {
          extraTime = 0; // Same area
        } else if (areaDistance === 1) {
          extraTime = 10; // Adjacent areas
        } else if (areaDistance === 2) {
          extraTime = 20; // 2 areas away
        } else {
          extraTime = 30; // Far areas
        }
        
        // Apply transport method multiplier
        let multiplier = 1;
        switch (preferences.transportMethod) {
          case 'private':
            multiplier = 1;
            break;
          case 'public':
            multiplier = 1.5; // Public transport takes longer
            break;
          case 'ride-sharing':
            multiplier = 1.2; // Slightly longer due to waiting time
            break;
        }
        
        return Math.round((transportTimeBetweenDestinations + extraTime) * multiplier);
      };
      
      // Set current time to start time
      let currentHour = startHours;
      let currentMinute = startMinutes;
      let currentTimeMinutes = currentHour * 60 + currentMinute;
      const endTimeMinutes = (endHours < startHours ? endHours + 24 : endHours) * 60 + endMinutes;
      
      console.log(`Trip starts at ${formatTime(currentHour, currentMinute)} and ends at ${formatTime(endHours, endMinutes)}`);
      
      // Track current location for transport time calculation
      let currentDestination = null;
      
      // Breakfast if starting early (before 9 AM)
      if (startHours < 9) {
        const breakfastPlace = culinaryPlaces.find(place => !usedDestinations.has(place.id));
        
        const breakfastLocation = breakfastPlace?.location || breakfastPlace?.original?.location || 'Jakarta Pusat';
        const breakfastArea = getAreaFromLocation(breakfastLocation);
        
        itinerary.push({
          time: formatTime(currentHour, currentMinute),
          activity: breakfastPlace 
            ? `🍳 Sarapan - ${breakfastPlace.label}` 
            : '🍳 Sarapan',
          duration: `${mealDuration} menit`,
          notes: `Mulai hari dengan sarapan yang lezat di ${breakfastArea}`, 
          price: breakfastPlace?.price || 'Harga tidak tersedia',
          location: breakfastLocation,
          area: breakfastArea
        });
        
        if (breakfastPlace) {
          usedDestinations.add(breakfastPlace.id);
          currentDestination = { ...breakfastPlace, area: breakfastArea, location: breakfastLocation };
        }
        
        [currentHour, currentMinute] = addTime(currentHour, currentMinute, 0, mealDuration);
        currentTimeMinutes = currentHour * 60 + currentMinute;
      }
      
      // Morning activities 
      let morningActivitiesAdded = 0;
      const maxMorningActivities = preferences.travelStyle === 'intensive' ? 3 : preferences.travelStyle === 'relaxed' ? 1 : 2;
      
      // Lunch timeframe: ideally between 12-14
      const idealLunchStartMinutes = 12 * 60; // 12:00
      const latestLunchStartMinutes = 14 * 60; // 14:00
      
      console.log(`Planning to add up to ${maxMorningActivities} morning activities`);
      
      // Add morning activities until lunch time
      while (morningActivitiesAdded < maxMorningActivities && 
             currentTimeMinutes < idealLunchStartMinutes - defaultActivityDuration && 
             optimizedDestinations.length > 0) {
        
        // Get next destination
        const nextDest = optimizedDestinations.find(d => !usedDestinations.has(d.id));
        if (!nextDest) break;
        
        // Calculate transport time to this destination
        const transportTime = currentDestination ? getTransportTimeForDestinations(currentDestination, nextDest) : 0;
        
        // Add transport time if we're not at the starting location
        if (transportTime > 0) {
          [currentHour, currentMinute] = addTime(currentHour, currentMinute, 0, transportTime);
          currentTimeMinutes = currentHour * 60 + currentMinute;
        }
        
        // Calculate appropriate duration based on category and preferences
        let activityDuration = defaultActivityDuration;
        if (nextDest.category === 'Rekreasi' || nextDest.category === 'Alam') {
          activityDuration += 30; // Add more time for recreational activities
        }
        
        const destLocation = nextDest.location || nextDest.original?.location || 'Jakarta';
        const destArea = nextDest.area || getAreaFromLocation(destLocation);
        
        itinerary.push({
          time: formatTime(currentHour, currentMinute),
          activity: `${getCategoryEmoji(nextDest.category)} ${nextDest.category} - ${nextDest.label}`,
          duration: `${Math.floor(activityDuration / 60)} jam ${activityDuration % 60 > 0 ? (activityDuration % 60) + ' menit' : ''}`,
          notes: `Aktivitas pagi${morningActivitiesAdded > 0 ? ' (lanjutan)' : ''} di ${destArea}${transportTime > 0 ? ` (${transportTime} menit perjalanan)` : ''}`,
          price: nextDest.price || 'Harga tidak tersedia',
          location: destLocation,
          area: destArea
        });
        
        usedDestinations.add(nextDest.id);
        optimizedDestinations = optimizedDestinations.filter(d => d.id !== nextDest.id);
        currentDestination = { ...nextDest, area: destArea, location: destLocation };
        
        [currentHour, currentMinute] = addTime(currentHour, currentMinute, 0, activityDuration);
        currentTimeMinutes = currentHour * 60 + currentMinute;
        
        morningActivitiesAdded++;
        
        console.log(`Added morning activity: ${nextDest.label} in ${destArea}`);
      }
      
      console.log(`Added ${morningActivitiesAdded} morning activities`);
      
      // If we're too early for lunch, add buffer time or a short Istirahat Jajan
      if (currentTimeMinutes < idealLunchStartMinutes - 30) {
        // Add a Istirahat Jajan if it's not right after breakfast
        if (currentTimeMinutes > (startHours * 60 + startMinutes + 120)) {
          itinerary.push({
            time: formatTime(currentHour, currentMinute),
            activity: '☕ Istirahat Jajan',
            duration: '30 menit',
            notes: 'Istirahat sejenak dengan kopi/teh sebelum Istirahat Makan',
            price: 'Rp 15.000 - 30.000',
            location: currentDestination?.location || 'Jakarta',
            area: currentDestination?.area || 'Jakarta Pusat'
          });
          
          [currentHour, currentMinute] = addTime(currentHour, currentMinute, 0, 30);
          currentTimeMinutes = currentHour * 60 + currentMinute;
          
          console.log(`Added Istirahat Jajan at ${formatTime(currentHour, currentMinute)}`);
          
          // Buffer time to get closer to lunch
          const bufferMinutes = Math.min(idealLunchStartMinutes - currentTimeMinutes, 45);
          if (bufferMinutes > 15) {
            [currentHour, currentMinute] = addTime(currentHour, currentMinute, 0, bufferMinutes);
            currentTimeMinutes = currentHour * 60 + currentMinute;
          }
        } else {
          // Just add buffer time if we're right after breakfast
          const bufferMinutes = Math.min(idealLunchStartMinutes - currentTimeMinutes, 60);
          [currentHour, currentMinute] = addTime(currentHour, currentMinute, 0, bufferMinutes);
          currentTimeMinutes = currentHour * 60 + currentMinute;
        }
      }
      
      // Lunch - if it's between 12:00 and 14:00 (or close enough)
      if (currentTimeMinutes >= (idealLunchStartMinutes - 60) && currentTimeMinutes <= (latestLunchStartMinutes + 30)) {
        // If we're a bit early for ideal lunch, adjust time to be closer to ideal
        if (currentTimeMinutes < idealLunchStartMinutes) {
          const adjustMinutes = idealLunchStartMinutes - currentTimeMinutes;
          [currentHour, currentMinute] = addTime(currentHour, currentMinute, 0, Math.min(adjustMinutes, 30));
          currentTimeMinutes = currentHour * 60 + currentMinute;
        }
        
        // Find best lunch place considering current location
        let lunchPlace = null;
        if (currentDestination) {
          // Try to find a culinary place in the same area first
          lunchPlace = culinaryPlaces.find(place => 
            !usedDestinations.has(place.id) && 
            getAreaFromLocation(place.location || place.original?.location) === currentDestination.area
          );
        }
        
        // If no culinary place in same area, find any available
        if (!lunchPlace) {
          lunchPlace = culinaryPlaces.find(place => !usedDestinations.has(place.id));
        }
        
        const lunchLocation = lunchPlace?.location || lunchPlace?.original?.location || currentDestination?.location || 'Jakarta Pusat';
        const lunchArea = getAreaFromLocation(lunchLocation);
        const transportTime = currentDestination && lunchPlace ? getTransportTimeForDestinations(currentDestination, { ...lunchPlace, location: lunchLocation }) : 0;
        
        // Add transport time if needed
        if (transportTime > 0) {
          [currentHour, currentMinute] = addTime(currentHour, currentMinute, 0, transportTime);
          currentTimeMinutes = currentHour * 60 + currentMinute;
        }
        
        itinerary.push({
          time: formatTime(currentHour, currentMinute),
          activity: lunchPlace 
            ? `🍜 Istirahat Makan - ${lunchPlace.label}` 
            : '🍜 Istirahat Makan',
          duration: `${mealDuration} menit`,
          notes: `Istirahat Istirahat Makan untuk mengisi energi di ${lunchArea}${transportTime > 0 ? ` (${transportTime} menit perjalanan)` : ''}`,
          price: lunchPlace?.price || 'Rp 25.000 - 50.000',
          location: lunchLocation,
          area: lunchArea
        });
        
        if (lunchPlace) {
          usedDestinations.add(lunchPlace.id);
          currentDestination = { ...lunchPlace, area: lunchArea, location: lunchLocation };
        }
        
        [currentHour, currentMinute] = addTime(currentHour, currentMinute, 0, mealDuration);
        currentTimeMinutes = currentHour * 60 + currentMinute;
        
        console.log(`Added lunch at ${formatTime(currentHour, currentMinute)} in ${lunchArea}`);
      } else {
        // If we're way outside lunch time, still add lunch anyway
        const lunchPlace = culinaryPlaces.find(place => !usedDestinations.has(place.id));
        const lunchLocation = lunchPlace?.location || lunchPlace?.original?.location || currentDestination?.location || 'Jakarta Pusat';
        const lunchArea = getAreaFromLocation(lunchLocation);
        const transportTime = currentDestination && lunchPlace ? getTransportTimeForDestinations(currentDestination, { ...lunchPlace, location: lunchLocation }) : 0;
        
        console.log(`Adding lunch outside normal lunch hours at ${formatTime(currentHour, currentMinute)}`);
        
        // Add transport time if needed
        if (transportTime > 0) {
          [currentHour, currentMinute] = addTime(currentHour, currentMinute, 0, transportTime);
          currentTimeMinutes = currentHour * 60 + currentMinute;
        }
        
        itinerary.push({
          time: formatTime(currentHour, currentMinute),
          activity: lunchPlace 
            ? `🍜 Istirahat Makan - ${lunchPlace.label}` 
            : '🍜 Istirahat Makan',
          duration: `${mealDuration} menit`,
          notes: `Istirahat untuk makan dan mengisi energi di ${lunchArea}${transportTime > 0 ? ` (${transportTime} menit perjalanan)` : ''}`,
          price: lunchPlace?.price || 'Rp 25.000 - 50.000',
          location: lunchLocation,
          area: lunchArea
        });
        
        if (lunchPlace) {
          usedDestinations.add(lunchPlace.id);
          currentDestination = { ...lunchPlace, area: lunchArea, location: lunchLocation };
        }
        
        [currentHour, currentMinute] = addTime(currentHour, currentMinute, 0, mealDuration);
        currentTimeMinutes = currentHour * 60 + currentMinute;
      }
      
      // Afternoon activities (after lunch until dinner)
      let afternoonActivitiesAdded = 0;
      const maxAfternoonActivities = preferences.travelStyle === 'intensive' ? 3 : preferences.travelStyle === 'relaxed' ? 1 : 2;
      
      // Dinner timeframe: ideally between 18-20
      const idealDinnerStartMinutes = 18 * 60; // 18:00
      const latestDinnerStartMinutes = 20 * 60; // 20:00
      
      console.log(`Planning to add up to ${maxAfternoonActivities} afternoon activities`);
      
      while (afternoonActivitiesAdded < maxAfternoonActivities && 
             currentTimeMinutes < idealDinnerStartMinutes - defaultActivityDuration && 
             optimizedDestinations.length > 0) {
        
        // Get next destination
        const nextDest = optimizedDestinations.find(d => !usedDestinations.has(d.id));
        if (!nextDest) break;
        
        // Calculate transport time to this destination
        const transportTime = currentDestination ? getTransportTimeForDestinations(currentDestination, nextDest) : 0;
        
        // Add transport time
        if (transportTime > 0) {
          [currentHour, currentMinute] = addTime(currentHour, currentMinute, 0, transportTime);
          currentTimeMinutes = currentHour * 60 + currentMinute;
        }
        
        // Calculate appropriate duration based on category and preferences
        let activityDuration = defaultActivityDuration;
        if (nextDest.category === 'Rekreasi' || nextDest.category === 'Alam') {
          activityDuration += 30; // Add more time for recreational activities
        }
        
        const destLocation = nextDest.location || nextDest.original?.location || 'Jakarta';
        const destArea = nextDest.area || getAreaFromLocation(destLocation);
        
        itinerary.push({
          time: formatTime(currentHour, currentMinute),
          activity: `${getCategoryEmoji(nextDest.category)} ${nextDest.category} - ${nextDest.label}`,
          duration: `${Math.floor(activityDuration / 60)} jam ${activityDuration % 60 > 0 ? (activityDuration % 60) + ' menit' : ''}`,
          notes: `Aktivitas siang/sore${afternoonActivitiesAdded > 0 ? ' (lanjutan)' : ''} di ${destArea}${transportTime > 0 ? ` (${transportTime} menit perjalanan)` : ''}`,
          price: nextDest.price || 'Harga tidak tersedia',
          location: destLocation,
          area: destArea
        });
        
        usedDestinations.add(nextDest.id);
        optimizedDestinations = optimizedDestinations.filter(d => d.id !== nextDest.id);
        currentDestination = { ...nextDest, area: destArea, location: destLocation };
        
        [currentHour, currentMinute] = addTime(currentHour, currentMinute, 0, activityDuration);
        currentTimeMinutes = currentHour * 60 + currentMinute;
        
        afternoonActivitiesAdded++;
        
        console.log(`Added afternoon activity: ${nextDest.label} in ${destArea}`);
      }
      
      console.log(`Added ${afternoonActivitiesAdded} afternoon activities`);
      
      // Add Istirahat Jajan in the afternoon if time permits and we haven't added one yet
      if (currentTimeMinutes < idealDinnerStartMinutes - 45 && 
          currentTimeMinutes > 15 * 60 && // After 3 PM
          !itinerary.some(item => item.activity.includes('Coffee'))) {
        
        itinerary.push({
          time: formatTime(currentHour, currentMinute),
          activity: '☕ Istirahat Jajan',
          duration: '30 menit',
          notes: 'Nikmati kopi/teh sore hari',
          price: 'Rp 15.000 - 30.000',
          location: currentDestination?.location || 'Jakarta',
          area: currentDestination?.area || 'Jakarta Pusat'
        });
        
        [currentHour, currentMinute] = addTime(currentHour, currentMinute, 0, 30);
        currentTimeMinutes = currentHour * 60 + currentMinute;
        
        console.log(`Added afternoon Istirahat Jajan at ${formatTime(currentHour, currentMinute)}`);
      }
      
      // Evening activity if there's time before dinner
      if (currentTimeMinutes < idealDinnerStartMinutes - defaultActivityDuration && 
          optimizedDestinations.length > 0) {
        
        // Get next destination - prioritize shopping or relaxing activities for evening
        let nextDest = optimizedDestinations.find(d => 
          !usedDestinations.has(d.id) && 
          ['Belanja', 'Cafe'].includes(d.category)
        );
        
        // If no specific evening activity found, just get the next one
        if (!nextDest) {
          nextDest = optimizedDestinations.find(d => !usedDestinations.has(d.id));
        }
        
        if (nextDest) {
          // Calculate transport time to this destination
          const transportTime = currentDestination ? getTransportTimeForDestinations(currentDestination, nextDest) : 0;
          
          // Add transport time
          if (transportTime > 0) {
            [currentHour, currentMinute] = addTime(currentHour, currentMinute, 0, transportTime);
            currentTimeMinutes = currentHour * 60 + currentMinute;
          }
          
          // Calculate appropriate duration based on category and preferences
          let activityDuration = defaultActivityDuration;
          
          const destLocation = nextDest.location || nextDest.original?.location || 'Jakarta';
          const destArea = nextDest.area || getAreaFromLocation(destLocation);
          
          itinerary.push({
            time: formatTime(currentHour, currentMinute),
            activity: `${getCategoryEmoji(nextDest.category)} ${nextDest.category} - ${nextDest.label}`,
            duration: `${Math.floor(activityDuration / 60)} jam ${activityDuration % 60 > 0 ? (activityDuration % 60) + ' menit' : ''}`,
            notes: `Aktivitas sore menjelang malam di ${destArea}${transportTime > 0 ? ` (${transportTime} menit perjalanan)` : ''}`,
            price: nextDest.price || 'Harga tidak tersedia',
            location: destLocation,
            area: destArea
          });
          
          usedDestinations.add(nextDest.id);
          optimizedDestinations = optimizedDestinations.filter(d => d.id !== nextDest.id);
          currentDestination = { ...nextDest, area: destArea, location: destLocation };
          
          [currentHour, currentMinute] = addTime(currentHour, currentMinute, 0, activityDuration);
          currentTimeMinutes = currentHour * 60 + currentMinute;
          
          console.log(`Added evening activity: ${nextDest.label} in ${destArea}`);
        }
      }
      
      // If we're too early for dinner, add buffer time
      if (currentTimeMinutes < idealDinnerStartMinutes - 30) {
        const bufferMinutes = Math.min(idealDinnerStartMinutes - currentTimeMinutes, 60);
        [currentHour, currentMinute] = addTime(currentHour, currentMinute, 0, bufferMinutes);
        currentTimeMinutes = currentHour * 60 + currentMinute;
      }
      
      // Dinner - if it's after 18:00 and before end of trip
      if (currentTimeMinutes >= (idealDinnerStartMinutes - 60) && 
          currentTimeMinutes <= (latestDinnerStartMinutes + 30) &&
          currentTimeMinutes < endTimeMinutes - mealDuration) {
        
        // If we're a bit early for ideal dinner, adjust time to be closer to ideal
        if (currentTimeMinutes < idealDinnerStartMinutes) {
          const adjustMinutes = idealDinnerStartMinutes - currentTimeMinutes;
          [currentHour, currentMinute] = addTime(currentHour, currentMinute, 0, Math.min(adjustMinutes, 30));
          currentTimeMinutes = currentHour * 60 + currentMinute;
        }
        
        // Find best dinner place considering current location
        let dinnerPlace = null;
        if (currentDestination) {
          // Try to find a culinary place in the same area first
          dinnerPlace = culinaryPlaces.find(place => 
            !usedDestinations.has(place.id) &&
            place.id !== itinerary.find(item => item.activity.includes('Istirahat Makan'))?.placeId &&
            getAreaFromLocation(place.location || place.original?.location) === currentDestination.area
          );
        }
        
        // If no culinary place in same area, find any available
        if (!dinnerPlace) {
          dinnerPlace = culinaryPlaces.find(place => 
            !usedDestinations.has(place.id) &&
            place.id !== itinerary.find(item => item.activity.includes('Istirahat Makan'))?.placeId
          );
        }
        
        const dinnerLocation = dinnerPlace?.location || dinnerPlace?.original?.location || currentDestination?.location || 'Jakarta Pusat';
        const dinnerArea = getAreaFromLocation(dinnerLocation);
        const transportTime = currentDestination && dinnerPlace ? getTransportTimeForDestinations(currentDestination, { ...dinnerPlace, location: dinnerLocation }) : 0;
        
        // Add transport time if needed
        if (transportTime > 0) {
          [currentHour, currentMinute] = addTime(currentHour, currentMinute, 0, transportTime);
          currentTimeMinutes = currentHour * 60 + currentMinute;
        }
        
        itinerary.push({
          time: formatTime(currentHour, currentMinute),
          activity: dinnerPlace 
            ? `🍽️ Makan Malam - ${dinnerPlace.label}` 
            : '🍽️ Makan Malam di Restoran Pilihan',
          duration: `${mealDuration} menit`,
          notes: `Nikmati makan malam untuk mengakhiri trip di ${dinnerArea}${transportTime > 0 ? ` (${transportTime} menit perjalanan)` : ''}`,
          price: dinnerPlace?.price || 'Rp 35.000 - 75.000',
          location: dinnerLocation,
          area: dinnerArea
        });
        
        if (dinnerPlace) {
          usedDestinations.add(dinnerPlace.id);
          itinerary[itinerary.length - 1].placeId = dinnerPlace.id;
          currentDestination = { ...dinnerPlace, area: dinnerArea, location: dinnerLocation };
        }
        
        [currentHour, currentMinute] = addTime(currentHour, currentMinute, 0, mealDuration);
        currentTimeMinutes = currentHour * 60 + currentMinute;
        
        console.log(`Added dinner at ${formatTime(currentHour, currentMinute)} in ${dinnerArea}`);
      } else if (currentTimeMinutes < endTimeMinutes - mealDuration) {
        // If we're outside of dinner time but have time before the end, still add dinner
        const dinnerPlace = culinaryPlaces.find(place => 
          !usedDestinations.has(place.id) &&
          place.id !== itinerary.find(item => item.activity.includes('Istirahat Makan'))?.placeId
        );
        
        const dinnerLocation = dinnerPlace?.location || dinnerPlace?.original?.location || currentDestination?.location || 'Jakarta Pusat';
        const dinnerArea = getAreaFromLocation(dinnerLocation);
        const transportTime = currentDestination && dinnerPlace ? getTransportTimeForDestinations(currentDestination, { ...dinnerPlace, location: dinnerLocation }) : 0;
        
        console.log(`Adding dinner outside normal dinner hours at ${formatTime(currentHour, currentMinute)}`);
        
        // Add transport time if needed
        if (transportTime > 0) {
          [currentHour, currentMinute] = addTime(currentHour, currentMinute, 0, transportTime);
          currentTimeMinutes = currentHour * 60 + currentMinute;
        }
        
        itinerary.push({
          time: formatTime(currentHour, currentMinute),
          activity: dinnerPlace 
            ? `🍽️ Makan Malam - ${dinnerPlace.label}` 
            : '🍽️ Makan Malam di Restoran Pilihan',
          duration: `${mealDuration} menit`,
          notes: `Nikmati makan malam untuk mengakhiri trip di ${dinnerArea}${transportTime > 0 ? ` (${transportTime} menit perjalanan)` : ''}`,
          price: dinnerPlace?.price || 'Rp 35.000 - 75.000',
          location: dinnerLocation,
          area: dinnerArea
        });
        
        if (dinnerPlace) {
          usedDestinations.add(dinnerPlace.id);
          itinerary[itinerary.length - 1].placeId = dinnerPlace.id;
          currentDestination = { ...dinnerPlace, area: dinnerArea, location: dinnerLocation };
        }
        
        [currentHour, currentMinute] = addTime(currentHour, currentMinute, 0, mealDuration);
        currentTimeMinutes = currentHour * 60 + currentMinute;
      }
      
      // Final activity if there's still time and destinations left
      if (currentTimeMinutes < endTimeMinutes - defaultActivityDuration / 2 && 
          optimizedDestinations.length > 0) {
        
        // Get next destination - prioritize entertainment for night
        let finalDest = optimizedDestinations.find(d => 
          !usedDestinations.has(d.id) && 
          ['Belanja', 'Cafe'].includes(d.category)
        );
        
        // If no specific night activity found, just get the next one
        if (!finalDest) {
          finalDest = optimizedDestinations.find(d => !usedDestinations.has(d.id));
        }
        
        if (finalDest) {
          // Calculate transport time to this destination
          const transportTime = currentDestination ? getTransportTimeForDestinations(currentDestination, finalDest) : 0;
          
          // Add transport time
          if (transportTime > 0) {
            [currentHour, currentMinute] = addTime(currentHour, currentMinute, 0, transportTime);
            currentTimeMinutes = currentHour * 60 + currentMinute;
          }
          
          // Calculate appropriate duration based on category and preferences
          let activityDuration = Math.min(defaultActivityDuration, endTimeMinutes - currentTimeMinutes - 15);
          
          if (activityDuration >= 45) {
            const destLocation = finalDest.location || finalDest.original?.location || 'Jakarta';
            const destArea = finalDest.area || getAreaFromLocation(destLocation);
            
            itinerary.push({
              time: formatTime(currentHour, currentMinute),
              activity: `${getCategoryEmoji(finalDest.category)} ${finalDest.category} - ${finalDest.label}`,
              duration: `${Math.floor(activityDuration / 60)} jam ${activityDuration % 60 > 0 ? (activityDuration % 60) + ' menit' : ''}`,
              notes: `Aktivitas malam untuk mengakhiri hari di ${destArea}${transportTime > 0 ? ` (${transportTime} menit perjalanan)` : ''}`,
              price: finalDest.price || 'Harga tidak tersedia',
              location: destLocation,
              area: destArea
            });
            
            usedDestinations.add(finalDest.id);
            console.log(`Added final activity: ${finalDest.label} in ${destArea}`);
          }
        }
      }
      
      // Even if there are no optimized destinations left, add at least one default activity
      // This ensures we always have some items in the itinerary
      if (itinerary.length === 0) {
        console.log("No itinerary items generated, adding default activities");
        
        // Add a morning activity
        itinerary.push({
          time: formatTime(startHours, startMinutes),
          activity: '🏛️ Kunjungan ke Museum Nasional',
          duration: '2 jam',
          notes: 'Mulai hari dengan menjelajahi museum di Jakarta Pusat',
          price: 'Rp 20.000 - 50.000',
          location: 'Jakarta Pusat',
          area: 'Jakarta Pusat'
        });
        
        // Add lunch
        const lunchHour = Math.min(startHours + 3, 13);
        itinerary.push({
          time: formatTime(lunchHour, 0),
          activity: '🍜 Istirahat Makan',
          duration: '1 jam',
          notes: 'Istirahat  Makan dan mencicipi kuliner lokal di Jakarta Pusat',
          price: 'Rp 25.000 - 50.000',
          location: 'Jakarta Pusat',
          area: 'Jakarta Pusat'
        });
        
        // Add afternoon activity
        itinerary.push({
          time: formatTime(lunchHour + 1, 30),
          activity: '🛍️ Belanja di Mal atau Pasar Tradisional',
          duration: '2 jam',
          notes: 'Jelajahi pusat perbelanjaan atau pasar tradisional di Jakarta Pusat',
          price: 'Varies',
          location: 'Jakarta Pusat',
          area: 'Jakarta Pusat'
        });
        
        // Add dinner
        itinerary.push({
          time: formatTime(18, 30),
          activity: '🍽️ Makan Malam',
          duration: '1 jam 30 menit',
          notes: 'Nikmati makan malam untuk mengakhiri trip di Jakarta Pusat',
          price: 'Rp 35.000 - 75.000',
          location: 'Jakarta Pusat',
          area: 'Jakarta Pusat'
        });
      }
      
      // Make sure we have at least 2 items in itinerary
      if (itinerary.length < 2) {
        console.log("Not enough itinerary items, adding default activity");
        
        // Add at least one more activity if only one exists
        const lastActivity = itinerary[itinerary.length - 1];
        const lastTime = lastActivity.time.split(':').map(Number);
        const [nextHour, nextMinute] = addTime(lastTime[0], lastTime[1], 1, 30);
        
        itinerary.push({
          time: formatTime(nextHour, nextMinute),
          activity: '🛍️ Waktu Bebas untuk Belanja atau Bersantai',
          duration: '2 jam',
          notes: 'Luangkan waktu untuk belanja oleh-oleh atau bersantai',
          price: 'Varies',
          location: lastActivity.location || 'Jakarta Pusat',
          area: lastActivity.area || 'Jakarta Pusat'
        });
      }
      
      // Add transport notes between activities based on transport method
      if (preferences.transportMethod) {
        let transportNote = '';
        
        switch (preferences.transportMethod) {
          case 'private':
            transportNote = 'Gunakan kendaraan pribadi';
            break;
          case 'public':
            transportNote = 'Perjalanan dengan transportasi umum';
            break;
          case 'ride-sharing':
            transportNote = 'Pesan Gojek/Grab untuk perjalanan antar lokasi';
            break;
          default:
            transportNote = 'Perjalanan antar lokasi';
        }
        
        // Add transport info to itinerary notes
        itinerary = itinerary.map((item, index, array) => {
          if (index < array.length - 1) {
            const currentArea = item.area || 'UNKNOWN';
            const nextArea = array[index + 1].area || 'UNKNOWN';
            
            if (currentArea !== nextArea && !item.notes.includes('transport') && !item.notes.includes('Grab')) {
              return {
                ...item,
                notes: `${item.notes}. ${transportNote} ke ${nextArea}.`
              };
            }
          }
          return item;
        });
      }
      
      // Sort itinerary by time
      itinerary.sort((a, b) => {
        const aTime = a.time.split(':').map(Number);
        const bTime = b.time.split(':').map(Number);
        return (aTime[0] * 60 + aTime[1]) - (bTime[0] * 60 + bTime[1]);
      });
      
      console.log(`Final itinerary has ${itinerary.length} items`);
      console.log(itinerary.map(item => `${item.time} - ${item.activity} (${item.area})`));
      
      // Calculate budget estimation based on destinations and preferences
      let totalBudgetLow = 0;
      let totalBudgetHigh = 0;
      
      // Add costs from used destinations
      destinationsForTrip.forEach(dest => {
        if (usedDestinations.has(dest.id)) {
          let price = 0;
          
          // Extract price from different possible formats
          if (typeof dest.price === 'number') {
            price = dest.price;
          } else if (typeof dest.price === 'string') {
            const priceMatch = dest.price.match(/(\d+[\d.,]*)/g);
            if (priceMatch && priceMatch.length > 0) {
              price = parseInt(priceMatch[0].replace(/[.,]/g, ''), 10) || 0;
            }
          } else if (dest.original && typeof dest.original.price === 'string') {
            const priceMatch = dest.original.price.match(/(\d+[\d.,]*)/g);
            if (priceMatch && priceMatch.length > 0) {
              price = parseInt(priceMatch[0].replace(/[.,]/g, ''), 10) || 0;
            }
          }
          
          totalBudgetLow += price;
          totalBudgetHigh += price * 1.2; // Add 20% for high estimate
        }
      });
      
      // Count area changes for transport cost calculation
      let areaChanges = 0;
      for (let i = 1; i < itinerary.length; i++) {
        if (itinerary[i].area !== itinerary[i-1].area) {
          areaChanges++;
        }
      }
      
      // Add transport costs based on method and area changes
      const tripCount = Math.max(itinerary.length - 1, areaChanges);
      switch (preferences.transportMethod) {
        case 'private':
          // Fuel costs estimate + parking + extra for area changes
          totalBudgetLow += 15000 + (areaChanges * 15000) + (10000 * Math.max(1, usedDestinations.size)); // Base + area change cost + parking per destination
          totalBudgetHigh += 30000 + (areaChanges * 25000) + (15000 * Math.max(1, usedDestinations.size));
          break;
        case 'public':
          // Public transport costs (per person) + extra for area changes
          totalBudgetLow += 5000 * Math.max(2, tripCount) + (areaChanges * 8000);
          totalBudgetHigh += 10000 * Math.max(2, tripCount) + (areaChanges * 15000);
          break;
        case 'ride-sharing':
          // Ride-sharing costs (per trip) + extra for area changes
          totalBudgetLow += 20000 * Math.max(2, tripCount) + (areaChanges * 25000);
          totalBudgetHigh += 35000 * Math.max(2, tripCount) + (areaChanges * 40000);
          break;
        default:
          // Default transport costs
          totalBudgetLow += 15000 + (areaChanges * 10000);
          totalBudgetHigh += 35000 + (areaChanges * 20000);
      }
      
      // Meal costs if not included in destinations
      const breakfastCount = itinerary.filter(item => item.activity.includes('Sarapan') && !item.activity.includes('-')).length;
      const lunchCount = itinerary.filter(item => item.activity.includes('Istirahat Makan') && !item.activity.includes('-')).length;
      const dinnerCount = itinerary.filter(item => item.activity.includes('Makan Malam') && !item.activity.includes('-')).length;
      const coffeeCount = itinerary.filter(item => item.activity.includes('Istirahat Jajan')).length;
      
      // Add budget for meals not at specific destinations
      if (preferences.mealPreference === 'local') {
        totalBudgetLow += (15000 * Math.max(0, breakfastCount)) + 
                          (25000 * Math.max(1, lunchCount)) + 
                          (35000 * Math.max(1, dinnerCount)) + 
                          (10000 * Math.max(0, coffeeCount));
        totalBudgetHigh += (25000 * Math.max(0, breakfastCount)) + 
                           (35000 * Math.max(1, lunchCount)) + 
                           (50000 * Math.max(1, dinnerCount)) + 
                           (15000 * Math.max(0, coffeeCount));
      } else if (preferences.mealPreference === 'international') {
        totalBudgetLow += (25000 * Math.max(0, breakfastCount)) + 
                          (40000 * Math.max(1, lunchCount)) + 
                          (60000 * Math.max(1, dinnerCount)) + 
                          (15000 * Math.max(0, coffeeCount));
        totalBudgetHigh += (40000 * Math.max(0, breakfastCount)) + 
                           (60000 * Math.max(1, lunchCount)) + 
                           (80000 * Math.max(1, dinnerCount)) + 
                           (25000 * Math.max(0, coffeeCount));
      } else { // both
        totalBudgetLow += (20000 * Math.max(0, breakfastCount)) + 
                          (30000 * Math.max(1, lunchCount)) + 
                          (45000 * Math.max(1, dinnerCount)) + 
                          (12000 * Math.max(0, coffeeCount));
        totalBudgetHigh += (30000 * Math.max(0, breakfastCount)) + 
                           (45000 * Math.max(1, lunchCount)) + 
                           (65000 * Math.max(1, dinnerCount)) + 
                           (20000 * Math.max(0, coffeeCount));
      }
      
      // Ensure we have at least some budget (in case calculations went wrong)
      if (totalBudgetLow < 150000) totalBudgetLow = 150000;
      if (totalBudgetHigh < totalBudgetLow * 1.1) totalBudgetHigh = totalBudgetLow * 1.2;
      
      // Add incidentals and other expenses (souvenirs, etc.)
      totalBudgetLow += 20000;
      totalBudgetHigh += 50000;
      
      // Format budget with thousand separators
      const formatNumber = (num) => {
        return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      };
      
      const totalBudgetEstimation = `Rp ${formatNumber(totalBudgetLow)} - ${formatNumber(totalBudgetHigh)}/pax`;
      
      // Add trip meta information
      const tripTitle = preferences.duration === 'weekend' 
        ? `Trip Jakarta - Weekend (${startTime} - ${formatTime(endHours, endMinutes)})`
        : `Trip Jakarta - ${preferences.duration === 'half-day' ? 'Setengah Hari' : 'Full Day'} (${startTime} - ${formatTime(endHours, endMinutes)})`;
      
      // Get unique areas visited
      const areasVisited = [...new Set(itinerary.map(item => item.area).filter(area => area && area !== 'UNKNOWN'))];
      
      const tripDetails = {
        destinationCount: Math.max(usedDestinations.size, 1),
        categories: [...new Set(destinationsForTrip.filter(d => usedDestinations.has(d.id)).map(d => d.category))],
        areasVisited: areasVisited,
        areaChanges: areaChanges,
        preferences: preferences
      };
      
      // Return the complete rundown
      return {
        title: tripTitle,
        itinerary: itinerary,
        budgetEstimation: totalBudgetEstimation,
        preferences: preferences,
        tripDetails: tripDetails
      };
    } catch (error) {
      console.error("Error generating rundown:", error);
      return {
        title: "Error generating rundown",
        itinerary: [],
        budgetEstimation: "N/A",
        preferences: preferences,
        error: error.message
      };
    }
  };

  // Function to get emoji based on category
  const getCategoryEmoji = (category) => {
    if (!category) return '📍'; // Default emoji if category is undefined
    
    const categoryLower = category.toLowerCase();
    switch (categoryLower) {
      case 'kuliner':
        return '🍜';
      case 'rekreasi':
        return '🎡';
      case 'sejarah':
        return '🏛️';
      case 'belanja':
        return '🛍️';
      case 'edukasi':
        return '📚';
      case 'alam':
        return '🌳';
      case 'cafe':
        return '☕';
      case 'venue':
        return '🏞️';
      case 'budaya':
        return '🎭';
      default:
        return '📍';
    }
  };

  // Render current question
  const renderQuestion = () => {
    if (!questions || questions.length === 0 || currentStep >= questions.length) {
      return <div>Loading questions...</div>;
    }
    
    const question = questions[currentStep];
    
    return (
      <div className="mb-6">
        <h4 className="text-lg font-medium mb-4">{question.question}</h4>
        
        {question.type === 'radio' && (
          <div className="space-y-3">
            {question.options.map((option) => (
              <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name={question.id}
                  value={option.value}
                  checked={responses[question.id] === option.value}
                  onChange={() => handleOptionSelect(question.id, option.value)}
                  className="w-4 h-4 text-blue-600"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        )}
        
        {question.type === 'checkbox' && (
          <div className="space-y-3">
            {question.options.map((option) => (
              <label key={option.value} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  name={question.id}
                  value={option.value}
                  checked={responses[question.id]?.includes(option.value)}
                  onChange={() => handleOptionSelect(question.id, option.value, true)}
                  className="w-4 h-4 text-blue-600"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        )}
        
        {question.type === 'time' && (
          <input
            type="time"
            value={responses[question.id]}
            onChange={(e) => handleTimeChange(question.id, e.target.value)}
            className="border border-gray-300 rounded px-3 py-2"
          />
        )}
      </div>
    );
  };

  

  // If the popup is not open, don't render anything
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999] pointer-events: auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-blue-500 text-white px-6 py-4 flex justify-between items-center">
          <h3 className="font-medium">Generate Rundown Trip</h3>
          <button onClick={handleClose} className="text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-gray-200 h-1">
          <div 
            className="bg-blue-500 h-1 transition-all duration-300" 
            style={{ width: `${(questions.length > 0 ? (currentStep + 1) / questions.length : 0) * 100}%` }}
          ></div>
        </div>
        
        {/* Question content */}
        <div className="px-6 py-6">
          {isLoadingDestinations ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-gray-600">Memuat data destinasi...</p>
            </div>
          ) : error ? (
            <div className="text-center py-4 text-red-500">
              {error}
              <button 
                onClick={handleClose}
                className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Tutup
              </button>
            </div>
          ) : (
            <>
              <div className="text-sm text-gray-500 mb-2">
                Langkah {currentStep + 1} dari {questions.length}
              </div>
              
              {renderQuestion()}
              
              {/* Navigation buttons */}
              <div className="flex justify-between mt-8">
                <button
                  onClick={handleBack}
                  disabled={currentStep === 0}
                  className={`px-4 py-2 rounded ${
                    currentStep === 0 
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Kembali
                </button>
                
                <button
                  onClick={handleNext}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  {currentStep === questions.length - 1 ? 'Selesai' : 'Lanjut'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RundownGenerator;
