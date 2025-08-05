// index.js
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Initialize Firebase Admin SDK
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || require('./serviceAccountKey.json'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://apartment-34739.firebaseio.com'
});

const db = admin.firestore();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.'))); // Serve static files (e.g., apartment.html)

// API Endpoints
// Get all apartments
app.get('/api/flats', async (req, res) => {
  try {
    const { offerType, flatType, minPrice, maxPrice, sortBy } = req.query;
    let query = db.collection('flats');

    if (offerType && offerType !== 'all') {
      query = query.where('offerType', '==', offerType);
    }
    if (flatType && flatType !== 'all') {
      query = query.where('type', '==', flatType);
    }
    if (minPrice) {
      query = query.where('price', '>=', parseFloat(minPrice));
    }
    if (maxPrice) {
      query = query.where('price', '<=', parseFloat(maxPrice));
    }
    if (sortBy) {
      const [field, direction] = sortBy.includes('-') ? sortBy.split('-') : [sortBy, 'asc'];
      query = query.orderBy(field, direction);
    }

    const snapshot = await query.get();
    const flats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(flats);
  } catch (error) {
    console.error('Error fetching flats:', error);
    res.status(500).json({ error: 'Failed to fetch apartments' });
  }
});

// Get single apartment by ID
app.get('/api/flats/:id', async (req, res) => {
  try {
    const flatDoc = await db.collection('flats').doc(req.params.id).get();
    if (!flatDoc.exists) {
      return res.status(404).json({ error: 'Apartment not found' });
    }
    res.status(200).json({ id: flatDoc.id, ...flatDoc.data() });
  } catch (error) {
    console.error('Error fetching flat:', error);
    res.status(500).json({ error: 'Failed to fetch apartment' });
  }
});

// Submit inquiry
app.post('/api/inquiries', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    await db.collection('inquiries').add({
      name,
      email,
      message,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    res.status(201).json({ message: 'Inquiry submitted successfully' });
  } catch (error) {
    console.error('Error submitting inquiry:', error);
    res.status(500).json({ error: 'Failed to submit inquiry' });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'apartment.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
