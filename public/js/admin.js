// Admin Dashboard
let currentPage = 'dashboard';
let allOrders = [];
let menuItems = [];
let walkinCart = [];
let analyticsData = null;
let currentPeriod = 'today';

// Sidebar Navigation
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    
    // Update active nav
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    e.currentTarget.classList.add('active');
    
    // Show page
    const page = e.currentTarget.dataset.page;
    showPage(page);
  });
});

// Show Page
function showPage(page) {
  currentPage = page;
  
  // Hide all pages
  document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
  
  // Show selected page
  const pageElement = document.getElementById(`page-${page}`);
  if (pageElement) {
    pageElement.classList.add('active');
  }
  
  // Update title
  const titles = {
    dashboard: 'Dashboard',
    analytics: 'Analysis',
    menu: 'Menu Management',
    orders: 'Live Orders',
    accepted: 'Accepted Orders',
    completed: 'Completed Orders',
    history: 'Order History',
    walkin: 'Walk-in Order'
  };
  document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';
  
  // Load page data
  loadPageData(page);
}

// Load Page Data
async function loadPageData(page) {
  switch (page) {
    case 'dashboard':
      await loadDashboard();
      break;
    case 'analytics':
      await loadAnalytics();
      break;
    case 'menu':
      await loadMenu();
      break;
    case 'orders':
      await loadOrders('pending');
      break;
    case 'accepted':
      await loadOrders('accepted');
      break;
    case 'completed':
      await loadOrders('completed');
      break;
    case 'history':
      await loadOrders('all');
      break;
    case 'walkin':
      await loadWalkinMenu();
      break;
  }
}

// Load Dashboard
async function loadDashboard() {
  try {
    const analytics = await apiCall('/analytics?period=today');
    
    // Update KPIs
    document.getElementById('kpi-total-orders').textContent = analytics.totalOrders;
    document.getElementById('kpi-total-revenue').textContent = analytics.totalRevenue.toFixed(0);
    document.getElementById('kpi-accepted').textContent = analytics.onlineOrders + analytics.cashOrders;
    
    // Get completed count
    const orders = await apiCall('/orders?status=completed');
    const todayCompleted = orders.filter(o => {
      const orderDate = new Date(o.createdAt).toDateString();
      const today = new Date().toDateString();
      return orderDate === today;
    });
    document.getElementById('kpi-completed').textContent = todayCompleted.length;
    
    // Load recent orders
    await loadRecentOrders();
  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
}

// Load Recent Orders
async function loadRecentOrders() {
  try {
    const orders = await apiCall('/orders');
    const recent = orders.slice(0, 10);
    
    const container = document.getElementById('recentOrders');
    
    if (recent.length === 0) {
      container.innerHTML = '<div class="empty-state">No recent orders</div>';
      return;
    }
    
    container.innerHTML = recent.map(order => `
      <div class="recent-order-item">
        <div>
          <strong>#${order.orderId}</strong> - ${order.customerName}
          <br>
          <small>${formatDateTime(order.createdAt)}</small>
        </div>
        <div>
          <strong>₹${order.total}</strong>
          <br>
          <span class="status-badge">${getStatusEmoji(order.status)} ${order.status}</span>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading recent orders:', error);
  }
}

// Load Analytics
async function loadAnalytics() {
  try {
    analyticsData = await apiCall(`/analytics?period=${currentPeriod}`);
    
    // Update payment breakdown
    document.getElementById('analytics-online').textContent = analyticsData.onlineRevenue.toFixed(0);
    document.getElementById('analytics-cash').textContent = analyticsData.cashRevenue.toFixed(0);
    
    // Update top items
    const topItemsContainer = document.getElementById('topItems');
    const topItems = Object.entries(analyticsData.topItems || {})
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);
    
    if (topItems.length === 0) {
      topItemsContainer.innerHTML = '<div class="empty-state">No data available</div>';
    } else {
      topItemsContainer.innerHTML = topItems.map(([name, data]) => `
        <div class="top-item">
          <span>${name}</span>
          <span><strong>${data.count}</strong> sold (₹${data.revenue})</span>
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('Error loading analytics:', error);
  }
}

// Analytics Period Filter
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentPeriod = e.target.dataset.period;
    loadAnalytics();
  });
});

