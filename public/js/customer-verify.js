// Customer Verification Page
let currentUserId = null;
let currentUserData = null;

// OTP Input Auto-Focus
const otpInputs = document.querySelectorAll('.otp-input');

otpInputs.forEach((input, index) => {
  input.addEventListener('input', (e) => {
    if (e.target.value.length === 1 && index < otpInputs.length - 1) {
      otpInputs[index + 1].focus();
    }
  });
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !e.target.value && index > 0) {
      otpInputs[index - 1].focus();
    }
  });
});

// Send OTP Form
document.getElementById('phoneForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const name = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const email = document.getElementById('email').value.trim();
  const button = document.getElementById('sendOtpBtn');
  
  if (!name || !phone || !email) {
    showMessage('message', 'Please fill all fields', 'error');
    return;
  }
  
  if (phone.length !== 10) {
    showMessage('message', 'Please enter a valid 10-digit phone number', 'error');
    return;
  }
  
  button.disabled = true;
  button.textContent = 'Sending...';
  
  try {
    const response = await apiCall('/send-otp', 'POST', { name, phone, email });
    
    currentUserId = response.userId;
    currentUserData = { name, phone, email };
    
    // Hide phone section, show OTP section
    document.getElementById('phoneSection').style.display = 'none';
    document.getElementById('otpSection').style.display = 'block';
    
    showMessage('message', 'OTP sent to your email!', 'success');
    
    // Focus first OTP input
    otpInputs[0].focus();
  } catch (error) {
    showMessage('message', error.message || 'Failed to send OTP', 'error');
    button.disabled = false;
    button.textContent = 'Send OTP';
  }
});

// Verify OTP Form
document.getElementById('otpForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const otp = Array.from(otpInputs).map(input => input.value).join('');
  const button = document.getElementById('verifyOtpBtn');
  
  if (otp.length !== 4) {
    showMessage('message', 'Please enter complete OTP', 'error');
    return;
  }
  
  button.disabled = true;
  button.textContent = 'Verifying...';
  
  try {
    const response = await apiCall('/verify-otp', 'POST', {
      userId: currentUserId,
      otp
    });
    
    // Save user data
    saveUser(response.user);
    
    showMessage('message', 'Verification successful!', 'success');
    
    // Redirect to menu
    setTimeout(() => {
      window.location.href = 'menu.html';
    }, 1000);
  } catch (error) {
    showMessage('message', error.message || 'Invalid OTP', 'error');
    button.disabled = false;
    button.textContent = 'Verify & Continue';
    
    // Clear OTP inputs
    otpInputs.forEach(input => input.value = '');
    otpInputs[0].focus();
  }
});

// Resend OTP
async function resendOTP() {
  if (!currentUserData) {
    showMessage('message', 'Please start over', 'error');
    return;
  }
  
  try {
    const response = await apiCall('/send-otp', 'POST', currentUserData);
    currentUserId = response.userId;
    
    showMessage('message', 'OTP resent to your email!', 'success');
    
    // Clear and focus first input
    otpInputs.forEach(input => input.value = '');
    otpInputs[0].focus();
  } catch (error) {
    showMessage('message', error.message || 'Failed to resend OTP', 'error');
  }
}
