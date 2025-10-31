const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const Razorpay = require('razorpay');
const AWS = require('aws-sdk');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

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
        const initialData = key === 'menu' ? getSampleMenu() : [];
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
    return [];
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

// Helper: Get from AWS DynamoDB
async function getFromAWS(tableName, key) {
  try {
    const params = {
      TableName: tableName,
      Key: key
    };
    const result = await dynamoDB.get(params).promise();
    return result.Item || null;
  } catch (error) {
    console.error(`Error getting from AWS ${tableName}:`, error.message);
    return null;
  }
}

// Helper: Scan AWS table
async function scanAWS(tableName) {
  try {
    const params = { TableName: tableName };
    const result = await dynamoDB.scan(params).promise();
    return result.Items || [];
  } catch (error) {
    console.error(`Error scanning AWS ${tableName}:`, error.message);
    return [];
  }
}

// Helper: Generate OTP
function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

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
function getOTPEmailTemplate(name, otp) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { background: white; max-width: 600px; margin: 0 auto; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .logo { text-align: center; font-size: 32px; color: #6B4423; margin-bottom: 20px; }
        .otp { font-size: 36px; font-weight: bold; color: #6B4423; text-align: center; background: #FFF8DC; padding: 20px; border-radius: 8px; margin: 30px 0; }
        .footer { text-align: center; color: #666; margin-top: 30px; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">☕ BeanBox Café</div>
        <h2>Hello ${name}!</h2>
        <p>Your verification code is:</p>
        <div class="otp">${otp}</div>
        <p>This code will expire in 5 minutes.</p>
        <p>If you didn't request this code, please ignore this email.</p>
        <div class="footer">
          <p>— BeanBox Café Team</p>
          <p>Scan. Verify. Order. Sip.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function getOrderEmailTemplate(name, orderId, status, otp) {
  const statusText = status === 'accepted' ? 'has been accepted' : 'is ready for pickup';
  const statusEmoji = status === 'accepted' ? '🟡' : '🟢';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { background: white; max-width: 600px; margin: 0 auto; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .logo { text-align: center; font-size: 32px; color: #6B4423; margin-bottom: 20px; }
        .status { text-align: center; font-size: 24px; margin: 20px 0; }
        .order-info { background: #FFF8DC; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .otp { font-size: 28px; font-weight: bold; color: #6B4423; text-align: center; margin: 15px 0; }
        .footer { text-align: center; color: #666; margin-top: 30px; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">☕ BeanBox Café</div>
        <h2>Hello ${name}!</h2>
        <div class="status">${statusEmoji} Your order ${statusText}!</div>
        <div class="order-info">
          <p><strong>Order ID:</strong> #${orderId}</p>
          <p><strong>Pickup OTP:</strong></p>
          <div class="otp">${otp}</div>
          <p style="text-align: center; color: #666; font-size: 14px;">Show this OTP when picking up your order</p>
        </div>
        <div class="footer">
          <p>— BeanBox Café Team</p>
          <p>Scan. Verify. Order. Sip.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Sample menu data
function getSampleMenu() {
  return [
    { id: '1', name: 'Cappuccino', category: 'Coffee', price: 120, image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400', isVeg: true, available: true },
    { id: '2', name: 'Latte', category: 'Coffee', price: 130, image: 'https://images.unsplash.com/photo-1561882468-9110e03e0f78?w=400', isVeg: true, available: true },
    { id: '3', name: 'Espresso', category: 'Coffee', price: 100, image: 'https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=400', isVeg: true, available: true },
    { id: '4', name: 'Croissant', category: 'Snacks', price: 80, image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400', isVeg: true, available: true },
    { id: '5', name: 'Chocolate Cake', category: 'Desserts', price: 150, image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400', isVeg: true, available: true },
    { id: '6', name: 'Cold Brew', category: 'Drinks', price: 140, image: 'https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=400', isVeg: true, available: true }
  ];
}

// ==================== API ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'BeanBox Café API is running' });
});

// Send OTP
app.post('/api/send-otp', async (req, res) => {
  try {
    const { name, phone, email } = req.body;
    
    if (!name || !phone || !email) {
      return res.status(400).json({ error: 'Name, phone, and email are required' });
    }
    
    const otp = generateOTP();
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
    
    const user = {
      id: userId,
      name,
      phone,
      email,
      otp,
      expiresAt,
      verified: false,
      createdAt: new Date().toISOString()
    };
    
    // Save to local JSON
    const users = await readJSON(FILES.users);
    users.push(user);
    await writeJSON(FILES.users, users);
    
    // Sync to AWS
    await syncToAWS('beanbox_users', user);
    
    // Send OTP via email
    await sendEmail(email, 'Your BeanBox Café Verification Code', getOTPEmailTemplate(name, otp));
    
    res.json({ 
      success: true, 
      message: 'OTP sent successfully',
      userId 
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Verify OTP
app.post('/api/verify-otp', async (req, res) => {
  try {
    const { userId, otp } = req.body;
    
    if (!userId || !otp) {
      return res.status(400).json({ error: 'User ID and OTP are required' });
    }
    
    // Read from local JSON
    const users = await readJSON(FILES.users);
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }
    
    if (Date.now() > user.expiresAt) {
      return res.status(400).json({ error: 'OTP expired' });
    }
    
    // Mark as verified
    user.verified = true;
    user.verifiedAt = new Date().toISOString();
    await writeJSON(FILES.users, users);
    
    // Sync to AWS
    await syncToAWS('beanbox_users', user);
    
    res.json({ 
      success: true, 
      message: 'OTP verified successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
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
    const { userId, items, total, paymentType, paymentId } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Items are required' });
    }
    
    // Get user details
    const users = await readJSON(FILES.users);
    const user = users.find(u => u.id === userId);
    
    if (!user && paymentType === 'online') {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Generate order
    const orders = await readJSON(FILES.orders);
    const orderId = orders.length + 1;
    const pickupOTP = generateOTP();
    
    const order = {
      id: orderId.toString(),
      orderId,
      userId: userId || 'walk-in',
      customerName: user ? user.name : req.body.customerName || 'Walk-in Customer',
      customerEmail: user ? user.email : '',
      customerPhone: user ? user.phone : '',
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
    
    // Send confirmation email if online order
    if (paymentType === 'online' && user) {
      await sendEmail(
        user.email,
        'Order Confirmed - BeanBox Café',
        getOrderEmailTemplate(user.name, orderId, 'accepted', pickupOTP)
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
      await sendEmail(
        order.customerEmail,
        `Order ${status === 'accepted' ? 'Accepted' : 'Ready'} - BeanBox Café`,
        getOrderEmailTemplate(order.customerName, order.orderId, status, order.pickupOTP)
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
    🧠 Admin Dashboard: http://localhost:${PORT}/admin
    
    Ready to serve! ☕
    `);
  });
}

startServer();
