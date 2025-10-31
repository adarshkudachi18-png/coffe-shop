const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const Razorpay = require('razorpay');
const AWS = require('aws-sdk');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Admin Credentials (In production, use environment variables and hashing)
const ADMIN_CREDENTIALS = {
  email: '00adarsh.kudachi00@gmail.com',
  password: 'adarsh18' // In production, store hashed password
};

// AWS DynamoDB Configuration
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'ap-south-1'
});

const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Razorpay Configuration
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Email Configuration
const Brevo = require('@getbrevo/brevo');
const brevo = new Brevo.TransactionalEmailsApi();

brevo.setApiKey(
  Brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

// Local JSON file paths
const DATA_DIR = path.join(__dirname, 'data');
const FILES = {
  users: path.join(DATA_DIR, 'users.json'),
  menu: path.join(DATA_DIR, 'menu.json'),
  orders: path.join(DATA_DIR, 'orders.json'),
  analytics: path.join(DATA_DIR, 'analytics.json'),
  settings: path.join(DATA_DIR, 'settings.json')
};

// Initialize data directory and files
async function initializeData() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    for (const [key, filePath] of Object.entries(FILES)) {
      try {
        await fs.access(filePath);
      } catch {
        let initialData = [];
        if (key === 'menu') {
          initialData = getSampleMenu();
        } else if (key === 'settings') {
          initialData = { acceptingOrders: true };
        }
        await fs.writeFile(filePath, JSON.stringify(initialData, null, 2));
      }
    }
    console.log('✅ Data directory initialized');
  } catch (error) {
    console.error('Error initializing data:', error);
  }
}

// Helper: Read JSON file
async function readJSON(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return filePath.includes('settings') ? { acceptingOrders: true } : [];
  }
}

// Helper: Write JSON file
async function writeJSON(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error);
    return false;
  }
}

// Helper: Sync to AWS DynamoDB
async function syncToAWS(tableName, item) {
  try {
    const params = {
      TableName: tableName,
      Item: item
    };
    await dynamoDB.put(params).promise();
    console.log(`✅ Synced to AWS: ${tableName}`);
    return true;
  } catch (error) {
    console.error(`❌ AWS sync failed for ${tableName}:`, error.message);
    return false;
  }
}

// Helper: Generate OTP
function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Helper: Generate Token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Helper: Send Email
// Helper: Send Email
async function sendEmail(to, subject, html) {
  try {
    const sendSmtpEmail = {
      sender: { name: 'Campus Canteen', email: '00adarsh.kudachi00@gmail.com' },
      to: [{ email: to }],
      subject: subject,
      htmlContent: html,
    };

    const response = await brevo.sendTransacEmail(sendSmtpEmail);
    console.log(`✅ Brevo email sent to ${to}`, response.messageId);
  } catch (error) {
    console.error('❌ Brevo email error:', error.response?.body || error);
  }
}

