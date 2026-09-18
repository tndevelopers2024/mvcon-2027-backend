# MVCON 2027 Backend Service

Backend service for the **MVCON 2027** conference registration and attendee management system, built with **Node.js**, **Express**, and **MongoDB (Mongoose)**.

---

## 🛠️ Features

- **Attendee Registration**: Full 3-step registration flow support matching the MVCON conference form (Personal Details, Professional Profile, Location & Billing).
- **MongoDB & Mongoose Schema**: Strongly-typed model with email uniqueness, automatic conference registration ID generation (`MVC27-XXXX`), and optional password hashing with `bcryptjs`.
- **Photo Upload Support**: Built-in file upload with `multer` supporting JPG, PNG, WEBP, and GIF under 2MB.
- **RESTful API**: Standardized JSON responses with error handling and HTTP status codes.
- **CORS Configured**: Ready to communicate with the Next.js frontend running on `http://localhost:3000`.

---

## 📁 Project Structure

```
backend/
├── package.json
├── .env.example
├── .env
├── .gitignore
├── README.md
├── uploads/                        # Uploaded profile photos
└── src/
    ├── config/
    │   └── db.js                   # Mongoose connection logic
    ├── models/
    │   └── Registration.js         # Mongoose schema for attendee registration
    ├── controllers/
    │   └── registrationController.js# Registration business logic & validation
    ├── routes/
    │   └── registrationRoutes.js   # Express routing for /api/register
    ├── middleware/
    │   ├── upload.js               # Multer image upload handler
    │   └── errorHandler.js         # Centralized error handler
    └── server.js                   # Express server startup
```

---

## 🚀 Getting Started

### 1. Install Dependencies

Navigate to the `backend/` directory:

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Edit or create the `.env` file (copied from `.env.example`):

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/mvcon2027
CLIENT_URL=http://localhost:3000
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=7d
```

> **Note on MongoDB**:
> - **Local MongoDB**: Make sure MongoDB service is running on your machine (default port `27017`).
> - **MongoDB Atlas**: Replace `MONGODB_URI` with your connection string from MongoDB Atlas:
>   `mongodb+srv://<username>:<password>@cluster0.mongodb.net/mvcon2027?retryWrites=true&w=majority`

### 3. Run the Backend

- **Development mode (auto-reload on change)**:
  ```bash
  npm run dev
  ```

- **Production mode**:
  ```bash
  npm start
  ```

The server will start at: `http://localhost:5000`

---

## 📡 API Endpoints

### 1. Health Check
- **Endpoint**: `GET /api/health`
- **Description**: Returns the server status and MongoDB connection state.
- **Sample Response**:
  ```json
  {
    "status": "online",
    "service": "MVCON 2027 Registration API",
    "database": "connected",
    "timestamp": "2026-09-08T05:30:00.000Z"
  }
  ```

### 2. Register Attendee
- **Endpoint**: `POST /api/register`
- **Content-Type**: `multipart/form-data` or `application/json`
- **Fields**:
  - `fullName` *(String, required)*
  - `institution` *(String, required)*
  - `email` *(String, required)*
  - `phone` *(String, required)*
  - `profession` *(String, required - 'PG' | 'Consultant' | 'Student' | 'Other')*
  - `designation` *(String, required)*
  - `stateMedicalCouncilNumber` *(String, required)*
  - `city` *(String, required)*
  - `state` *(String, required)*
  - `couponCode` *(String, optional)*
  - `password` *(String, optional)*
  - `profilePhoto` *(File or String URL, optional)*
- **Sample Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Registration successful! Welcome to MVCON 2027.",
    "registrationId": "MVC27-8912A3B",
    "data": {
      "_id": "66dd8f7e9b1...",
      "registrationId": "MVC27-8912A3B",
      "fullName": "Dr. Sarah Jenkins",
      "email": "sarah.j@example.com",
      "phone": "+91 9876543210",
      "institution": "Apollo Hospital",
      "profession": "Consultant",
      "designation": "Chief of Surgery",
      "stateMedicalCouncilNumber": "TNMC/2019/45821",
      "city": "Chennai",
      "state": "Tamil Nadu",
      "paymentStatus": "pending",
      "registrationStatus": "pending",
      "createdAt": "2026-09-08T05:30:00.000Z"
    },
    "token": "eyJhbGciOi..."
  }
  ```

### 3. Get All Registrations
- **Endpoint**: `GET /api/register`
- **Query Parameters**:
  - `search`: search by name, email, registrationId, institution
  - `profession`: filter by profession (`Consultant`, `PG`, etc.)
  - `status`: filter by status (`pending`, `confirmed`)

### 4. Get Registration by ID
- **Endpoint**: `GET /api/register/:id`
- **Description**: Fetch registration details by Mongo ObjectId or unique `registrationId`.
