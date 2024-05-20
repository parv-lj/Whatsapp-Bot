const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const app = express();

const client = new Client({
    puppeteer: {
        executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    },
    authStrategy: new LocalAuth({
        dataPath: '.wpdata'
    })
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

client.initialize();

async function sendMessage(recipientNumber, message) {
    try {
        await client.sendMessage(recipientNumber, message);
        console.log('Message sent successfully!');
        return {
            success: true,
            message: 'Message sent successfully!'
        };
    } catch (error) {
        console.error('Error sending message:', error);
        return {
            success: false,
            error: 'Error sending message'
        };
    }
}

async function getContactId(client, number) {
    try {
        const numberId = await client.getNumberId(number);
        if (!numberId) {
            return {
                error: 'The WhatsApp account does not exist'
            };
        }
        const contactId = numberId._serialized;
        return contactId;
    } catch (err) {
        return {
            error: 'The WhatsApp account does not exist'
        };
    }
}

async function getContactName(contactId) {
    try {
        const contact = await client.getContactById(contactId);
        const name = contact.pushname;
        return name ? name.split(' ') : null;
    } catch (error) {
        console.error('Error getting contact name: ', error);
        return null;
    }
}

async function downloadVideo(videoUrl) {
    try {

        const response = await fetch(videoUrl);
        const videoBuffer = await response.buffer();

        const filename = `video_${Date.now()}.mp4`;

        fs.writeFileSync(path.join(__dirname, 'videos', filename), videoBuffer);

        return filename;
    } catch (error) {
        console.error('Error downloading video:', error);
        return null;
    }
}

async function sendVideoMessage(to, filePath, caption) {
    try {

        const media = MessageMedia.fromFilePath(filePath);

        await client.sendMessage(`${to}@c.us`, media, { caption: caption });
        console.log('Video sent successfully');
    } catch (error) {
        console.error('Error sending video:', error);
    }
}

async function downloadAudio(audioUrl) {
    try {

        const response = await fetch(audioUrl);
        const audioBuffer = await response.buffer();

        const filename = `audio_${Date.now()}.mp3`;

        fs.writeFileSync(path.join(__dirname, 'audios', filename), audioBuffer);

        return filename;
    } catch (error) {
        console.error('Error downloading audio:', error);
        return null;
    }
}

async function sendAudioMessage(to, filePath) {
    try {

        const media = MessageMedia.fromFilePath(filePath);

        await client.sendMessage(`${to}@c.us`, media);
        console.log('Audio sent successfully');
    } catch (error) {
        console.error('Error sending audio:', error);
    }
}

async function sendCaptionMessage(to, caption) {
    try {
        const cap = `${caption}`;

        await client.sendMessage(`${to}@c.us`, cap);
        console.log('Caption message sent successfully');
    } catch (error) {
        console.error('Error sending caption message:', error);
    }
}

async function downloadImage(imageUrl) {
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error('Failed to fetch image');
        }
        const contentType = response.headers.get('content-type');
        const ext = contentType.split('/')[1];
        if (!ext) {
            throw new Error('Unknown image format');
        }
        const imageBuffer = await response.buffer();
        const filename = `image_${Date.now()}.${ext}`;
        fs.writeFileSync(path.join(__dirname, 'images', filename), imageBuffer);
        return filename;
    } catch (error) {
        console.error('Error downloading image:', error);
        return null;
    }
}

async function sendImageMessage(to, filePath, caption) {
    try {
        const media = MessageMedia.fromFilePath(filePath);
        await client.sendMessage(`${to}@c.us`, media, { caption: caption || '' });
        console.log('Image sent successfully');
    } catch (error) {
        console.error('Error sending image:', error);
    }
}

app.get('/send', async (req, res) => {
    const number = req.query.number;
    const message = req.query.message;

    if (!number || !message) {
        res.status(400).send('Number and message are required');
        return;
    }

    const cleanedNumber = number.replace('+', '').replace(/\s+/g, '');

    try {
        const contactId = await getContactId(client, cleanedNumber);

        if (contactId.error) {
            res.status(404).send(contactId);
            return;
        }

        const nameParts = await getContactName(contactId);
        if (!nameParts || nameParts.length < 2) {
            res.status(400).send(`First name or last name is missing. Message not sent.`);
            return;
        }

        const messageToSend = `${message}`;
        const sendMessageResult = await sendMessage(`${cleanedNumber}@c.us`, messageToSend);
        res.send(sendMessageResult);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send({ error: 'Internal server error' });
    }
});

app.get('/send-video', async (req, res) => {
    const recipient = req.query.to;
    const videoUrl = req.query.url;
    const caption = req.query.caption;

    if (!recipient || !videoUrl) {
        return res.status(400).send('Missing recipient or video URL');
    }

    const filename = await downloadVideo(videoUrl);

    if (!filename) {
        return res.status(500).send('Error downloading video');
    }

    const contactId = await getContactId(client, recipient);

    if (!contactId || contactId.error) {
        return res.status(404).send('Recipient not found');
    }

    const nameParts = await getContactName(contactId);
    if (!nameParts || nameParts.length < 2) {
        return res.status(400).send(`First name or last name is missing. Video not sent.`);
    }

    await sendVideoMessage(recipient, path.join(__dirname, 'videos', filename), caption);

    res.send('Video sent successfully');
});

app.get('/send-audio', async (req, res) => {
    const recipient = req.query.to;
    const audioUrl = req.query.url;
    const caption = req.query.caption;

    if (!recipient || !audioUrl) {
        return res.status(400).send('Missing recipient or audio URL');
    }

    const filename = await downloadAudio(audioUrl);

    if (!filename) {
        return res.status(500).send('Error downloading audio');
    }

    const contactId = await getContactId(client, recipient);

    if (!contactId || contactId.error) {
        return res.status(404).send('Recipient not found');
    }

    const nameParts = await getContactName(contactId);
    if (!nameParts || nameParts.length < 2) {
        return res.status(400).send(`First name or last name is missing. Audio not sent.`);
    }

    await sendAudioMessage(recipient, path.join(__dirname, 'audios', filename));

    if (caption) {
        await sendCaptionMessage(recipient, caption);
    }

    res.send('Audio sent successfully');
});

app.get('/send-image', async (req, res) => {
    const recipient = req.query.to;
    const imageUrl = req.query.url;
    const caption = req.query.caption;

    if (!recipient || !imageUrl) {
        return res.status(400).send('Missing recipient or image URL');
    }

    const filename = await downloadImage(imageUrl);

    if (!filename) {
        return res.status(500).send('Error downloading image');
    }

    await sendImageMessage(recipient, path.join(__dirname, 'images', filename), caption);

    res.send('Image sent successfully');
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});