// Usage:
// node generate-seed-from-kotlin.js <path/to/DatabaseInitializer.kt> [output.json]
// Defaults output to backend/seed-room-export.json

const fs = require('fs');
const path = require('path');

function lastEnumToken(token) {
  if (!token) return token;
  const parts = String(token).split('.');
  return parts[parts.length - 1];
}

function parseKotlinDate(expr) {
  if (!expr) return new Date();
  const trimmed = String(expr).trim();
  if (trimmed === '') return new Date();
  try {
    let jsExpr = trimmed
      .replace(/System\.currentTimeMillis\(\)/g, 'Date.now()')
      .replace(/L\b/g, '');
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

function parseKotlinSeedFile(kotlinFilePath) {
  const content = fs.readFileSync(kotlinFilePath, 'utf8');
  const users = [];
  const cases = [];
  const progress = [];

  const normalized = content.replace(/\r\n/g, '\n');

  const userRegex = /User\s*\(\s*([^)]*)\)/g;
  for (const match of normalized.matchAll(userRegex)) {
    const args = match[1];
    const get = (r) => {
      const m = args.match(r);
      return m ? m[1] : undefined;
    };
    const user = {
      id: get(/\bid\s*=\s*"([^"]*)"/),
      username: get(/\busername\s*=\s*"([^"]*)"/),
      password: get(/\bpassword\s*=\s*"([^"]*)"/),
      role: lastEnumToken(get(/\brole\s*=\s*([A-Za-z0-9_.]+)/)),
      name: get(/\bname\s*=\s*"([^"]*)"/),
      email: get(/\bemail\s*=\s*"([^"]*)"/),
      createdAt: new Date().toISOString(),
    };
    if (user.id && user.username) users.push(user);
  }

  const caseRegex = /CaseEntity\s*\(\s*([^)]*)\)/g;
  for (const match of normalized.matchAll(caseRegex)) {
    const args = match[1];
    const get = (r) => {
      const m = args.match(r);
      return m ? m[1] : undefined;
    };
    const caseDoc = {
      id: get(/\bid\s*=\s*"([^"]*)"/),
      title: get(/\btitle\s*=\s*"([^"]*)"/),
      description: get(/\bdescription\s*=\s*"([^"]*)"/),
      status: lastEnumToken(get(/\bstatus\s*=\s*([A-Za-z0-9_.]+)/)),
      assignedTo: get(/\bassignedTo\s*=\s*"([^"]*)"/),
      createdBy: get(/\bcreatedBy\s*=\s*"([^"]*)"/),
      createdAt: (() => {
        const inner = get(/\bcreatedAt\s*=\s*(Date\s*\([^)]*\))/);
        const m = inner ? inner.match(/Date\s*\(([^)]*)\)/) : null;
        return (m ? parseKotlinDate(m[1]) : new Date()).toISOString();
      })(),
      updatedAt: (() => {
        const inner = get(/\bupdatedAt\s*=\s*(Date\s*\([^)]*\))/);
        const m = inner ? inner.match(/Date\s*\(([^)]*)\)/) : null;
        return (m ? parseKotlinDate(m[1]) : new Date()).toISOString();
      })(),
      progressPercentage: Number(get(/\bprogressPercentage\s*=\s*([0-9]+)/) || 0),
      documentStatus: lastEnumToken(get(/\bdocumentStatus\s*=\s*([A-Za-z0-9_.]+)/)) || 'NOT_UPLOADED',
    };
    if (caseDoc.id && caseDoc.title) cases.push(caseDoc);
  }

  const progressRegex = /Progress\s*\(\s*([^)]*)\)/g;
  for (const match of normalized.matchAll(progressRegex)) {
    const args = match[1];
    const get = (r) => {
      const m = args.match(r);
      return m ? m[1] : undefined;
    };
    const p = {
      id: get(/\bid\s*=\s*"([^"]*)"/),
      userId: get(/\buserId\s*=\s*"([^"]*)"/),
      caseId: get(/\bcaseId\s*=\s*"([^"]*)"/),
      progressPercentage: Number(get(/\bprogressPercentage\s*=\s*([0-9]+)/) || 0),
      notes: get(/\bnotes\s*=\s*"([^"]*)"/),
      updatedAt: (() => {
        const inner = get(/\bupdatedAt\s*=\s*(Date\s*\([^)]*\))/);
        const m = inner ? inner.match(/Date\s*\(([^)]*)\)/) : null;
        return (m ? parseKotlinDate(m[1]) : new Date()).toISOString();
      })(),
    };
    if (p.id && p.userId && p.caseId) progress.push(p);
  }

  return { users, cases, progress };
}

function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3] || path.resolve(__dirname, 'seed-room-export.json');
  if (!inputPath) {
    console.error('Usage: node generate-seed-from-kotlin.js <DatabaseInitializer.kt> [output.json]');
    process.exit(1);
  }
  const data = parseKotlinSeedFile(inputPath);
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`✅ Seed written: ${outputPath}`);
}

main();


