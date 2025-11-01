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
    
    // Check if order is cancelled
    if (order.status === 'cancelled') {
      // Show cancelled view
      document.getElementById('regularStatus').style.display = 'none';
      document.getElementById('cancelledStatus').style.display = 'block';
      
      // Update cancelled order details
      document.getElementById('cancelledOrderId').textContent = order.orderId;
      document.getElementById('cancelledAmount').textContent = order.total;
      
      // Show refund info only for online payments
      if (order.paymentType === 'online') {
        document.getElementById('refundInfo').style.display = 'block';
        document.getElementById('refundAmount').textContent = order.total;
      } else {
        document.getElementById('refundInfo').style.display = 'none';
      }
      
      // Stop auto-refresh
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      
      return;
    }
    
    // Show regular status view
    document.getElementById('regularStatus').style.display = 'block';
    document.getElementById('cancelledStatus').style.display = 'none';
    
    // Update UI
    document.getElementById('orderId').textContent = order.orderId;
    document.getElementById('customerName').textContent = order.customerName;
    document.getElementById('pickupOTP').textContent = order.pickupOTP;
    document.getElementById('totalAmount').textContent = order.total;
    
    // Update status badge
    const statusElement = document.getElementById('orderStatus');
    if (order.status === 'pending') {
      statusElement.innerHTML = '🟡 Pending';
      statusElement.className = 'status-badge status-pending';
    } else if (order.status === 'accepted') {
      statusElement.innerHTML = '🔵 Accepted - Being Prepared';
      statusElement.className = 'status-badge status-accepted';
    } else if (order.status === 'completed') {
      statusElement.innerHTML = '🟢 Ready for Pickup';
      statusElement.className = 'status-badge status-completed';
      
      // Stop auto-refresh when completed
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
