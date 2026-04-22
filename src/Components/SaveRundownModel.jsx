import React, { useState, useEffect } from "react";
import { X, Save, MapPin, Calendar, DollarSign } from "lucide-react";
import { useRundown } from "./hooks/useRundown";

const SaveRundownModel = ({
  isOpen,
  onClose,
  rundownData,
  userId,
  onSaveSuccess,
  selectedrundown,
}) => {
  // Debug
  console.log("debug rundown data:", rundownData);
  console.log("debug selected rundown:", selectedrundown);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [tripType, setTripType] = useState("general");
  const [validationErrors, setValidationErrors] = useState([]);

  const { saveRundown, saving, error } = useRundown(userId);
  const [processedRundownData, setProcessedRundownData] = useState(null);

  // Price parsing function
  const parsePrice = (price) => {
    if (price === undefined || price === null) return 0;
    if (typeof price === "number") return price;
    if (typeof price === "string") {
      const numericString = price.replace(/[^0-9]/g, "");
      const parsed = parseFloat(numericString);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  // Single price formatting
  const formatSinglePrice = (price) => {
    const numericPrice = parsePrice(price);
    if (numericPrice === 0) return "-";

    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(numericPrice)
      .replace("IDR", "Rp");
  };

  // Calculate budget estimation
  const calculateBudgetEstimation = (destinations) => {
    let totalLow = 0;
    let totalHigh = 0;

    if (!destinations || !Array.isArray(destinations)) {
      return "-";
    }

    destinations.forEach((dest) => {
      const priceValue =
        dest.original?.price ||
        (dest.price && dest.price.match && dest.price.match(/\d+/)
          ? dest.price.replace(/\D/g, "")
          : 0) ||
        dest.estimatedCost ||
        0;

      const numericPrice = parsePrice(priceValue);

      totalLow += numericPrice;
      totalHigh += numericPrice * 1.1; // Add 10% buffer
    });

    // Add transportation buffer
    totalLow += 0;
    totalHigh += 10000;

    // Format the range
    const formatNumber = (num) => {
      return Math.round(num)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    return `Rp ${formatNumber(totalLow)} - ${formatNumber(totalHigh)}/pax`;
  };

  // Handle different data sources and normalize the structure
  useEffect(() => {
    if (rundownData) {
      setProcessedRundownData(rundownData);
    } else if (selectedrundown && selectedrundown.length > 0) {
      // Convert selectedrundown to rundown format
      const convertedRundown = {
        title: "Manual Trip Rundown",
        description: "",
        tags: [],
        tripType: "general",
        itinerary: selectedrundown.map((dest, index) => ({
          time: `${(9 + Math.floor(index * 2)).toString().padStart(2, '0')}:00`,
          activity: getDestinationDisplayName(dest, index),
          duration: "2 jam",
          notes: `Kunjungi ${getDestinationDisplayName(dest, index)}`,
          price: dest.price || "Free",
          location: getDestinationLocation(dest),
          category: getDestinationCategory(dest),
          estimatedCost: getDestinationPrice(dest),
          originalData: dest,
          order: index + 1,
          ...dest,
        })),
        budgetEstimation: calculateBudgetEstimation(selectedrundown),
        dataSource: "manual",
        totalDestinations: selectedrundown.length,
      };
      setProcessedRundownData(convertedRundown);
    } else {
      setProcessedRundownData(null);
    }
    // eslint-disable-next-line
  }, [rundownData, selectedrundown]);

  // Function to get display name for each destination
  const getDestinationDisplayName = (item, index) => {
    if (!item) return `Destinasi ${index + 1}`;

    if (item.label && typeof item.label === "string") {
      try {
        const parts = item.label.split(" - ");
        if (parts.length > 1) {
          return parts.slice(1).join(" - ");
        }
        const withoutEmoji = item.label.replace(
          /^[\u{1F300}-\u{1F9FF}][\s]*/u,
          ""
        );
        const withoutCategory = withoutEmoji.replace(/^[^-]-\s/, "");
        return withoutCategory || item.label;
      } catch (error) {
        return item.label;
      }
    }

    if (item.activity) {
      return item.activity;
    }

    const possibleNames = [
      item.name,
      item.destinationName,
      item.title,
      item.placeName,
      item.location,
    ];

    return (
      possibleNames.find((name) => name && name.trim() !== "") ||
      `Destinasi ${index + 1}`
    );
  };

  // Function to get location for display
  const getDestinationLocation = (item) => {
    if (!item) return "";
    return item.location || item.address || item.place || item.area || "";
  };

  // Function to get category
  const getDestinationCategory = (item) => {
    if (!item) return "General";
    return item.category || item.type || item.categoryType || "General";
  };

  // Function to get price
  const getDestinationPrice = (item) => {
    if (!item) return 0;
    try {
      const priceValue =
        item.original?.price ||
        (item.price && item.price.match && item.price.match(/\d+/)
          ? item.price.replace(/\D/g, "")
          : 0) ||
        item.estimatedCost ||
        item.cost ||
        0;

      return parsePrice(priceValue);
    } catch (error) {
      return 0;
    }
  };

  // Validate form
  const validateForm = () => {
    const errors = [];

    try {
      if (!title.trim()) {
        errors.push("Judul rundown harus diisi");
      }
      if (title.length > 100) {
        errors.push("Judul rundown maksimal 100 karakter");
      }
      if (description.length > 500) {
        errors.push("Deskripsi maksimal 500 karakter");
      }
      const currentData = processedRundownData;
      if (!currentData) {
        errors.push("Data rundown tidak tersedia");
      } else if (!currentData.itinerary) {
        errors.push("Data itinerary tidak tersedia");
      } else if (!Array.isArray(currentData.itinerary)) {
        errors.push("Format itinerary tidak valid");
      } else if (currentData.itinerary.length === 0) {
        errors.push("Rundown harus memiliki minimal 1 destinasi");
      } else {
        const invalidItems = currentData.itinerary.filter((item, index) => {
          return (
            !item ||
            (!item.label &&
              !item.activity &&
              !item.name &&
              !item.destinationName)
          );
        });

        if (invalidItems.length > 0) {
          errors.push(
            `Terdapat ${invalidItems.length} destinasi yang tidak valid`
          );
        }
      }
    } catch (error) {
      errors.push("Terjadi kesalahan saat validasi data");
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  // Handle save with data normalization
  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      const currentData = processedRundownData;

      const normalizedItinerary = currentData.itinerary
        .map((item, index) => {
          if (!item) {
            console.warn(`Item at index ${index} is undefined/null`);
            return null;
          }

          try {
            return {
              ...item,
              destinationName: getDestinationDisplayName(item, index),
              activity: getDestinationDisplayName(item, index),
              name: getDestinationDisplayName(item, index),
              location: getDestinationLocation(item),
              category: getDestinationCategory(item),
              estimatedCost: getDestinationPrice(item),
              originalData: item,
              order: item.order || index + 1,
              time: item.time || `${(9 + index * 2).toString().padStart(2, '0')}:00`,
              duration: item.duration || "2 jam",
              notes: item.notes || `Kunjungi ${getDestinationDisplayName(item, index)}`,
              price: item.price || "Free",
            };
          } catch (error) {
            return {
              ...item,
              destinationName: `Destinasi ${index + 1}`,
              activity: `Destinasi ${index + 1}`,
              name: `Destinasi ${index + 1}`,
              location: "",
              category: "General",
              estimatedCost: 0,
              originalData: item,
              order: index + 1,
              time: `${(9 + index * 2).toString().padStart(2, '0')}:00`,
              duration: "2 jam",
              notes: `Kunjungi destinasi ${index + 1}`,
              price: "Free",
            };
          }
        })
        .filter((item) => item !== null);

      const budgetEstimation = currentData.budgetEstimation
        ? currentData.budgetEstimation
        : calculateBudgetEstimation(normalizedItinerary);

      const formattedData = {
        ...currentData,
        itinerary: normalizedItinerary,
        title: title.trim(),
        description: description.trim(),
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag),
        tripType,
        budgetEstimation: budgetEstimation,
        dataSource: currentData.dataSource || (selectedrundown ? "manual" : "generated"),
        totalDestinations: normalizedItinerary.length,
        createdFrom: rundownData ? "generated_rundown" : "manual_selection",
        originalSelectedDestinations: selectedrundown || [],
      };

      const docId = await saveRundown(formattedData, title.trim());

      if (onSaveSuccess) {
        onSaveSuccess(docId);
      }
      onClose();
    } catch (err) {
      console.error("Save failed:", err);
    }
  };

  const currentData = processedRundownData;
  const totalDestinations = currentData?.itinerary?.length || 0;

  const estimatedCost = currentData?.budgetEstimation
    ? currentData?.budgetEstimation
    : calculateBudgetEstimation(currentData?.itinerary || []);

  const generatePreview = () => {
    if (!currentData?.itinerary || currentData.itinerary.length === 0) {
      return "Tidak ada destinasi";
    }

    const firstFew = currentData.itinerary
      .slice(0, 3)
      .map((item, index) => getDestinationDisplayName(item, index));

    const preview = firstFew.join(", ");
    return currentData.itinerary.length > 3 ? `${preview}...` : preview;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <Save className="mr-3 text-blue-500" size={24} />
            Simpan Rundown
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Rundown Preview */}
          {currentData && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-800 mb-3">
                Preview Rundown
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center text-blue-700">
                  <MapPin size={16} className="mr-2" />
                  <span>{totalDestinations} destinasi</span>
                </div>
                <div className="flex items-center text-blue-700">
                  <DollarSign size={16} className="mr-2" />
                  <span>{estimatedCost}</span>
                </div>
                <div className="flex items-center text-blue-700">
                  <Calendar size={16} className="mr-2" />
                  <span>{currentData.estimatedDuration || "1 hari"}</span>
                </div>
              </div>
              <p className="text-blue-600 text-sm mt-2 italic">
                {generatePreview()}
              </p>
              {/* Show data source */}
              <div className="mt-2 text-xs text-blue-500">
                {currentData.dataSource === "manual" || selectedrundown
                  ? "📝 Dibuat dari destinasi yang dipilih manual"
                  : "🤖 Dibuat dari generator otomatis"}
              </div>
            </div>
          )}

          {/* Form */}
          <div className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Judul Rundown *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Masukkan judul rundown"
                maxLength={100}
              />
              <p className="text-xs text-gray-500 mt-1">
                {title.length}/100 karakter
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deskripsi
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Tambahkan deskripsi untuk rundown ini..."
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">
                {description.length}/500 karakter
              </p>
            </div>

            {/* Trip Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Jenis Trip
              </label>
              <select
                value={tripType}
                onChange={(e) => setTripType(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="general">Umum</option>
                <option value="family">Keluarga</option>
                <option value="couple">Pasangan</option>
                <option value="friends">Teman-teman</option>
                <option value="solo">Solo</option>
                <option value="business">Bisnis</option>
                <option value="adventure">Petualangan</option>
                <option value="cultural">Budaya</option>
                <option value="culinary">Kuliner</option>
              </select>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="jakarta, wisata, keluarga (pisahkan dengan koma)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Pisahkan setiap tag dengan koma
              </p>
            </div>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="text-red-800 font-medium mb-2">
                Terdapat kesalahan:
              </h4>
              <ul className="text-red-700 text-sm space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Server Error */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Itinerary Preview */}
          {currentData?.itinerary && currentData.itinerary.length > 0 && (
            <div className="mt-6">
              <h4 className="font-medium text-gray-800 mb-3">
                Destinasi dalam Rundown:
              </h4>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {currentData.itinerary.map((item, index) => {
                  if (!item) {
                    return (
                      <div
                        key={index}
                        className="flex items-center p-2 bg-red-50 rounded"
                      >
                        <span className="text-red-600 text-xs">
                          Item {index + 1} is undefined
                        </span>
                      </div>
                    );
                  }

                  try {
                    const displayName = getDestinationDisplayName(item, index);
                    const location = getDestinationLocation(item);
                    const category = getDestinationCategory(item);
                    const price = getDestinationPrice(item);

                    return (
                      <div
                        key={index}
                        className="flex items-center p-2 bg-gray-50 rounded"
                      >
                        <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full mr-3 flex-shrink-0">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {displayName}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span className="bg-gray-200 px-2 py-1 rounded">
                              {category}
                            </span>
                            {location && <span>{location}</span>}
                            {item.time && (
                              <span className="text-blue-600 font-medium">
                                {item.time}
                              </span>
                            )}
                          </div>
                        </div>
                        {price > 0 && (
                          <span className="text-xs text-gray-600 flex-shrink-0">
                            {formatSinglePrice(price)}
                          </span>
                        )}
                        {price === 0 && (
                          <span className="text-xs text-green-600 flex-shrink-0">
                            -
                          </span>
                        )}
                      </div>
                    );
                  } catch (error) {
                    return (
                      <div
                        key={index}
                        className="flex items-center p-2 bg-red-50 rounded"
                      >
                        <span className="text-red-600 text-xs">
                          Error rendering item {index + 1}
                        </span>
                      </div>
                    );
                  }
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            disabled={saving}
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving || validationErrors.length > 0}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Menyimpan...
              </>
            ) : (
              <>
                <Save size={16} className="mr-2" />
                Simpan Rundown
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveRundownModel;
