import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

async function cleanupDB() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB!');
    const db = mongoose.connection.db;
    const col = db.collection('users');

    // List all users
    const all = await col.find({}, { projection: { username: 1, email: 1 } }).toArray();
    console.log('\nALL USERS BEFORE CLEANUP:');
    all.forEach(u => console.log('  > ' + u.username + ' | ' + u.email));

    // Find arpit users (keep max 3)
    const keep = all.filter(u =>
        (u.username && u.username.toLowerCase().includes('arpit')) ||
        (u.email && u.email.toLowerCase().includes('arpit'))
    ).slice(0, 3);

    const keepIds = keep.map(u => u._id);

    // Delete everyone else
    const notIn = { $nin: keepIds };
    const del = await col.deleteMany({ _id: notIn });
    console.log('\nDELETED ' + del.deletedCount + ' non-arpit users');

    // Clear other collections
    for (const c of ['debates', 'bets', 'notifications', 'messages']) {
        const r = await db.collection(c).deleteMany({});
        console.log('Cleared ' + c + ': ' + r.deletedCount + ' docs');
    }

    // Show remaining
    const rem = await col.find({}, { projection: { username: 1, email: 1 } }).toArray();
    console.log('\nREMAINING USERS:');
    rem.forEach(u => console.log('  > ' + u.username + ' | ' + u.email));

    await mongoose.disconnect();
    console.log('\nDone! DB is clean.');
}

cleanupDB().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});