// Email Templates
function getOrderEmailTemplate(name, orderId, items, total, pickupOTP, status = 'confirmed') {
  const statusText = status === 'accepted' ? 'is being prepared' : status === 'completed' ? 'is ready for pickup' : 'has been confirmed';
  const statusEmoji = status === 'accepted' ? '👨‍🍳' : status === 'completed' ? '✅' : '🎉';
  
  const itemsList = items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #DDD;">${item.name} x${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #DDD; text-align: right;">₹${item.price * item.quantity}</td>
    </tr>
  `).join('');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; margin: 0; }
        .container { background: white; max-width: 600px; margin: 0 auto; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #7B2CBF 0%, #5A189A 100%); color: white; padding: 40px 30px; text-align: center; }
        .logo { font-size: 48px; margin-bottom: 10px; }
        .header h1 { margin: 0; font-size: 28px; }
        .content { padding: 40px 30px; }
        .status { text-align: center; font-size: 24px; margin: 20px 0; color: #7B2CBF; }
        .order-info { background: #F8F9FA; padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #7B2CBF; }
        .order-id { font-size: 18px; font-weight: bold; color: #7B2CBF; margin-bottom: 15px; }
        .items-table { width: 100%; margin: 20px 0; border-collapse: collapse; }
        .total { font-size: 20px; font-weight: bold; color: #7B2CBF; padding: 15px; background: #F8F9FA; border-radius: 8px; text-align: right; margin-top: 15px; border-left: 3px solid #7B2CBF; }
        .otp-box { background: linear-gradient(135deg, #7B2CBF 0%, #5A189A 100%); color: white; padding: 20px; border-radius: 12px; text-align: center; margin: 25px 0; box-shadow: 0 4px 12px rgba(123, 44, 191, 0.3); }
        .otp { font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 10px 0; }
        .otp-label { font-size: 14px; text-transform: uppercase; letter-spacing: 2px; }
        .footer { background: #f5f5f5; padding: 30px; text-align: center; color: #666; font-size: 14px; }
        .button { display: inline-block; padding: 14px 32px; background: #7B2CBF; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">☕</div>
          <h1>BeanBox Café</h1>
        </div>
        <div class="content">
          <h2>Hello ${name}!</h2>
          <div class="status">${statusEmoji} Your order ${statusText}</div>
          
          <div class="order-info">
            <div class="order-id">Order #${orderId}</div>
            <table class="items-table">
              ${itemsList}
            </table>
            <div class="total">Total: ₹${total}</div>
          </div>
          
          <div class="otp-box">
            <div class="otp-label">Pickup OTP</div>
            <div class="otp">${pickupOTP}</div>
            <p style="margin: 10px 0 0; font-size: 13px; opacity: 0.9;">Show this OTP when collecting your order</p>
          </div>
          
          <p style="line-height: 1.8; color: #666;">
            ${status === 'completed' 
              ? 'Your order is ready! Please collect it from our counter.' 
              : 'We\'ll notify you when your order is ready for pickup.'}
          </p>
        </div>
        <div class="footer">
          <p style="margin: 0 0 10px; font-weight: bold; color: #6B4423;">BeanBox Café</p>
          <p style="margin: 0;">Crafting Perfect Moments, One Cup at a Time</p>
          <p style="margin: 10px 0 0; font-size: 12px;">© 2025 BeanBox Café. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function getPasswordResetEmail(email, tempPassword) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; margin: 0; }
        .container { background: white; max-width: 600px; margin: 0 auto; padding: 40px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .logo { text-align: center; font-size: 48px; margin-bottom: 20px; }
        h1 { color: #7B2CBF; text-align: center; }
        .password-box { background: #F8F9FA; padding: 20px; border-radius: 12px; margin: 30px 0; text-align: center; border-left: 4px solid #7B2CBF; }
        .password { font-size: 28px; font-weight: bold; color: #7B2CBF; letter-spacing: 4px; margin: 15px 0; }
        .footer { text-align: center; color: #666; margin-top: 30px; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">☕</div>
        <h1>Password Reset Request</h1>
        <p>Hello,</p>
        <p>We received a request to reset your password for the BeanBox Café Admin Dashboard.</p>
        
        <div class="password-box">
          <p style="margin: 0; font-size: 14px; color: #666;">Your temporary password is:</p>
          <div class="password">${tempPassword}</div>
          <p style="margin: 10px 0 0; font-size: 13px; color: #666;">Please change this password after logging in</p>
        </div>
        
        <p>If you didn't request this password reset, please ignore this email or contact support.</p>
        
        <div class="footer">
          <p>— BeanBox Café Team</p>
          <p style="margin-top: 5px;">Crafting Perfect Moments, One Cup at a Time</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Sample menu data
function getSampleMenu() {
  return [
    { id: '1', name: 'Cappuccino', category: 'Coffee', price: 120, description: 'Rich espresso with steamed milk and foam', image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400', type: 'veg', inStock: true },
    { id: '2', name: 'Latte', category: 'Coffee', price: 130, description: 'Smooth espresso with velvety steamed milk', image: 'https://images.unsplash.com/photo-1561882468-9110e03e0f78?w=400', type: 'veg', inStock: true },
    { id: '3', name: 'Espresso', category: 'Coffee', price: 100, description: 'Bold and intense shot of pure coffee', image: 'https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=400', type: 'veg', inStock: true },
    { id: '4', name: 'Croissant', category: 'Snacks', price: 80, description: 'Buttery and flaky French pastry', image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400', type: 'veg', inStock: true },
    { id: '5', name: 'Chocolate Cake', category: 'Desserts', price: 150, description: 'Decadent chocolate layer cake', image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400', type: 'veg', inStock: true },
    { id: '6', name: 'Cold Brew', category: 'Drinks', price: 140, description: 'Smooth cold-brewed coffee', image: 'https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=400', type: 'veg', inStock: true },
    { id: '7', name: 'Americano', category: 'Coffee', price: 110, description: 'Classic espresso with hot water', image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400', type: 'veg', inStock: true },
    { id: '8', name: 'Sandwich', category: 'Snacks', price: 120, description: 'Fresh grilled sandwich', image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400', type: 'veg', inStock: true }
  ];
}

// ==================== API ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'BeanBox Café API is running' });
});

// Admin Login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
      const token = generateToken();
      
      res.json({ 
        success: true, 
        token,
        message: 'Login successful'
      });
    } else {
      res.status(401).json({ 
        success: false, 
        error: 'Invalid email or password' 
      });
    }
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Admin Forgot Password
app.post('/api/admin/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (email === ADMIN_CREDENTIALS.email) {
      // Generate temporary password
      const tempPassword = 'Temp' + Math.floor(1000 + Math.random() * 9000);
      
      // In production, store this temp password with expiry
      // For now, just send email with current password info
      
      await sendEmail(
        email,
        'Password Reset - BeanBox Café Admin',
        getPasswordResetEmail(email, tempPassword)
      );
      
      res.json({ 
        success: true, 
        message: 'Password reset instructions sent to your email'
      });
    } else {
      // Don't reveal if email exists
      res.json({ 
        success: true, 
        message: 'If this email is registered, you will receive reset instructions'
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Get Settings
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await readJSON(FILES.settings);
    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Update Settings
app.put('/api/settings', async (req, res) => {
  try {
    const settings = await readJSON(FILES.settings);
    const updatedSettings = { ...settings, ...req.body };
    await writeJSON(FILES.settings, updatedSettings);
    
    res.json({ success: true, settings: updatedSettings });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Register Customer (simplified - no OTP)
app.post('/api/customer/register', async (req, res) => {
  try {
    const { name, email } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    
    const customerId = `customer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const customer = {
      id: customerId,
      name,
      email,
      createdAt: new Date().toISOString()
    };
    
    // Save to local JSON
    const users = await readJSON(FILES.users);
    users.push(customer);
    await writeJSON(FILES.users, users);
    
    // Sync to AWS
    await syncToAWS('beanbox_users', customer);
    
    res.json({ 
      success: true, 
      customerId,
      name,
      email
    });
  } catch (error) {
    console.error('Customer registration error:', error);
    res.status(500).json({ error: 'Failed to register customer' });
  }
});