// Load Menu
async function loadMenu() {
  try {
    menuItems = await apiCall('/menu');
    
    const container = document.getElementById('menuList');
    
    if (menuItems.length === 0) {
      container.innerHTML = '<div class="empty-state">No menu items. Click "Add Item" to create one.</div>';
      return;
    }
    
    container.innerHTML = menuItems.map(item => `
      <div class="menu-card">
        <img src="${item.image}" alt="${item.name}" class="menu-card-image">
        <div class="menu-card-content">
          <div class="menu-card-header">
            <div class="menu-card-title">${item.name}</div>
            ${item.isVeg ? '<span class="menu-card-badge badge-veg">🟢 Veg</span>' : '<span class="menu-card-badge badge-nonveg">🔴 Non-Veg</span>'}
          </div>
          <div class="menu-card-category">${item.category}</div>
          <div class="menu-card-price">₹${item.price}</div>
          <div class="menu-card-actions">
            <button class="btn btn-primary btn-sm" onclick="editMenuItem('${item.id}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteMenuItem('${item.id}')">Delete</button>
          </div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading menu:', error);
  }
}

// Add Menu Item
document.getElementById('addMenuItemBtn').addEventListener('click', () => {
  document.getElementById('modalTitle').textContent = 'Add Menu Item';
  document.getElementById('menuForm').reset();
  document.getElementById('menuItemId').value = '';
  document.getElementById('menuItemAvailable').checked = true;
  document.getElementById('menuModal').classList.add('active');
});

// Edit Menu Item
function editMenuItem(itemId) {
  const item = menuItems.find(i => i.id === itemId);
  if (!item) return;
  
  document.getElementById('modalTitle').textContent = 'Edit Menu Item';
  document.getElementById('menuItemId').value = item.id;
  document.getElementById('menuItemName').value = item.name;
  document.getElementById('menuItemCategory').value = item.category;
  document.getElementById('menuItemPrice').value = item.price;
  document.getElementById('menuItemImage').value = item.image;
  document.getElementById('menuItemVeg').checked = item.isVeg || false;
  document.getElementById('menuItemAvailable').checked = item.available !== false;
  document.getElementById('menuModal').classList.add('active');
}

// Delete Menu Item
async function deleteMenuItem(itemId) {
  if (!confirm('Are you sure you want to delete this item?')) return;
  
  try {
    await apiCall(`/menu/${itemId}`, 'DELETE');
    alert('Menu item deleted successfully');
    loadMenu();
  } catch (error) {
    alert('Failed to delete menu item: ' + error.message);
  }
}

// Close Modal
function closeMenuModal() {
  document.getElementById('menuModal').classList.remove('active');
}

// Save Menu Item
document.getElementById('menuForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const itemId = document.getElementById('menuItemId').value;
  const itemData = {
    name: document.getElementById('menuItemName').value,
    category: document.getElementById('menuItemCategory').value,
    price: parseFloat(document.getElementById('menuItemPrice').value),
    image: document.getElementById('menuItemImage').value,
    isVeg: document.getElementById('menuItemVeg').checked,
    available: document.getElementById('menuItemAvailable').checked
  };
  
  try {
    if (itemId) {
      // Update existing
      await apiCall(`/menu/${itemId}`, 'PUT', itemData);
      alert('Menu item updated successfully');
    } else {
      // Create new
      await apiCall('/menu', 'POST', itemData);
      alert('Menu item added successfully');
    }
    
    closeMenuModal();
    loadMenu();
  } catch (error) {
    alert('Failed to save menu item: ' + error.message);
  }
});

// Load Orders
async function loadOrders(status) {
  try {
    const endpoint = status === 'all' ? '/orders' : `/orders?status=${status}`;
    allOrders = await apiCall(endpoint);
    
    let containerId;
    if (status === 'pending') containerId = 'liveOrdersList';
    else if (status === 'accepted') containerId = 'acceptedOrdersList';
    else if (status === 'completed') containerId = 'completedOrdersList';
    else containerId = 'historyList';
    
    displayOrders(allOrders, containerId, status);
  } catch (error) {
    console.error('Error loading orders:', error);
  }
}

// Display Orders
function displayOrders(orders, containerId, status) {
  const container = document.getElementById(containerId);
  
  if (orders.length === 0) {
    container.innerHTML = '<div class="empty-state">No orders found</div>';
    return;
  }
  
  container.innerHTML = orders.map(order => `
    <div class="order-card">
      <div class="order-header">
        <div>
          <div class="order-id">#${order.orderId}</div>
          <div class="order-time">${formatDateTime(order.createdAt)}</div>
        </div>
        <span class="payment-badge payment-${order.paymentType}">${order.paymentType.toUpperCase()}</span>
      </div>
      
      <div class="order-body">
        <div class="order-info">
          <div class="order-label">Customer</div>
          <div class="order-value">${order.customerName}</div>
        </div>
        
        <div class="order-info">
          <div class="order-label">Phone</div>
          <div class="order-value">${order.customerPhone || 'N/A'}</div>
        </div>
        
        <div class="order-info">
          <div class="order-label">Pickup OTP</div>
          <div class="order-otp">${order.pickupOTP}</div>
        </div>
        
        <div class="order-info">
          <div class="order-label">Total</div>
          <div class="order-value">₹${order.total}</div>
        </div>
      </div>
      
      <div class="order-items">
        <div class="order-items-title">Items:</div>
        ${order.items.map(item => `
          <div class="order-item">
            <span>${item.name} x ${item.quantity}</span>
            <span>₹${item.price * item.quantity}</span>
          </div>
        `).join('')}
      </div>
      
      <div class="order-actions">
        ${status === 'pending' ? `
          <button class="btn btn-success btn-sm" onclick="updateOrderStatus('${order.id}', 'accepted')">✅ Accept</button>
          <button class="btn btn-primary btn-sm" onclick="updateOrderStatus('${order.id}', 'completed')">☕ Complete</button>
        ` : ''}
        ${status === 'accepted' ? `
          <button class="btn btn-primary btn-sm" onclick="updateOrderStatus('${order.id}', 'completed')">☕ Complete</button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

// Update Order Status
async function updateOrderStatus(orderId, newStatus) {
  try {
    await apiCall(`/orders/${orderId}/status`, 'PUT', { status: newStatus });
    alert(`Order #${orderId} ${newStatus === 'accepted' ? 'accepted' : 'completed'}!`);
    
    // Reload current page
    loadPageData(currentPage);
    
    // Refresh dashboard if on dashboard
    if (currentPage === 'dashboard') {
      loadDashboard();
    }
  } catch (error) {
    alert('Failed to update order status: ' + error.message);
  }
}

// Search Orders
document.getElementById('searchInput')?.addEventListener('input', debounce((e) => {
  const query = e.target.value.toLowerCase();
  
  if (!query) {
    displayOrders(allOrders, 'historyList', 'all');
    return;
  }
  
  const filtered = allOrders.filter(order => {
    return order.orderId.toString().includes(query) ||
           order.customerName.toLowerCase().includes(query) ||
           (order.customerPhone && order.customerPhone.includes(query));
  });
  
  displayOrders(filtered, 'historyList', 'all');
}, 300));

// Load Walk-in Menu
async function loadWalkinMenu() {
  try {
    const menu = await apiCall('/menu');
    
    const container = document.getElementById('walkinMenu');
    container.innerHTML = menu.map(item => `
      <div class="walkin-menu-item" data-id="${item.id}" onclick="toggleWalkinItem('${item.id}', '${item.name}', ${item.price})">
        <div class="walkin-item-name">${item.name}</div>
        <div class="walkin-item-price">₹${item.price}</div>
        <div class="quantity-control" style="margin-top: 10px;">
          <button class="btn-qty" onclick="event.stopPropagation(); decrementWalkin('${item.id}')">−</button>
          <span class="qty-display" id="walkin-qty-${item.id}">0</span>
          <button class="btn-qty" onclick="event.stopPropagation(); incrementWalkin('${item.id}', '${item.name}', ${item.price})">+</button>
        </div>
      </div>
    `).join('');
    
    updateWalkinCart();
  } catch (error) {
    console.error('Error loading walk-in menu:', error);
  }
}

// Toggle Walk-in Item
function toggleWalkinItem(id, name, price) {
  const item = walkinCart.find(i => i.id === id);
  if (item) {
    // Remove
    walkinCart = walkinCart.filter(i => i.id !== id);
  } else {
    // Add
    walkinCart.push({ id, name, price, quantity: 1 });
  }
  updateWalkinCart();
}

// Increment Walk-in
function incrementWalkin(id, name, price) {
  const item = walkinCart.find(i => i.id === id);
  if (item) {
    item.quantity++;
  } else {
    walkinCart.push({ id, name, price, quantity: 1 });
  }
  updateWalkinCart();
}

// Decrement Walk-in
function decrementWalkin(id) {
  const item = walkinCart.find(i => i.id === id);
  if (item) {
    item.quantity--;
    if (item.quantity <= 0) {
      walkinCart = walkinCart.filter(i => i.id !== id);
    }
  }
  updateWalkinCart();
}

// Update Walk-in Cart
function updateWalkinCart() {
  // Update quantities
  walkinCart.forEach(item => {
    const qtyElement = document.getElementById(`walkin-qty-${item.id}`);
    if (qtyElement) {
      qtyElement.textContent = item.quantity;
    }
    
    const menuItem = document.querySelector(`[data-id="${item.id}"]`);
    if (menuItem) {
      if (item.quantity > 0) {
        menuItem.classList.add('selected');
      } else {
        menuItem.classList.remove('selected');
      }
    }
  });
  
  // Update cart display
  const cartContainer = document.getElementById('walkinCart');
  if (walkinCart.length === 0) {
    cartContainer.innerHTML = '<div class="empty-state">No items selected</div>';
  } else {
    cartContainer.innerHTML = walkinCart.map(item => `
      <div class="walkin-cart-item">
        <span>${item.name} x ${item.quantity}</span>
        <span>₹${item.price * item.quantity}</span>
      </div>
    `).join('');
  }
  
  // Update total
  const total = walkinCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  document.getElementById('walkinTotal').textContent = total;
}

// Place Walk-in Order
document.getElementById('placeWalkinOrderBtn').addEventListener('click', async () => {
  if (walkinCart.length === 0) {
    alert('Please select items');
    return;
  }
  
  const customerName = document.getElementById('walkinName').value.trim() || 'Walk-in Customer';
  const total = walkinCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  const orderData = {
    customerName,
    items: walkinCart,
    total,
    paymentType: 'cash'
  };
  
  try {
    await apiCall('/orders', 'POST', orderData);
    alert('Walk-in order placed successfully!');
    
    // Reset
    walkinCart = [];
    document.getElementById('walkinName').value = '';
    updateWalkinCart();
    loadWalkinMenu();
  } catch (error) {
    alert('Failed to place order: ' + error.message);
  }
});

// Sidebar Toggle (Mobile)
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('active');
});

// Update Clock
function updateClock() {
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-IN', { 
    hour: '2-digit', 
    minute: '2-digit'
  });
  const dateString = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  document.getElementById('currentTime').textContent = `${dateString} | ${timeString}`;
}

// Get Status Emoji
function getStatusEmoji(status) {
  const emojis = {
    pending: '🟡',
    accepted: '🟡',
    completed: '🟢'
  };
  return emojis[status] || '⚪';
}

// Initialize
updateClock();
setInterval(updateClock, 60000);
loadDashboard();

// Auto-refresh orders every 30 seconds
setInterval(() => {
  if (currentPage === 'orders' || currentPage === 'accepted' || currentPage === 'dashboard') {
    loadPageData(currentPage);
  }
}, 30000);
