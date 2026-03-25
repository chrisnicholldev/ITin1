import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil, Trash2, FileText, BookOpen, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { getFolders, getArticles, createFolder, updateFolder, deleteFolder, deleteArticle } from '@/api/docs';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole, type DocFolderResponse, type ArticleResponse } from '@itdesk/shared';

const FOLDER_ICONS: Record<string, string> = {
  folder: '📁', network: '🌐', server: '🖥️', security: '🔒',
  people: '👥', document: '📄', settings: '⚙️', cloud: '☁️',
};

function FolderModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: DocFolderResponse }) {
  const [name, setName] = useState(editing?.name ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [icon, setIcon] = useState(editing?.icon ?? 'folder');
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: () => editing
      ? updateFolder(editing.id, { name, description, icon })
      : createFolder({ name, description, icon, sortOrder: 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docs', 'folders'] });
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Folder' : 'New Folder'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Network Infrastructure" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
          </div>
          <div className="space-y-1.5">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(FOLDER_ICONS).map(([key, emoji]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcon(key)}
                  className={`w-9 h-9 rounded border text-lg flex items-center justify-center ${icon === key ? 'border-primary bg-primary/10' : 'border-border'}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutate()} disabled={!name.trim() || isPending}>
            {isPending ? 'Saving...' : editing ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DocsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === UserRole.IT_ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<DocFolderResponse | undefined>();

  const { data: folders = [] } = useQuery<DocFolderResponse[]>({
    queryKey: ['docs', 'folders'],
    queryFn: getFolders,
  });

  const { data: articlesData } = useQuery({
    queryKey: ['docs', 'articles', { folderId: selectedFolder, search }],
    queryFn: () => getArticles({
      ...(selectedFolder && { folderId: selectedFolder }),
      ...(search && { search }),
      limit: 50,
    }),
  });
  const articles: ArticleResponse[] = articlesData?.data ?? [];

  const { mutate: doDeleteFolder } = useMutation({
    mutationFn: deleteFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docs', 'folders'] });
      if (selectedFolder) setSelectedFolder(null);
    },
    onError: (e: any) => alert(e?.response?.data?.message ?? 'Could not delete folder'),
  });

  const { mutate: doDeleteArticle } = useMutation({
    mutationFn: deleteArticle,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['docs', 'articles'] }),
  });

  const activeFolder = folders.find((f) => f.id === selectedFolder);

  return (
    <div className="flex gap-6 h-full">
      {/* Sidebar — folder list */}
      <aside className="w-56 flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Folders</h2>
          {isAdmin && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingFolder(undefined); setFolderModalOpen(true); }}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <button
          onClick={() => setSelectedFolder(null)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${!selectedFolder ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
        >
          <BookOpen className="h-4 w-4" />
          <span className="flex-1 text-left">All Articles</span>
        </button>

        {folders.map((folder) => (
          <div key={folder.id} className="group relative">
            <button
              onClick={() => setSelectedFolder(folder.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${selectedFolder === folder.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <span>{FOLDER_ICONS[folder.icon ?? 'folder'] ?? '📁'}</span>
              <span className="flex-1 text-left truncate">{folder.name}</span>
              <span className="text-xs opacity-60">{folder.articleCount}</span>
            </button>
            {isAdmin && (
              <div className="absolute right-1 top-1 hidden group-hover:flex gap-0.5">
                <button
                  className="p-1 rounded hover:bg-muted-foreground/20"
                  onClick={(e) => { e.stopPropagation(); setEditingFolder(folder); setFolderModalOpen(true); }}
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  className="p-1 rounded hover:bg-destructive/20 hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); if (confirm(`Delete folder "${folder.name}"?`)) doDeleteFolder(folder.id); }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        ))}

        {folders.length === 0 && (
          <p className="text-xs text-muted-foreground px-3 py-2">No folders yet.</p>
        )}
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="h-6 w-6" />
              {activeFolder ? activeFolder.name : 'Documentation'}
            </h1>
            {activeFolder?.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{activeFolder.description}</p>
            )}
          </div>
          {isAdmin && (
            <Button onClick={() => navigate(`/docs/articles/new${selectedFolder ? `?folder=${selectedFolder}` : ''}`)}>
              <Plus className="h-4 w-4 mr-1" /> New Article
            </Button>
          )}
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search articles..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {articles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              {search ? 'No articles match your search.' : 'No articles in this folder yet.'}
              {isAdmin && !search && (
                <div className="mt-3">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/docs/articles/new${selectedFolder ? `?folder=${selectedFolder}` : ''}`)}>
                    Write the first article
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {articles.map((article) => (
              <Link key={article.id} to={`/docs/articles/${article.slug}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{article.title}</p>
                            {!article.published && (
                              <Badge variant="outline" className="text-xs">Draft</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {!selectedFolder && (
                              <span className="text-xs text-muted-foreground">
                                {FOLDER_ICONS[article.folder?.icon ?? 'folder'] ?? '📁'} {article.folder?.name}
                              </span>
                            )}
                            {article.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-muted-foreground hidden sm:block">
                          {new Date(article.updatedAt).toLocaleDateString()}
                        </span>
                        {isAdmin && (
                          <div className="flex gap-1" onClick={(e) => e.preventDefault()}>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navigate(`/docs/articles/${article.slug}/edit`)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 hover:text-destructive"
                              onClick={() => { if (confirm(`Delete "${article.title}"?`)) doDeleteArticle(article.slug); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <FolderModal
        open={folderModalOpen}
        onClose={() => { setFolderModalOpen(false); setEditingFolder(undefined); }}
        editing={editingFolder}
      />
    </div>
  );
}
