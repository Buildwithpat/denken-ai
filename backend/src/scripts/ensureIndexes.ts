/**
 * ensureIndexes.ts
 *
 * Run once after schema changes to sync MongoDB indexes:
 *   npx ts-node src/scripts/ensureIndexes.ts
 *
 * This is idempotent — existing indexes are preserved, missing ones are created.
 */

import dotenv from 'dotenv';
import path   from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import mongoose from 'mongoose';
import { env }  from '../config/env';

// Import all models that define indexes to register them with Mongoose
import '../models/Result';
import '../models/Test';
import '../models/QuestionBank';
import '../models/MistakePattern';
import '../models/QuestionPerformance';
import '../models/User';
import '../models/MentorSession';
import '../models/ConceptGraph';

async function run() {
  console.log('[Indexes] Connecting to MongoDB…');
  await mongoose.connect(env.MONGO_URI);
  console.log('[Indexes] Connected. Syncing indexes…');

  const modelNames = mongoose.modelNames();
  for (const name of modelNames) {
    const model = mongoose.model(name);
    await model.syncIndexes();
    console.log(`[Indexes] ✓ ${name}`);
  }

  console.log('[Indexes] All indexes synced.');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('[Indexes] Failed:', err);
  process.exit(1);
});
