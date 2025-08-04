/**
 * @file This script manages the frontend logic for the apartment listing webpage,
 * including dynamic content loading from Firestore, filtering, sorting,
 * modal interactions, and form submissions.
 */

import { db, auth } from "./firebase.js";
import { collection, getDocs, doc, getDoc, addDoc, setDoc, query, where, orderBy, limit, documentId, startAfter } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- Configuration Object ---
const CONFIG = {
    exchangeRates: {
        "USD": 1.0,
        "EUR": 0.92,
        "GBP": 0.79,
        "CAD": 1.36,
        "AUD": 1.52,
        "JPY": 156.0,
        "INR": 83.3,
        "BRL": 5.08,
        "ZAR": 18.5,
        "NZD": 1.63,
        "CHF": 0.90,
        "SGD": 1.35,
        "HKD": 7.8,
        "SEK": 10.8,
        "NOK": 10.8,
        "DKK": 6.8,
        "PLN": 3.9,
        "MXN": 16.6,
        "AED": 3.67,
        "SAR": 3.75,
        "RUB": 89.0,
        "TRY": 32.2,
        "THB": 36.6,
        "IDR": 16200,
        "MYR": 4.7,
        "PHP": 58.5,
        "VND": 25400,
        "KRW": 1360,
        "EGP": 47.7
    },
    flatAmenityIcons: {
        "parking": "fas fa-parking",
        "gym": "fas fa-dumbbell",
        "pool": "fas fa-swimming-pool",
        "balcony": "fas fa-building",
        "security": "fas fa-shield-alt",
        "pet-friendly": "fas fa-paw",
        "furnished": "fas fa-couch",
        "laundry": "fas fa-washer",
        "dishwasher": "fas fa-dishwasher",
        "air-conditioning": "fas fa-snowflake",
        "heating": "fas fa-fire",
        "wifi": "fas fa-wifi",
        "elevator": "fas fa-elevator",
        "playground": "fas fa-child",
        "garden": "fas fa-leaf",
        "storage": "fas fa-box",
        "fireplace": "fas fa-fire-alt",
        "waterfront": "fas fa-water",
        "city-view": "fas fa-city",
        "mountain-view": "fas fa-mountain"
    },
    flatsPerPage: 6,
    recentlyViewedLimit: 3,
    skeletonCount: 6
};

// --- Global Variables ---
let allFlatsData = [];
let displayedFlatsCount = 0;
let lastVisibleFlat = null;
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let recentlyViewed = JSON.parse(localStorage.getItem('recentlyViewed')) || [];
let currentCurrency = 'USD';
let authMode = 'login';
let authTimeout;
const elements = {};
const currentFilters = {
    offerType: 'all',
    flatType: 'all',
    minPrice: '',
    maxPrice: '',
    sortBy: 'price-desc',
    searchTerm: '',
    showFavorites: false
};

// --- Utility Functions ---
function capitalizeFirstLetter(string) {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function formatPrice(price) {
    const convertedPrice = price * CONFIG.exchangeRates[currentCurrency];
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currentCurrency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(convertedPrice);
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        console.error("Toast container not found!");
        return;
    }
    const toast = document.createElement('div');
    toast.className = `toast p-3 rounded-md shadow-md text-white ${
        type === 'success' ? 'bg-green-500' :
        type === 'error' ? 'bg-red-500' :
        'bg-gray-800'
    } transform translate-y-full opacity-0 transition-all duration-300 ease-out`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';
    }, 10);
    setTimeout(() => {
        toast.style.transform = 'translateY(-100%)';
        toast.style.opacity = '0';
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}

function showSkeletons(count) {
    elements.flatsList.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-card bg-white p-6 rounded-lg shadow-lg animate-pulse';
        skeleton.innerHTML = `
            <div class="h-48 bg-gray-300 rounded-md mb-4"></div>
            <div class="h-4 bg-gray-300 w-3/4 mb-2 rounded"></div>
            <div class="h-4 bg-gray-300 w-1/2 mb-4 rounded"></div>
            <div class="h-3 bg-gray-300 w-full mb-2 rounded"></div>
            <div class="h-3 bg-gray-300 w-5/6 rounded"></div>
        `;
        elements.flatsList.appendChild(skeleton);
    }
}

function hideSkeletons() {
    // Handled by clearing flatsList in showSkeletons or fetchFlats
}

function initCounter(element) {
    const target = +element.getAttribute('data-target');
    const duration = 2000;
    const start = 0;
    let startTime = null;
    const animateCount = (currentTime) => {
        if (!startTime) startTime = currentTime;
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const value = Math.floor(progress * (target - start) + start);
        element.textContent = value;
        if (progress < 1) {
            requestAnimationFrame(animateCount);
        } else {
            element.textContent = target;
        }
    };
    requestAnimationFrame(animateCount);
}

