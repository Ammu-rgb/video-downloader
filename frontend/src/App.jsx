import { useRef, useState } from 'react';
import './App.css';

const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5000';


async function testBackend() {
  try {
    const response = await fetch(`${API_URL}/api/health`);
    const data = await response.json();
    console.log('Backend response:', data);
  } catch (error) {
    console.error('Backend test failed:', error);
  }
}


function App() {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState('mp4');
  const [message, setMessage] = useState('');
  const [formats, setFormats] = useState([]);
  const [audioFormats, setAudioFormats] = useState([]);
  const [progress, setProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingFormatId, setDownloadingFormatId] = useState(null);
  const [videoInfo, setVideoInfo] = useState(null);
  const statusRef = useRef(null);
  async function handleSubmit() {
    if (!url.trim()) {
      setMessage('Please paste a video URL first.');
      setFormats([]);
      return;
    }

    try {
      const parsedUrl = new URL(url.trim());

      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        setMessage('Please enter a valid URL.');
        setFormats([]);
        return;
      }

      setMessage('Checking video URL...');
      setFormats([]);
      setProgress(0);
      console.log('Checking backend URL:', url, 'Format:', format);
      const response = await fetch(`${API_URL}/api/video/info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        
       
        
        
body: JSON.stringify({
  url: parsedUrl.href,
  format,
}),






      });

      const data = await response.json();

      if (!response.ok) {
  setIsDownloading(false);
  setDownloadingFormatId(null);
  setMessage(data.error || 'Download failed.');
  return;
}

      setFormats(data.formats || []);
      setAudioFormats(data.audioFormats || []);
      setVideoInfo({
  title: data.title,
  duration: data.duration,
  thumbnail: data.thumbnail,
});
      setMessage(
        `Video found: ${data.title} | ${(data.formats || []).length} quality options available. Selected format: ${data.format.toUpperCase()}`
      );
      } catch (error) {
  console.error('Get Video error:', error);
  setMessage(`Error: ${error.message}`);
}
  }

  async function handleDownload(item) {
    let progressInterval;

    try {
      setProgress(0);
      setMessage(`Starting ${item.quality} download...`);
      setIsDownloading(true);
      setTimeout(() => {
  statusRef.current?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}, 100);
setDownloadingFormatId(item.formatId);
      
console.log('Checking video URL:', url, 'Format:', format);

      const response = await fetch(`${API_URL}/api/video/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
  url: url.trim(),
  formatId: item.formatId,
  format,
}),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || 'Download failed.');
        return;
      }

      const { downloadId } = data;

      if (!downloadId) {
  setIsDownloading(false);
  setDownloadingFormatId(null);
  setMessage('Could not start the download. Please try again.');
  return;
}

      setMessage(`Preparing ${item.quality} ${format.toUpperCase()} download... 0%`);

      progressInterval = setInterval(async () => {
        try {
          const progressResponse = await fetch(
            `${API_URL}/api/video/progress/${encodeURIComponent(downloadId)}`
          );

          if (!progressResponse.ok) return;

          const progressData = await progressResponse.json();

          if (progressData.status === 'downloading') {
            const percent = Math.min(
              100,
              Math.max(0, Number(progressData.percent) || 0)
            );
                        setProgress(percent);
            setMessage(`Downloading ${item.quality}... ${percent}%`);
          } else if (progressData.status === 'error') {
            clearInterval(progressInterval);
            setProgress(0);
            setIsDownloading(false);
            setDownloadingFormatId(null);
            setMessage('Download failed. Please try another quality or video.');
          } else if (progressData.status === 'complete') {
            clearInterval(progressInterval);

            setProgress(100);
            setMessage(`${item.quality} download complete!`);
setIsDownloading(false);
setDownloadingFormatId(null);
setTimeout(() => {
  setProgress(0);
  setMessage('Download complete!');
}, 3000);

            const downloadUrl =
              `${API_URL}/api/video/file/${encodeURIComponent(downloadId)}`;

            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `download-${item.quality}.${format}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
          }
        } catch (error) {
          console.error('Progress check failed:', error);
        }
              }, 1000);
    } catch (error) {
      if (progressInterval) clearInterval(progressInterval);
      setIsDownloading(false);
      setDownloadingFormatId(null);
      setMessage('Could not connect to the backend. Please try again.');
    }
  }

  return (
    <div className="app">
      <button type="button" onClick={testBackend}>
        Test Backend
      </button>

      <nav className="navbar">
        <h2>
          Video<span>Down</span>
        </h2>
        <p>Simple Video Downloader</p>
      </nav>

      <main className="hero">
        <h1>Video Downloader</h1>
        <p className="subtitle">
          Download videos or extract audio in just a few clicks.
        </p>

        <form
          className="download-box"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <input
            type="url"
            value={url}
            
onChange={(event) => {
  setUrl(event.target.value);
  setMessage('');
  setFormats([]);
  setAudioFormats([]);
  setVideoInfo(null);
  setProgress(0);
}}

            placeholder="Paste your video URL here..."
            aria-label="Video URL"
            required
          />

          <select
            value={format}
            onChange={(event) => setFormat(event.target.value)}
            aria-label="Download format"
          >
            <option value="mp4">MP4 · Video</option>
            <option value="mp3">MP3 · Audio</option>
          </select>

          <button type="submit">Get Video</button>
        </form>

        
{videoInfo && (
  <div className="video-preview">
    {videoInfo.previewUrl ? (
      <video
        controls
        preload="metadata"
        poster={videoInfo.thumbnail || undefined}
        className="video-thumbnail"
        src={videoInfo.previewUrl}
      >
        Your browser does not support video playback.
      </video>
    ) : (
      videoInfo.thumbnail && (
        <img
          src={videoInfo.thumbnail}
          alt={`Preview of ${videoInfo.title}`}
          className="video-thumbnail"
        />
      )
    )}

    <div className="video-preview-info">
      <h3>{videoInfo.title}</h3>
      {videoInfo.duration != null && (
        <p>
          Duration: {Math.floor(videoInfo.duration / 60)}:
          {String(videoInfo.duration % 60).padStart(2, '0')}
        </p>
      )}
    </div>
  </div>
)}

{message && (
  <p ref={statusRef} className="note status-message" role="status">
    {message}
  </p>
)}


        {progress > 0 && (
          <div className="progress-container">
            <div className="progress-info">
              <span>Download progress</span>
              <strong>{progress}%</strong>
            </div>

            <div
              className="progress-track"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {(format === 'mp3' ? audioFormats : formats).length > 0 && (
          <div className="quality-list">
            <h3>
  {format === 'mp3' ? 'Available Audio Qualities' : 'Available Video Qualities'}
</h3>
            <p className="quality-subtitle">
              Choose a quality to see its format and file size.
            </p>

            {(format === 'mp3' ? audioFormats : formats).map((item) => (
              <div
                className="quality-item"
                key={`${item.formatId}-${item.ext}`}
              >
                <div className="quality-details">
                  <strong>{item.quality}</strong>

                  <span className="quality-format">
                    {item.ext.toUpperCase()}
                  </span>

                  
{format === 'mp3' ? (
  <span className="video-only">Audio only</span>
) : (
  !item.hasAudio && (
    <span className="video-only">Video only</span>
  )
)}

                </div>

                <span className="quality-size">
                  {item.filesize != null
                    ? `${(item.filesize / (1024 * 1024)).toFixed(1)} MB`
                    : 'Size unavailable'}
                </span>


      <button
  type="button"
  className="quality-select"
  disabled={isDownloading}
  onClick={() => {
  console.log('MP3 download button clicked');
  handleDownload(item);
}}
>
  {downloadingFormatId === item.formatId ? (
    <>
      <span className="button-spinner" />
      Preparing download...
    </>
  ) : (
    format === 'mp3' ? 'Download MP3' : 'Download MP4'
  )}
</button>
              </div>
            ))}
          </div>
        )}

        <p className="note">
          Supports compatible video links and authorized downloads.
        </p>
      </main>
    </div>
  );
}

export default App;