// Get Menu
app.get('/api/menu', async (req, res) => {
  try {
    const menu = await readJSON(FILES.menu);
    // Filter by inStock (new field) or available (legacy field)
    res.json(menu.filter(item => item.inStock !== false && item.available !== false));
  } catch (error) {
    console.error('Get menu error:', error);
    res.status(500).json({ error: 'Failed to get menu' });
  }
});

// Get Menu
app.get('/api/menu', async (req, res) => {
  try {
    const menu = await readJSON(FILES.menu);
    res.json(menu.filter(item => item.available));
  } catch (error) {
    console.error('Get menu error:', error);
    res.status(500).json({ error: 'Failed to get menu' });
  }
});

// Add Menu Item (Admin)
app.post('/api/menu', async (req, res) => {
  try {
    const item = {
      id: `item_${Date.now()}`,
      ...req.body,
      createdAt: new Date().toISOString()
    };
    
    const menu = await readJSON(FILES.menu);
    menu.push(item);
    await writeJSON(FILES.menu, menu);
    
    await syncToAWS('beanbox_menu', item);
    
    res.json({ success: true, item });
  } catch (error) {
    console.error('Add menu item error:', error);
    res.status(500).json({ error: 'Failed to add menu item' });
  }
});

// Update Menu Item (Admin)
app.put('/api/menu/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const menu = await readJSON(FILES.menu);
    const index = menu.findIndex(item => item.id === id);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    
    menu[index] = { ...menu[index], ...req.body, updatedAt: new Date().toISOString() };
    await writeJSON(FILES.menu, menu);
    
    await syncToAWS('beanbox_menu', menu[index]);
    
    res.json({ success: true, item: menu[index] });
  } catch (error) {
    console.error('Update menu item error:', error);
    res.status(500).json({ error: 'Failed to update menu item' });
  }
});

