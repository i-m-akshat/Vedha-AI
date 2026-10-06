#!/usr/bin/env node
/**
 * Vedha AI Chrome Extension — Master E2E Test Suite Runner
 * 
 * Executes Tiers 1–4 of the comprehensive test suite:
 * - Tier 1: Feature Coverage (F1 to F12, >=60 tests)
 * - Tier 2: Boundary Value Analysis (F1 to F12, >=60 tests)
 * - Tier 3: Pairwise Combinatorial Interactions (>=12 tests)
 * - Tier 4: Real-World Portal Workloads (>=6 tests)
 * 
 * Usage:
 *   node tests/e2e/runner.js [--tier=1|2|3|4] [--verbose] [--grep=<pattern>]
 */

const fs = require('fs');
const path = require('path');

// CLI Arguments
const args = process.argv.slice(2);
let selectedTier = null;
let verbose = false;
let grepFilter = null;

for (const arg of args) {
  if (arg.startsWith('--tier=')) {
    selectedTier = parseInt(arg.split('=')[1], 10);
  } else if (arg === '-t' && args[args.indexOf(arg) + 1]) {
    selectedTier = parseInt(args[args.indexOf(arg) + 1], 10);
  } else if (arg === '--verbose' || arg === '-v') {
    verbose = true;
  } else if (arg.startsWith('--grep=')) {
    grepFilter = new RegExp(arg.split('=')[1], 'i');
  }
}

// Test Registry
const testSuites = [];
let currentSuite = null;

const suiteStack = [];

function describe(suiteName, fn) {
  const parent = suiteStack[suiteStack.length - 1];
  const detectedTier = determineTier(suiteName);
  const suiteTier = detectedTier !== null ? detectedTier : (parent ? parent.tier : 1);
  const fullSuiteName = parent ? `${parent.name} > ${suiteName}` : suiteName;

  const suite = {
    name: fullSuiteName,
    tier: suiteTier,
    tests: []
  };

  suiteStack.push(suite);
  currentSuite = suite;
  testSuites.push(suite);
  try {
    fn();
  } finally {
    suiteStack.pop();
    currentSuite = suiteStack[suiteStack.length - 1] || null;
  }
}

function it(testName, fn) {
  if (!currentSuite) {
    throw new Error(`Test "${testName}" defined outside of describe block`);
  }
  currentSuite.tests.push({
    name: testName,
    fn,
    suiteName: currentSuite.name,
    tier: currentSuite.tier
  });
}

function determineTier(suiteName) {
  const match = suiteName.match(/Tier\s*(\d)/i) || suiteName.match(/T(\d)/i);
  return match ? parseInt(match[1], 10) : null;
}

