// Customer Menu Page
let menuData = [];
let currentCategory = 'all';

// Toast Notification Function
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️'
  };
  
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-message">${message}</div>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Check if customer info exists
const customerName = sessionStorage.getItem('customerName');
const customerEmail = sessionStorage.getItem('customerEmail');

if (!customerName || !customerEmail) {
  window.location.href = 'index.html';
}

// Display user name
document.getElementById('userName').textContent = customerName;

// Check if orders are being accepted
async function checkOrdersStatus() {
  try {
    const settings = await apiCall('/settings');
    
    if (!settings.acceptingOrders) {
      // Show message and disable ordering
      document.getElementById('menuGrid').innerHTML = `
        <div class="orders-stopped-message" style="grid-column: 1 / -1;">
          <div class="icon">⏸️</div>
          <h2>Orders Temporarily Paused</h2>
          <p>We're not accepting new orders at the moment.</p>
          <p>Please check back later or visit us in person!</p>
          <p style="margin-top: 20px; font-weight: 600;">Thank you for your understanding.</p>
        </div>
      `;
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error checking orders status:', error);
    return true; // Allow ordering if check fails
  }
}

// Load Menu
async function loadMenu() {
  try {
    // Check if orders are being accepted
    const canOrder = await checkOrdersStatus();
    if (!canOrder) {
      return; // Don't load menu if orders are stopped
    }
    
    menuData = await apiCall('/menu');
    displayMenu();
    updateCartCount();
  } catch (error) {
    console.error('Error loading menu:', error);
    document.getElementById('menuGrid').innerHTML = '<div class="empty-state">Failed to load menu</div>';
  }
}

// Display Menu
function displayMenu() {
  const container = document.getElementById('menuGrid');
  
  const filtered = currentCategory === 'all' 
    ? menuData 
    : menuData.filter(item => item.category === currentCategory);
  
  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No items found</div>';
    return;
  }
  
  container.innerHTML = filtered.map(item => {
    const cart = getCart();
    const cartItem = cart.find(i => i.id === item.id);
    const quantity = cartItem ? cartItem.quantity : 0;
    
    return `
      <div class="menu-item">
        <img src="${item.image}" alt="${item.name}" class="menu-item-image">
        <div class="menu-item-content">
          <div class="menu-item-name">${item.name}</div>
          <div class="menu-item-price">₹${item.price}</div>
          <div class="menu-item-actions">
            ${quantity === 0 ? `
              <button class="btn-add" onclick="handleAddToCart('${item.id}')">Add</button>
            ` : `
              <div class="quantity-control">
                <button class="btn-qty" onclick="handleDecrement('${item.id}')">−</button>
                <span class="qty-display">${quantity}</span>
                <button class="btn-qty" onclick="handleIncrement('${item.id}')">+</button>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Category Filter
document.querySelectorAll('.category-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentCategory = e.target.dataset.category;
    displayMenu();
  });
});

// Add to Cart
function handleAddToCart(itemId) {
  const item = menuData.find(i => i.id === itemId);
  if (item) {
    addToCart(item);
    displayMenu();
    showToast(`${item.name} added to cart`, 'success');
  }
}

// Increment
function handleIncrement(itemId) {
  const cart = getCart();
  const item = cart.find(i => i.id === itemId);
  if (item) {
    updateCartItem(itemId, item.quantity + 1);
    displayMenu();
  }
}

// Decrement
function handleDecrement(itemId) {
  const cart = getCart();
  const item = cart.find(i => i.id === itemId);
  if (item) {
    if (item.quantity === 1) {
      showToast('Item removed from cart', 'info');
    }
    updateCartItem(itemId, item.quantity - 1);
    displayMenu();
  }
}

// Initialize
loadMenu();
