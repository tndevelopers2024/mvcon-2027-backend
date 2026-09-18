const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mvcon2027');
    console.log(`✅ MongoDB Connected: ${conn.connection.host} (Database: ${conn.connection.name})`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.warn(`⚠️  Please ensure MongoDB is running locally or provide a valid MONGODB_URI (e.g. MongoDB Atlas) in .env`);
  }
};

module.exports = connectDB;
