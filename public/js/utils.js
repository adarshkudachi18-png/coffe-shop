// Utility Functions
const API_URL = window.location.origin + '/api';

// API Helper
async function apiCall(endpoint, method = 'GET', data = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, options);
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'API request failed');
    }
    
    return result;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Local Storage Helpers
function saveToLocalStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
}

function getFromLocalStorage(key) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return null;
  }
}

function removeFromLocalStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Error removing from localStorage:', error);
  }
}

// Cart Helpers
function getCart() {
  return getFromLocalStorage('beanbox_cart') || [];
}

function saveCart(cart) {
  saveToLocalStorage('beanbox_cart', cart);
  updateCartCount();
}

function addToCart(item) {
  const cart = getCart();
  const existingItem = cart.find(i => i.id === item.id);
  
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ ...item, quantity: 1 });
  }
  
  saveCart(cart);
  return cart;
}

function updateCartItem(itemId, quantity) {
  const cart = getCart();
  const item = cart.find(i => i.id === itemId);
  
  if (item) {
    if (quantity <= 0) {
      return removeFromCart(itemId);
    }
    item.quantity = quantity;
  }
  
  saveCart(cart);
  return cart;
}

function removeFromCart(itemId) {
  const cart = getCart();
  const filtered = cart.filter(i => i.id !== itemId);
  saveCart(filtered);
  return filtered;
}

function clearCart() {
  saveCart([]);
}

function getCartTotal() {
  const cart = getCart();
  return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

function getCartCount() {
  const cart = getCart();
  return cart.reduce((count, item) => count + item.quantity, 0);
}

function updateCartCount() {
  const countElement = document.getElementById('cartCount');
  const totalElement = document.getElementById('cartTotal');
  
  if (countElement) {
    countElement.textContent = getCartCount();
  }
  
  if (totalElement) {
    totalElement.textContent = getCartTotal();
  }
}

// User Helpers
function saveUser(user) {
  saveToLocalStorage('beanbox_user', user);
}

function getUser() {
  return getFromLocalStorage('beanbox_user');
}

function clearUser() {
  removeFromLocalStorage('beanbox_user');
}

// Format Currency
function formatCurrency(amount) {
  return '₹' + amount.toFixed(0);
}

// Format Date/Time
function formatDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Show Message
function showMessage(elementId, message, type = 'success') {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = message;
    element.className = `message ${type}`;
    element.style.display = 'block';
    
    setTimeout(() => {
      element.style.display = 'none';
    }, 5000);
  }
}

// Debounce
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Generate Random ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
