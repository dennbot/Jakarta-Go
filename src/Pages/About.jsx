import React, { useState, useRef, useEffect } from 'react';
import Navbar from '../Components/Navbar';
import YourTripPopup from '../Components/YourTrip';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import Footer from '../Components/Footer';


const About = () => {

  // User authentication state
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
    
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
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

  return (
    <div className="relative">

      <Navbar 
      isLoggedIn={isLoggedIn}
      username={username}
      handleLogout={handleLogout}
      handleLoginClick={handleLoginClick}
      handleProfileClick={handleProfileClick}
      />

        
      {/* Hero Section */}
      <section className="w-full h-screen bg-cover bg-center bg-fixed relative flex items-center justify-center text-center px-6 py-16 sm:py-24" style={{ backgroundImage: "url('/552468.jpg')" }}>
  {/* Overlay transparan dengan blur */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>

  {/* Konten depan */}
      <div className="relative text-white z-10">
        <h1 className="text-4xl sm:text-6xl font-bold mb-4">Welcome to Jakarta-GO</h1>
        <p className="text-xl sm:text-2xl mb-6">Your trusted guide to explore the best of Jakarta, Indonesia</p>
        <a href="#about" className="bg-blue-600 text-white py-2 px-6 rounded-xl hover:bg-blue-700 transition-all">
          Learn More
        </a>
      </div>
      </section>


      {/* Our Mission Section */}
      <section id="about" className="py-16 px-6 bg-gray-50 text-center">
        <h2 className="text-3xl font-semibold mb-8">Our Mission</h2>
        <p className="text-lg max-w-3xl mx-auto text-gray-700">
          At Jakarta-GO, our mission is to simplify the travel planning experience. We aim to provide you with personalized recommendations
          and itinerary tools that make exploring Jakarta both effortless and unforgettable. Whether you're a first-time traveler or a seasoned explorer,
          we're here to help you discover the best attractions, places to eat, and activities to do in Jakarta.
        </p>
      </section>

      {/* Our Team Section */}
      <section className="py-16 px-6 text-center">
  <h2 className="text-3xl font-semibold mb-12">Meet Our Team</h2>

  <div className="flex justify-center gap-10 flex-wrap">
    {/* Card 1 */}
    <div className="bg-white p-6 rounded-lg shadow-2xl w-[400px]">
      <img src="/reymen.jpg" alt="Jane Doe" className="w-full h-120 object-cover rounded-t-lg" />
      <h3 className="font-semibold text-lg mt-4">Reymen Sow</h3>
      <h4 className="font-semibold text-lg mt-1">2540128316</h4>
      <p className="text-gray-600">Developer</p>
    </div>

    {/* Card 2 */}
    <div className="bg-white p-6 rounded-lg shadow-2xl w-[400px]">
      <img src="/desmond.jpg" alt="John Smith" className="w-full h-120 object-cover rounded-t-lg" />
      <h3 className="font-semibold text-lg mt-4">Desmond Connery</h3>
      <h4 className="font-semibold text-lg mt-1">2501981850</h4>
      <p className="text-gray-600">Developer</p>
    </div>
  </div>
</section>


      {/* Why Choose Us Section */}
      <section className="py-16 px-6 bg-white text-center">
        <h2 className="text-3xl font-semibold mb-8">Why Choose Us?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
          <div className="p-6 bg-blue-50 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-2">Personalized Recommendations</h3>
            <p className="text-gray-600">Receive curated suggestions based on your interests, preferences, and travel goals.</p>
          </div>
          <div className="p-6 bg-blue-50 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-2">Budget Planning</h3>
            <p className="text-gray-600">Stay within your travel budget with our easy-to-use budget tracking tools.</p>
          </div>
          <div className="p-6 bg-blue-50 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-2">Keep Your Favorite Trip Close</h3>
            <p className="text-gray-600">Easily save and revisit your top travel plans anytime, anywhere—perfect for quick access and stress-free planning.</p>
          </div>
        </div>
      </section>

      {/* Contact Us Section */}
      <section className="py-16 px-6 bg-gray-50 text-center">
        <h2 className="text-3xl font-semibold mb-8">Contact Us</h2>
        <p className="text-lg text-gray-700 mb-6">We'd love to hear from you! Whether you have questions or feedback, don't hesitate to reach out to our team.</p>
        <a href="mailto:reymen.sow@binus.ac.id" className="bg-blue-600 text-white py-2 px-6 rounded-xl hover:bg-blue-700 transition-all">Email Us</a>
      </section>

      {/* Footer */}
      
      <Footer />
      <YourTripPopup />
    </div>
  );
};

export default About;