function parseAmenities(amenitiesData) {
    if (!amenitiesData) return [];
    if (Array.isArray(amenitiesData)) {
        if (amenitiesData.length === 1 && typeof amenitiesData[0] === 'string' && amenitiesData[0].startsWith('[') && amenitiesData[0].endsWith(']')) {
            try {
                return JSON.parse(amenitiesData[0]);
            } catch (e) {
                console.error("Error parsing stringified amenities:", e);
                return [];
            }
        }
        return amenitiesData.filter(item => typeof item === 'string');
    }
    if (typeof amenitiesData === 'string' && amenitiesData.startsWith('[') && amenitiesData.endsWith(']')) {
        try {
            return JSON.parse(amenitiesData);
        } catch (e) {
            console.error("Error parsing stringified amenities (single string):", e);
            return [];
        }
    }
    return [];
}

// --- DOM Manipulation / Render Functions ---
function createFlatCard(flat) {
    console.log("Creating card for flat:", flat); // DEBUG
    const flatCard = document.createElement('div');
    flatCard.className = 'bg-white rounded-lg shadow-lg overflow-hidden transition-transform duration-300 hover:scale-105 relative animate-on-scroll';
    flatCard.setAttribute('data-flat-id', flat.id || 'unknown');
    const isFavorite = favorites.includes(flat.id);
    const parsedAmenities = parseAmenities(flat.amenities || []);
    flatCard.innerHTML = `
        <img src="${flat.imageUrls && flat.imageUrls.length > 0 ? flat.imageUrls[0] : 'https://placehold.co/400x250/E0E0E0/888888?text=No+Image'}" 
             alt="${flat.type || 'Apartment'} in ${flat.location || 'Unknown'}" class="w-full h-48 object-cover cursor-pointer flat-image">
        <div class="p-6">
            <div class="flex justify-between items-center mb-3">
                <h3 class="text-2xl font-bold text-indigo-800">${formatPrice(flat.price || 0)}</h3>
                <span class="bg-indigo-100 text-indigo-800 text-sm font-semibold px-3 py-1 rounded-full">${capitalizeFirstLetter(flat.offerType || 'unknown')}</span>
            </div>
            <p class="text-gray-600 mb-2">${flat.bedrooms || 'N/A'} Bed | ${flat.bathrooms || 'N/A'} Bath | ${flat.area || 'N/A'} sqft</p>
            <p class="text-gray-700 flex items-center mb-4"><i class="fas fa-map-marker-alt text-indigo-600 mr-2"></i>${flat.location || 'Unknown'}</p>
            <div class="flex flex-wrap gap-2 text-gray-500 text-sm mb-4">
                ${parsedAmenities.length > 0 ? parsedAmenities.map(amenity => `<span class="bg-gray-100 px-2 py-1 rounded-full"><i class="${CONFIG.flatAmenityIcons[amenity.toLowerCase()] || 'fas fa-question-circle'} mr-1"></i>${capitalizeFirstLetter(amenity)}</span>`).join('') : '<span>No amenities</span>'}
            </div>
            <p class="text-gray-700 text-sm mb-4 line-clamp-3">${flat.description || 'No description available.'}</p>
            <div class="flex justify-between items-center">
                <button class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 view-details-btn">
                    View Details
                </button>
                <button class="favorite-btn text-2xl ${isFavorite ? 'text-red-500' : 'text-gray-400'} hover:text-red-600 transition-colors" data-flat-id="${flat.id || 'unknown'}" aria-label="Add to favorites">
                    <i class="${isFavorite ? 'fas' : 'far'} fa-heart"></i>
                </button>
            </div>
        </div>
    `;
    console.log("Generated flat card HTML:", flatCard.outerHTML); // DEBUG
    flatCard.querySelector('.view-details-btn').addEventListener('click', () => showFlatDetailModal(flat));
    flatCard.querySelector('.flat-image').addEventListener('click', () => {
        if (flat.imageUrls && flat.imageUrls.length > 0) {
            openLightbox(flat.imageUrls, 0);
        } else {
            showToast("No images available for this flat.", "info");
        }
    });
    return flatCard;
}

async function renderTestimonials() {
    if (!elements.reviewsList) {
        console.error("Testimonials list container not found!");
        return;
    }
    elements.reviewsList.innerHTML = '<div class="card p-6 bg-indigo-50 text-indigo-900"><p class="text-lg italic mb-4">"Loading testimonials..."</p></div>';
    try {
        const testimonialsCollection = collection(db, "testimonials");
        const querySnapshot = await getDocs(testimonialsCollection);
        const fetchedTestimonials = [];
        querySnapshot.forEach((doc) => {
            fetchedTestimonials.push(doc.data());
        });
        elements.reviewsList.innerHTML = '';
        if (fetchedTestimonials.length > 0) {
            fetchedTestimonials.forEach(testimonial => {
                const testimonialCard = document.createElement('div');
                testimonialCard.className = 'card p-6 bg-indigo-50 text-indigo-900';
                testimonialCard.innerHTML = `
                    <p class="text-lg italic mb-4">"${testimonial.quote || 'No quote available.'}"</p>
                    <p class="text-md font-semibold text-indigo-800">- ${testimonial.author || 'Anonymous'}</p>
                `;
                elements.reviewsList.appendChild(testimonialCard);
            });
        } else {
            elements.reviewsList.innerHTML = '<p class="text-center text-gray-600 col-span-full">No testimonials found.</p>';
        }
    } catch (error) {
        console.error("Error fetching testimonials:", error);
        elements.reviewsList.innerHTML = '<p class="text-center text-red-600 col-span-full">Error loading testimonials.</p>';
        showToast("Error loading testimonials.", "error");
    }
}

