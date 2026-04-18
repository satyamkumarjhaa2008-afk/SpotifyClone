// server.js
require('dotenv').config(); // npm i dotenv
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 3000;

// ===== Build the URI safely (URL-encode password) =====
const user = process.env.MONGO_USER || 'satyam_jha0_0';
const rawPassword = process.env.MONGO_PASS || 'Mnss1xAz1xlazjv7'; // move to .env in real use
const encodedPass = encodeURIComponent(rawPassword);
const dbName = process.env.MONGO_DB || 'Songs';

// Example SRV URI for Atlas
const MONGO_URI = process.env.MONGO_URI ||
  `mongodb+srv://${user}:${encodedPass}@cluster0.g0yywja.mongodb.net/${dbName}?retryWrites=true&w=majority`;

// ===== Connect once at startup =====
async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // useCreateIndex / useFindAndModify are deprecated in modern mongoose
    });
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message || err);
    // Exit the process if DB is required for the app to run:
    process.exit(1);
  }
}
connectDB();

// Optional: log connection events
mongoose.connection.on('connected', () => console.log('mongoose: connected'));
mongoose.connection.on('error', (err) => console.error('mongoose error:', err));
mongoose.connection.on('disconnected', () => console.warn('mongoose: disconnected'));

// ===== Schema & model =====
const songSchema = new mongoose.Schema({
  title: String,
  artist: String,
  songUrl: String,
});
// ⚠️ IMPORTANT: Always pass the exact collection name as the 3rd argument
// to prevent Mongoose from auto-pluralizing (e.g., 'songdetails' → 'songdetailses')
const Song = mongoose.model('Song', songSchema, 'songdetails');



// ===== Helper =====
let songsArray = [];

async function prepareSongsArray() {
  try {
    const songs = await Song.find({}).lean();
    songsArray = songs.map(s => ({ title: s.title, artist: s.artist }));
    console.log(`Fetched ${songsArray.length} songs`);
  } catch (err) {
    console.error('❌ Error fetching songs:', err);
  }
}

// ===== Express =====
app.use(express.static(path.join(__dirname, 'templates')));

app.get('/spotify', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

app.get('/api/songs', async (req, res) => {
  await prepareSongsArray();
  res.json(songsArray);
});

app.get('/getSongUrl', async (req, res) => {
  const { title, artist } = req.query;
  try {
    const song = await Song.findOne({ title, artist }).lean();
    if (!song) return res.status(404).json({ error: 'Song not found' });
    res.json({ url: song.songUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(port, () => console.log(`Server listening on ${port}`));
