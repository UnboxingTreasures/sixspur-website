interface IGMedia {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
}

interface YTVideo {
  id: { videoId: string };
  snippet: {
    title: string;
    publishedAt: string;
    thumbnails: { medium: { url: string } };
  };
}

async function getInstagramMedia(): Promise<{ data: IGMedia[] } | { error: string }> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) return { error: "Missing INSTAGRAM_ACCESS_TOKEN in .env.local" };

  try {
    const res = await fetch(
      `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&access_token=${token}&limit=6`,
      { cache: "no-store" }
    );
    const json = await res.json();
    if (json.error) return { error: json.error.message };
    return { data: json.data || [] };
  } catch (e: any) {
    return { error: e.message };
  }
}

async function getYouTubeVideos(): Promise<{ data: YTVideo[] } | { error: string }> {
  const key = process.env.YOUTUBE_API_KEY;
  const channelId = process.env.YOUTUBE_CHANNEL_ID;
  if (!key || !channelId) return { error: "Missing YOUTUBE_API_KEY or YOUTUBE_CHANNEL_ID in .env.local" };

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?key=${key}&channelId=${channelId}&part=snippet&order=date&maxResults=6&type=video`,
      { cache: "no-store" }
    );
    const json = await res.json();
    if (json.error) return { error: json.error.message };
    return { data: json.items || [] };
  } catch (e: any) {
    return { error: e.message };
  }
}

export default async function TestSocialPage() {
  const [ig, yt] = await Promise.all([getInstagramMedia(), getYouTubeVideos()]);

  return (
    <main style={{ padding: "2rem", maxWidth: "1000px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        Social Integration Test Page
      </h1>
      <p style={{ color: "#666", marginBottom: "2rem", fontSize: "0.85rem" }}>
        Temporary test route — not linked from the live site nav. Directory structure to be
        migrated to real components/pages later.
      </p>

      {/* Instagram/Facebook */}
      <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "1rem", borderBottom: "2px solid #E77A2D", paddingBottom: "0.5rem" }}>
        Instagram / Facebook
      </h2>
      {"error" in ig ? (
        <p style={{ color: "#c00", background: "#fee", padding: "1rem", borderRadius: "4px" }}>
          Error: {ig.error}
        </p>
      ) : ig.data.length === 0 ? (
        <p>No posts returned.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem", marginBottom: "3rem" }}>
          {ig.data.map((post) => (
            <a key={post.id} href={post.permalink} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit", border: "1px solid #ddd", borderRadius: "4px", overflow: "hidden" }}>
              {(post.media_url || post.thumbnail_url) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.media_type === "VIDEO" ? post.thumbnail_url : post.media_url}
                  alt=""
                  style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block" }}
                />
              )}
              <div style={{ padding: "0.5rem", fontSize: "0.75rem" }}>
                <p style={{ color: "#999", marginBottom: "0.25rem" }}>{post.media_type} — {new Date(post.timestamp).toLocaleDateString()}</p>
                <p style={{ overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                  {post.caption || "(no caption)"}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* YouTube */}
      <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "1rem", borderBottom: "2px solid #E77A2D", paddingBottom: "0.5rem" }}>
        YouTube
      </h2>
      {"error" in yt ? (
        <p style={{ color: "#c00", background: "#fee", padding: "1rem", borderRadius: "4px" }}>
          Error: {yt.error}
        </p>
      ) : yt.data.length === 0 ? (
        <p>No videos returned.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem" }}>
          {yt.data.map((video) => (
            <a key={video.id.videoId} href={`https://youtube.com/watch?v=${video.id.videoId}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit", border: "1px solid #ddd", borderRadius: "4px", overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={video.snippet.thumbnails.medium.url} alt="" style={{ width: "100%", display: "block" }} />
              <div style={{ padding: "0.5rem", fontSize: "0.75rem" }}>
                <p style={{ fontWeight: 600, marginBottom: "0.25rem", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                  {video.snippet.title}
                </p>
                <p style={{ color: "#999" }}>{new Date(video.snippet.publishedAt).toLocaleDateString()}</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
