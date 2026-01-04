#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Fixing Rollup native dependencies...');

try {
  // Check if the problematic module exists
  const rollupPath = path.join('node_modules', '@rollup', 'rollup-linux-x64-gnu');
  const rollupPackageJson = path.join(rollupPath, 'package.json');

  if (!fs.existsSync(rollupPackageJson)) {
    console.log('Installing missing rollup native binary...');
    // Try to install the specific rollup binary
    try {
      execSync('npm install @rollup/rollup-linux-x64-gnu --save-optional', { stdio: 'inherit' });
    } catch (installError) {
      console.log('Direct install failed, trying alternative approach...');
      // Alternative: try to trigger npm to install optional dependencies
      execSync('npm install --include=optional', { stdio: 'inherit' });
    }
  }

  // Try to rebuild rollup
  console.log('Rebuilding rollup...');
  execSync('npm rebuild rollup', { stdio: 'inherit' });

  console.log('Rollup dependencies fix completed');
} catch (error) {
  console.log('Rollup fix attempted, continuing with build...');
  console.log('Error details:', error.message);
}
