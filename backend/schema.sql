-- 警告：执行此文件将清空数据库数据！
-- 用于初始化或重置系统

DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS categories;

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parentId TEXT -- 允许为空，为空则表示顶级分类
);

CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  coverImage TEXT,
  authorName TEXT,
  createdAt INTEGER,
  updatedAt INTEGER,
  categoryId TEXT,
  tags TEXT, -- JSON 字符串存储
  isFeatured INTEGER DEFAULT 0, -- 0 or 1
  audioUrl TEXT
);

-- 保持为空，不插入测试数据