function displayRecentlyViewed() {
    if (!elements.recentlyViewedList) {
        console.error("Recently viewed list container not found!");
        return;
    }
    elements.recentlyViewedList.innerHTML = '';
    if (recentlyViewed.length === 0) {
        elements.recentlyViewedList.innerHTML = '<p class="text-center text-gray-600 col-span-full">No recently viewed apartments.</p>';
        return;
    }
    recentlyViewed = recentlyViewed.filter(flat => flat && flat.id);
    recentlyViewed.forEach(flat => {
        elements.recentlyViewedList.appendChild(createFlatCard(flat));
    });
}

function showFlatDetailModal(flat) {
    console.log("Showing flat detail modal for:", flat);
    if (!elements.flatDetailModal || !elements.modalImageGallery || !elements.flatDetailTitle || !elements.flatDetailDescription || !elements.flatDetailPrice || !elements.flatDetailSpecs || !elements.flatDetailLocation || !elements.flatDetailAmenities) {
        console.error("One or more flat detail modal elements not found!");
        showToast("Could not open flat details. Missing elements.", "error");
        return;
    }
    const parsedAmenitiesModal = parseAmenities(flat.amenities || []);
    elements.flatDetailTitle.textContent = `${flat.type || 'N/A'} in ${flat.location || 'N/A'}`;
    elements.flatDetailDescription.textContent = flat.description || 'No description available.';
    elements.flatDetailPrice.textContent = formatPrice(flat.price || 0);
    elements.flatDetailSpecs.innerHTML = `
        <li><i class="fas fa-bed text-indigo-600 mr-2"></i> ${flat.bedrooms || 'N/A'} Bedrooms</li>
        <li><i class="fas fa-bath text-indigo-600 mr-2"></i> ${flat.bathrooms || 'N/A'} Bathrooms</li>
        <li><i class="fas fa-ruler-combined text-indigo-600 mr-2"></i> ${flat.area || 'N/A'} sqft</li>
        <li><i class="fas fa-tag text-indigo-600 mr-2"></i> ${capitalizeFirstLetter(flat.offerType || 'N/A')}</li>
    `;
    elements.flatDetailLocation.innerHTML = `<i class="fas fa-map-marker-alt text-indigo-600 mr-2"></i> ${flat.location || 'N/A'}`;
    elements.flatDetailAmenities.innerHTML = parsedAmenitiesModal.length > 0 ? parsedAmenitiesModal.map(amenity => `
        <span class="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm flex items-center">
            <i class="${CONFIG.flatAmenityIcons[amenity.toLowerCase()] || 'fas fa-question-circle'} mr-1"></i> ${capitalizeFirstLetter(amenity)}
        </span>
    `).join('') : '<p>No specific amenities listed.</p>';
    elements.modalImageGallery.innerHTML = '';
    if (flat.imageUrls && flat.imageUrls.length > 0) {
        flat.imageUrls.forEach((url, index) => {
            const img = document.createElement('img');
            img.src = url;
            img.alt = `Apartment image ${index + 1}`;
            img.className = 'w-full h-48 object-cover rounded-md cursor-pointer';
            img.addEventListener('click', () => openLightbox(flat.imageUrls, index));
            elements.modalImageGallery.appendChild(img);
        });
    } else {
        elements.modalImageGallery.innerHTML = '<p class="text-gray-500 text-center col-span-full">No additional images available.</p>';
    }
    addToRecentlyViewed(flat);
    elements.flatDetailModal.classList.remove('hidden');
    elements.flatDetailModal.classList.add('active');
    document.body.classList.add('overflow-hidden');
}

function closeFlatDetailModal() {
    elements.flatDetailModal.classList.add('hidden');
    elements.flatDetailModal.classList.remove('active');
    document.body.classList.remove('overflow-hidden');
}

let currentLightboxImages = [];
let currentLightboxIndex = 0;

function openLightbox(imageUrls, startIndex) {
    if (!elements.lightboxModal || !elements.lightboxImage) {
        console.error("Lightbox elements not found!");
        showToast("Lightbox not available.", "error");
        return;
    }
    currentLightboxImages = imageUrls;
    currentLightboxIndex = startIndex;
    elements.lightboxImage.src = currentLightboxImages[currentLightboxIndex];
    elements.lightboxModal.classList.remove('hidden');
    elements.lightboxModal.classList.add('active');
    document.body.classList.add('overflow-hidden');
    updateLightboxNavButtons();
}

function updateLightboxNavButtons() {
    if (!elements.lightboxPrevBtn || !elements.lightboxNextBtn) {
        console.error("Lightbox navigation buttons not found!");
        return;
    }
    elements.lightboxPrevBtn.classList.toggle('hidden', currentLightboxIndex === 0);
    elements.lightboxNextBtn.classList.toggle('hidden', currentLightboxIndex === currentLightboxImages.length - 1);
}

