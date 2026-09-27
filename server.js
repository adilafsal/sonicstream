const express = require('express');
const cors = require('cors');
const youtubedl = require('youtube-dl-exec');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/info', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'YouTube URL is required.' });

        const output = await youtubedl(url, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            extractorArgs: 'youtube:player_client=default,-android_sdkless',
        });

        res.json({
            title: output.title || 'Unknown Title',
            channel: output.uploader || output.channel || 'Unknown Channel',
            duration: output.duration_string || 'N/A',
            thumbnail: output.thumbnail || '',
            id: output.id
        });
    } catch (err) {
        console.error('Metadata Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch video details. Make sure the URL is valid and public.' });
    }
});

app.get('/api/download', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).send('YouTube URL is required.');

        let filename = 'audio.mp3';
        try {
            const meta = await youtubedl(url, { 
                dumpSingleJson: true, 
                noCheckCertificates: true,
                extractorArgs: 'youtube:player_client=default,-android_sdkless'
            });
            if (meta && meta.title) {
                filename = `${meta.title.replace(/[^\w\s]/gi, '').trim()}.mp3`;
            }
        } catch (e) {}

        res.header('Content-Type', 'audio/mpeg');
        res.header('Content-Disposition', `attachment; filename="${filename}"`);

        const subprocess = youtubedl.exec(url, {
            extractAudio: true,
            audioFormat: 'mp3',
            audioQuality: '0', 
            output: '-',
            extractorArgs: 'youtube:player_client=default,-android_sdkless'
        }, {
            stdio: ['ignore', 'pipe', 'pipe']
        });

        subprocess.stdout.pipe(res);

        subprocess.on('error', (err) => {
            console.error('Streaming error:', err);
            if (!res.headersSent) res.status(500).send('Audio conversion failed.');
        });
    } catch (err) {
        if (!res.headersSent) res.status(500).send('Server error.');
    }
});

app.listen(PORT, () => {
    console.log(`SonicStream server active at http://localhost:${PORT}`);
});