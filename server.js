const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(bodyParser.json());

// Frontend now reads directly from Firestore. This server exposes only health and base routes.

app.get('/api/', (req, res) => {
	res.json({ message: 'CMS Web Backend API', version: '1.0.0' });
});
app.get('/api/health', (req, res) => {
	res.json({ status: 'healthy', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// Deprecate all prior API endpoints now that frontend reads Firestore directly
app.all('/api/*', (req, res) => {
	res.status(410).json({ error: 'Deprecated: Frontend now reads directly from Firestore' });
});

app.listen(PORT, '0.0.0.0', () => {
	console.log(`CMS Web Backend running on port ${PORT}`);
});