function navigateLightbox(direction) {
    currentLightboxIndex += direction;
    if (currentLightboxIndex < 0) {
        currentLightboxIndex = 0;
    } else if (currentLightboxIndex >= currentLightboxImages.length) {
        currentLightboxIndex = currentLightboxImages.length - 1;
    }
    elements.lightboxImage.src = currentLightboxImages[currentLightboxIndex];
    updateLightboxNavButtons();
}

function closeLightbox() {
    elements.lightboxModal.classList.add('hidden');
    elements.lightboxModal.classList.remove('active');
    document.body.classList.remove('overflow-hidden');
}

// --- Data Management (Favorites & Recently Viewed) ---
async function toggleFavorite(flatId, buttonElement) {
    if (!auth.currentUser) {
        showToast("Please log in to manage favorites.", "info");
        return;
    }
    const userDocRef = doc(db, "users", auth.currentUser.uid);
    let userFavorites = [];
    try {
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            userFavorites = userDocSnap.data().favorites || [];
        }
        const index = userFavorites.indexOf(flatId);
        if (index > -1) {
            userFavorites.splice(index, 1);
            favorites = favorites.filter(id => id !== flatId);
            buttonElement.querySelector('i').classList.replace('fas', 'far');
            showToast("Removed from favorites.", "info");
        } else {
            userFavorites.push(flatId);
            favorites.push(flatId);
            buttonElement.querySelector('i').classList.replace('far', 'fas');
            showToast("Added to favorites!", "success");
        }
        await setDoc(userDocRef, { favorites: userFavorites }, { merge: true });
        localStorage.setItem('favorites', JSON.stringify(favorites));
        updateFavoritesFilterButtonState();
        if (currentFilters.showFavorites) {
            fetchFlats(true);
        }
    } catch (error) {
        console.error("Error toggling favorite:", error);
        showToast("Error updating favorites. Please try again.", "error");
    }
}

async function loadFavorites(uid) {
    try {
        const userDocRef = doc(db, "users", uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            favorites = userDocSnap.data().favorites || [];
            localStorage.setItem('favorites', JSON.stringify(favorites));
        } else {
            favorites = [];
            localStorage.removeItem('favorites');
        }
        updateFavoriteIconsInDisplay();
        updateFavoritesFilterButtonState();
    } catch (error) {
        console.error("Error loading favorites:", error);
        favorites = [];
        localStorage.removeItem('favorites');
        updateFavoritesFilterButtonState();
        showToast("Error loading your favorites.", "error");
    }
}

function updateFavoriteIconsInDisplay() {
    document.querySelectorAll('.favorite-btn').forEach(button => {
        const flatId = button.getAttribute('data-flat-id');
        if (favorites.includes(flatId)) {
            button.querySelector('i').classList.replace('far', 'fas');
            button.classList.add('text-red-500');
            button.classList.remove('text-gray-400');
        } else {
            button.querySelector('i').classList.replace('fas', 'far');
            button.classList.remove('text-red-500');
            button.classList.add('text-gray-400');
        }
    });
}

function addToRecentlyViewed(flat) {
    recentlyViewed = recentlyViewed.filter(item => item.id !== flat.id);
    recentlyViewed.unshift(flat);
    if (recentlyViewed.length > CONFIG.recentlyViewedLimit) {
        recentlyViewed = recentlyViewed.slice(0, CONFIG.recentlyViewedLimit);
    }
    localStorage.setItem('recentlyViewed', JSON.stringify(recentlyViewed));
    displayRecentlyViewed();
}

function updateFavoritesFilterButtonState() {
    if (elements.favoritesCountSpan && elements.favoriteToggleButton) {
        elements.favoritesCountSpan.textContent = favorites.length;
        elements.favoriteToggleButton.checked = currentFilters.showFavorites;
    }
}

// --- Firebase Authentication ---
async function handleAuth(event) {
    event.preventDefault();
    const email = elements.authEmailInput.value;
    const password = elements.authPasswordInput.value;
    elements.authErrorMessage.classList.add('hidden');
    elements.authErrorMessage.textContent = '';
    if (!email || !password) {
        elements.authErrorMessage.textContent = 'Email and password are required.';
        elements.authErrorMessage.classList.remove('hidden');
        return;
    }
    try {
        if (authMode === 'login') {
            await signInWithEmailAndPassword(auth, email, password);
            showToast("Logged in successfully!", "success");
        } else {
            await createUserWithEmailAndPassword(auth, email, password);
            showToast("Registration successful! Welcome!", "success");
        }
    } catch (error) {
        console.error("Authentication error:", error);
        let message = "An unknown error occurred.";
        if (error.code) {
            switch (error.code) {
                case 'auth/invalid-email':
                    message = 'Invalid email address format.';
                    break;
                case 'auth/user-disabled':
                    message = 'Your account has been disabled.';
                    break;
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                    message = 'Invalid email or password.';
                    break;
                case 'auth/email-already-in-use':
                    message = 'This email is already registered.';
                    break;
                case 'auth/weak-password':
                    message = 'Password should be at least 6 characters.';
                    break;
                case 'auth/too-many-requests':
                    message = 'Too many failed login attempts. Please try again later.';
                    break;
                default:
                    message = `Authentication failed: ${error.message}`;
            }
        }
        elements.authErrorMessage.textContent = message;
        elements.authErrorMessage.classList.remove('hidden');
        showToast(message, "error");
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
        showToast("You have been signed out.", "info");
    } catch (error) {
        console.error("Error signing out:", error);
        showToast("Error signing out. Please try again.", "error");
    }
}

