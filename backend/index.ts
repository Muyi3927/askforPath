import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Placeholder types
type D1Database = any;
type R2Bucket = any;

type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
  AUTH_SECRET?: string;
  R2_PUBLIC_DOMAIN?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS
app.use('/*', cors({
  origin: '*', 
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE']
}));

// --- Auth Helper ---
const checkAuth = (c: any) => {
  const authHeader = c.req.header('Authorization');
  const secret = c.env.AUTH_SECRET || "my-secret-password";
  if (!authHeader || authHeader !== `Bearer ${secret}`) {
    return false;
  }
  return true;
};

// --- Routes ---

// 1. Get All Posts
app.get('/api/posts', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM posts ORDER BY createdAt DESC`
    ).all();

    const posts = results.map((p: any) => ({
      ...p,
      tags: p.tags ? JSON.parse(p.tags) : [],
      isFeatured: Boolean(p.isFeatured),
      author: { username: p.authorName || 'Admin', role: 'ADMIN' }
    }));

    return c.json(posts);
  } catch (e: any) {
    console.error("DB Error:", e);
    return c.json({ error: e.message || "Database error" }, 500);
  }
});

// 2. Get Single Post
app.get('/api/posts/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first();
    if (!post) return c.json({ error: 'Not found' }, 404);

    const formatted = {
      ...post,
      tags: post.tags ? JSON.parse(post.tags as string) : [],
      isFeatured: Boolean(post.isFeatured),
      author: { username: post.authorName || 'Admin', role: 'ADMIN' }
    };
    return c.json(formatted);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 3. Create/Update Post (Protected)
app.post('/api/posts', async (c) => {
  if (!checkAuth(c)) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const body = await c.req.json();
    const { id, title, excerpt, content, coverImage, categoryId, tags, isFeatured, audioUrl, author } = body;

    const now = Date.now();
    const tagString = JSON.stringify(tags || []);
    const validCategoryId = categoryId || '';

    const existing = await c.env.DB.prepare('SELECT id FROM posts WHERE id = ?').bind(id).first();

    if (existing) {
      await c.env.DB.prepare(`
            UPDATE posts SET title=?, excerpt=?, content=?, coverImage=?, updatedAt=?, categoryId=?, tags=?, isFeatured=?, audioUrl=?
            WHERE id=?
        `).bind(title, excerpt, content, coverImage, now, validCategoryId, tagString, isFeatured ? 1 : 0, audioUrl, id).run();
    } else {
      await c.env.DB.prepare(`
            INSERT INTO posts (id, title, excerpt, content, coverImage, createdAt, updatedAt, categoryId, tags, isFeatured, audioUrl, authorName)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(id, title, excerpt, content, coverImage, now, now, validCategoryId, tagString, isFeatured ? 1 : 0, audioUrl, author?.username || 'Admin').run();
    }

    return c.json({ success: true, id });
  } catch (e: any) {
    console.error("Save Error:", e);
    return c.json({ error: e.message }, 500);
  }
});

// 4. Delete Post (Protected)
app.delete('/api/posts/:id', async (c) => {
  if (!checkAuth(c)) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 5. Upload File to R2
app.put('/api/upload', async (c) => {
  if (!checkAuth(c)) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const formData = await c.req.parseBody();
    const file = formData['file'];

    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file uploaded' }, 400);
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'webm'];
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];

    let folder = 'others/';
    if (imageExts.includes(ext)) folder = 'images/';
    else if (audioExts.includes(ext)) folder = 'audios/';

    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const key = `${folder}${safeName}`;

    await c.env.BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType: file.type }
    });

    let publicUrl = '';
    // 优先使用环境变量，如果没有，返回一个假地址供调试（但通常会报错）
    if (c.env.R2_PUBLIC_DOMAIN) {
      const base = c.env.R2_PUBLIC_DOMAIN.endsWith('/')
        ? c.env.R2_PUBLIC_DOMAIN.slice(0, -1)
        : c.env.R2_PUBLIC_DOMAIN;
      publicUrl = `${base}/${key}`;
    } else {
      return c.json({ error: 'R2_PUBLIC_DOMAIN not configured' }, 500);
    }

    return c.json({ url: publicUrl });
  } catch (e: any) {
    console.error("Upload Error:", e);
    return c.json({ error: e.message }, 500);
  }
});

// 6. Get Categories
app.get('/api/categories', async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM categories').all();
    return c.json(results);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 7. Create New Category (Protected)
app.post('/api/categories', async (c) => {
  if (!checkAuth(c)) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const body = await c.req.json();
    const { name, parentId } = body; 

    if (!name?.trim()) return c.json({ error: '分类名称不能为空' }, 400);

    const id = Date.now().toString();
    const trimmedName = name.trim();
    const finalParentId = (parentId && parentId !== '') ? parentId : null;

    await c.env.DB.prepare(
      `INSERT INTO categories (id, name, parentId) VALUES (?, ?, ?)`
    ).bind(id, trimmedName, finalParentId).run();

    return c.json({ id, name: trimmedName, parentId: finalParentId });
  } catch (e: any) {
    console.error("Create Category Error:", e);
    return c.json({ error: e.message }, 500);
  }
});

// 8. Delete Category (Protected)
app.delete('/api/categories/:id', async (c) => {
  if (!checkAuth(c)) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  try {
    const used = await c.env.DB.prepare('SELECT 1 FROM posts WHERE categoryId = ? LIMIT 1').bind(id).first();
    if (used) return c.json({ error: '该分类下有文章，无法删除' }, 400);
    
    const hasChildren = await c.env.DB.prepare('SELECT 1 FROM categories WHERE parentId = ? LIMIT 1').bind(id).first();
    if (hasChildren) return c.json({ error: '该分类包含子分类，请先删除子分类' }, 400);

    await c.env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

export default app;