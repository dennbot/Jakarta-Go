import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { User, Mail, Phone, MapPin, ArrowLeft, Edit, Save, FileText, Calendar, Heart, Star, Trash2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';


const UserProfilePage = () => {
  const [userProfile, setUserProfile] = useState(null);
  const [savedRundowns, setSavedRundowns] = useState([]); // Changed from single to array
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [user, setUser] = useState(null);
  const [editForm, setEditForm] = useState({
    username: '',
    email: '',
    telpon: ''
  });
  
  // New states for rundown management
  const [loadingRundowns, setLoadingRundowns] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [tempRundown, setTempRundown] = useState(null);
  
  const navigate = useNavigate();
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'Users', currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            setUserProfile(userData);
            setEditForm({
              username: userData.username || '',
              email: userData.email || '',
              telpon: userData.telpon || ''
            });

            // Load saved rundowns from Firebase instead of localStorage
            await loadSavedRundowns(currentUser.uid);
            
            // Check if there's a temp rundown in localStorage to save
            checkForTempRundown();
          } else {
            setError('Data user tidak ditemukan');
          }
        } catch (err) {
          console.error('Error fetching user data:', err);
          setError('Gagal memuat data user');
        } finally {
          setLoading(false);
        }
      } else {
        setError('Silakan login terlebih dahulu');
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load saved rundowns from Firebase
  const loadSavedRundowns = async (userId) => {
    setLoadingRundowns(true);
    try {
      const rundownsQuery = query(
        collection(db, 'savedRundowns'),
        where('userId', '==', userId),
        where('isActive', '==', true)
      );
      
      const querySnapshot = await getDocs(rundownsQuery);
      const rundowns = [];
      
      querySnapshot.forEach((doc) => {
        rundowns.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // Sort by creation date (newest first)
      rundowns.sort((a, b) => {
        const timeA = a.createdAt?.toDate?.() || 0;
        const timeB = b.createdAt?.toDate?.() || 0;
        return timeB - timeA;
      });
      
      setSavedRundowns(rundowns);
    } catch (error) {
      console.error('Error loading rundowns:', error);
    } finally {
      setLoadingRundowns(false);
    }
  };

  // Check for temporary rundown in localStorage
  const checkForTempRundown = () => {
    const tempRundownData = localStorage.getItem('generatedRundown');
    if (tempRundownData) {
      try {
        const parsedRundown = JSON.parse(tempRundownData);
        setTempRundown(parsedRundown);
      } catch (error) {
        console.error('Error parsing temp rundown:', error);
      }
    }
  };

  // Save rundown to Firebase
  const saveRundownToFirebase = async (rundownData, customTitle = '') => {
    if (!user) return;
    
    try {
      const rundownToSave = {
        userId: user.uid,
        title: customTitle || rundownData.title || 'My Jakarta Trip',
        description: rundownData.description || 'Generated rundown for Jakarta trip',
        itinerary: rundownData.itinerary || [],
        budgetEstimation: rundownData.budgetEstimation || 'Belum dihitung',
        totalDestinations: rundownData.itinerary?.length || 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isActive: true,
        tags: rundownData.tags || ['jakarta', 'wisata']
      };

      await addDoc(collection(db, 'savedRundowns'), rundownToSave);
      
      // Reload rundowns
      await loadSavedRundowns(user.uid);
      
      // Clear temp data
      localStorage.removeItem('generatedRundown');
      setTempRundown(null);
      setShowSaveModal(false);
      
      alert('Rundown berhasil disimpan!');
    } catch (error) {
      console.error('Error saving rundown:', error);
      alert('Gagal menyimpan rundown. Silakan coba lagi.');
    }
  };

  // Delete rundown (soft delete)
  const deleteRundown = async (rundownId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus rundown ini?')) return;
    
    try {
      const rundownRef = doc(db, 'savedRundowns', rundownId);
      await updateDoc(rundownRef, {
        isActive: false,
        updatedAt: serverTimestamp()
      });
      
      // Reload rundowns
      await loadSavedRundowns(user.uid);
      alert('Rundown berhasil dihapus!');
    } catch (error) {
      console.error('Error deleting rundown:', error);
      alert('Gagal menghapus rundown.');
    }
  };

  // Handle edit profile functions (existing code)
  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    if (!isEditing) {
      setEditForm({
        username: userProfile?.username || '',
        email: userProfile?.email || '',
        telpon: userProfile?.telpon || ''
      });
    }
  };

  const handleSaveProfile = async () => {
    if (!user) {
      setError('User belum terdaftar');
      return;
    }
    
    const userDocRef = doc(db, 'Users', user.uid);
    try {
      await updateDoc(userDocRef, {
        username: editForm.username,
        email: editForm.email,
        telpon: editForm.telpon
      });

      setUserProfile(prev => ({
        ...prev,
        username: editForm.username,
        email: editForm.email,
        telpon: editForm.telpon
      }));

      setIsEditing(false);
      alert('Profile berhasil diperbarui!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Gagal memperbarui profile');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      localStorage.removeItem('currentUserId');
      localStorage.removeItem('generatedRundown');
      localStorage.removeItem('yourTrip');
      navigate('/');
      window.location.reload();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };
// tinggal buat tampilan showwww 
const handleViewRundown = (rundown) => {
  navigate(`/rundown/${rundown.id}`, { state: { rundown } });
};

  // Format date helper
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Tanggal tidak tersedia';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Memuat profil...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-red-500 mb-4">
              <User size={48} className="mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors mr-2"
            >
              Login
            </button>
            <button
              onClick={() => navigate('/')}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
            >
              Kembali ke Beranda
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-600 hover:text-gray-800 mb-4 transition-colors"
          >
            <ArrowLeft size={20} className="mr-2" />
            Kembali
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Profil Pengguna</h1>
          <p className="text-gray-600 mt-2">Kelola informasi akun dan lihat aktivitas Anda</p>
        </div>

        {/* Profile Card & Rundowns Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Card */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
              <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="ml-6 text-white">
                      <h2 className="text-2xl font-bold">
                        {userProfile?.username || 'User'}
                      </h2>
                      <p className="text-blue-100">Jakarta-GO Member</p>
                    </div>
                  </div>
                  <button
                    onClick={isEditing ? handleSaveProfile : handleEditToggle}
                    className="bg-white bg-opacity-20 hover:bg-opacity-30 text-black px-4 py-2 rounded-lg transition-colors flex items-center"
                  >
                    {isEditing ? <Save size={16} className="mr-2" /> : <Edit size={16} className="mr-2" />}
                    {isEditing ? 'Simpan' : 'Edit'}
                  </button>
                </div>
              </div>

              {/* Profile Content */}
              <div className="p-6">
                <div className="space-y-6">
                  {/* Username */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center mb-3">
                      <User className="text-gray-500 mr-3" size={20} />
                      <h3 className="font-semibold text-gray-800">Username</h3>
                    </div>
                    {isEditing ? (
                      <input
                        type="text"
                        name="username"
                        value={editForm.username}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Masukkan username"
                      />
                    ) : (
                      <p className="text-gray-600">
                        {userProfile?.username || 'Tidak tersedia'}
                      </p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center mb-3">
                      <Mail className="text-gray-500 mr-3" size={20} />
                      <h3 className="font-semibold text-gray-800">Email</h3>
                    </div>
                    {isEditing ? (
                      <input
                        type="email"
                        name="email"
                        value={editForm.email}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Masukkan email"
                      />
                    ) : (
                      <p className="text-gray-600 break-words">
                        {userProfile?.email || 'Tidak tersedia'}
                      </p>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center mb-3">
                      <Phone className="text-gray-500 mr-3" size={20} />
                      <h3 className="font-semibold text-gray-800">Telepon</h3>
                    </div>
                    {isEditing ? (
                      <input
                        type="tel"
                        name="telpon"
                        value={editForm.telpon}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Masukkan nomor telepon"
                      />
                    ) : (
                      <p className="text-gray-600">
                        {userProfile?.telpon || 'Tidak tersedia'}
                      </p>
                    )}
                  </div>

                  {isEditing && (
                    <div className="flex space-x-4">
                      <button
                        onClick={handleSaveProfile}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
                      >
                        <Save size={16} className="mr-2" />
                        Simpan Perubahan
                      </button>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        Batal
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Saved Rundowns Section */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                  <FileText className="text-blue-500 mr-3" size={24} />
                  Rundown Tersimpan ({savedRundowns.length})
                </h2>
                
                {/* Save temp rundown button if exists */}
                {tempRundown && (
                  <button
                    onClick={() => setShowSaveModal(true)}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm flex items-center"
                  >
                    <Plus size={16} className="mr-2" />
                    Simpan Rundown Baru
                  </button>
                )}
              </div>

              {loadingRundowns ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Memuat rundown...</p>
                </div>
              ) : savedRundowns.length > 0 ? (
                <div className="space-y-4">
                  {savedRundowns.map((rundown) => (
                    <div key={rundown.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-800 mb-2">
                            {rundown.title}
                          </h4>
                          <div className="flex items-center text-sm text-gray-600 mb-2">
                            <MapPin size={14} className="mr-1" />
                            <span>{rundown.totalDestinations} destinasi</span>
                            <span className="mx-2">•</span>
                            <Calendar size={14} className="mr-1" />
                            <span>{formatDate(rundown.createdAt)}</span>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">
                            Budget: {rundown.budgetEstimation}
                          </p>
                          <div className="flex space-x-2">
                            <button 
                              onClick={() => handleViewRundown(rundown)}
                              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-colors"
                            >
                              Lihat Detail
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteRundown(rundown.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Hapus rundown"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="mx-auto mb-4" size={48} />
                  <p className="text-lg mb-2">Belum ada rundown tersimpan</p>
                  <p className="text-sm mb-4">Buat rundown pertama Anda untuk eksplorasi Jakarta!</p>
                  
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Statistics Card */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Statistik Akun</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FileText className="text-blue-500 mr-3" size={20} />
                    <span className="text-gray-600">Trip Tersimpan</span>
                  </div>
                  <span className="font-bold text-blue-600">
                    {savedRundowns.length}
                  </span>
                </div>
                
              </div>
            </div>

            {/* Action Card */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Aksi Cepat</h3>
              <div className="space-y-3">
                <button 
                  onClick={() => navigate('/')}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Buat Trip Baru
                </button>
                <button 
                  onClick={() => navigate('/rekomendasi')}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Lihat Rekomendasi
                </button>
                <button 
                  onClick={handleLogout}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Rundown Modal */}
      {showSaveModal && tempRundown && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Simpan Rundown</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Judul Rundown
              </label>
              <input
                type="text"
                defaultValue={tempRundown.title || 'My Jakarta Trip'}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Masukkan judul rundown"
                id="rundown-title"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  const title = document.getElementById('rundown-title').value;
                  saveRundownToFirebase(tempRundown, title);
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfilePage;
