export const SENTINEL = "••••••••";

async function request(method, path, body = null) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body !== null) opts.body = JSON.stringify(body);
  const res = await fetch(`/api${path}`, opts);
  if (res.status === 204) return {};
  const data = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error(data.detail || `Request failed: ${res.status}`);
  return data;
}

export const api = {
  // Settings
  getSettings:    ()           => request("GET",  "/settings"),
  updateSettings: (d)          => request("PUT",  "/settings", d),
  testBedrock:    (accessKey, secretKey) => request("POST", "/settings/test-bedrock", {accessKey, secretKey}),

  // Company
  getCompany:    ()  => request("GET", "/company"),
  updateCompany: (d) => request("PUT", "/company", d),

  // Social accounts
  getSocialAccounts:      ()         => request("GET",    "/social-accounts"),
  updateSocialAccount:    (plat, d)  => request("PUT",    `/social-accounts/${plat}`, d),
  disconnectSocialAccount:(plat)     => request("DELETE", `/social-accounts/${plat}`),

  // Posts
  getPosts:     ()            => request("GET",    "/posts"),
  updatePost:   (id, d)       => request("PUT",    `/posts/${id}`, d),
  deletePost:   (id)          => request("DELETE", `/posts/${id}`),
  approvePost:  (id)          => request("POST",   `/posts/${id}/approve`),
  rejectPost:   (id)          => request("POST",   `/posts/${id}/reject`),
  schedulePost: (id, sched)   => request("POST",   `/posts/${id}/schedule`, { scheduledFor: sched }),
  publishPost:  (id)          => request("POST",   `/posts/${id}/publish`),
  sendToTelegram:(id)         => request("POST",   `/posts/${id}/send-telegram`),

  // Generate
  generateContent: (d) => request("POST", "/generate/full", d),

  // Telegram
  getTelegram:      ()  => request("GET", "/telegram"),
  updateTelegram:   (d) => request("PUT", "/telegram", d),
  testBot:          (t) => request("POST", "/telegram/test-bot",      { botToken: t }),
  fetchChatId:      (t) => request("POST", "/telegram/fetch-chat-id", { botToken: t }),
  sendTestMessage:  (d) => request("POST", "/telegram/test-message",  d),
  sendMockCard:     (d) => request("POST", "/telegram/mock-card",     d),

  // Analytics
  getAnalytics: ()  => request("GET",  "/analytics"),
  getInsights:  ()  => request("POST", "/analytics/insights"),
};
