"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://vvabeaemg5.execute-api.us-east-1.amazonaws.com";

const ADMIN_TO_ADDRESS = "richard@sixspurranch.org";

interface Message {
  messageId: string;
  fromEmail: string;
  fromName: string | null;
  subject: string | null;
  bodyText: string | null;
  isRead: boolean;
  isReplied: boolean;
  receivedAt: string;
  repliedAt: string | null;
  pdfDownloadUrl?: string;
  fencePhotoDownloadUrls?: { key: string; url: string }[];
}

interface ThreadMessage {
  messageId: string;
  fromEmail: string;
  fromName: string | null;
  subject: string | null;
  bodyText: string | null;
  isRead: boolean;
  receivedAt: string;
}

export default function AdminInboxDetailPage() {
  const params = useParams();
  const messageId = params.id as string;

  const [message, setMessage] = useState<Message | null>(null);
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingRead, setMarkingRead] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [replySuccess, setReplySuccess] = useState(false);

  const replyTemplates = [
    {
      label: "Adoption Inquiry",
      text:
        "Hi! Thanks so much for your interest in adopting. We'd love to help find the right fit — " +
        "could you tell us a bit more about your household and experience with animals? Once we hear back, " +
        "we can walk you through the next steps in our adoption process.\n\n" +
        "Warmly,\nSix Spur Ranch and Rescue",
    },
    {
      label: "Donation Thanks",
      text:
        "Hi! Thank you so much for your generous support of Six Spur Ranch and Rescue. Gifts like yours " +
        "directly help us care for the animals in our sanctuary. We're so grateful to have you in our corner.\n\n" +
        "With gratitude,\nSix Spur Ranch and Rescue",
    },
    {
      label: "Volunteer Info",
      text:
        "Hi! Thanks for your interest in volunteering with us. We'd love to have your help — " +
        "could you share a little about your availability and any experience working with animals? " +
        "We'll follow up with next steps once we hear back.\n\n" +
        "Best,\nSix Spur Ranch and Rescue",
    },
    {
      label: "General",
      text: "Hi! Thanks for reaching out.\n\n[Add your answer here]\n\nBest,\nSix Spur Ranch and Rescue",
    },
  ];

  useEffect(() => {
    if (messageId) {
      fetchMessage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageId]);

  const fetchMessage = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/admin/inbox/${messageId}`);
      const data = await res.json();

      if (data.success) {
        setMessage(data.data.message);
        setThreadMessages(data.data.threadMessages);

        if (!data.data.message.isRead) {
          markAsRead(true);
        }
      } else {
        setError(data.message || "Failed to load message");
      }
    } catch (err) {
      console.error("Error fetching message:", err);
      setError("Failed to load message");
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (isRead: boolean) => {
    try {
      setMarkingRead(true);
      const res = await fetch(`${API_URL}/admin/inbox/${messageId}/read`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_read: isRead }),
      });

      const data = await res.json();

      if (data.success && message) {
        setMessage({ ...message, isRead });
      }
    } catch (err) {
      console.error("Error marking message:", err);
    } finally {
      setMarkingRead(false);
    }
  };

  const sendReplyMessage = async () => {
    if (!replyText.trim()) {
      alert("Please enter a reply message");
      return;
    }

    if (!message) return;

    try {
      setSending(true);

      const sendRes = await fetch(`${API_URL}/admin/inbox/${messageId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_email: message.fromEmail,
          subject: message.subject,
          reply_text: replyText,
        }),
      });

      const sendData = await sendRes.json();

      if (!sendData.success) {
        alert(sendData.message || "Failed to send reply");
        return;
      }

      const markRes = await fetch(`${API_URL}/admin/inbox/${messageId}/replied`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });

      const markData = await markRes.json();

      if (markData.success) {
        setReplySuccess(true);
        setShowReplyForm(false);
        setReplyText("");
        fetchMessage();
        setTimeout(() => setReplySuccess(false), 3000);
      } else {
        alert("Email sent but failed to update status");
      }
    } catch (err) {
      console.error("Error sending reply:", err);
      alert("Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-spur-tan-light p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">Loading message...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-spur-tan-light p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Link href="/admin/inbox" className="text-spur-orange hover:text-spur-orange-dark flex items-center gap-2">
              ← Back to Inbox
            </Link>
          </div>
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
        </div>
      </div>
    );
  }

  if (!message) {
    return null;
  }

  return (
    <div className="min-h-screen bg-spur-tan-light p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/admin/inbox" className="text-spur-orange hover:text-spur-orange-dark flex items-center gap-2 font-medium">
            ← Back to Inbox
          </Link>

          <button
            onClick={() => markAsRead(!message.isRead)}
            disabled={markingRead}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 disabled:opacity-50"
          >
            {markingRead ? "..." : message.isRead ? "Mark as Unread" : "Mark as Read"}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="border-b border-spur-tan bg-white px-6 py-4">
            <h1 className="text-2xl font-bold text-spur-black mb-4">{message.subject || "(No Subject)"}</h1>

            <div className="space-y-2 text-sm">
              <div className="flex items-start">
                <span className="font-medium text-gray-700 w-20">From:</span>
                <span className="text-gray-900">
                  {message.fromName ? (
                    <>
                      {message.fromName} <span className="text-gray-500">&lt;{message.fromEmail}&gt;</span>
                    </>
                  ) : (
                    message.fromEmail
                  )}
                </span>
              </div>

              <div className="flex items-start">
                <span className="font-medium text-gray-700 w-20">To:</span>
                <span className="text-gray-900">{ADMIN_TO_ADDRESS}</span>
              </div>

              <div className="flex items-start">
                <span className="font-medium text-gray-700 w-20">Date:</span>
                <span className="text-gray-900">{formatDate(message.receivedAt)}</span>
              </div>

              <div className="flex items-center gap-2 pt-2">
                {!message.isRead ? (
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">New</span>
                ) : null}
                {message.isReplied ? (
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Replied</span>
                ) : null}
              </div>

              {message.pdfDownloadUrl && (
                <div className="pt-3">
                  <a
                    href={message.pdfDownloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-spur-orange-light text-spur-orange-dark text-sm font-semibold rounded hover:bg-spur-orange hover:text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download Application PDF
                  </a>
                  <p className="text-xs text-gray-400 mt-1">Link expires in 15 minutes — refresh the page for a new one.</p>
                </div>
              )}

              {message.fencePhotoDownloadUrls && message.fencePhotoDownloadUrls.length > 0 && (
                <div className="pt-4">
                  <p className="text-sm font-semibold text-spur-black mb-2">
                    Fence/Enclosure Photos ({message.fencePhotoDownloadUrls.length})
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {message.fencePhotoDownloadUrls.map((photo, i) => (
                      <a
                        key={photo.key}
                        href={photo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-24 h-24 rounded overflow-hidden border border-spur-tan hover:border-spur-orange transition-colors"
                      >
                        <img src={photo.url} alt={`Fence photo ${i + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Links expire in 15 minutes — refresh the page for new ones.</p>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-6">
            {message.bodyText ? (
              <pre className="whitespace-pre-wrap font-sans text-gray-900 leading-relaxed">{message.bodyText}</pre>
            ) : (
              <p className="text-gray-500 italic">(No message body)</p>
            )}
          </div>

          {threadMessages.length > 1 && (
            <div className="border-t border-spur-tan bg-spur-tan-light px-6 py-4">
              <h3 className="font-semibold text-spur-black mb-3">Conversation Thread</h3>
              <div className="space-y-3">
                {threadMessages.map((msg) => (
                  <div
                    key={msg.messageId}
                    className={`bg-white rounded-lg p-4 border ${
                      msg.messageId === message.messageId ? "border-spur-orange/40 bg-spur-orange-light/30" : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm text-gray-900">{msg.fromName || msg.fromEmail}</span>
                      <span className="text-xs text-gray-500">{formatDate(msg.receivedAt)}</span>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-2">{msg.bodyText}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-spur-tan px-6 py-4 bg-white">
            {replySuccess && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm">
                ✓ Reply sent successfully!
              </div>
            )}

            {!showReplyForm ? (
              <button
                onClick={() => setShowReplyForm(true)}
                className="px-4 py-2 bg-spur-orange text-white rounded-lg hover:bg-spur-orange-dark font-medium"
              >
                Reply
              </button>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quick Templates:</label>
                  <div className="flex flex-wrap gap-2">
                    {replyTemplates.map((template) => (
                      <button
                        key={template.label}
                        onClick={() => setReplyText(template.text)}
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your Reply:</label>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={8}
                    className="w-full px-3 py-2 border border-spur-tan rounded-lg focus:outline-none focus:border-spur-orange transition-colors font-sans"
                    placeholder="Type your reply here..."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={sendReplyMessage}
                    disabled={sending || !replyText.trim()}
                    className="px-4 py-2 bg-spur-orange text-white rounded-lg hover:bg-spur-orange-dark font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? "Sending..." : "Send Reply"}
                  </button>
                  <button
                    onClick={() => {
                      setShowReplyForm(false);
                      setReplyText("");
                    }}
                    disabled={sending}
                    className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
