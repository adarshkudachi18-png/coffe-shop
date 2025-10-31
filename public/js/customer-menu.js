// Customer Menu Page
let menuData = [];
let currentCategory = 'all';

// Check if user is verified
const user = getUser();
if (!user) {
  window.location.href = 'verify.html';
}

// Display user name
document.getElementById('userName').textContent = user.name;

// Load Menu
async function loadMenu() {
  try {
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
    updateCartItem(itemId, item.quantity - 1);
    displayMenu();
  }
}

// Initialize
loadMenu();
