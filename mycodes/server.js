const express = require('express')
const app = express()
const port = 3000
const path = require('path');
const mongoose = require("mongoose");
let songsArray

mongoose.connect("mongodb+srv://satyam_jha0_0:Mnss1xAz1xlazjv7@cluster0.g0yywja.mongodb.net/Songs");

const songSchema = new mongoose.Schema({
  title: String,
  artist: String,
  songUrl: String, // add this field
});

const Song = mongoose.model("songdetails", songSchema);

async function prepareSongsArray() {
  try {
    const songs = await Song.find({}); // fetch all from DB

    // Create array of { title, artist }
     songsArray = songs.map(song => ({
      title: song.title,
      artist: song.artist,
    }));

    // For now, just log it on server
    
   
  } catch (err) {
    console.error("❌ Error fetching songs:", err);
  }
}

app.use(express.static(path.join(__dirname, 'templates')));

app.get('/spotify', async (req, res) => {
   
  res.sendFile(path.join(__dirname, 'templates', 'index.html'));

});
app.get("/api/songs", async (req,res) => {
    await prepareSongsArray()
res.json(songsArray)

})
app.get("/getSongUrl", async (req, res) => {
  const { title, artist } = req.query;

  try {
    const song = await Song.findOne({ title, artist }); // MongoDB query
    if (!song) return res.status(404).json({ error: "Song not found" });

    res.json({ url: song.songUrl}); // send URL back to frontend
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
