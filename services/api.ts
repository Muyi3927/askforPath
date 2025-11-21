import { BlogPost, Category } from '../types';

// ==================== 重要配置区 ====================
// 安全获取环境变量
// 解决 "Cannot read properties of undefined (reading 'VITE_API_URL')"
const getApiBaseUrl = () => {
  const DEFAULT_URL = 'https://lumina-blog-backend.workers.dev'; // 默认兜底地址，请随后替换为你真实的 worker 地址

  try {
    // 检查 import.meta 是否存在以及 env 是否存在
    const meta = import.meta as any;
    if (typeof meta !== 'undefined' && meta.env) {
      return meta.env.VITE_API_URL || DEFAULT_URL;
    }
  } catch (e) {
    console.warn("Error reading environment variables:", e);
  }
  return DEFAULT_URL;
};

const API_BASE_URL = getApiBaseUrl();

// 必须与 backend/wrangler.toml.txt 里的 AUTH_SECRET 完全一致！
const AUTH_TOKEN = 'a8f5b3e7d2c9f1g4h6j8k9m2n4p6q8r0t1y3u5i7o9';
// ===================================================

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const err = await res.json();
      msg = err.error || msg;
    } catch { }
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  async getPosts(): Promise<BlogPost[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/posts`);
      return handleResponse<BlogPost[]>(res);
    } catch (error) {
      console.error("Fetch posts failed:", error);
      return [];
    }
  },

  async getPost(id: string): Promise<BlogPost> {
    const res = await fetch(`${API_BASE_URL}/api/posts/${id}`);
    return handleResponse<BlogPost>(res);
  },

  async getCategories(): Promise<Category[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/api/categories`);
      return handleResponse<Category[]>(res);
    } catch (error) {
      console.error("Fetch categories failed:", error);
      return [];
    }
  },

  async savePost(post: BlogPost): Promise<{ success: boolean; id: string }> {
    const res = await fetch(`${API_BASE_URL}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify(post),
    });
    return handleResponse(res);
  },

  async deletePost(id: string): Promise<void> {
    await fetch(`${API_BASE_URL}/api/posts/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });
  },

  async uploadFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });

    const data = await handleResponse<{ url: string }>(res);
    if (!data.url) throw new Error('上传成功但未返回 URL');
    return data.url;
  },

  async createCategory(name: string, parentId: string | null): Promise<Category> {
    const res = await fetch(`${API_BASE_URL}/api/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify({ name, parentId }),
    });
    return handleResponse<Category>(res);
  },

  async deleteCategory(id: string): Promise<void> {
    await fetch(`${API_BASE_URL}/api/categories/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    });
  },
};