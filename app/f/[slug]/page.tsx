"use client";

import { useParams } from "next/navigation";
import PublicForm from "@/components/campaigns/PublicForm";

export default function PublicFormPage() {
  const params = useParams();
  const slug = params?.slug as string;

  if (!slug) return null;

  return <PublicForm slug={slug} />;
}
