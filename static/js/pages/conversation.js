/* global $, window */

// Page: conversation.html
// Handles sending messages + polling for incoming ones every 4 seconds.
(function conversationPage() {
  if ($("body").attr("data-page") !== "conversation") return;

  const C = window.AppCore;

  $(document).ready(function () {
    const $thread     = $("#thread");
    const otherUser   = String($thread.attr("data-other-username") || "");
    let   lastId      = parseInt($thread.attr("data-last-id") || "0", 10) || 0;
    const $form       = $("#composeForm");
    const $body       = $("#composeBody");
    const $sendBtn    = $("#composeSend");

    // Scroll to bottom on load
    function scrollToBottom() {
      $thread.scrollTop($thread[0].scrollHeight);
    }
    scrollToBottom();

    function escapeHtml(s) {
      return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function formatTime(iso) {
      try {
        const d = new Date(iso);
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
      } catch (e) { return ""; }
    }

    function appendMessage(msg) {
      const mine = msg.sender === "me";
      const html = `
        <div data-message-id="${msg.id}" class="flex ${mine ? "justify-end" : "justify-start"}">
          <div class="max-w-[78%] rounded-2xl px-4 py-2 text-sm shadow-sm
                      ${mine
                        ? "bg-sky-600 text-white"
                        : "bg-white text-slate-800 border border-slate-200"}">
            <div class="whitespace-pre-wrap break-words">${escapeHtml(msg.body)}</div>
            <div class="mt-1 text-[10px] ${mine ? "text-sky-100" : "text-slate-400"}">
              ${formatTime(msg.created_at)}
            </div>
          </div>
        </div>
      `;
      // Remove empty-state placeholder if present
      $thread.find(".flex.h-full.items-center").remove();
      $thread.append(html);
      if (msg.id > lastId) lastId = msg.id;
    }

    // Send a message
    $form.on("submit", async function (e) {
      e.preventDefault();
      const body = String($body.val() || "").trim();
      if (!body) return;
      $sendBtn.prop("disabled", true);
      try {
        const data = await C.fetchJson(`api/messages/${encodeURIComponent(otherUser)}`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ body }),
        });
        if (data && data.ok) {
          appendMessage(data.message);
          $body.val("");
          scrollToBottom();
        } else {
          C.showToast(data?.error || "Could not send message.", "error");
        }
      } catch (err) {
        const msg = err?.body?.error || err?.message || "Could not send message.";
        C.showToast(msg, "error");
      } finally {
        $sendBtn.prop("disabled", false);
        $body.focus();
      }
    });

    // Enter to send, Shift+Enter for newline
    $body.on("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        $form.trigger("submit");
      }
    });

    // Poll for new incoming messages every 4s
    async function pollIncoming() {
      try {
        const data = await C.fetchJson(
          `api/messages/${encodeURIComponent(otherUser)}?since_id=${lastId}`
        );
        if (data && data.ok && Array.isArray(data.messages) && data.messages.length > 0) {
          const wasAtBottom =
            $thread[0].scrollHeight - $thread[0].scrollTop - $thread[0].clientHeight < 60;
          for (const m of data.messages) {
            // Skip ones we already have (e.g. ones we just sent)
            if ($thread.find(`[data-message-id='${m.id}']`).length > 0) continue;
            appendMessage(m);
          }
          if (wasAtBottom) scrollToBottom();
        }
      } catch (err) {
        // Silent — next tick will retry.
      }
    }
    window.setInterval(pollIncoming, 4000);
  });
})();
