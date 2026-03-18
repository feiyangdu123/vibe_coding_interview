'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface BulkCandidate {
  name: string;
  email: string;
  phone?: string;
}

interface BulkCandidateImportProps {
  onImport: (candidates: BulkCandidate[]) => void;
}

export function BulkCandidateImport({ onImport }: BulkCandidateImportProps) {
  const [text, setText] = useState('');

  const handleParse = () => {
    const lines = text.trim().split('\n').filter(line => line.trim());
    const candidates: BulkCandidate[] = [];

    for (const line of lines) {
      // 支持格式：姓名,邮箱,手机 或 姓名 邮箱 手机（空格/逗号/制表符分隔）
      const parts = line.split(/[,\t\s]+/).map(p => p.trim());
      if (parts.length >= 2) {
        candidates.push({
          name: parts[0],
          email: parts[1],
          phone: parts[2] || undefined
        });
      }
    }

    if (candidates.length === 0) {
      toast.error('未识别到有效候选人数据');
      return;
    }

    onImport(candidates);
    toast.success(`已导入 ${candidates.length} 位候选人`);
  };

  return (
    <div className="space-y-4">
      <Label>批量导入候选人</Label>
      <Textarea
        placeholder="每行一位候选人，格式：姓名 邮箱 手机（可选）&#10;例如：&#10;张三 zhangsan@example.com 13800138000&#10;李四 lisi@example.com"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        className="font-mono text-sm"
      />
      <Button onClick={handleParse} variant="outline" type="button">
        解析并导入
      </Button>
    </div>
  );
}