function toggleAuthMode() {
    if (authMode === 'login') {
        authMode = 'register';
        elements.authModeToggle.textContent = 'Register';
        elements.authSubmitBtn.textContent = 'Register';
        elements.toggleAuthModeLink.innerHTML = "Already have an account? Login";
    } else {
        authMode = 'login';
        elements.authModeToggle.textContent = 'Login';
        elements.authSubmitBtn.textContent = 'Login';
        elements.toggleAuthModeLink.innerHTML = "Don't have an account? Register";
    }
    elements.authErrorMessage.classList.add('hidden');
    elements.authErrorMessage.textContent = '';
    elements.authPasswordInput.value = '';
}

// --- Firestore Data Fetching ---
async function fetchApartmentDetails() {
    try {
        const docRef = doc(db, "apartmentDetails", "main");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (elements.addressSpan) elements.addressSpan.textContent = data.address || 'N/A';
            if (elements.builtYearSpan) elements.builtYearSpan.textContent = data.builtYear || 'N/A';
            if (elements.totalFlatsCounter) {
                elements.totalFlatsCounter.setAttribute('data-target', data.totalFlats || '0');
                initCounter(elements.totalFlatsCounter);
            }
            if (elements.descriptionSpan) elements.descriptionSpan.textContent = data.description || 'No description available.';
            if (elements.amenitiesSpan) {
                if (data.amenities && Array.isArray(data.amenities)) {
                    elements.amenitiesSpan.innerHTML = data.amenities.map(amenity => `<span>${amenity}</span>`).join(', ');
                } else {
                    elements.amenitiesSpan.textContent = 'No amenities listed.';
                }
            }
        } else {
            console.log("No apartment details document found!");
            if (elements.addressSpan) elements.addressSpan.textContent = 'Not available';
            if (elements.builtYearSpan) elements.builtYearSpan.textContent = 'Not available';
            if (elements.totalFlatsCounter) {
                elements.totalFlatsCounter.setAttribute('data-target', '0');
                initCounter(elements.totalFlatsCounter);
            }
            if (elements.descriptionSpan) elements.descriptionSpan.textContent = 'Details not available.';
            if (elements.amenitiesSpan) elements.amenitiesSpan.textContent = 'Not available.';
        }
    } catch (error) {
        console.error("Error fetching apartment details:", error);
        showToast("Error loading apartment details.", "error");
    }
}