// Delete Menu Item (Admin)
app.delete('/api/menu/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const menu = await readJSON(FILES.menu);
    const filtered = menu.filter(item => item.id !== id);
    
    if (menu.length === filtered.length) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    
    await writeJSON(FILES.menu, filtered);
    
    res.json({ success: true, message: 'Menu item deleted' });
  } catch (error) {
    console.error('Delete menu item error:', error);
    res.status(500).json({ error: 'Failed to delete menu item' });
  }
});

// Create Razorpay Order
app.post('/api/create-razorpay-order', async (req, res) => {
  try {
    const { amount } = req.body;
    
    const options = {
      amount: amount * 100, // amount in paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`
    };
    
    const order = await razorpay.orders.create(options);
    
    res.json({ 
      success: true, 
      orderId: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (error) {
    console.error('Create Razorpay order error:', error);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// Create Order
app.post('/api/orders', async (req, res) => {
  try {
    const { customerName, customerEmail, items, total, paymentType, paymentId } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Items are required' });
    }
    
    // Check if accepting orders
    const settings = await readJSON(FILES.settings);
    if (!settings.acceptingOrders && paymentType === 'online') {
      return res.status(400).json({ error: 'Sorry, we are not accepting orders at the moment' });
    }
    
    // Generate order
    const orders = await readJSON(FILES.orders);
    const orderId = orders.length + 1;
    const pickupOTP = generateOTP();
    
    const order = {
      id: orderId.toString(),
      orderId,
      customerName: customerName || 'Walk-in Customer',
      customerEmail: customerEmail || '',
      items,
      total,
      paymentType,
      paymentId: paymentId || '',
      pickupOTP,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    orders.push(order);
    await writeJSON(FILES.orders, orders);
    
    // Sync to AWS
    await syncToAWS('beanbox_orders', order);
    
    // Send confirmation email if email provided
    if (customerEmail && paymentType === 'online') {
      await sendEmail(
        customerEmail,
        'Order Confirmed - BeanBox Café',
        getOrderEmailTemplate(customerName, orderId, items, total, pickupOTP, 'confirmed')
      );
    }
    
    res.json({ 
      success: true, 
      order: {
        id: order.id,
        orderId: order.orderId,
        pickupOTP,
        customerName: order.customerName
      }
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Create Walk-in Order (Admin)
app.post('/api/orders/walk-in', async (req, res) => {
  try {
    const { customerName, customerEmail, items, total, paymentType } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Items are required' });
    }
    
    // Generate order
    const orders = await readJSON(FILES.orders);
    const orderId = orders.length + 1;
    const pickupOTP = generateOTP();
    
    const order = {
      id: orderId.toString(),
      orderId,
      customerName: customerName || 'Walk-in Customer',
      customerEmail: customerEmail || 'walkin@beanbox.com',
      items,
      total,
      paymentType: paymentType || 'cash',
      paymentId: '',
      pickupOTP,
      status: 'accepted', // Walk-in orders are automatically accepted
      orderType: 'walk-in',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      acceptedAt: new Date().toISOString()
    };
    
    orders.push(order);
    await writeJSON(FILES.orders, orders);
    
    // Sync to AWS
    await syncToAWS('beanbox_orders', order);
    
    res.json({ 
      success: true, 
      order: {
        id: order.id,
        orderId: order.orderId,
        pickupOTP,
        customerName: order.customerName
      }
    });
  } catch (error) {
    console.error('Create walk-in order error:', error);
    res.status(500).json({ error: 'Failed to create walk-in order' });
  }
});

// Get Order Status
app.get('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orders = await readJSON(FILES.orders);
    const order = orders.find(o => o.id === id || o.orderId.toString() === id);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to get order' });
  }
});

// Get All Orders (Admin)
app.get('/api/orders', async (req, res) => {
  try {
    const { status } = req.query;
    let orders = await readJSON(FILES.orders);
    
    if (status) {
      orders = orders.filter(o => o.status === status);
    }
    
    // Sort by newest first
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json(orders);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

// Update Order Status (Admin)
app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const orders = await readJSON(FILES.orders);
    const order = orders.find(o => o.id === id || o.orderId.toString() === id);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    order.status = status;
    order.updatedAt = new Date().toISOString();
    
    if (status === 'accepted') {
      order.acceptedAt = new Date().toISOString();
    } else if (status === 'completed') {
      order.completedAt = new Date().toISOString();
    }
    
    await writeJSON(FILES.orders, orders);
    await syncToAWS('beanbox_orders', order);
    
    // Send email notification
    if (order.customerEmail) {
      const emailStatus = status === 'completed' ? 'completed' : 'accepted';
      await sendEmail(
        order.customerEmail,
        `Order ${status === 'accepted' ? 'Accepted' : 'Ready'} - BeanBox Café`,
        getOrderEmailTemplate(order.customerName, order.orderId, order.items, order.total, order.pickupOTP, emailStatus)
      );
    }
    
    // Update analytics if completed
    if (status === 'completed') {
      await updateAnalytics(order);
    }
    
    res.json({ success: true, order });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Update Analytics
async function updateAnalytics(order) {
  try {
    const today = new Date().toISOString().split('T')[0];
    let analytics = await readJSON(FILES.analytics);
    
    let todayAnalytics = analytics.find(a => a.date === today);
    
    if (!todayAnalytics) {
      todayAnalytics = {
        date: today,
        totalOrders: 0,
        totalRevenue: 0,
        onlineRevenue: 0,
        cashRevenue: 0,
        onlineOrders: 0,
        cashOrders: 0,
        topItems: {}
      };
      analytics.push(todayAnalytics);
    }
    
    todayAnalytics.totalOrders++;
    todayAnalytics.totalRevenue += order.total;
    
    if (order.paymentType === 'online') {
      todayAnalytics.onlineRevenue += order.total;
      todayAnalytics.onlineOrders++;
    } else {
      todayAnalytics.cashRevenue += order.total;
      todayAnalytics.cashOrders++;
    }
    
    // Update top items
    order.items.forEach(item => {
      if (!todayAnalytics.topItems[item.name]) {
        todayAnalytics.topItems[item.name] = { count: 0, revenue: 0 };
      }
      todayAnalytics.topItems[item.name].count += item.quantity;
      todayAnalytics.topItems[item.name].revenue += item.price * item.quantity;
    });
    
    await writeJSON(FILES.analytics, analytics);
    await syncToAWS('beanbox_analytics', todayAnalytics);
  } catch (error) {
    console.error('Update analytics error:', error);
  }
}

// Get Analytics (Admin)
app.get('/api/analytics', async (req, res) => {
  try {
    const { period } = req.query; // today, week, month
    const analytics = await readJSON(FILES.analytics);
    
    const today = new Date();
    let filteredAnalytics = analytics;
    
    if (period === 'today') {
      const todayStr = today.toISOString().split('T')[0];
      filteredAnalytics = analytics.filter(a => a.date === todayStr);
    } else if (period === 'week') {
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      filteredAnalytics = analytics.filter(a => new Date(a.date) >= weekAgo);
    } else if (period === 'month') {
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      filteredAnalytics = analytics.filter(a => new Date(a.date) >= monthAgo);
    }
    
    // Aggregate data
    const summary = {
      totalOrders: 0,
      totalRevenue: 0,
      onlineRevenue: 0,
      cashRevenue: 0,
      onlineOrders: 0,
      cashOrders: 0,
      topItems: {},
      dailyData: filteredAnalytics
    };
    
    filteredAnalytics.forEach(day => {
      summary.totalOrders += day.totalOrders;
      summary.totalRevenue += day.totalRevenue;
      summary.onlineRevenue += day.onlineRevenue;
      summary.cashRevenue += day.cashRevenue;
      summary.onlineOrders += day.onlineOrders;
      summary.cashOrders += day.cashOrders;
      
      Object.entries(day.topItems || {}).forEach(([item, data]) => {
        if (!summary.topItems[item]) {
          summary.topItems[item] = { count: 0, revenue: 0 };
        }
        summary.topItems[item].count += data.count;
        summary.topItems[item].revenue += data.revenue;
      });
    });
    
    res.json(summary);
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// Start server
async function startServer() {
  await initializeData();
  
  app.listen(PORT, () => {
    console.log(`
    ☕ BeanBox Café Server Running
    ================================
    🌐 Server: http://localhost:${PORT}
    📊 API: http://localhost:${PORT}/api/health
    
    📱 Customer App: http://localhost:${PORT}/customer
    🔐 Admin Login: http://localhost:${PORT}/admin/login.html
    
    Ready to serve! ☕
    `);
  });
}

startServer();
