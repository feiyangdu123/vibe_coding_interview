'use client'

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // 尝试获取当前用户
    fetch('http://localhost:3001/api/auth/me', { credentials: 'include' })
      .then(res => {
        if (res.ok) {
          router.push('/admin');
        } else {
          router.push('/login');
        }
      })
      .catch(() => router.push('/login'));
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="text-center">
        <p className="text-gray-600">加载中...</p>
      </div>
    </div>
  );
}
