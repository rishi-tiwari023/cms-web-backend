const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(bodyParser.json());

let users = [];
let cases = [];
let progress = [];

function findUserByCredentials(username, password) {
	return users.find(user => user.username === username && user.password === password);
}
function findUserById(userId) {
	return users.find(user => user.id === userId);
}
function getCasesByUserId(userId) {
	return cases.filter(caseItem => caseItem.assignedTo === userId);
}
function getProgressByUserId(userId) {
	return progress.filter(progressItem => progressItem.userId === userId);
}

app.get('/api/', (req, res) => {
	res.json({ message: 'CMS Web Backend API', version: '1.0.0' });
});
app.get('/api/health', (req, res) => {
	res.json({ status: 'healthy', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

app.post('/api/users/login', (req, res) => {
	const { username, password } = req.body;
	const user = findUserByCredentials(username, password);
	if (user) {
		res.json({ user, token: 'mock-jwt-' + Date.now(), expiresAt: Date.now() + 86400000 });
	} else {
		res.status(401).json({ error: 'Invalid credentials' });
	}
});
app.get('/api/users', (req, res) => { res.json(users); });
app.get('/api/users/:userId', (req, res) => {
	const user = findUserById(req.params.userId);
	if (user) res.json(user); else res.status(404).json({ error: 'User not found' });
});
app.post('/api/users', (req, res) => {
	const user = { id: uuidv4(), ...req.body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
	users.push(user);
	res.json(user);
});

app.get('/api/cases/user/:userId', (req, res) => { res.json(getCasesByUserId(req.params.userId)); });
app.get('/api/cases', (req, res) => { res.json(cases); });
app.get('/api/cases/:caseId', (req, res) => {
	const caseItem = cases.find(c => c.id === req.params.caseId);
	if (caseItem) res.json(caseItem); else res.status(404).json({ error: 'Case not found' });
});
app.post('/api/cases', (req, res) => {
	const caseItem = { id: uuidv4(), ...req.body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
	cases.push(caseItem);
	res.json(caseItem);
});
app.put('/api/cases/:caseId', (req, res) => {
	const caseIndex = cases.findIndex(c => c.id === req.params.caseId);
	if (caseIndex !== -1) {
		cases[caseIndex] = { ...cases[caseIndex], ...req.body, updatedAt: new Date().toISOString() };
		res.json(cases[caseIndex]);
	} else {
		res.status(404).json({ error: 'Case not found' });
	}
});

app.get('/api/progress', (req, res) => { res.json(progress); });
app.get('/api/progress/user/:userId', (req, res) => { res.json(getProgressByUserId(req.params.userId)); });
app.get('/api/progress/case/:caseId', (req, res) => { res.json(progress.filter(p => p.caseId === req.params.caseId)); });
app.post('/api/progress', (req, res) => {
	const progressItem = { id: uuidv4(), ...req.body, createdAt: new Date().toISOString() };
	progress.push(progressItem);
	res.json(progressItem);
});

app.get('/api/sync', (req, res) => {
	res.json({ status: 'ready', message: 'Sync service is available' });
});
app.post('/api/sync/upload', (req, res) => {
	const { data } = req.body;
	if (data && data.cases) {
		data.cases.forEach(caseItem => {
			const existingIndex = cases.findIndex(c => c.id === caseItem.id);
			if (existingIndex !== -1) cases[existingIndex] = caseItem; else cases.push(caseItem);
		});
	}
	if (data && data.progress) {
		data.progress.forEach(progressItem => {
			const existingIndex = progress.findIndex(p => p.id === progressItem.id);
			if (existingIndex !== -1) progress[existingIndex] = progressItem; else progress.push(progressItem);
		});
	}
	res.json({ success: true, message: 'Data uploaded', lastSync: Date.now(), conflicts: [] });
});
app.post('/api/sync/download', (req, res) => {
	const { userId } = req.body;
	res.json({ success: true, message: 'Data downloaded', lastSync: Date.now(), data: { cases: getCasesByUserId(userId), progress: getProgressByUserId(userId) } });
});
app.get('/api/updates/:userId', (req, res) => {
	const { userId } = req.params;
	const lastSync = parseInt(req.query.lastSync) || 0;
	const recentCases = cases.filter(c => c.assignedTo === userId && new Date(c.updatedAt).getTime() > lastSync);
	const recentProgress = progress.filter(p => p.userId === userId && new Date(p.createdAt).getTime() > lastSync);
	const updates = [
		...recentCases.map(c => ({ id: c.id, type: 'case', action: 'UPDATE', data: c, timestamp: new Date(c.updatedAt).getTime() })),
		...recentProgress.map(p => ({ id: p.id, type: 'progress', action: 'CREATE', data: p, timestamp: new Date(p.createdAt).getTime() }))
	];
	res.json({ hasUpdates: updates.length > 0, updates, lastSync: Date.now() });
});

function initializeSampleData() {
	users = [
		{ id: 'admin-1', username: 'admin', password: 'admin123', role: 'ADMIN', name: 'Admin User', email: 'admin@cms.com', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
		{ id: 'student-1', username: 'pranjal', password: 'pranjal123', role: 'STUDENT', name: 'Pranjal Patel', email: 'pranjal@student.com', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
		{ id: 'student-2', username: 'rishi', password: 'rishi123', role: 'STUDENT', name: 'Rishi Tiwari', email: 'rishi@student.com', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
	];
	cases = [
		{ id: 'case-rishi-1', title: "Rishi's Research Project", description: 'Conduct research on mobile app development trends', status: 'ASSIGNED', assignedTo: 'student-2', createdBy: 'admin-1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), progressPercentage: 60, documentStatus: 'UPLOADED' },
		{ id: 'case-rishi-2', title: "Rishi's Data Analysis", description: 'Analyze user behavior data and create reports', status: 'OPEN', assignedTo: 'student-2', createdBy: 'admin-1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), progressPercentage: 30, documentStatus: 'NOT_UPLOADED' },
		{ id: 'case-rishi-3', title: "Rishi's Mobile App", description: 'Develop a cross-platform mobile application', status: 'CLOSED', assignedTo: 'student-2', createdBy: 'admin-1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), progressPercentage: 100, documentStatus: 'APPROVED' }
	];
	console.log('Sample data initialized');
}

app.listen(PORT, '0.0.0.0', () => {
	console.log(`CMS Web Backend running on port ${PORT}`);
	initializeSampleData();
});
