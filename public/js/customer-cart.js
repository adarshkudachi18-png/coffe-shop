// Customer Cart Page
const RAZORPAY_KEY = 'rzp_live_Ra3bAvUG3HAtoy'; // Replace with actual key from .env

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
  const emptyCart = document.getElementById('emptyCart');
  const cartSummary = document.getElementById('cartSummary');
  
  if (cart.length === 0) {
    cartItemsContainer.style.display = 'none';
    cartSummary.style.display = 'none';
    emptyCart.style.display = 'block';
    return;
  }
  
  emptyCart.style.display = 'none';
  cartItemsContainer.style.display = 'block';
  cartSummary.style.display = 'block';
  
  // Display items
  cartItemsContainer.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img src="${item.image}" alt="${item.name}" class="cart-item-image">
      <div class="cart-item-details">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">₹${item.price} each</div>
      </div>
      <div class="cart-item-controls">
        <div class="cart-item-total">₹${item.price * item.quantity}</div>
        <div class="quantity-control">
          <button class="btn-qty" onclick="handleDecrement('${item.id}')">−</button>
          <span class="qty-display">${item.quantity}</span>
          <button class="btn-qty" onclick="handleIncrement('${item.id}')">+</button>
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
  }
}

// Decrement
function handleDecrement(itemId) {
  const cart = getCart();
  const item = cart.find(i => i.id === itemId);
  if (item) {
    updateCartItem(itemId, item.quantity - 1);
    displayCart();
  }
}

// Proceed to Payment
document.getElementById('proceedBtn').addEventListener('click', async () => {
  const cart = getCart();
  if (cart.length === 0) {
    alert('Your cart is empty');
    return;
  }
  
  const total = Math.round(getCartTotal());
  
  try {
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
        await createOrder(response.razorpay_payment_id, total);
      },
      prefill: {
        name: customerName,
        email: customerEmail,
        contact: ''
      },
      theme: {
        color: '#6B4423'
      },
      modal: {
        ondismiss: function() {
          console.log('Payment cancelled');
        }
      }
    };
    
    const rzp = new Razorpay(options);
    rzp.open();
  } catch (error) {
    console.error('Payment error:', error);
    alert('Failed to initiate payment. Please try again.');
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
    
    // Redirect to status page
    window.location.href = 'status.html';
  } catch (error) {
    console.error('Order creation error:', error);
    alert('Payment successful but order creation failed. Please contact support with payment ID: ' + paymentId);
  }
}

// Initialize
displayCart();
