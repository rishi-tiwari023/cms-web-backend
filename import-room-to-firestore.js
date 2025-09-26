// Usage:
// 1) Place your Google service account JSON at backend/serviceAccountKey.json
// 2a) Export your Room DB to JSON with arrays: users[], cases[], progress[]
//     Run: node import-room-to-firestore.js ./room-export.json
// 2b) OR provide the Kotlin seed file from Android app (DatabaseInitializer.kt)
//     Run: node import-room-to-firestore.js C:/DevProjects/cms/app/src/main/java/com/example/cms/data/DatabaseInitializer.kt

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Resolve credentials path in this precedence order:
// 1) CLI arg #2 (optional): node import-room-to-firestore.js <input> <serviceAccount.json>
// 2) GOOGLE_APPLICATION_CREDENTIALS environment variable
// 3) backend/serviceAccountKey.json (default)
const cliCreds = process.argv[3];
const envCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const defaultCreds = path.resolve(__dirname, 'serviceAccountKey.json');
const serviceAccountPath = cliCreds || envCreds || defaultCreds;

if (!fs.existsSync(serviceAccountPath)) {
    console.error('Missing Firebase service account JSON. Provide one of:');
    console.error(' - Place file at backend/serviceAccountKey.json');
    console.error(' - Set env var GOOGLE_APPLICATION_CREDENTIALS to the JSON path');
    console.error(' - Pass as second CLI arg: node import-room-to-firestore.js <input> <serviceAccount.json>');
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
});

const db = admin.firestore();

function lastEnumToken(token) {
    if (!token) return token;
    const parts = String(token).split('.');
    return parts[parts.length - 1];
}

function parseKotlinDate(expr) {
    // Handles: Date() or Date(System.currentTimeMillis() - 7 * 24 * 60 * 60 * 1000L)
    if (!expr) return new Date();
    const trimmed = String(expr).trim();
    if (trimmed === '') return new Date();
    try {
        // Replace Kotlin millis call and long suffix
        let jsExpr = trimmed
            .replace(/System\.currentTimeMillis\(\)/g, 'Date.now()')
            .replace(/L\b/g, '');
        // Whitelist basic characters to avoid arbitrary code execution
        if (!/^[0-9\s+\-*/().DateNow:]+$/i.test(jsExpr.replace(/Date\.now\(\)/g, 'DateNow'))) {
            return new Date();
        }
        // eslint-disable-next-line no-eval
        const ms = eval(jsExpr);
        if (Number.isFinite(ms)) return new Date(ms);
        return new Date();
    } catch {
        return new Date();
    }
}

function reviveDatesDeep(value) {
    if (Array.isArray(value)) {
        return value.map(reviveDatesDeep);
    }
    if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            if ((k === 'createdAt' || k === 'updatedAt') && typeof v === 'string') {
                const d = new Date(v);
                out[k] = isNaN(d.getTime()) ? v : d;
            } else {
                out[k] = reviveDatesDeep(v);
            }
        }
        return out;
    }
    return value;
}