async function fetchFlats(reset = false) {
    console.log(`fetchFlats called (reset: ${reset})`);
    if (!elements.flatsList) {
        elements.flatsList = document.getElementById('flatsList');
        if (!elements.flatsList) {
            console.error("Critical Error: Flats list container (id='flatsList') not found in the DOM.");
            showToast("Error: Apartment display area not found. Please refresh the page.", "error");
            return;
        }
    }
    showSkeletons(CONFIG.skeletonCount);
    console.log("Showing skeleton loaders");
    if (reset) {
        allFlatsData = [];
        displayedFlatsCount = 0;
        lastVisibleFlat = null;
        elements.flatsList.innerHTML = '';
        elements.loadMoreBtn.classList.add('hidden');
        elements.noFlatsMessage.classList.add('hidden');
        console.log("Resetting flats list and pagination");
    }
    try {
        let flatsQueryRef = collection(db, "flats");
        if (currentFilters.offerType !== 'all') {
            flatsQueryRef = query(flatsQueryRef, where("offerType", "==", currentFilters.offerType));
        }
        if (currentFilters.flatType !== 'all') {
            flatsQueryRef = query(flatsQueryRef, where("type", "==", currentFilters.flatType));
        }
        if (currentFilters.minPrice) {
            flatsQueryRef = query(flatsQueryRef, where("price", ">=", parseFloat(currentFilters.minPrice)));
        }
        if (currentFilters.maxPrice) {
            flatsQueryRef = query(flatsQueryRef, where("price", "<=", parseFloat(currentFilters.maxPrice)));
        }
        if (currentFilters.showFavorites && favorites.length > 0) {
            flatsQueryRef = query(flatsQueryRef, where(documentId(), 'in', favorites));
        } else if (currentFilters.showFavorites && favorites.length === 0) {
            hideSkeletons();
            elements.flatsList.innerHTML = '';
            elements.noFlatsMessage.classList.remove('hidden');
            elements.noFlatsMessage.textContent = 'No favorite apartments found.';
            elements.loadMoreBtn.classList.add('hidden');
            console.log("No favorites to display");
            return;
        }
        if (currentFilters.sortBy === 'price-asc') {
            flatsQueryRef = query(flatsQueryRef, orderBy("price", "asc"));
        } else if (currentFilters.sortBy === 'price-desc') {
            flatsQueryRef = query(flatsQueryRef, orderBy("price", "desc"));
        } else if (currentFilters.sortBy === 'area-asc') {
            flatsQueryRef = query(flatsQueryRef, orderBy("area", "asc"));
        } else if (currentFilters.sortBy === 'area-desc') {
            flatsQueryRef = query(flatsQueryRef, orderBy("area", "desc"));
        } else {
            flatsQueryRef = query(flatsQueryRef, orderBy("price", "desc"));
        }
        if (lastVisibleFlat) {
            flatsQueryRef = query(flatsQueryRef, startAfter(lastVisibleFlat));
        }
        flatsQueryRef = query(flatsQueryRef, limit(CONFIG.flatsPerPage));
        const querySnapshot = await getDocs(flatsQueryRef);
        console.log(`Query snapshot docs count: ${querySnapshot.docs.length}`);
        const fetchedFlats = [];
        querySnapshot.forEach((doc) => {
            fetchedFlats.push({ id: doc.id, ...doc.data() });
        });
        console.log("Fetched flats data:", fetchedFlats);
        if (fetchedFlats.length > 0) {
            allFlatsData = allFlatsData.concat(fetchedFlats);
            elements.flatsList.innerHTML = '';
            console.log("Clearing flatsList and appending new cards");
            fetchedFlats.forEach(flat => {
                const card = createFlatCard(flat);
                console.log("Appending flat card:", flat.id, card);
                elements.flatsList.appendChild(card);
            });
            lastVisibleFlat = querySnapshot.docs[querySnapshot.docs.length - 1];
            displayedFlatsCount += fetchedFlats.length;
            console.log(`Total flats displayed: ${displayedFlatsCount}`);
            if (fetchedFlats.length === CONFIG.flatsPerPage) {
                elements.loadMoreBtn.classList.remove('hidden');
                console.log("Showing load more button");
            } else {
                elements.loadMoreBtn.classList.add('hidden');
                console.log("Hiding load more button");
            }
            elements.noFlatsMessage.classList.add('hidden');
        } else {
            console.log("No flats fetched");
            elements.flatsList.innerHTML = '';
            if (reset) {
                elements.noFlatsMessage.classList.remove('hidden');
                elements.noFlatsMessage.textContent = 'No apartments found matching your criteria.';
                console.log("Showing no flats message");
            } else {
                showToast("No more apartments to load.", "info");
            }
            elements.loadMoreBtn.classList.add('hidden');
        }
        updateFavoriteIconsInDisplay();
    } catch (error) {
        console.error("Error fetching flats:", error);
        showToast("Error loading apartments.", "error");
        elements.flatsList.innerHTML = '';
        elements.noFlatsMessage.classList.remove('hidden');
        elements.noFlatsMessage.textContent = 'Error loading apartments.';
    } finally {
        hideSkeletons();
        console.log("Hiding skeleton loaders");
    }
}

// --- Event Handlers ---
function handleFavoriteButtonClick(event) {
    const button = event.target.closest('.favorite-btn');
    if (button) {
        const flatId = button.getAttribute('data-flat-id');
        toggleFavorite(flatId, button);
    }
}

function handleApplyFilters() {
    if (!elements.offerTypeFilter || !elements.flatTypeFilter || !elements.minPriceFilter ||
        !elements.maxPriceFilter || !elements.sortByFilter || !elements.favoriteToggleButton) {
        console.error("One or more filter elements are missing!");
        showToast("Error: Filter controls are missing.", "error");
        return;
    }
    currentFilters.offerType = elements.offerTypeFilter.value;
    currentFilters.flatType = elements.flatTypeFilter.value;
    currentFilters.minPrice = elements.minPriceFilter.value;
    currentFilters.maxPrice = elements.maxPriceFilter.value;
    currentFilters.sortBy = elements.sortByFilter.value;
    currentFilters.showFavorites = elements.favoriteToggleButton.checked;
    console.log("Applying filters:", currentFilters); // DEBUG
    fetchFlats(true);
}

function handleLoadMore() {
    fetchFlats(false);
}

function handleCurrencyChange() {
    currentCurrency = elements.currencySwitcher.value;
    elements.flatsList.innerHTML = '';
    allFlatsData.forEach(flat => {
        elements.flatsList.appendChild(createFlatCard(flat));
    });
    updateFavoriteIconsInDisplay();
}

async function handleContactFormSubmit(event) {
    event.preventDefault();
    const name = elements.contactName.value;
    const email = elements.contactEmail.value;
    const message = elements.contactMessage.value;
    const formMessage = elements.formMessage;
    formMessage.textContent = '';
    if (!name || !email || !message) {
        formMessage.textContent = "Please fill in all fields.";
        formMessage.style.color = 'red';
        return;
    }
    try {
        await addDoc(collection(db, "inquiries"), {
            name,
            email,
            message,
            timestamp: new Date()
        });
        formMessage.textContent = "Your message has been sent!";
        formMessage.style.color = 'green';
        elements.contactForm.reset();
        showToast("Inquiry sent successfully!", "success");
    } catch (error) {
        console.error("Error submitting inquiry:", error);
        formMessage.textContent = "Failed to send message. Please try again.";
        formMessage.style.color = 'red';
        showToast("Failed to send inquiry.", "error");
    }
}

