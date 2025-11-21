import React, { useState, useEffect, createContext } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { PostDetail } from './pages/PostDetail';
import { Editor } from './pages/Editor';
import { Login } from './pages/Login';
import { About } from './pages/About';
import { ThemeContextType, AuthContextType, User, UserRole, BlogPost, Category } from './types';
import { api } from './services/api';

// Contexts
export const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  toggleTheme: () => {},
});

export const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
  isAdmin: false
});

const App: React.FC = () => {
  // Theme State
  const [isDark, setIsDark] = useState(false);
  
  // Auth State
  const [user, setUser] = useState<User | null>(null);

  // Data State - Start Empty
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Initialize Theme
  useEffect(() => {
    const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(isSystemDark);
  }, []);

  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  // Fetch Data from Backend
  useEffect(() => {
    const loadData = async () => {
      try {
        const [fetchedPosts, fetchedCategories] = await Promise.all([
          api.getPosts(),
          api.getCategories()
        ]);
        
        // 直接设置返回的数据（可能是空数组，这正是我们想要的）
        setPosts(fetchedPosts || []);
        setCategories(fetchedCategories || []);
        
      } catch (e) {
        console.error("Failed to load data from API", e);
        // API 失败时，这里不加载 Mock 数据，以免混淆，保持为空或显示错误
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const toggleTheme = () => setIsDark(!isDark);

  const login = (username: string, role: UserRole) => {
    setUser({
      id: Date.now().toString(),
      username,
      role,
      avatarUrl: `https://ui-avatars.com/api/?name=${username}&background=random`
    });
  };

  const logout = () => setUser(null);

  const handleSavePost = (post: BlogPost) => {
    const exists = posts.some(p => p.id === post.id);
    if (exists) {
      setPosts(posts.map(p => p.id === post.id ? post : p));
    } else {
      setPosts([post, ...posts]);
    }
  };

  const addCategory = (name: string, parentId: string | null) => {
    // 这个方法主要用于 Editor 内的本地更新，实际数据已通过 API 刷新
    // 但为了保持一致性，我们可以重新 fetch 或者手动添加
    const newCat: Category = {
        id: `c${Date.now()}`, // 临时ID，实际应以 API 返回为准，建议 Editor 触发全量刷新
        name,
        parentId
    };
    setCategories([...categories, newCat]);
  };

  const deleteCategory = (id: string) => {
    // 本地状态更新
    setCategories(prev => prev.filter(c => c.id !== id));
  };

  const updatePost = (updatedPost: BlogPost) => {
      setPosts(posts.map(p => p.id === updatedPost.id ? updatedPost : p));
  };

  if (loading) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
          </div>
      );
  }

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      <AuthContext.Provider value={{ 
        user, 
        login, 
        logout, 
        isAuthenticated: !!user,
        isAdmin: user?.role === UserRole.ADMIN
      }}>
        <HashRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Home posts={posts} categories={categories} />} />
              <Route path="/about" element={<About />} />
              <Route path="/post/:id" element={<PostDetail posts={posts} updatePost={updatePost} categories={categories} />} />
              <Route path="/login" element={<Login />} />
              <Route 
                path="/editor" 
                element={
                  <Editor 
                    onSave={handleSavePost} 
                    categories={categories} 
                    onAddCategory={addCategory}
                    onDeleteCategory={deleteCategory}
                    posts={posts}
                  />
                } 
              />
              <Route 
                path="/editor/:id" 
                element={
                  <Editor 
                    onSave={handleSavePost} 
                    categories={categories} 
                    onAddCategory={addCategory}
                    onDeleteCategory={deleteCategory}
                    posts={posts}
                  />
                } 
              />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Layout>
        </HashRouter>
      </AuthContext.Provider>
    </ThemeContext.Provider>
  );
};

export default App;