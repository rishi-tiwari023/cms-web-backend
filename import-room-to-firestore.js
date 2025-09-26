// Usage:
// 1) Place your Google service account JSON at backend/serviceAccountKey.json
// 2) Export your Room DB to JSON with arrays: users[], cases[], progress[]
// 3) Run: node import-room-to-firestore.js ./room-export.json

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.resolve(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
	console.error('Missing serviceAccountKey.json in backend/.');
	process.exit(1);
}

admin.initializeApp({
	credential: admin.credential.cert(require(serviceAccountPath)),
});

const db = admin.firestore();

async function importCollection(collName, items, idField = 'id') {
	if (!Array.isArray(items)) return;
	console.log(`Importing ${items.length} docs into ${collName} ...`);
	const batchSize = 400;
	for (let i = 0; i < items.length; i += batchSize) {
		const slice = items.slice(i, i + batchSize);
		const batch = db.batch();
		slice.forEach((item) => {
			const docId = item[idField] ? String(item[idField]) : undefined;
			const ref = docId ? db.collection(collName).doc(docId) : db.collection(collName).doc();
			batch.set(ref, sanitize(item));
		});
		await batch.commit();
		console.log(`  committed ${Math.min(i + batchSize, items.length)}/${items.length}`);
	}
}

function sanitize(obj) {
	// Convert any dates/longs to Firestore-friendly types if needed.
	// Here we just ensure plain JSON values.
	return JSON.parse(JSON.stringify(obj));
}

async function main() {
	const inputPath = process.argv[2];
	if (!inputPath) {
		console.error('Usage: node import-room-to-firestore.js <room-export.json>');
		process.exit(1);
	}
	const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
	await importCollection('users', data.users || [], 'id');
	await importCollection('cases', data.cases || [], 'id');
	await importCollection('progress', data.progress || [], 'id');
	console.log('✅ Import complete. Check Firestore Console.');
	process.exit(0);
}

main().catch((e) => {
	console.error('Import failed:', e);
	process.exit(1);
});
