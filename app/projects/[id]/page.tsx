import { ProjectDetail } from "@/components/projects/ProjectDetail";

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  return <ProjectDetail projectId={params.id} />;
}
