const axios = require('axios');
const helmet = require('helmet');
const ipaddr = require('ipaddr.js');
const { spawn, execFile } = require('child_process');
function isPublicIp(ip) {
  try {
    const address = ipaddr.parse(ip);
    return address.range() === 'unicast';
  } catch {
    return false;
  }
}
function isSafeHostname(hostname) {
  const host = hostname.toLowerCase();

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local')
  ) {
    return false;
  }

  return true;
}

function isSupportedVideoUrl(url) {
  const host = url.hostname.toLowerCase();

  return (
    host === 'youtube.com' ||
    host.endsWith('.youtube.com') ||
    host === 'youtu.be' ||
    host === 'instagram.com' ||
    host.endsWith('.instagram.com')
  );
}

const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(
  process.env.FFMPEG_PATH ||
  (process.platform === 'win32'
    ? 'C:\\Users\\Amaan\\Downloads\\ffmpeg-9.0.2-essentials_build\\bin\\ffmpeg.exe'
    : 'ffmpeg')
);

ffmpeg.setFfprobePath(
  process.env.FFPROBE_PATH ||
  (process.platform === 'win32'
    ? 'C:\\Users\\Amaan\\Downloads\\ffmpeg-9.0.2-essentials_build\\bin\\ffprobe.exe'
    : 'ffprobe')
);
ffmpeg.getAvailableFormats((err, formats) => {
  if (err) {
    console.error('FFmpeg error:', err.message);
    return;
  }

  console.log('FFmpeg formats loaded:', Object.keys(formats).length);
});
const app = express();
app.use(helmet());
const PORT = process.env.PORT || 5000;
const path = require('path');
const fs = require('fs');
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const downloadProgress = new Map();

function isSupportedMediaType(contentType = '') {
  return [
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/ogg',
  ].some((type) => contentType.toLowerCase().includes(type));
}

if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}
app.use(cors({
  origin: [
    'http://localhost:5173',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.get('/', (req, res) => {
  res.json({
    message: 'Video Downloader API is running!'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Backend is working properly'
  });
});

app.get('/api/diagnostics', (req, res) => {
  const { execFile } = require('child_process');

  const ytDlpPath =
    process.env.YTDLP_PATH || '/usr/local/bin/yt-dlp';

  execFile(ytDlpPath, ['--version'], (error, stdout) => {
    res.json({
      nodeVersion: process.version,
      platform: process.platform,
      ytDlpPath,
      ytDlpVersion: error ? 'Version check failed' : stdout.trim()
    });
  });
});

app.get('/api/video/progress/:downloadId', (req, res) => {
  const progress = downloadProgress.get(req.params.downloadId);

  if (!progress) {
    return res.status(404).json({
      percent: 0,
      status: 'waiting'
    });
  }

  return res.json(progress);
});


app.post('/api/video/info', (req, res) => {
  const { url, format } = req.body;

  if (!url || !format) {
    return res.status(400).json({
      error: 'Video URL and format are required.'
    });
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({
      error: 'Please provide a valid URL.'
    });
  }
    const isInstagram = parsedUrl.hostname.toLowerCase().includes('instagram.com');
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return res.status(400).json({
      error: 'Only HTTP and HTTPS URLs are supported.'
    });
  }

  if (
    parsedUrl.username ||
    parsedUrl.password ||
    !isSafeHostname(parsedUrl.hostname) ||
!isSupportedVideoUrl(parsedUrl)
  ) {
    return res.status(400).json({
      error: 'This URL is not allowed.'
    });
  }

  if (!['mp3', 'mp4'].includes(format)) {
    return res.status(400).json({
      error: 'Format must be MP3 or MP4.'
    });
  }

  
  const path = require('path');

  const ytDlpPath =
  process.env.YTDLP_PATH ||
  path.join(
    __dirname,
    process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
  );

  execFile(
    ytDlpPath,
    [
      '--dump-single-json',
      '--no-download',
      '--no-playlist',
      '--no-warnings',
      '--',
      parsedUrl.href
    ],
    { timeout: 60000, maxBuffer: 50 * 1024 * 1024 },
    (error, stdout) => {
      if (error) {
  console.error('yt-dlp error:', error.message);
  console.error('yt-dlp stderr:', error.stderr);

  return res.status(400).json({
    error: error.message,
    details: error.stderr || ''
  });
}

      try {
        const info = JSON.parse(stdout);
        const previewUrl = info.url || null;
        console.log('Video metadata:', {
  filesize: info.filesize,
  filesize_approx: info.filesize_approx,
  duration: info.duration,
  formatCount: (info.formats || []).length
});
        const isInstagram = parsedUrl.hostname.toLowerCase().includes('instagram.com');
        const formats = (info.formats || [])
          .filter(f => f.vcodec !== 'none' && f.height)
          .map(f => ({
            formatId: f.format_id,
            quality: `${f.height}p`,
            ext: f.ext,
            filesize: f.filesize ?? f.filesize_approx ?? null,
            hasAudio: f.acodec !== 'none'
          }))
          .filter((f, i, arr) =>
            arr.findIndex(x =>
              x.quality === f.quality &&
              x.ext === f.ext &&
              x.hasAudio === f.hasAudio
            ) === i
          );

          const audioFormats = (info.formats || [])
  .filter(f => f.acodec !== 'none' && f.acodec)
  .map(f => ({
    formatId: f.format_id,
    quality: f.abr ? `${Math.round(f.abr)} kbps` : 'Audio',
    ext: f.ext,
    filesize: f.filesize ?? f.filesize_approx ?? null
  }))
  .filter((f, i, arr) =>
    arr.findIndex(x =>
      x.quality === f.quality &&
      x.ext === f.ext
    ) === i
  );

          return res.json({
  title: info.title,
  duration: info.duration,
  thumbnail: info.thumbnail || null,
  previewUrl,
  format,
  formats,
  audioFormats
});
      } catch {
        return res.status(500).json({
          error: 'Could not read video information.'
        });
      }
    }
  );
});


app.get('/api/ffmpeg-test', (req, res) => {
  res.json({
    status: 'OK',
    message: 'FFmpeg library connected successfully!'
  });
});

app.get('/api/downloads-test', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Downloads folder is ready!'
  });
});


