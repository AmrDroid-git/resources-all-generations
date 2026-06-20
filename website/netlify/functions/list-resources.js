const fs = require('fs');
const path = require('path');

const IGNORED_FILES = new Set(['about.json', 'config.json', 'i18n.json', 'index.json']);

function findResourceDirectory() {
  const candidates = [
    path.join(process.cwd(), 'data', 'link'),
    path.join(__dirname, '..', '..', 'data', 'link'),
    path.join(__dirname, 'data', 'link')
  ];

  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isDirectory());
}

exports.handler = async function handler() {
  try {
    const directory = findResourceDirectory();

    if (!directory) {
      return {
        statusCode: 500,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          error: 'Resource directory not found',
          expected: 'data/link/*.json'
        })
      };
    }

    const files = fs.readdirSync(directory)
      .filter((file) => file.toLowerCase().endsWith('.json'))
      .filter((file) => !IGNORED_FILES.has(file.toLowerCase()))
      .filter((file) => !file.startsWith('.') && !file.startsWith('_'))
      .sort((a, b) => a.localeCompare(b));

    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=0, must-revalidate'
      },
      body: JSON.stringify({ files })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