// --- Core Initialization Functions ---
function initializeElements() {
    elements.authSection = document.getElementById('auth-section');
    elements.authForm = document.getElementById('auth-form');
    elements.authEmailInput = document.getElementById('auth-email');
    elements.authPasswordInput = document.getElementById('auth-password');
    elements.authSubmitBtn = document.getElementById('auth-submit-btn');
    elements.authErrorMessage = document.getElementById('auth-error-message');
    elements.authModeToggle = document.getElementById('auth-mode-toggle');
    elements.toggleAuthModeLink = document.getElementById('toggle-auth-mode');
    elements.mainWebpageContent = document.getElementById('main-webpage-content');
    elements.mobileMenuBtn = document.getElementById('mobile-menu-btn');
    elements.mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
    elements.closeMobileMenuBtn = document.getElementById('close-mobile-menu-btn');
    elements.accountDropdownBtn = document.getElementById('account-dropdown-btn');
    elements.accountDropdown = document.getElementById('account-dropdown');
    elements.profileLogoutLink = document.getElementById('profile-logout-link');
    elements.loginRegisterLink = document.getElementById('login-register-link');
    elements.mobileProfileLogoutLink = document.getElementById('mobile-profile-logout-link');
    elements.mobileLoginRegisterLink = document.getElementById('mobile-login-register-link');
    elements.loggedInUserName = document.getElementById('logged-in-username');
    elements.addressSpan = document.getElementById('address-span');
    elements.builtYearSpan = document.getElementById('built-year-span');
    elements.totalFlatsCounter = document.getElementById('total-flats-counter') ? document.getElementById('total-flats-counter').querySelector('.counter') : null;
    elements.descriptionSpan = document.getElementById('description-span');
    elements.amenitiesSpan = document.getElementById('amenities-span');
    elements.flatsList = document.getElementById('flatsList');
    elements.loadMoreBtn = document.getElementById('loadMoreBtn');
    elements.noFlatsMessage = document.getElementById('no-flats-message');
    elements.offerTypeFilter = document.getElementById('offerTypeFilter');
    elements.flatTypeFilter = document.getElementById('flatTypeFilter');
    elements.minPriceFilter = document.getElementById('minPriceFilter');
    elements.maxPriceFilter = document.getElementById('maxPriceFilter');
    elements.sortByFilter = document.getElementById('sortByFilter');
    elements.favoriteToggleButton = document.getElementById('favorite-toggle-btn');
    elements.favoritesCountSpan = document.getElementById('favorites-count-span');
    elements.recentlyViewedList = document.getElementById('recently-viewed-list');
    elements.reviewsList = document.getElementById('reviews-list');
    elements.contactForm = document.getElementById('contact-form');
    elements.contactName = document.getElementById('contact-name');
    elements.contactEmail = document.getElementById('contact-email');
    elements.contactMessage = document.getElementById('contact-message');
    elements.formMessage = document.getElementById('form-message');
    elements.flatDetailModal = document.getElementById('flat-detail-modal');
    if (elements.flatDetailModal) {
        elements.closeModalBtn = elements.flatDetailModal.querySelector('#close-modal-btn');
        elements.modalImageGallery = elements.flatDetailModal.querySelector('#modal-image-gallery');
        elements.flatDetailTitle = elements.flatDetailModal.querySelector('#flat-detail-title');
        elements.flatDetailDescription = elements.flatDetailModal.querySelector('#flat-detail-description');
        elements.flatDetailPrice = elements.flatDetailModal.querySelector('#flat-detail-price');
        elements.flatDetailSpecs = elements.flatDetailModal.querySelector('#flat-detail-specs');
        elements.flatDetailLocation = elements.flatDetailModal.querySelector('#flat-detail-location');
        elements.flatDetailAmenities = elements.flatDetailModal.querySelector('#flat-detail-amenities');
    }
    elements.lightboxModal = document.getElementById('lightbox-modal');
    elements.lightboxImage = document.getElementById('lightbox-image');
    elements.lightboxCloseBtn = document.querySelector('.lightbox-close-button');
    elements.lightboxPrevBtn = document.getElementById('lightbox-prev');
    elements.lightboxNextBtn = document.getElementById('lightbox-next');
    elements.backToTopBtn = document.getElementById('back-to-top');
    if (!elements.flatsList) {
        console.error("flatsList element not found in DOM!");
    } else {
        console.log("flatsList element found:", elements.flatsList);
    }
}

