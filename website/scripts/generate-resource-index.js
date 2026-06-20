const fs = require('fs');
const path = require('path');

const RESOURCE_DIR = path.resolve(__dirname, '..', 'data', 'link');
const OUTPUT_FILE = path.join(RESOURCE_DIR, '_files.json');

function isResourceFile(fileName) {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.json')
    && !lower.startsWith('_')
    && !lower.startsWith('.')
    && lower !== 'index.json';
}

if (!fs.existsSync(RESOURCE_DIR)) {
  throw new Error(`Resource directory not found: ${RESOURCE_DIR}`);
}

const files = fs.readdirSync(RESOURCE_DIR)
  .filter(isResourceFile)
  .sort((a, b) => a.localeCompare(b));

fs.writeFileSync(
  OUTPUT_FILE,
  JSON.stringify({ generated: true, files }, null, 2) + '\n',
  'utf8'
);

console.log(`Generated ${path.relative(process.cwd(), OUTPUT_FILE)} with ${files.length} files.`);
