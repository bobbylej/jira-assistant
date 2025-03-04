const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Create output directory if it doesn't exist
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Create a file to stream archive data to
const output = fs.createWriteStream(path.join(distDir, 'doit-jira-assistant.zip'));
const archive = archiver('zip', {
  zlib: { level: 9 } // Sets the compression level
});

// Listen for all archive data to be written
output.on('close', function() {
  console.log(`Extension packaged successfully (${archive.pointer()} bytes)`);
  console.log(`Output: ${path.join(distDir, 'doit-jira-assistant.zip')}`);
});

// Handle warnings and errors
archive.on('warning', function(err) {
  if (err.code === 'ENOENT') {
    console.warn(err);
  } else {
    throw err;
  }
});

archive.on('error', function(err) {
  throw err;
});

// Pipe archive data to the file
archive.pipe(output);

// Add files
archive.file(path.join(__dirname, 'manifest.json'), { name: 'manifest.json' });
archive.directory(path.join(__dirname, 'popup'), 'popup');
archive.directory(path.join(__dirname, 'background'), 'background');
archive.directory(path.join(__dirname, 'content'), 'content');
archive.directory(path.join(__dirname, 'icons'), 'icons');

// Finalize the archive
archive.finalize(); 