app.post('/api/video/download', (req, res) => {
  const { url, formatId, format = 'mp4' } = req.body;
  if (!['mp3', 'mp4'].includes(format)) {
  return res.status(400).json({
    error: 'Format must be MP3 or MP4.'
  });
}

  if (!url || !formatId) {
    return res.status(400).json({
      error: 'Video URL and quality are required.'
    });
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({
      error: 'Please provide a valid URL.'
    });
  }
  if (
  !['http:', 'https:'].includes(parsedUrl.protocol) ||
  parsedUrl.username ||
  parsedUrl.password ||
  !isSafeHostname(parsedUrl.hostname) ||
  !isSupportedVideoUrl(parsedUrl)
) {
    return res.status(400).json({
      error: 'This URL is not allowed.'
    });
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(String(formatId))) {
    return res.status(400).json({
      error: 'Invalid video quality.'
    });
  }
    const isInstagram = parsedUrl.hostname.toLowerCase().includes('instagram.com');
  const downloadId =
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const outputPath = path.join(
    DOWNLOAD_DIR,
    `video-${downloadId}.%(ext)s`
  );

  downloadProgress.set(downloadId, {
    percent: 0,
    status: 'downloading'
  });

 const downloadArgs = [
  '--newline',
  '--no-playlist',
  '--no-warnings',
  '--max-filesize', '100M',
];

if (format === 'mp3') {
  downloadArgs.push(
    '-f', 'bestaudio/best',
    '-x',
    '--audio-format', 'mp3',
    '--audio-quality', '192K',
    '--ffmpeg-location',
    process.env.FFMPEG_PATH ||
(process.platform === 'win32'
  ? 'C:\\Users\\Amaan\\Downloads\\ffmpeg-9.0.2-essentials_build\\bin'
  : '/usr/bin')
  );
} else {
  downloadArgs.push(
    '-f',
    isInstagram ? 'best' : `${formatId}+bestaudio[ext=m4a]/bestaudio`
  );
}

downloadArgs.push('-o', outputPath, '--', parsedUrl.href);

const ytDlpPath =
  process.env.YTDLP_PATH ||
  path.join(
    __dirname,
    process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
  );

const child = spawn(ytDlpPath, downloadArgs);
  let stderr = '';
  let outputBuffer = '';

  child.stdout.on('data', (data) => {
    outputBuffer += data.toString();

    const lines = outputBuffer.split(/\r?\n/);
    outputBuffer = lines.pop() || '';

    for (const line of lines) {
      const match = line.match(/(\d+(?:\.\d+)?)%/);

      if (match) {
  const currentProgress = downloadProgress.get(downloadId);

  if (currentProgress?.status === 'downloading') {
    const newPercent = Number(match[1]);
    const previousPercent = currentProgress.percent || 0;

    downloadProgress.set(downloadId, {
      percent: Math.max(previousPercent, newPercent),
      status: 'downloading'
    });
  }
}
    }
  });

  child.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  child.on('error', (error) => {
    console.error('Download process error:', error.message);
    downloadProgress.set(downloadId, {
      percent: 0,
      status: 'error'
    });
  });

  child.on('close', (code) => {
    if (code !== 0) {
      console.error('Download error:', stderr);
      downloadProgress.set(downloadId, {
        percent: 0,
        status: 'error'
      });
      return;
    }

    const prefix = `video-${downloadId}`;
    const matchingFile = fs.readdirSync(DOWNLOAD_DIR)
      .filter(name => name.startsWith(prefix))
      .map(name => path.join(DOWNLOAD_DIR, name))
      .find(file => fs.existsSync(file));

    if (!matchingFile) {
      downloadProgress.set(downloadId, {
        percent: 0,
        status: 'error'
      });
      return;
    }

    downloadProgress.set(downloadId, {
      percent: 100,
      status: 'complete',
      filePath: matchingFile,
      fileName: path.basename(matchingFile)
    });
  });

  return res.json({ downloadId });
});


app.get('/api/video/file/:downloadId', (req, res) => {
  const job = downloadProgress.get(req.params.downloadId);

  if (!job || job.status !== 'complete' || !job.filePath) {
    return res.status(404).json({
      error: 'Downloaded file is not ready.'
    });
  }
      console.log('Sending file:', job.filePath);
console.log('File size:', fs.statSync(job.filePath).size, 'bytes');

  res.download(job.filePath, job.fileName, (error) => {
    if (error) {
      console.error('File transfer error:', error.message);
console.error('Response headers sent:', res.headersSent);
console.error('Response destroyed:', res.destroyed);
      return;
    }

    fs.unlink(job.filePath, (unlinkError) => {
      if (unlinkError) {
        console.error('File cleanup error:', unlinkError.message);
      }
      downloadProgress.delete(req.params.downloadId);
    });
  });
});
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});