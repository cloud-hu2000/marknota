#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('Fixing Rollup native dependencies...');

try {
  // Try to rebuild rollup
  execSync('npm rebuild @rollup/rollup-linux-x64-gnu || true', { stdio: 'inherit' });
  execSync('npm rebuild rollup || true', { stdio: 'inherit' });

  console.log('Rollup dependencies fix completed');
} catch (error) {
  console.log('Rollup fix attempted, continuing with build...');
}
