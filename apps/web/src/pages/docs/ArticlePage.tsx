import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Calendar, User, FolderOpen, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getArticle } from '@/api/docs';
import { TipTapRenderer } from '@/components/docs/TipTapEditor';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole, type ArticleResponse } from '@itdesk/shared';

const FOLDER_ICONS: Record<string, string> = {
  folder: '📁', network: '🌐', server: '🖥️', security: '🔒',
  people: '👥', document: '📄', settings: '⚙️', cloud: '☁️',
};

export function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === UserRole.IT_ADMIN || user?.role === UserRole.SUPER_ADMIN;

  const { data: article, isLoading, isError } = useQuery<ArticleResponse>({
    queryKey: ['docs', 'articles', slug],
    queryFn: () => getArticle(slug!),
    enabled: !!slug,
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  if (isError || !article) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground mb-4">Article not found.</p>
        <Button variant="outline" onClick={() => navigate('/docs')}>Back to Docs</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 mb-1 text-muted-foreground" onClick={() => navigate('/docs')}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
          <h1 className="text-2xl font-bold">{article.title}</h1>
          {!article.published && (
            <Badge variant="outline">Draft</Badge>
          )}
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={() => navigate(`/docs/articles/${slug}/edit`)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
        )}
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground border-b pb-4">
        {article.folder && (
          <span className="flex items-center gap-1">
            <FolderOpen className="h-3.5 w-3.5" />
            {FOLDER_ICONS[article.folder.icon ?? 'folder'] ?? '📁'} {article.folder.name}
          </span>
        )}
        {article.createdBy && (
          <span className="flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            {article.createdBy.displayName}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          Updated {new Date(article.updatedAt).toLocaleDateString()}
        </span>
        {article.tags?.length > 0 && (
          <span className="flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" />
            {article.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="prose prose-sm max-w-none">
        <TipTapRenderer content={article.body} />
      </div>

      {/* Linked assets */}
      {article.linkedAssets?.length > 0 && (
        <div className="border-t pt-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Linked Assets</p>
          <div className="flex flex-wrap gap-2">
            {article.linkedAssets.map((a: any) => (
              <Link key={a.id} to={`/assets/${a.id}`}>
                <Badge variant="outline" className="cursor-pointer hover:border-primary">{a.name}</Badge>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Linked location */}
      {article.linkedLocation && (
        <div className="border-t pt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Location</p>
          <p className="text-sm">{(article.linkedLocation as any).name}</p>
        </div>
      )}
    </div>
  );
}
