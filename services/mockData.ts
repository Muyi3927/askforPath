import { BlogPost, Category, User, UserRole } from '../types';

export const MOCK_USER: User = {
  id: 'u1',
  username: 'AdminUser',
  role: UserRole.ADMIN,
  avatarUrl: 'https://ui-avatars.com/api/?name=Ancient+Path&background=0D8ABC&color=fff'
};

// 初始数据完全为空，强制从后端获取
export const INITIAL_CATEGORIES: Category[] = [];
export const INITIAL_POSTS: BlogPost[] = [];