function parseKotlinSeedFile(kotlinFilePath) {
    const content = fs.readFileSync(kotlinFilePath, 'utf8');
    const users = [];
    const cases = [];
    const progress = [];

    // Normalize content to simplify regex across multiple lines
    const normalized = content
        .replace(/\r\n/g, '\n');

    // Users: val <var> = User( id = "..", username = "..", password = "..", role = UserRole.ADMIN, name = "..", email = ".." )
    const userRegex = /User\s*\(\s*([^)]*)\)/g;
    for (const match of normalized.matchAll(userRegex)) {
        const args = match[1];
        const get = (name, r) => {
            const m = args.match(r);
            return m ? m[1] : undefined;
        };
        const user = {
            id: get('id', /\bid\s*=\s*"([^"]*)"/),
            username: get('username', /\busername\s*=\s*"([^"]*)"/),
            password: get('password', /\bpassword\s*=\s*"([^"]*)"/),
            role: lastEnumToken(get('role', /\brole\s*=\s*([A-Za-z0-9_.]+)/)),
            name: get('name', /\bname\s*=\s*"([^"]*)"/),
            email: get('email', /\bemail\s*=\s*"([^"]*)"/),
            createdAt: new Date().toISOString(),
        };
        if (user.id && user.username) {
            users.push(user);
        }
    }

    // Cases: CaseEntity( id="..", title="..", description="..", status=CaseStatus.ASSIGNED, assignedTo="..", createdBy="..", createdAt=Date(...), updatedAt=Date(...), progressPercentage=35, documentStatus=DocumentStatus.UPLOADED )
    const caseRegex = /CaseEntity\s*\(\s*([^)]*)\)/g;
    for (const match of normalized.matchAll(caseRegex)) {
        const args = match[1];
        const getStr = (r) => {
            const m = args.match(r);
            return m ? m[1] : undefined;
        };
        const getEnum = (r) => lastEnumToken(getStr(r));
        const getNum = (r) => {
            const v = getStr(r);
            return v ? Number(v) : undefined;
        };
        const getDateIso = (r) => {
            const inner = getStr(r);
            if (!inner) return undefined;
            const m = inner.match(/Date\s*\(([^)]*)\)/);
            const d = parseKotlinDate(m ? m[1] : '');
            return d.toISOString();
        };
        const caseDoc = {
            id: getStr(/\bid\s*=\s*"([^"]*)"/),
            title: getStr(/\btitle\s*=\s*"([^"]*)"/),
            description: getStr(/\bdescription\s*=\s*"([^"]*)"/),
            status: getEnum(/\bstatus\s*=\s*([A-Za-z0-9_.]+)/),
            assignedTo: getStr(/\bassignedTo\s*=\s*"([^"]*)"/),
            createdBy: getStr(/\bcreatedBy\s*=\s*"([^"]*)"/),
            createdAt: getDateIso(/\bcreatedAt\s*=\s*(Date\s*\([^)]*\))/),
            updatedAt: getDateIso(/\bupdatedAt\s*=\s*(Date\s*\([^)]*\))/),
            progressPercentage: getNum(/\bprogressPercentage\s*=\s*([0-9]+)/) || 0,
            documentStatus: getEnum(/\bdocumentStatus\s*=\s*([A-Za-z0-9_.]+)/) || 'NOT_UPLOADED',
        };
        if (caseDoc.id && caseDoc.title) {
            cases.push(caseDoc);
        }
    }

    // Progress: Progress( id="..", userId="..", caseId="..", progressPercentage=.., notes="..", updatedAt=Date(...) )
    const progressRegex = /Progress\s*\(\s*([^)]*)\)/g;
    for (const match of normalized.matchAll(progressRegex)) {
        const args = match[1];
        const getStr = (r) => {
            const m = args.match(r);
            return m ? m[1] : undefined;
        };
        const getNum = (r) => {
            const v = getStr(r);
            return v ? Number(v) : undefined;
        };
        const getDateIso = (r) => {
            const inner = getStr(r);
            if (!inner) return undefined;
            const m = inner.match(/Date\s*\(([^)]*)\)/);
            const d = parseKotlinDate(m ? m[1] : '');
            return d.toISOString();
        };
        const p = {
            id: getStr(/\bid\s*=\s*"([^"]*)"/),
            userId: getStr(/\buserId\s*=\s*"([^"]*)"/),
            caseId: getStr(/\bcaseId\s*=\s*"([^"]*)"/),
            progressPercentage: getNum(/\bprogressPercentage\s*=\s*([0-9]+)/) || 0,
            notes: getStr(/\bnotes\s*=\s*"([^"]*)"/),
            updatedAt: getDateIso(/\bupdatedAt\s*=\s*(Date\s*\([^)]*\))/),
        };
        if (p.id && p.userId && p.caseId) {
            progress.push(p);
        }
    }

    return { users, cases, progress };
}

async function importCollection(collName, items, idField = 'id') {
    if (!Array.isArray(items)) return;
    // Deduplicate by id
    const seen = new Set();
    const unique = [];
    for (const it of items) {
        const id = it && it[idField];
        const key = id ? String(id) : Symbol();
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(it);
        }
    }
    console.log(`Importing ${unique.length} docs into ${collName} ...`);
	const batchSize = 400;
    for (let i = 0; i < unique.length; i += batchSize) {
        const slice = unique.slice(i, i + batchSize);
		const batch = db.batch();
		slice.forEach((item) => {
			const docId = item[idField] ? String(item[idField]) : undefined;
			const ref = docId ? db.collection(collName).doc(docId) : db.collection(collName).doc();
            batch.set(ref, sanitize(reviveDatesDeep(item)));
		});
		await batch.commit();
        console.log(`  committed ${Math.min(i + batchSize, unique.length)}/${unique.length}`);
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
        console.error('Usage: node import-room-to-firestore.js <room-export.json | DatabaseInitializer.kt>');
		process.exit(1);
	}
    let data;
    if (inputPath.endsWith('.kt')) {
        console.log('Parsing Kotlin seed file ...');
        data = parseKotlinSeedFile(inputPath);
    } else {
        data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    }
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
