const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

async function getToken() {
  const { auth } = await import("./firebase");
  return await auth.currentUser?.getIdToken();
}

async function api(path: string, options?: RequestInit) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
  return res.json();
}

export async function registerUser() {
  return api("/api/auth/register", { method: "POST" });
}

export async function getMe() {
  return api("/api/auth/me");
}

export async function getChats() {
  const res = await api("/api/chat/history");
  return res.chats || [];
}

export async function getChat(id: string) {
  return api(`/api/chat/${id}`);
}

export async function saveChat(data: {
  chatId?: string;
  title?: string;
  messages?: { role: string; content: string }[];
  faculty?: string;
}) {
  return api("/api/chat/save", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteChat(id: string) {
  return api(`/api/chat/${id}`, { method: "DELETE" });
}

export async function getFaculties() {
  const res = await fetch(`${BASE_URL}/api/faculty`);
  const data = await res.json();
  return data.faculties || [];
}

export async function getFaculty(slug: string) {
  const res = await fetch(`${BASE_URL}/api/faculty/${slug}`);
  return res.json();
}

export async function getAdminUsers() {
  return api("/api/admin/users");
}

export async function deleteUser(uid: string) {
  return api(`/api/admin/user/${uid}`, { method: "DELETE" });
}

export async function getAdminChats() {
  return api("/api/admin/chats");
}

export async function getAdminFaculty() {
  return api("/api/admin/faculty");
}

export async function updateFaculty(slug: string, data: any) {
  return api(`/api/admin/faculty/${slug}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
