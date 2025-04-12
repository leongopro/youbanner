"use client";

import BannerForm from '@/components/BannerForm';

export default function CreatePage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">创建YouTube Banner</h1>
        <p className="text-metal-text-secondary mt-2">
          填写以下信息，自动生成专业的YouTube频道Banner
        </p>
      </div>
      
      <BannerForm />
    </div>
  );
} 