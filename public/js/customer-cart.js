// Customer Cart Page
const RAZORPAY_KEY = 'rzp_live_Ra3bAvUG3HAtoy'; // Replace with actual key from .env

// Toast Notification Function
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
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

// Display Cart
function displayCart() {
  const cart = getCart();
  const cartItemsContainer = document.getElementById('cartItems');
  const cartItemsSection = document.getElementById('cartItemsSection');
  const emptyCart = document.getElementById('emptyCart');
  const cartSummary = document.getElementById('cartSummary');
  
  if (cart.length === 0) {
    cartItemsSection.style.display = 'none';
    cartSummary.style.display = 'none';
    emptyCart.style.display = 'block';
    return;
  }
  
  emptyCart.style.display = 'none';
  cartItemsSection.style.display = 'block';
  cartSummary.style.display = 'block';
  
  // Display items with professional card layout
  cartItemsContainer.innerHTML = cart.map(item => `
    <div class="cart-item-card">
      <img src="${item.image}" alt="${item.name}" class="cart-item-img">
      <div class="cart-item-info">
        <h3 class="cart-item-name">${item.name}</h3>
        <div class="cart-item-price">₹${item.price} each</div>
      </div>
      <div class="cart-item-actions">
        <div class="cart-item-subtotal">₹${item.price * item.quantity}</div>
        <div class="quantity-controls">
          <button class="qty-btn" onclick="handleDecrement('${item.id}')">−</button>
          <span class="qty-value">${item.quantity}</span>
          <button class="qty-btn" onclick="handleIncrement('${item.id}')">+</button>
        </div>
      </div>
    </div>
  `).join('');
  
  // Calculate totals
  const total = getCartTotal();
  
  document.getElementById('subtotal').textContent = total.toFixed(0);
  document.getElementById('total').textContent = total.toFixed(0);
}

// Increment
function handleIncrement(itemId) {
  const cart = getCart();
  const item = cart.find(i => i.id === itemId);
  if (item) {
    updateCartItem(itemId, item.quantity + 1);
    displayCart();
    showToast('Quantity increased', 'success');
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
    displayCart();
  }
}

// Proceed to Payment
document.getElementById('proceedBtn').addEventListener('click', async () => {
  const cart = getCart();
  if (cart.length === 0) {
    showToast('Your cart is empty', 'error');
    return;
  }
  
  const total = Math.round(getCartTotal());
  
  try {
    showToast('Initializing payment...', 'info');
    
    // Create Razorpay order
    const orderResponse = await apiCall('/create-razorpay-order', 'POST', { amount: total });
    
    // Open Razorpay checkout
    const options = {
      key: RAZORPAY_KEY,
      amount: orderResponse.amount,
      currency: orderResponse.currency,
      name: 'BeanBox Café',
      description: 'Coffee Shop Order',
      order_id: orderResponse.orderId,
      handler: async function (response) {
        // Payment successful
        showToast('Payment successful! Creating order...', 'success');
        await createOrder(response.razorpay_payment_id, total);
      },
      prefill: {
        name: customerName,
        email: customerEmail,
        contact: ''
      },
      theme: {
        color: '#7B2CBF'
      },
      modal: {
        ondismiss: function() {
          showToast('Payment cancelled', 'warning');
          console.log('Payment cancelled');
        }
      }
    };
    
    const rzp = new Razorpay(options);
    rzp.open();
  } catch (error) {
    console.error('Payment error:', error);
    showToast('Failed to initiate payment. Please try again.', 'error');
  }
});

// Create Order after payment
async function createOrder(paymentId, total) {
  const cart = getCart();
  
  const orderData = {
    customerName,
    customerEmail,
    items: cart.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity
    })),
    total,
    paymentType: 'online',
    paymentId
  };
  
  try {
    const response = await apiCall('/orders', 'POST', orderData);
    
    // Clear cart
    clearCart();
    
    // Save order ID for status page
    saveToLocalStorage('beanbox_current_order', response.order);
    
    showToast('Order placed successfully!', 'success');
    
    // Redirect to status page after a short delay
    setTimeout(() => {
      window.location.href = 'status.html';
    }, 1000);
    
  } catch (error) {
    console.error('Order creation error:', error);
    showToast(`Payment successful but order creation failed. Please contact support with payment ID: ${paymentId}`, 'error');
  }
}

// Initialize
displayCart();