// Custom Assertions
const assert = {
  ok(val, msg) {
    if (!val) throw new Error(msg || `Expected truthy value, got ${val}`);
  },
  strictEqual(actual, expected, msg) {
    if (actual !== expected) {
      throw new Error(msg || `AssertionError: Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  },
  notStrictEqual(actual, expected, msg) {
    if (actual === expected) {
      throw new Error(msg || `AssertionError: Expected value not to strictly equal ${JSON.stringify(expected)}`);
    }
  },
  deepStrictEqual(actual, expected, msg) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) {
      throw new Error(msg || `AssertionError: Deep equality mismatch.\nExpected: ${b}\nActual:   ${a}`);
    }
  },
  match(str, regex, msg) {
    if (!regex.test(String(str))) {
      throw new Error(msg || `AssertionError: "${str}" did not match pattern ${regex}`);
    }
  },
  doesNotMatch(str, regex, msg) {
    if (regex.test(String(str))) {
      throw new Error(msg || `AssertionError: "${str}" unexpectedly matched pattern ${regex}`);
    }
  },
  throws(fn, expected, msg) {
    let threw = false;
    let caught = null;
    try {
      fn();
    } catch (e) {
      threw = true;
      caught = e;
    }
    if (!threw) {
      throw new Error(msg || 'Expected function to throw an error, but it returned normally');
    }
    if (expected instanceof RegExp && !expected.test(caught.message)) {
      throw new Error(msg || `Expected error message "${caught.message}" to match ${expected}`);
    }
  },
  doesNotThrow(fn, msg) {
    try {
      fn();
    } catch (e) {
      throw new Error(msg || `Expected function not to throw, but caught: ${e.message}`);
    }
  },
  async rejects(asyncFn, expected, msg) {
    let threw = false;
    let caught = null;
    try {
      await asyncFn();
    } catch (e) {
      threw = true;
      caught = e;
    }
    if (!threw) {
      throw new Error(msg || 'Expected async function to reject, but it resolved');
    }
    if (expected instanceof RegExp && !expected.test(caught.message)) {
      throw new Error(msg || `Expected error message "${caught.message}" to match ${expected}`);
    }
  }
};

// Global Exposure for Test Suites
global.describe = describe;
global.it = it;
global.test = it;
global.assert = assert;

// Load Test Files
const testFiles = [
  { tier: 1, file: path.join(__dirname, 'tier1_features.test.js') },
  { tier: 2, file: path.join(__dirname, 'tier2_boundaries.test.js') },
  { tier: 3, file: path.join(__dirname, 'tier3_pairwise.test.js') },
  { tier: 4, file: path.join(__dirname, 'tier4_realworld.test.js') }
];

async function run() {
  console.log('='.repeat(78));
  console.log('   VEDHA AI CHROME EXTENSION — COMPREHENSIVE E2E TEST SUITE RUNNER');
  console.log('='.repeat(78));
  if (selectedTier) {
    console.log(`[FILTER] Executing only Tier ${selectedTier}`);
  }
  if (grepFilter) {
    console.log(`[FILTER] Matching test names with pattern: ${grepFilter}`);
  }
  console.log('');

  // Require files to register tests
  for (const item of testFiles) {
    if (selectedTier && item.tier !== selectedTier) continue;
    if (fs.existsSync(item.file)) {
      try {
        require(item.file);
      } catch (err) {
        console.error(`[ERROR] Failed to load test file: ${item.file}`);
        console.error(err);
        process.exit(1);
      }
    } else {
      console.warn(`[WARN] Test file missing: ${item.file}`);
    }
  }

  // Flatten tests
  const testsToRun = [];
  for (const suite of testSuites) {
    if (selectedTier && suite.tier !== selectedTier) continue;
    for (const testCase of suite.tests) {
      if (grepFilter && !grepFilter.test(testCase.name) && !grepFilter.test(suite.name)) {
        continue;
      }
      testsToRun.push(testCase);
    }
  }

  if (testsToRun.length === 0) {
    console.log('No tests found matching the selection criteria.');
    process.exit(0);
  }

  console.log(`Executing ${testsToRun.length} registered E2E test cases...\n`);

  const results = {
    total: testsToRun.length,
    passed: 0,
    failed: 0,
    byTier: {
      1: { total: 0, passed: 0, failed: 0 },
      2: { total: 0, passed: 0, failed: 0 },
      3: { total: 0, passed: 0, failed: 0 },
      4: { total: 0, passed: 0, failed: 0 }
    },
    failures: []
  };

  const startTime = Date.now();

  for (let i = 0; i < testsToRun.length; i++) {
    const t = testsToRun[i];
    const tierNum = t.tier || 1;
    results.byTier[tierNum].total++;

    const testLabel = `[T${tierNum}] ${t.suiteName} > ${t.name}`;
    try {
      await t.fn();
      results.passed++;
      results.byTier[tierNum].passed++;
      if (verbose) {
        console.log(`  ✔ PASS: ${testLabel}`);
      } else {
        process.stdout.write('.');
      }
    } catch (err) {
      results.failed++;
      results.byTier[tierNum].failed++;
      results.failures.push({
        label: testLabel,
        error: err.message || String(err),
        stack: err.stack
      });
      if (verbose) {
        console.log(`  ✖ FAIL: ${testLabel}`);
        console.log(`         ${err.message}`);
      } else {
        process.stdout.write('F');
      }
    }
  }

  const durationMs = Date.now() - startTime;
  if (!verbose) console.log('\n');

  // Summary Report
  console.log('='.repeat(78));
  console.log('                    EXECUTION SUMMARY BY TIER');
  console.log('='.repeat(78));
  console.log(` Tier 1 (Feature Coverage)     : ${results.byTier[1].passed}/${results.byTier[1].total} passed (${results.byTier[1].failed} failed)`);
  console.log(` Tier 2 (Boundary Values)      : ${results.byTier[2].passed}/${results.byTier[2].total} passed (${results.byTier[2].failed} failed)`);
  console.log(` Tier 3 (Pairwise Combinations): ${results.byTier[3].passed}/${results.byTier[3].total} passed (${results.byTier[3].failed} failed)`);
  console.log(` Tier 4 (Real-World Scenarios) : ${results.byTier[4].passed}/${results.byTier[4].total} passed (${results.byTier[4].failed} failed)`);
  console.log('-'.repeat(78));
  console.log(` Total Executed   : ${results.total}`);
  console.log(` Total Passed     : ${results.passed}`);
  console.log(` Total Failed     : ${results.failed}`);
  const passRate = results.total > 0 ? ((results.passed / results.total) * 100).toFixed(1) : 0;
  console.log(` Pass Rate        : ${passRate}%`);
  console.log(` Total Duration   : ${durationMs} ms`);
  console.log('='.repeat(78));

  // Failure Trace Output
  if (results.failures.length > 0) {
    console.log('\n' + '!'.repeat(78));
    console.log(`                   FAILURE DETAILS (${results.failures.length} FAILURES)`);
    console.log('!'.repeat(78));
    for (let i = 0; i < results.failures.length; i++) {
      const f = results.failures[i];
      console.log(`\n[#${i + 1}] ${f.label}`);
      console.log(`    Error: ${f.error}`);
      if (verbose && f.stack) {
        const stackLines = f.stack.split('\n').slice(1, 4).join('\n');
        console.log(`    Stack:\n${stackLines}`);
      }
    }
    console.log('\n' + '!'.repeat(78));
  }

  if (results.failed > 0) {
    console.log(`\nResult: ✖ FAIL — ${results.failed} test(s) failed.`);
    process.exit(1);
  } else {
    console.log(`\nResult: ✔ PASS — All ${results.total} tests passed successfully!`);
    process.exit(0);
  }
}

if (require.main === module) {
  run().catch(err => {
    console.error('Fatal runner error:', err);
    process.exit(1);
  });
}

module.exports = { describe, it, assert, run };
