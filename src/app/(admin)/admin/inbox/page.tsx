"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://vvabeaemg5.execute-api.us-east-1.amazonaws.com";

interface InboxMessage {
  messageId: string;
  allMessageIds?: string[];
  messageCount?: number;
  fromEmail: string;
  fromName: string | null;
  subject: string | null;
  isRead: boolean;
  isReplied: boolean;
  isDeleted?: boolean;
  threadId: string;
  receivedAt: string;
  repliedAt: string | null;
  pdfKey?: string;
}

interface Pagination {
  page: number;
  total: number;
  totalPages: number;
  limit?: number;
}

function AdminInboxPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState<Pagination>({ page: 1, total: 0, totalPages: 0 });
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState("all"); // 'all', 'unread'
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [performingBatch, setPerformingBatch] = useState(false);
  const [showDeleted, setShowDeleted] = useState(searchParams.get("show_deleted") === "true");
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const toggleShowDeleted = () => {
    const next = !showDeleted;
    setShowDeleted(next);
    // Reflect in the URL (replace, not push, so this doesn't clutter back-button
    // history) so the toggle survives navigating away to a message and back --
    // local state alone resets every time this page remounts.
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set("show_deleted", "true");
    } else {
      params.delete("show_deleted");
    }
    router.replace(`/admin/inbox?${params.toString()}`);
  };

  useEffect(() => {
    fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, searchTerm, pagination.page, showDeleted]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", pagination.page.toString());

      if (filter === "unread") {
        params.set("is_read", "false");
      }

      if (searchTerm) {
        params.set("search", searchTerm);
      }

      if (showDeleted) {
        params.set("include_deleted", "true");
      }

      const res = await fetch(`${API_URL}/admin/inbox?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setMessages(data.data.messages);
        setPagination(data.data.pagination);
        setUnreadCount(data.data.unreadCount);
      } else {
        setError(data.message || "Failed to load messages");
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
      setError("Failed to load messages");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination({ ...pagination, page: 1 });
    fetchMessages();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const toggleSelection = (messageId: string) => {
    setSelectedIds((prev) =>
      prev.includes(messageId) ? prev.filter((id) => id !== messageId) : [...prev, messageId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === messages.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(messages.map((m) => m.messageId));
    }
  };

  const performBatchAction = async (action: string) => {
    if (selectedIds.length === 0) {
      alert("Please select at least one message");
      return;
    }

    try {
      setPerformingBatch(true);
      const res = await fetch(`${API_URL}/admin/inbox/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_ids: selectedIds, action }),
      });

      const data = await res.json();

      if (data.success) {
        setSelectedIds([]);
        fetchMessages();
      } else {
        alert(data.message || "Batch operation failed");
      }
    } catch (err) {
      console.error("Error performing batch action:", err);
      alert("Batch operation failed");
    } finally {
      setPerformingBatch(false);
    }
  };

  const restoreMessage = async (messageId: string) => {
    try {
      setRestoringId(messageId);
      const res = await fetch(`${API_URL}/admin/inbox/${messageId}/restore`, {
        method: "PATCH",
      });
      const data = await res.json();

      if (data.success) {
        fetchMessages();
      } else {
        alert(data.message || "Failed to restore message");
      }
    } catch (err) {
      console.error("Error restoring message:", err);
      alert("Failed to restore message");
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <>
      <div className="bg-spur-orange px-7 py-4 flex items-center justify-between shadow-md">
        <div>
          <div className="text-white font-bold text-base tracking-wide">Inbox</div>
          <div className="text-white/65 text-xs">
            {unreadCount > 0 ? `${unreadCount} unread message${unreadCount !== 1 ? "s" : ""}` : "All caught up!"}
          </div>
        </div>
      </div>
      <div className="min-h-screen bg-spur-tan-light p-8">
        <div className="max-w-7xl mx-auto">
          {/* Filters and Search */}
          <div className="mb-8">
            <div className="flex gap-4 items-center">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setFilter("all");
                    setPagination({ ...pagination, page: 1 });
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filter === "all"
                      ? "bg-spur-orange text-white"
                      : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => {
                    setFilter("unread");
                    setPagination({ ...pagination, page: 1 });
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filter === "unread"
                      ? "bg-spur-orange text-white"
                      : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  Unread {unreadCount > 0 ? `(${unreadCount})` : ""}
                </button>
                <button
                  onClick={toggleShowDeleted}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    showDeleted
                      ? "bg-red-600 text-white"
                      : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {showDeleted ? "Hide Deleted" : "Show Deleted"}
                </button>
              </div>

              <form onSubmit={handleSearch} className="flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-spur-tan rounded-lg focus:outline-none focus:border-spur-orange transition-colors"
                />
              </form>
            </div>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Batch Action Bar */}
          {selectedIds.length > 0 && (
            <div className="mb-4 bg-spur-orange-light border border-spur-orange/30 rounded-lg px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-medium text-spur-orange-dark">
                {selectedIds.length} message{selectedIds.length !== 1 ? "s" : ""} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => performBatchAction("mark_read")}
                  disabled={performingBatch}
                  className="px-3 py-1 bg-spur-orange text-white rounded-lg hover:bg-spur-orange-dark text-sm font-medium disabled:opacity-50"
                >
                  Mark as Read
                </button>
                <button
                  onClick={() => performBatchAction("mark_unread")}
                  disabled={performingBatch}
                  className="px-3 py-1 bg-white border border-spur-orange/40 text-spur-orange-dark rounded-lg hover:bg-spur-orange-light text-sm font-medium disabled:opacity-50"
                >
                  Mark as Unread
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete ${selectedIds.length} message${selectedIds.length !== 1 ? "s" : ""}? This can be restored later if needed, but won't show up in the inbox anymore.`)) {
                      performBatchAction("delete");
                    }
                  }}
                  disabled={performingBatch}
                  className="px-3 py-1 bg-white border border-red-300 text-red-700 rounded-lg hover:bg-red-50 text-sm font-medium disabled:opacity-50"
                >
                  Delete
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  disabled={performingBatch}
                  className="px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          {/* Messages Table */}
          {loading ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">
                {filter === "unread" ? "No unread messages" : "No messages yet"}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === messages.length && messages.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-spur-orange focus:ring-spur-orange"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      From
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subject
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Received
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    {showDeleted && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {messages.map((message) => (
                    <tr
                      key={message.messageId}
                      className={`hover:bg-gray-50 transition-colors ${
                        message.isDeleted
                          ? "bg-red-50/60"
                          : !message.isRead
                          ? "bg-spur-orange-light/40"
                          : ""
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(message.messageId)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelection(message.messageId);
                          }}
                          className="rounded border-gray-300 text-spur-orange focus:ring-spur-orange"
                        />
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap cursor-pointer"
                        onClick={() => router.push(`/admin/inbox/${message.messageId}`)}
                      >
                        <div className="flex items-center">
                          {!message.isRead ? (
                            <div className="w-2 h-2 bg-spur-orange rounded-full mr-3"></div>
                          ) : null}
                          <div>
                            <div className={`text-sm ${!message.isRead ? "font-semibold text-gray-900" : "text-gray-900"}`}>
                              {message.fromName || message.fromEmail}
                            </div>
                            {message.fromName ? (
                              <div className="text-sm text-gray-500">{message.fromEmail}</div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td
                        className="px-6 py-4 cursor-pointer"
                        onClick={() => router.push(`/admin/inbox/${message.messageId}`)}
                      >
                        <div className={`text-sm ${!message.isRead ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                          {message.subject || "(No Subject)"}
                          {message.messageCount && message.messageCount > 1 && (
                            <span className="ml-1.5 px-1.5 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">
                              {message.messageCount}
                            </span>
                          )}
                          {message.pdfKey && (
                            <svg className="inline-block w-3.5 h-3.5 ml-1.5 -mt-0.5 text-spur-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                          )}
                        </div>
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap cursor-pointer"
                        onClick={() => router.push(`/admin/inbox/${message.messageId}`)}
                      >
                        <div className="text-sm text-gray-500">{formatDate(message.receivedAt)}</div>
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap cursor-pointer"
                        onClick={() => router.push(`/admin/inbox/${message.messageId}`)}
                      >
                        {message.isDeleted ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-700">
                            Deleted
                          </span>
                        ) : message.isReplied ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Replied
                          </span>
                        ) : !message.isRead ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            New
                          </span>
                        ) : (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                            Read
                          </span>
                        )}
                      </td>
                      {showDeleted && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          {message.isDeleted && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                restoreMessage(message.messageId);
                              }}
                              disabled={restoringId === message.messageId}
                              className="px-3 py-1 bg-white border border-green-300 text-green-700 rounded-lg hover:bg-green-50 text-xs font-medium disabled:opacity-50"
                            >
                              {restoringId === message.messageId ? "..." : "Restore"}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {pagination.totalPages > 1 && (
                <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                      disabled={pagination.page === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                      disabled={pagination.page === pagination.totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing page <span className="font-medium">{pagination.page}</span> of{" "}
                        <span className="font-medium">{pagination.totalPages}</span>
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                          onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                          disabled={pagination.page === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                          disabled={pagination.page === pagination.totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function AdminInboxPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-spur-tan-light p-8" />}>
      <AdminInboxPageInner />
    </Suspense>
  );
}