function setupEventListeners() {
    if (elements.authForm) elements.authForm.addEventListener('submit', handleAuth);
    if (elements.toggleAuthModeLink) elements.toggleAuthModeLink.addEventListener('click', (e) => { e.preventDefault(); toggleAuthMode(); });
    if (elements.profileLogoutLink) elements.profileLogoutLink.addEventListener('click', (e) => { e.preventDefault(); handleLogout(); });
    if (elements.mobileProfileLogoutLink) elements.mobileProfileLogoutLink.addEventListener('click', (e) => { e.preventDefault(); handleLogout(); });
    if (elements.loginRegisterLink) elements.loginRegisterLink.addEventListener('click', (e) => { e.preventDefault(); elements.authSection.classList.remove('hidden'); elements.mainWebpageContent.classList.add('hidden'); });
    if (elements.mobileLoginRegisterLink) elements.mobileLoginRegisterLink.addEventListener('click', (e) => { e.preventDefault(); elements.authSection.classList.remove('hidden'); elements.mainWebpageContent.classList.add('hidden'); elements.mobileMenuOverlay.classList.add('hidden');});
    if (elements.mobileMenuBtn) elements.mobileMenuBtn.addEventListener('click', () => elements.mobileMenuOverlay.classList.remove('hidden'));
    if (elements.closeMobileMenuBtn) elements.closeMobileMenuBtn.addEventListener('click', () => elements.mobileMenuOverlay.classList.add('hidden'));
    if (elements.accountDropdownBtn) {
        elements.accountDropdownBtn.addEventListener('click', () => {
            elements.accountDropdown.classList.toggle('hidden');
        });
        document.addEventListener('click', (event) => {
            if (elements.accountDropdown && !elements.accountDropdown.contains(event.target) && !elements.accountDropdownBtn.contains(event.target)) {
                elements.accountDropdown.classList.add('hidden');
            }
        });
    }
    if (elements.applyFiltersBtn) elements.applyFiltersBtn.addEventListener('click', handleApplyFilters);
    if (elements.loadMoreBtn) elements.loadMoreBtn.addEventListener('click', handleLoadMore);
    if (elements.flatsList) elements.flatsList.addEventListener('click', handleFavoriteButtonClick);
    if (elements.contactForm) elements.contactForm.addEventListener('submit', handleContactFormSubmit);
    if (elements.closeModalBtn) elements.closeModalBtn.addEventListener('click', closeFlatDetailModal);
    if (elements.lightboxCloseBtn) elements.lightboxCloseBtn.addEventListener('click', closeLightbox);
    if (elements.lightboxPrevBtn) elements.lightboxPrevBtn.addEventListener('click', () => navigateLightbox(-1));
    if (elements.lightboxNextBtn) elements.lightboxNextBtn.addEventListener('click', () => navigateLightbox(1));
    if (elements.backToTopBtn) {
        elements.backToTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                elements.backToTopBtn.classList.remove('hidden');
            } else {
                elements.backToTopBtn.classList.add('hidden');
            }
        });
    }
}

function initScrollAnimations() {
    const animateElements = document.querySelectorAll('.animate-on-scroll');
    console.log("Found animate-on-scroll elements:", animateElements.length); // DEBUG
    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                console.log("Element intersecting:", entry.target); // DEBUG
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1
    });
    animateElements.forEach(element => {
        observer.observe(element);
    });
}

// --- Initialization ---
function initialize() {
    initializeElements();
    setupEventListeners();
    initScrollAnimations();
    const toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2';
    document.body.appendChild(toastContainer);
    onAuthStateChanged(auth, (user) => {
        if (user) {
            elements.authSection.classList.add('hidden');
            loadFavorites(user.uid);
            showToast(`Welcome back, ${user.email}!`, "success");
            if (elements.loggedInUserName) elements.loggedInUserName.textContent = user.email;
            if (elements.favoriteToggleButton) elements.favoriteToggleButton.classList.remove('hidden');
            if (elements.profileLogoutLink) elements.profileLogoutLink.classList.remove('hidden');
            if (elements.mobileProfileLogoutLink) elements.mobileProfileLogoutLink.classList.remove('hidden');
            if (elements.loginRegisterLink) elements.loginRegisterLink.classList.add('hidden');
            if (elements.mobileLoginRegisterLink) elements.mobileLoginRegisterLink.classList.add('hidden');
        } else {
            elements.authSection.classList.remove('hidden');
            favorites = [];
            localStorage.removeItem('favorites');
            if (elements.loggedInUserName) elements.loggedInUserName.textContent = 'Guest';
            if (elements.favoriteToggleButton) elements.favoriteToggleButton.classList.add('hidden');
            if (elements.profileLogoutLink) elements.profileLogoutLink.classList.add('hidden');
            if (elements.mobileProfileLogoutLink) elements.mobileProfileLogoutLink.classList.add('hidden');
            if (elements.loginRegisterLink) elements.loginRegisterLink.classList.remove('hidden');
            if (elements.mobileLoginRegisterLink) elements.mobileLoginRegisterLink.classList.remove('hidden');
        }
        elements.mainWebpageContent.classList.remove('hidden');
        fetchApartmentDetails();
        fetchFlats(true);
        displayRecentlyViewed();
        updateFavoritesFilterButtonState();
    });
}

// --- Start Application ---
document.addEventListener('DOMContentLoaded', initialize);