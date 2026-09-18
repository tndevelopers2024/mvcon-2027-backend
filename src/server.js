const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config();

// Connect to MongoDB
const connectDB = require('./config/db');
connectDB();

// Initialize express app
const app = express();

// Enable Cross-Origin Resource Sharing (CORS)
const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
app.use(
  cors({
    origin: [clientUrl, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  })
);

// Body parser middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    status: 'online',
    service: 'MVCON 2027 Registration API',
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

// Root API information
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to the MVCON 2027 Backend API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      register: 'POST /api/register',
      listRegistrations: 'GET /api/register',
      getRegistration: 'GET /api/register/:id',
    },
  });
});

// Mount Routes
const registrationRoutes = require('./routes/registrationRoutes');
const authRoutes = require('./routes/authRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const abstractRoutes = require('./routes/abstractRoutes');

app.use('/api/register', registrationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/abstracts', abstractRoutes);

// Centralized error handling
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// Start Server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 MVCON 2027 Backend running on http://localhost:${PORT}`);
  console.log(`📋 API Documentation: http://localhost:${PORT}/`);
  console.log(`🩺 Health Check: http://localhost:${PORT}/api/health`);
});

module.exports = { app, server };
