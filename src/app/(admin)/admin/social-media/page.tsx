import SocialPostComposer from "@/components/admin/SocialPostComposer";

export default function AdminSocialMediaPage() {
  return (
    <main style={{ padding: "2rem", maxWidth: "1100px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem", color: "#111111" }}>
        Social Media
      </h1>

      <SocialPostComposer />
    </main>
  );
}
