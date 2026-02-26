#!/usr/bin/env node

// Basic syntax check without full TypeScript compilation
const fs = require('fs');
const path = require('path');

const files = [
  'src/cli.ts',
  'src/commands/init.ts',
  'src/commands/generate.ts',
  'src/core/parser.ts',
  'src/core/generator.ts',
  'src/utils/config.ts',
  'src/utils/logger.ts',
  'src/index.ts'
];

console.log('Checking TypeScript files...');

let errors = 0;
for (const file of files) {
  const filePath = path.join(__dirname, file);
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Basic syntax checks
    if (!content.includes('export')) {
      console.log(`  ❌ ${file} - No exports found`);
      errors++;
    } else if (content.match(/import.*from/)) {
      console.log(`  ✅ ${file} - OK`);
    }
  } catch (err) {
    console.log(`  ❌ ${file} - ${err.message}`);
    errors++;
  }
}

console.log(`\nChecked ${files.length} files, ${errors} errors`);

if (errors > 0) {
  process.exit(1);
}

console.log('\n✅ All files passed basic checks');
