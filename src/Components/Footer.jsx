import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-gray-800 text-gray-300 py-10 text-center font-poppins">
      <p>&copy; 2025 Jakarta-GO. All rights reserved.</p>
      <nav className="mt-4 flex flex-wrap justify-center gap-4">
        <Link to="/about" className="text-white hover:text-teal-300">About Us</Link>
        <a href="mailto:reymen.sow@binus.ac.id" className="text-white hover:text-teal-300">Contact</a>
        <Link to="/rekomendasi" className="text-white hover:text-teal-300">Travel Guides</Link>
      </nav>
    </footer>
  );
};

export default Footer;
