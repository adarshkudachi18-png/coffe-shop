// Customer Status Page
let currentOrder = getFromLocalStorage('beanbox_current_order');
let refreshInterval;

if (!currentOrder) {
  window.location.href = 'menu.html';
}

// Display Order Status
async function displayOrderStatus() {
  try {
    // Fetch latest order status
    const order = await apiCall(`/orders/${currentOrder.id}`);
    
    // Update UI
    document.getElementById('orderId').textContent = order.orderId;
    document.getElementById('customerName').textContent = order.customerName;
    document.getElementById('pickupOTP').textContent = order.pickupOTP;
    document.getElementById('totalAmount').textContent = order.total;
    
    // Update status badge
    const statusElement = document.getElementById('orderStatus');
    if (order.status === 'pending') {
      statusElement.innerHTML = '🟡 Pending';
      statusElement.style.background = '#FFF9C4';
      statusElement.style.color = '#F57F17';
    } else if (order.status === 'accepted') {
      statusElement.innerHTML = '🟡 Accepted';
      statusElement.style.background = '#FFE082';
      statusElement.style.color = '#F57F17';
    } else if (order.status === 'completed') {
      statusElement.innerHTML = '🟢 Ready for Pickup';
      statusElement.style.background = '#C8E6C9';
      statusElement.style.color = '#388E3C';
      
      // Stop auto-refresh
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    }
    
    // Save updated order
    saveToLocalStorage('beanbox_current_order', order);
  } catch (error) {
    console.error('Error fetching order status:', error);
  }
}

// Refresh Status
document.getElementById('refreshBtn').addEventListener('click', () => {
  displayOrderStatus();
});

// Auto-refresh every 10 seconds
refreshInterval = setInterval(() => {
  displayOrderStatus();
}, 10000);

// Initialize
displayOrderStatus();
