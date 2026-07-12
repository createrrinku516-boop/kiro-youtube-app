const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, '../data/db.json');

let dbCache = null;

const initDb = () => {
  if (!fs.existsSync(path.dirname(FILE_PATH))) {
    fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  }
  if (!fs.existsSync(FILE_PATH)) {
    fs.writeFileSync(FILE_PATH, JSON.stringify({ videos: {}, comments: {} }, null, 2));
  }
};

const readDb = () => {
  initDb();
  try {
    const data = fs.readFileSync(FILE_PATH, 'utf8');
    dbCache = JSON.parse(data);
    return dbCache;
  } catch (err) {
    return dbCache || { videos: {}, comments: {} };
  }
};

const writeDb = (data) => {
  dbCache = data;
  initDb();
  const tempPath = FILE_PATH + '.tmp';
  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
    fs.renameSync(tempPath, FILE_PATH);
  } catch (err) {
    console.error('[DB] Error writing to db.json:', err.message);
  }
};

module.exports = {
  readDb,
  writeDb
};
